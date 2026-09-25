// Strategi F3 "Funding Squeeze" di server (lihat src/lib/fundingSqueeze.ts). Dua peran:
// 1) Forward-test shadow-only — TIDAK PERNAH eksekusi order, TIDAK menyentuh state.json/trades.jsonl,
//    independen dari strategi bot, jalan terlepas dari state.enabled. Harga masuk/keluar & funding
//    dihitung persis seperti backtest: masuk = open candle 1h setelah settlement, keluar = close
//    candle ke-72 setelah masuk.
// 2) Sumber data panel Funding Squeeze — snapshot tiap siklus disiarkan lewat SSE
//    (/api/funding-stream), jadi browser tidak perlu polling Binance sendiri.
import fs from 'node:fs'
import path from 'node:path'
import {
  F3_SYMBOLS, F3_FEE_ROUNDTRIP, F3_HOLD_MS, avgLast3, findActiveF3Window, longFundingPnl,
  type FundingPoint, type F3TradeInfo, type F3ClosedTrade, type F3Row, type F3ShadowSummary, type F3Snapshot,
} from '../../../src/lib/fundingSqueeze.js'
import { fetchAllPremiumIndex } from '../marketData/binancePublic.js'

const BASE = 'https://fapi.binance.com'
const DATA_DIR = path.join(process.cwd(), 'data')
const OPEN_FILE = path.join(DATA_DIR, 'funding-shadow-open.json')
const CLOSED_FILE = path.join(DATA_DIR, 'funding-shadow-closed.jsonl')
const META_FILE = path.join(DATA_DIR, 'funding-shadow-meta.json')
const BATCH = 7
const HOUR = 3600e3
// 25 settlement: koin dengan funding tiap 4 jam butuh ≥18 titik supaya masa tahan 72 jam tercakup.
const FUNDING_HISTORY = 25

function loadOpen(): F3TradeInfo[] {
  if (!fs.existsSync(OPEN_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(OPEN_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveOpen(open: F3TradeInfo[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(OPEN_FILE, JSON.stringify(open, null, 2))
}

function readClosed(): F3ClosedTrade[] {
  if (!fs.existsSync(CLOSED_FILE)) return []
  return fs.readFileSync(CLOSED_FILE, 'utf-8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function appendClosed(trade: F3ClosedTrade): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.appendFileSync(CLOSED_FILE, JSON.stringify(trade) + '\n')
}

function startedAt(): number {
  if (fs.existsSync(META_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(META_FILE, 'utf-8')).startedAt
    } catch {
      // meta rusak — tulis ulang di bawah
    }
  }
  const now = Date.now()
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(META_FILE, JSON.stringify({ startedAt: now }))
  return now
}

async function getJson(pathAndQuery: string): Promise<any> {
  const res = await fetch(`${BASE}${pathAndQuery}`)
  if (!res.ok) throw new Error(`Binance ${pathAndQuery} -> HTTP ${res.status}`)
  return res.json()
}

async function fetchFundings(symbol: string, startTime?: number): Promise<FundingPoint[]> {
  const query = startTime != null ? `startTime=${startTime}&limit=100` : `limit=${FUNDING_HISTORY}`
  const data = await getJson(`/fapi/v1/fundingRate?symbol=${symbol}&${query}`)
  return (data as { fundingTime: number; fundingRate: string }[]).map((d) => ({ time: d.fundingTime, rate: parseFloat(d.fundingRate) }))
}

async function fetchHourBar(symbol: string, time: number): Promise<{ open: number; close: number } | null> {
  const data = await getJson(`/fapi/v1/klines?symbol=${symbol}&interval=1h&startTime=${time}&limit=1`)
  const row = (data as string[][])[0]
  return row && Number(row[0]) === time ? { open: parseFloat(row[1]), close: parseFloat(row[4]) } : null
}

const coinOf = (symbol: string) => symbol.replace(/USDT$/, '')
const pct = (x: number, digits = 2) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(digits)}%`

// ── Snapshot untuk SSE ─────────────────────────────────────────────────────────
let snapshot: F3Snapshot | null = null
const listeners = new Set<(s: F3Snapshot) => void>()

export function getFundingSnapshot(): F3Snapshot | null {
  return snapshot
}

export function onFundingSnapshot(listener: (s: F3Snapshot) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getFundingShadowSummary(): F3ShadowSummary {
  const closed = readClosed()
  const byWeek = new Map<number, number>()
  for (const t of closed) {
    const week = Math.floor(t.entryTime / (7 * 24 * HOUR))
    byWeek.set(week, (byWeek.get(week) ?? 0) + t.ret)
  }
  const n = closed.length
  return {
    startedAt: startedAt(),
    closedCount: n,
    avgRet: n ? closed.reduce((a, t) => a + t.ret, 0) / n : null,
    winRate: n ? closed.filter((t) => t.ret > 0).length / n : null,
    totalRet: closed.reduce((a, t) => a + t.ret, 0),
    weeks: byWeek.size,
    positiveWeeks: [...byWeek.values()].filter((v) => v > 0).length,
    open: loadOpen(),
    recent: closed.slice(-10).reverse(),
  }
}

export async function runFundingShadow(log: (msg: string) => void): Promise<void> {
  startedAt()
  const now = Date.now()
  const open = loadOpen()
  const known = new Set([...open, ...readClosed()].map((t) => `${t.symbol}-${t.entryTime}`))
  const fundingsBySymbol = new Map<string, FundingPoint[]>()

  // 1) Ambil funding semua koin (dipakai untuk snapshot panel) + catat sinyal baru —
  //    satu posisi per koin, sama seperti backtest.
  for (let i = 0; i < F3_SYMBOLS.length; i += BATCH) {
    await Promise.all(F3_SYMBOLS.slice(i, i + BATCH).map(async (symbol) => {
      try {
        const fundings = await fetchFundings(symbol)
        fundingsBySymbol.set(symbol, fundings)
        if (open.some((t) => t.symbol === symbol)) return
        const window = findActiveF3Window(fundings, now)
        if (!window || known.has(`${symbol}-${window.entryTime}`)) return
        const signalAvg = avgLast3(fundings.filter((f) => f.time < window.signalTime + HOUR)) ?? 0
        open.push({ symbol, ...window, signalAvg, entryPrice: null })
        log(`[Forward-test F3, bukan posisi bot] ${coinOf(symbol)}: sinyal long funding squeeze (funding ${pct(signalAvg, 3)}), masuk ${new Date(window.entryTime).toISOString().slice(0, 16)}Z`)
      } catch (e) {
        log(`F3 forward-test gagal cek ${symbol}: ${(e as Error).message}`)
      }
    }))
  }

  const stillOpen: F3TradeInfo[] = []
  for (const t of open) {
    try {
      // 2) Harga masuk = open candle jam masuk (tersedia begitu jam itu dimulai).
      if (t.entryPrice == null && now >= t.entryTime) {
        t.entryPrice = (await fetchHourBar(t.symbol, t.entryTime))?.open ?? null
      }
      // 3) Tutup = close candle yang mulai di exitTime, jadi baru bisa setelah candle itu selesai.
      if (t.entryPrice != null && now >= t.exitTime + HOUR) {
        const bar = await fetchHourBar(t.symbol, t.exitTime)
        if (bar) {
          const fundings = await fetchFundings(t.symbol, t.entryTime)
          const priceRet = bar.close / t.entryPrice - 1
          const fundingPnl = longFundingPnl(fundings, t.entryTime, t.entryTime + F3_HOLD_MS + 60_000)
          const ret = priceRet + fundingPnl - F3_FEE_ROUNDTRIP
          appendClosed({ ...t, entryPrice: t.entryPrice, exitPrice: bar.close, priceRet, fundingPnl, ret, closedAt: now })
          log(`[Forward-test F3, bukan posisi bot] ${coinOf(t.symbol)}: selesai 72 jam, hasil ${pct(ret)} (harga ${pct(priceRet)}, funding ${pct(fundingPnl, 3)})`)
          continue
        }
      }
    } catch (e) {
      log(`F3 forward-test gagal update ${t.symbol}: ${(e as Error).message}`)
    }
    stillOpen.push(t)
  }
  saveOpen(stillOpen)

  // 4) Snapshot panel. Proyeksi pakai funding yang sedang berjalan (premium index) — opsional,
  //    kalau gagal diambil panel tetap jalan tanpa peringatan dini.
  let predicted: Record<string, { fundingRatePct: number }> = {}
  try {
    predicted = await fetchAllPremiumIndex()
  } catch (e) {
    log(`F3 gagal ambil funding berjalan: ${(e as Error).message}`)
  }
  const rows: F3Row[] = []
  for (const symbol of F3_SYMBOLS) {
    const fundings = fundingsBySymbol.get(symbol)
    const avg24 = fundings ? avgLast3(fundings) : null
    if (!fundings || avg24 == null) continue
    const next = predicted[symbol]?.fundingRatePct
    const trade = stillOpen.find((t) => t.symbol === symbol)
    rows.push({
      symbol,
      avg24,
      lastSettleTime: fundings[fundings.length - 1].time,
      projectedAvg: next != null ? (fundings[fundings.length - 2].rate + fundings[fundings.length - 1].rate + next / 100) / 3 : null,
      trade: trade ? { ...trade, fundingSinceEntry: longFundingPnl(fundings, trade.entryTime, now) } : null,
    })
  }
  snapshot = { updatedAt: now, rows, summary: getFundingShadowSummary() }
  for (const listener of listeners) listener(snapshot)
}
