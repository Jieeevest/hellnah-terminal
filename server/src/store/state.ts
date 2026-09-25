import fs from 'node:fs'
import path from 'node:path'
import type { DailyGuardState } from '../risk/dailyGuard.js'
import type { PositionSide } from '../risk/liquidation.js'
import type { Timeframe } from '../marketData/binancePublic.js'

// Single bracket TP1/SL (TP1 nutup qty PENUH) — SL statis dari entry sampai posisi
// ditutup, gak ada lagi staircase/trailing multi-tahap (lihat futuresEngine.ts).
export interface OpenPosition {
  id: string
  symbol: string
  side: PositionSide
  entry: number
  qty: number
  qtyRemaining: number
  leverage: number
  margin: number
  stopLoss: number
  takeProfit1: number
  tickSize: number
  stepSize: number
  primaryTimeframe: Timeframe
  openedAt: number
  // Cuma keisi di TRADING_MODE=live — algoId order bracket beneran di Binance (Algo Order
  // API /fapi/v1/algoOrder, STOP_MARKET & TAKE_PROFIT_MARKET closePosition=true) yang
  // dipantau tickPositionsLive tiap tick. Bukan orderId klasik (lihat binanceFutures.ts).
  slAlgoId?: number
  tpAlgoId?: number
  // Posisi ini awalnya sinyal SHORT tapi dibalik jadi LONG (lihat HARD_LIMITS.shortToLongFlipSymbols)
  // -- dipakai buat nge-track flipLongSlCount per simbol pas posisi ini ditutup.
  flippedFromShort?: boolean
  // Floating PnL — diupdate tiap tick (tickPositions, ~15 detik sekali) dari mark price live.
  markPrice: number
  unrealizedPnlUsd: number
  unrealizedPnlPct: number // relatif terhadap margin, bukan notional
  // Snapshot analisa saat entry — dibawa sampai posisi ditutup supaya trade log
  // (server/data/trades.jsonl) tetap punya konteks "kenapa masuk", bukan cuma angka hasil.
  entryRankingScore: number
  entryAccuracyPct: number
  entryConfidenceLabel: string
  entryRiskReward: number
  entryContextLabel: string
  entrySummary: string
}

export interface ClosedTrade {
  id: string
  symbol: string
  side: PositionSide
  entry: number
  exitPrice: number
  exitReason: 'SL' | 'TP1' | 'TIME_STOP' | 'MAX_HOLD' | 'MANUAL'
  realizedPnlUsd: number
  rMultiple: number
  openedAt: number
  closedAt: number
}

export interface ActivityEntry {
  timestamp: number
  message: string
}

// Posisi lain yang ada di akun Binance TAPI BUKAN dibuka/dikelola bot ini (mis. posisi
// manual user) — read-only buat ditampilkan, SENGAJA terpisah dari OpenPosition/openPositions
// supaya gak ikut kehitung ke limit bot (maxConcurrentPositions, maxTotalMarginPct, dst)
// dan gak pernah disentuh logic tickPositionsLive (gak ada slAlgoId/tpAlgoId beneran).
export interface ExternalPosition {
  symbol: string
  side: PositionSide
  qty: number
  entryPrice: number
  leverage: number
  unrealizedProfit: number
  liquidationPrice: number
}

const MAX_ACTIVITY_LOG = 200

export interface AppState {
  enabled: boolean
  // Diisi ulang tiap startup dari CONFIG.tradingMode (index.ts) — SENGAJA gak dipersist
  // sebagai sumber kebenaran dari state.json lama, supaya selalu cerminan config aktif
  // saat proses ini jalan, bukan sisa mode sebelumnya.
  tradingMode: string
  equity: number
  dailyGuard: DailyGuardState
  openPositions: OpenPosition[]
  closedTrades: ClosedTrade[]
  // Cuma keisi di TRADING_MODE=live (lihat refreshExternalPositions di livePositionManager.ts).
  externalPositions: ExternalPosition[]
  symbolCooldownUntil: Record<string, number>
  lastSeenLabel: Record<string, string>
  activityLog: ActivityEntry[]
  updatedAt: number
  // Hitungan SL pada posisi flip-short-jadi-long (lihat HARD_LIMITS.shortToLongFlipSymbols)
  // per simbol -- begitu nyampe HARD_LIMITS.flipLongSlBreaker, simbol itu dihindari total
  // (gak di-flip lagi, gak di-short juga) sampai di-reset manual.
  flipLongSlCount: Record<string, number>
}

// Dipanggil dari log() di index.ts — supaya "apa yang lagi dikerjain sekarang" (scan
// jalan, simbol ditolak gate, posisi dibuka/ditutup) ikut ke-broadcast ke FE lewat SSE,
// bukan cuma nyangkut di console server.
export function pushActivity(state: AppState, message: string, nowMs: number): void {
  state.activityLog.push({ timestamp: nowMs, message })
  if (state.activityLog.length > MAX_ACTIVITY_LOG) {
    state.activityLog.splice(0, state.activityLog.length - MAX_ACTIVITY_LOG)
  }
}

const DATA_DIR = path.join(process.cwd(), 'data')
const STATE_FILE = path.join(DATA_DIR, 'state.json')

export function createInitialState(startingEquity: number, nowMs: number): AppState {
  return {
    enabled: false,
    tradingMode: 'paper',
    equity: startingEquity,
    dailyGuard: {
      dayKeyUtc: new Date(nowMs).toISOString().slice(0, 10),
      equityAtOpen: startingEquity,
      realizedPnl: 0,
      consecutiveLosses: 0,
      cooldownUntil: null,
    },
    openPositions: [],
    closedTrades: [],
    externalPositions: [],
    symbolCooldownUntil: {},
    lastSeenLabel: {},
    activityLog: [],
    updatedAt: nowMs,
    flipLongSlCount: {},
  }
}

export function loadState(startingEquity: number, nowMs: number): AppState {
  if (!fs.existsSync(STATE_FILE)) return createInitialState(startingEquity, nowMs)
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as AppState
    if (!parsed.activityLog) parsed.activityLog = [] // backward-compat state.json lama
    if (!parsed.externalPositions) parsed.externalPositions = []
    if (!parsed.flipLongSlCount) parsed.flipLongSlCount = {}
    return parsed
  } catch {
    // File korup/kosong — jangan crash, mulai dari state fresh daripada macet total.
    return createInitialState(startingEquity, nowMs)
  }
}

export function saveState(state: AppState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  // Nama tmp file unik per-proses+per-write (bukan cuma `${STATE_FILE}.tmp` yang dulu
  // dipakai bareng-bareng) — waktu tsx watch restart, sempat ada 2 proses hidup
  // bersamaan sebentar (proses lama belum sempat exit), dan kalau nama tmp-nya sama,
  // proses kedua bisa nimpa tmp file proses pertama sebelum sempat di-rename -> rename
  // gagal (ENOENT) atau state ke-overwrite jadi state proses yang salah.
  const tmpFile = `${STATE_FILE}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2))
  fs.renameSync(tmpFile, STATE_FILE) // rename atomic — hindari file.json korup kalau proses mati di tengah write
}
