import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import type { Exchange, MarketType } from '@/types'
import type { Candle } from '@/lib/indicators'
import { API_URLS } from '@/constants/apiUrls'

export const SIGNAL_TIMEFRAMES = ['5m', '15m', '30m', '1h', '4h'] as const
export type SignalTimeframe = typeof SIGNAL_TIMEFRAMES[number]

export async function fetchCandles(
  symbol: string,
  exchange: Exchange,
  marketType: MarketType,
  interval: SignalTimeframe
): Promise<Candle[]> {
  try {
    switch (exchange) {
      case 'binance': {
        const base = marketType === 'futures'
          ? API_URLS.binance.futures
          : API_URLS.binance.spot
        const { data } = await axios.get(`${base}/klines`, {
          params: { symbol, interval, limit: 150 },
        })
        return (data as any[]).map((d) => ({
          time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]),
          low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]),
        }))
      }
    }
  } catch {
    return []
  }
}

export type CandleMap = Record<SignalTimeframe, Candle[]>

export function useSignalData(
  symbol: string,
  exchange: Exchange,
  marketType: MarketType,
  currentPrice: number
) {
  const [baseCandles, setBaseCandles] = useState<CandleMap>({
    '5m': [], '15m': [], '30m': [], '1h': [], '4h': [],
  })
  const [loading, setLoading] = useState(false)

  // Full refresh every 30 s
  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    setLoading(true)

    const run = async () => {
      const results = await Promise.all(
        SIGNAL_TIMEFRAMES.map((tf) => fetchCandles(symbol, exchange, marketType, tf))
      )
      if (cancelled) return
      setBaseCandles({
        '5m': results[0], '15m': results[1], '30m': results[2],
        '1h': results[3],  '4h': results[4],
      })
      setLoading(false)
    }

    run()
    const id = setInterval(run, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [symbol, exchange, marketType])

  // Patch last candle with live price so signal recalculates on every tick
  const candles = useMemo((): CandleMap => {
    if (!currentPrice || currentPrice === 0) return baseCandles
    const patched: CandleMap = {} as CandleMap
    for (const tf of SIGNAL_TIMEFRAMES) {
      const arr = baseCandles[tf]
      if (!arr.length) { patched[tf] = arr; continue }
      const last = arr[arr.length - 1]
      patched[tf] = [
        ...arr.slice(0, -1),
        {
          ...last,
          close: currentPrice,
          high:  Math.max(last.high, currentPrice),
          low:   Math.min(last.low,  currentPrice),
        },
      ]
    }
    return patched
  }, [baseCandles, currentPrice])

  return { candles, loading }
}
