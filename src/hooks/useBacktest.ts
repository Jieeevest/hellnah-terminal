import { useState, useCallback } from 'react'
import axios from 'axios'
import type { Exchange, MarketType } from '@/types'
import type { Candle } from '@/lib/indicators'
import { generateSignal, type Direction } from '@/lib/signals'
import type { SignalTimeframe } from './useSignalData'
import { API_URLS } from '@/constants/apiUrls'

export interface BtTrade {
  index: number
  time: number
  direction: Direction
  confluence: number
  pattern: string
  entryPrice: number
  exitPrice: number
  pnl: number           // in %
  win: boolean
  exitReason: 'TP' | 'SL' | 'TIME'
}

export interface BtResult {
  trades: BtTrade[]
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  totalPnl: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  maxDrawdown: number
  equityCurve: number[]   // cumulative pnl per trade
  byDir: Record<string, { wins: number; total: number }>
  timeframe: SignalTimeframe
  candlesUsed: number
  fromTime: number
  toTime: number
}

export interface BtParams {
  timeframe: SignalTimeframe
  tp: number          // e.g. 2 → 2%
  sl: number          // e.g. 1 → 1%
  lookforward: number // candles ahead
  minConfluence: number
}

// ── fetch 1000 candles ──────────────────────────────────────────
async function fetchHistorical(
  symbol: string,
  exchange: Exchange,
  marketType: MarketType,
  interval: SignalTimeframe
): Promise<Candle[]> {
  const LIMIT = 1000
  try {
    switch (exchange) {
      case 'binance': {
        const base = marketType === 'futures'
          ? API_URLS.binance.futures
          : API_URLS.binance.spot
        const { data } = await axios.get(`${base}/klines`, { params: { symbol, interval, limit: LIMIT } })
        return (data as any[]).map((d) => ({
          time: d[0], open: +d[1], high: +d[2], low: +d[3], close: +d[4], volume: +d[5],
        }))
      }
      case 'kucoin': {
        if (marketType === 'futures') {
          const gran = ({ '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240 } as Record<string, number>)[interval]!
          const to = Date.now()
          const from = to - gran * 60_000 * LIMIT
          const { data } = await axios.get(`${API_URLS.kucoin.futures}/kline/query`, {
            params: { symbol, granularity: gran, from, to },
          })
          return ((data?.data ?? []) as any[]).map((d: any) => ({
            time: d[0], open: +d[1], high: +d[3], low: +d[4], close: +d[2], volume: +d[5],
          }))
        } else {
          const type = ({ '5m': '5min', '15m': '15min', '30m': '30min', '1h': '1hour', '4h': '4hour' } as Record<string, string>)[interval]!
          const { data } = await axios.get(`${API_URLS.kucoin.spot}/market/candles`, {
            params: { symbol, type },
          })
          return ((data?.data ?? []) as any[]).reverse().map((d: any) => ({
            time: parseInt(d[0]) * 1000, open: +d[1], close: +d[2], high: +d[3], low: +d[4], volume: +d[5],
          }))
        }
      }
      case 'okx': {
        const bar = ({ '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H' } as Record<string, string>)[interval]!
        const { data } = await axios.get(`${API_URLS.okx.market}/candles`, {
          params: { instId: symbol, bar, limit: LIMIT },
        })
        return ((data?.data ?? []) as any[]).reverse().map((d: any) => ({
          time: +d[0], open: +d[1], high: +d[2], low: +d[3], close: +d[4], volume: +d[5],
        }))
      }
      case 'cryptocom': {
        const { data } = await axios.get(`${API_URLS.cryptoCom.public}/get-candlestick`, {
          params: { instrument_name: symbol, timeframe: interval, count: LIMIT },
        })
        return ((data?.result?.data ?? []) as any[]).reverse().map((d: any) => ({
          time: d.t, open: +d.o, high: +d.h, low: +d.l, close: +d.c, volume: +d.v,
        }))
      }
    }
  } catch {
    return []
  }
}

// ── backtest engine ─────────────────────────────────────────────
function runEngine(candles: Candle[], params: BtParams): BtResult {
  const { tp, sl, lookforward, minConfluence, timeframe } = params
  const tpDec = tp / 100
  const slDec = sl / 100
  const MIN_LB = 60
  const trades: BtTrade[] = []

  let i = MIN_LB
  while (i < candles.length - lookforward) {
    const sig = generateSignal(candles.slice(0, i + 1))
    if (!sig || sig.direction === 'NEUTRAL' || sig.confluence < minConfluence) {
      i++
      continue
    }

    const isBuy = sig.direction === 'BUY' || sig.direction === 'STRONG_BUY'
    const entry = candles[i].close
    const tpPrice = isBuy ? entry * (1 + tpDec) : entry * (1 - tpDec)
    const slPrice = isBuy ? entry * (1 - slDec) : entry * (1 + slDec)

    let exitPrice = candles[i + lookforward].close
    let exitReason: BtTrade['exitReason'] = 'TIME'

    for (let j = i + 1; j <= i + lookforward; j++) {
      const c = candles[j]
      if (isBuy) {
        if (c.low  <= slPrice) { exitPrice = slPrice; exitReason = 'SL'; break }
        if (c.high >= tpPrice) { exitPrice = tpPrice; exitReason = 'TP'; break }
      } else {
        if (c.high >= slPrice) { exitPrice = slPrice; exitReason = 'SL'; break }
        if (c.low  <= tpPrice) { exitPrice = tpPrice; exitReason = 'TP'; break }
      }
    }

    const pnl = isBuy
      ? (exitPrice - entry) / entry * 100
      : (entry - exitPrice) / entry * 100

    trades.push({
      index: i,
      time: candles[i].time,
      direction: sig.direction,
      confluence: sig.confluence,
      pattern: sig.pattern.name,
      entryPrice: entry,
      exitPrice,
      pnl,
      win: pnl > 0,
      exitReason,
    })

    // skip forward so trades don't overlap heavily
    i += Math.max(1, Math.floor(lookforward / 2))
  }

  if (!trades.length) {
    return {
      trades: [], totalTrades: 0, wins: 0, losses: 0, winRate: 0,
      totalPnl: 0, avgWin: 0, avgLoss: 0, profitFactor: 0,
      maxDrawdown: 0, equityCurve: [], byDir: {}, timeframe,
      candlesUsed: candles.length,
      fromTime: candles[0]?.time ?? 0,
      toTime: candles[candles.length - 1]?.time ?? 0,
    }
  }

  const wins   = trades.filter((t) => t.win).length
  const losses = trades.length - wins
  const winPnls  = trades.filter((t) => t.win).map((t) => t.pnl)
  const lossPnls = trades.filter((t) => !t.win).map((t) => Math.abs(t.pnl))
  const avgWin  = winPnls.length  ? winPnls.reduce((a, b) => a + b, 0)  / winPnls.length  : 0
  const avgLoss = lossPnls.length ? lossPnls.reduce((a, b) => a + b, 0) / lossPnls.length : 0
  const totalPnl = trades.reduce((a, t) => a + t.pnl, 0)
  const grossWin  = winPnls.reduce((a, b) => a + b, 0)
  const grossLoss = lossPnls.reduce((a, b) => a + b, 0)
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : 999

  // equity curve + max drawdown
  let cum = 0, peak = 0, maxDD = 0
  const equityCurve: number[] = []
  for (const t of trades) {
    cum += t.pnl
    equityCurve.push(parseFloat(cum.toFixed(3)))
    if (cum > peak) peak = cum
    const dd = peak - cum
    if (dd > maxDD) maxDD = dd
  }

  // by direction
  const byDir: Record<string, { wins: number; total: number }> = {}
  for (const t of trades) {
    if (!byDir[t.direction]) byDir[t.direction] = { wins: 0, total: 0 }
    byDir[t.direction].total++
    if (t.win) byDir[t.direction].wins++
  }

  return {
    trades, totalTrades: trades.length, wins, losses, winRate: (wins / trades.length) * 100,
    totalPnl, avgWin, avgLoss, profitFactor, maxDrawdown: maxDD,
    equityCurve, byDir, timeframe,
    candlesUsed: candles.length,
    fromTime: candles[MIN_LB]?.time ?? 0,
    toTime: candles[candles.length - 1]?.time ?? 0,
  }
}

// ── hook ────────────────────────────────────────────────────────
export function useBacktest(symbol: string, exchange: Exchange, marketType: MarketType) {
  const [result, setResult] = useState<BtResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [progress, setProgress] = useState('')

  const run = useCallback(async (params: BtParams) => {
    if (!symbol) return
    setLoading(true)
    setError(null)
    setResult(null)
    setProgress('Mengambil data historis...')

    try {
      const candles = await fetchHistorical(symbol, exchange, marketType, params.timeframe)
      if (candles.length < 100) { setError('Data historis tidak cukup dari exchange ini'); setLoading(false); return }

      setProgress(`Menjalankan backtest pada ${candles.length} candle...`)
      await new Promise((r) => setTimeout(r, 20))

      const res = runEngine(candles, params)
      setResult(res)
      setProgress('')
    } catch {
      setError('Gagal mengambil data historis')
    } finally {
      setLoading(false)
    }
  }, [symbol, exchange, marketType])

  return { result, loading, error, progress, run }
}
