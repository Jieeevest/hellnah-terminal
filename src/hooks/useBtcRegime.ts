import { useState, useEffect } from 'react'
import { API_URLS } from '@/constants/apiUrls'

export type BtcRegimeKind = 'bull' | 'neutral' | 'bear'

export interface BtcRegime {
  kind: BtcRegimeKind
  price: number
  high30d: number
  drawdownPct: number
  sma50d: number
}

// Sama dengan rem BTC di bot (server HARD_LIMITS.btcBrakeDrawdownPct) supaya scanner & bot sejalan.
const BEAR_DRAWDOWN_PCT = 10
const REFRESH_MS = 15 * 60 * 1000

async function fetchBtcRegime(): Promise<BtcRegime> {
  const res = await fetch(`${API_URLS.binance.futures}/klines?symbol=BTCUSDT&interval=1d&limit=51`)
  if (!res.ok) throw new Error(`BTC klines HTTP ${res.status}`)
  const rows = (await res.json()) as unknown[][]
  const closes = rows.map((r) => parseFloat(r[4] as string))
  const highs = rows.map((r) => parseFloat(r[2] as string))
  const price = closes[closes.length - 1]
  const high30d = Math.max(...highs.slice(-30))
  const drawdownPct = ((high30d - price) / high30d) * 100
  const prevCloses = closes.slice(0, -1)
  const sma50d = prevCloses.reduce((a, b) => a + b, 0) / prevCloses.length
  const kind: BtcRegimeKind = drawdownPct >= BEAR_DRAWDOWN_PCT ? 'bear' : price > sma50d ? 'bull' : 'neutral'
  return { kind, price, high30d, drawdownPct, sma50d }
}

export function useBtcRegime(): BtcRegime | null {
  const [regime, setRegime] = useState<BtcRegime | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => fetchBtcRegime().then((r) => { if (!cancelled) setRegime(r) }).catch(() => {})
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  return regime
}
