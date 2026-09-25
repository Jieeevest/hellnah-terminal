import { CONFIG } from '../config/env.js'
import { HARD_LIMITS } from '../config/limits.js'
import {
  TIMEFRAMES,
  fetchMultiTimeframeCandles,
  fetchOpenInterestQuote,
  fetchTradableUsdtPerpetualSymbols,
  fetchSymbolOnboardDates,
  fetchAllTickers24hr,
  fetchAllSpreadPct,
  fetchAllPremiumIndex,
  type TickerStats,
  type PremiumIndexEntry,
} from '../marketData/binancePublic.js'
import { generateMTFSignal, analyzeFuturesSetup, type FuturesSetupAnalysis } from './signalEngine.js'
import { evaluateEntryGate, ENTRY_GATE_REASON_LABEL } from '../strategy/entryGate.js'
import { SL_PCT } from '../../../src/lib/futuresEngine.js'
import type { AppState } from '../store/state.js'

export interface ScanCandidate {
  symbol: string
  side: 'long' | 'short'
  analysis: FuturesSetupAnalysis
  quoteVolume24h: number
}

const BATCH_SIZE = 6
const BATCH_DELAY_MS = 300

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function computeBtcRegimeLabel(): Promise<string> {
  const candlesMap = await fetchMultiTimeframeCandles('BTCUSDT', TIMEFRAMES)
  const signal = generateMTFSignal(candlesMap, null, null)
  return signal?.label ?? 'Neutral'
}

interface BulkMarketData {
  tickers: Record<string, TickerStats>
  spreads: Record<string, number>
  premiumIndex: Record<string, PremiumIndexEntry>
}

// Bukan N request per simbol — 3 request ini masing-masing balikin data SEMUA simbol
// sekaligus, jadi scan "semua koin" tidak mengalikan jumlah request dengan ukuran watchlist.
async function fetchBulkMarketData(): Promise<BulkMarketData> {
  const [tickers, spreads, premiumIndex] = await Promise.all([
    fetchAllTickers24hr(),
    fetchAllSpreadPct(),
    fetchAllPremiumIndex(),
  ])
  return { tickers, spreads, premiumIndex }
}

// Simbol thin-liquidity yang di 41 jam observasi paper-trading pertama SELALU gagal capai
// TP1 sebelum kena SL (5 dari 5 posisi, -$100.38 gabungan dari total profit +$10.93) —
// dikeluarkan dari ranking otomatis sampai ada bukti perilakunya berubah.
const EXCLUDED_SYMBOLS = new Set(['1000RATSUSDT', 'IDOLUSDT', 'UAIUSDT'])

// 'all'   -> ranking semua pair USDT-M perpetual berdasarkan quote volume 24h, ambil top N.
// 'fixed' -> pakai WATCHLIST dari env apa adanya.
function resolveWatchlist(tradableSymbols: string[], bulk: BulkMarketData, onboardDates: Map<string, number>, nowMs: number): string[] {
  if (CONFIG.watchlistMode === 'fixed') return CONFIG.watchlist

  const minAgeMs = HARD_LIMITS.minListingAgeDays * 24 * 60 * 60 * 1000
  return tradableSymbols
    .filter((s) => !EXCLUDED_SYMBOLS.has(s))
    // Coin baru listing (< minListingAgeDays) belum punya cukup histori/rawan pump-dump
    // fase awal (lihat catatan HARD_LIMITS.minListingAgeDays) — kalau onboardDate gak ada
    // di data (jarang), sengaja LOLOS (fail-open) daripada nge-block simbol lama gara-gara
    // data hilang.
    .filter((s) => {
      const onboard = onboardDates.get(s)
      return onboard === undefined || nowMs - onboard >= minAgeMs
    })
    .sort((a, b) => (bulk.tickers[b]?.quoteVolume24h ?? 0) - (bulk.tickers[a]?.quoteVolume24h ?? 0))
    .slice(0, CONFIG.maxWatchlistSize)
}

interface MarketSnapshot {
  symbol: string
  candlesMap: Record<string, any>
  quoteVolume24h: number
  spreadPct: number
  fundingRatePct: number
  markPrice: number
  openInterestQuote: number
}

async function fetchSnapshot(symbol: string, bulk: BulkMarketData, log: (msg: string) => void): Promise<MarketSnapshot | null> {
  const ticker = bulk.tickers[symbol]
  const premium = bulk.premiumIndex[symbol]
  if (!ticker || !premium) return null // simbol baru listing / belum ada di snapshot bulk — skip aman

  try {
    const [candlesMap, openInterestQuote] = await Promise.all([
      fetchMultiTimeframeCandles(symbol, TIMEFRAMES),
      fetchOpenInterestQuote(symbol, premium.markPrice),
    ])
    return {
      symbol,
      candlesMap,
      quoteVolume24h: ticker.quoteVolume24h,
      spreadPct: bulk.spreads[symbol] ?? 1,
      fundingRatePct: premium.fundingRatePct,
      markPrice: premium.markPrice,
      openInterestQuote,
    }
  } catch (e) {
    log(`scan ${symbol} gagal: ${(e as Error).message}`)
    return null
  }
}

async function fetchSnapshotsBatched(symbols: string[], bulk: BulkMarketData, log: (msg: string) => void): Promise<MarketSnapshot[]> {
  const out: MarketSnapshot[] = []
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map((symbol) => fetchSnapshot(symbol, bulk, log)))
    for (const r of results) if (r) out.push(r)
    if (i + BATCH_SIZE < symbols.length) await delay(BATCH_DELAY_MS)
  }
  return out
}

// Gate auto-trade sengaja jauh lebih ketat daripada scanner FE biasa (rankingScore>=58
// di useFuturesOpportunities.ts) — lihat server/src/strategy/entryGate.ts.
export async function runScanCycle(state: AppState, log: (msg: string) => void): Promise<ScanCandidate[]> {
  const [btcLabel, tradableSymbols, bulk, onboardDates] = await Promise.all([
    computeBtcRegimeLabel(),
    fetchTradableUsdtPerpetualSymbols(),
    fetchBulkMarketData(),
    fetchSymbolOnboardDates(),
  ])

  const watchlist = resolveWatchlist(tradableSymbols, bulk, onboardDates, Date.now())
  log(`scan ${watchlist.length} simbol (mode: ${CONFIG.watchlistMode})`)

  const snapshots = await fetchSnapshotsBatched(watchlist, bulk, log)
  if (!snapshots.length) return []

  const maxVolume = Math.max(...snapshots.map((s) => s.quoteVolume24h), 0)
  const maxOpenInterest = Math.max(...snapshots.map((s) => s.openInterestQuote), 0)

  const candidates: ScanCandidate[] = []

  for (const snap of snapshots) {
    const signal = generateMTFSignal(snap.candlesMap, null, snap.fundingRatePct)
    const prevLabel = state.lastSeenLabel[snap.symbol] ?? null
    state.lastSeenLabel[snap.symbol] = signal?.label ?? 'Neutral'
    if (!signal || signal.label === 'Neutral') continue

    const ticker = {
      symbol: snap.symbol,
      volume: snap.quoteVolume24h,
      fundingRate: snap.fundingRatePct,
      openInterest: snap.openInterestQuote,
    } as any

    const analysis = analyzeFuturesSetup(ticker, signal, snap.candlesMap, maxVolume, maxOpenInterest)
    if (!analysis || !analysis.primaryPlan) continue

    const confirmedCandleCloses = prevLabel === signal.label ? 2 : 1
    const hasOpenPositionForSymbol = state.openPositions.some((p) => p.symbol === snap.symbol)
    const symbolCooldownActive = (state.symbolCooldownUntil[snap.symbol] ?? 0) > Date.now()
    const btcRegimeSafe = analysis.side === 'long' ? btcLabel !== 'Bearish' : btcLabel !== 'Bullish'
    // SL_PCT sekarang konstanta tetap (futuresEngine.ts) — SL beneran yang dipakai eksekusi
    // SELALU persis SL_PCT dari live entry price (dihitung ulang di positionManager.ts /
    // livePositionManager.ts, bukan dari plan.stopLoss). Pakai konstanta ini langsung,
    // bukan Math.abs(openHigh - plan.stopLoss)/openHigh — formula lama itu nyampur openHigh
    // (dipakai buat short) dengan stopLoss yang buat long dihitung dari openLow, jadi
    // ngukur selisih zona teknikal, BUKAN jarak SL 10% yang beneran bakal dipakai — banyak
    // nolak entry gara-gara measurement noise, bukan sinyal yang beneran di luar batas.
    const stopDistPct = SL_PCT

    const gate = evaluateEntryGate({
      label: signal.label,
      rankingScore: analysis.rankingScore,
      accuracyPct: analysis.accuracyPct,
      confidenceLabel: analysis.confidenceLabel,
      timeframeAlignment: analysis.alignment,
      riskReward: analysis.primaryPlan.riskReward,
      crowdednessLabel: analysis.crowdednessLabel,
      quoteVolume24h: snap.quoteVolume24h,
      spreadPct: snap.spreadPct,
      stopDistPct,
      btcRegimeSafe,
      confirmedCandleCloses,
      symbolWhitelisted: true,
      hasOpenPositionForSymbol,
      symbolCooldownActive,
    })
    if (!gate.pass) {
      const readableReasons = gate.reasons.map((r) => ENTRY_GATE_REASON_LABEL[r])
      const shown = readableReasons.slice(0, 3).join('; ')
      const more = readableReasons.length > 3 ? ` (+${readableReasons.length - 3} alasan lain)` : ''
      log(`${snap.symbol} ${analysis.side} ditolak: ${shown}${more}`)
      continue
    }

    candidates.push({ symbol: snap.symbol, side: analysis.side, analysis, quoteVolume24h: snap.quoteVolume24h })
  }

  return candidates
}
