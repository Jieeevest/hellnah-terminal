// Strategi "F3" hasil backtest 3 tahun (Sep 2023 – Sep 2026): long saat rata-rata 3 funding
// terakhir yang SUDAH dibayar ≤ −0,03%, masuk di awal jam berikutnya, tahan 72 jam, satu posisi
// per koin. Dipakai bersama oleh panel Funding Squeeze (frontend) dan pencatat forward-test
// (server/src/engine/fundingShadow.ts). Semua angka & daftar koin sengaja disamakan persis dengan
// backtest — jangan diubah tanpa backtest ulang, karena di luar kondisi ini strategi belum diuji.
export const F3_THRESHOLD = -0.0003
export const F3_HOLD_MS = 72 * 3600e3
export const F3_ENTRY_WINDOW_MS = 3600e3
// Biaya taker pulang-pergi + perkiraan slippage — sama dengan asumsi backtest.
export const F3_FEE_ROUNDTRIP = 0.0015
export const F3_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
  'LTCUSDT', 'BCHUSDT', 'TRXUSDT', 'ATOMUSDT', 'NEARUSDT', 'FILUSDT', 'ETCUSDT', 'UNIUSDT', 'AAVEUSDT', 'INJUSDT',
  'APTUSDT', 'ARBUSDT', 'OPUSDT', 'SUIUSDT', '1000PEPEUSDT', '1000SHIBUSDT', 'WLDUSDT', 'TIAUSDT', 'LDOUSDT', 'CRVUSDT',
  'RUNEUSDT', 'SANDUSDT', 'GALAUSDT', 'FETUSDT', 'SEIUSDT',
]

export interface FundingPoint {
  time: number
  rate: number
}

export interface F3Window {
  signalTime: number
  entryTime: number
  exitTime: number
}

export function avgLast3(fundings: FundingPoint[]): number | null {
  if (fundings.length < 3) return null
  return (fundings[fundings.length - 1].rate + fundings[fundings.length - 2].rate + fundings[fundings.length - 3].rate) / 3
}

// Rekonstruksi aturan backtest dari riwayat funding (urut lama → baru): sinyal dicek di tiap
// settlement, masuk di awal jam berikutnya, sinyal lain di koin yang sama diabaikan sampai
// posisi 72 jam itu selesai. Mengembalikan posisi yang masih berjalan pada waktu `now`.
export function findActiveF3Window(fundings: FundingPoint[], now: number): F3Window | null {
  let busyUntil = -Infinity
  let active: F3Window | null = null
  for (let i = 2; i < fundings.length; i++) {
    const avg = (fundings[i].rate + fundings[i - 1].rate + fundings[i - 2].rate) / 3
    const settleHour = Math.floor(fundings[i].time / 3600e3) * 3600e3
    const entryTime = settleHour + 3600e3
    if (entryTime <= busyUntil || avg > F3_THRESHOLD) continue
    busyUntil = entryTime + F3_HOLD_MS
    if (now < busyUntil) active = { signalTime: settleHour, entryTime, exitTime: busyUntil }
  }
  return active
}

// Long membayar funding positif dan menerima funding negatif — sama seperti di backtest.
export function longFundingPnl(fundings: FundingPoint[], fromExclusive: number, toInclusive: number): number {
  return fundings.filter((f) => f.time > fromExclusive && f.time <= toInclusive).reduce((a, f) => a - f.rate, 0)
}

// ── Bentuk data yang dikirim server lewat SSE (/api/funding-stream) ke panel Funding Squeeze ──

export interface F3TradeInfo extends F3Window {
  symbol: string
  signalAvg: number
  entryPrice: number | null
}

export interface F3ClosedTrade extends F3TradeInfo {
  entryPrice: number
  exitPrice: number
  priceRet: number
  fundingPnl: number
  ret: number
  closedAt: number
}

export interface F3Row {
  symbol: string
  avg24: number
  lastSettleTime: number
  // Proyeksi rata-rata kalau funding yang sedang berjalan dibayar apa adanya — cuma peringatan dini.
  projectedAvg: number | null
  trade: (F3TradeInfo & { fundingSinceEntry: number }) | null
}

export interface F3ShadowSummary {
  startedAt: number
  closedCount: number
  avgRet: number | null
  winRate: number | null
  totalRet: number
  weeks: number
  positiveWeeks: number
  open: F3TradeInfo[]
  recent: F3ClosedTrade[]
}

export interface F3Snapshot {
  updatedAt: number
  rows: F3Row[]
  summary: F3ShadowSummary
}
