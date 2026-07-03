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
      case 'kucoin': {
        if (marketType === 'futures') {
          const gran = { '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240 }[interval]!
          const to = Date.now()
          const from = to - gran * 60 * 1000 * 150
          const { data } = await axios.get(`${API_URLS.kucoin.futures}/kline/query`, {
            params: { symbol, granularity: gran, from, to },
          })
          return ((data?.data ?? []) as any[]).map((d: any) => ({
            time: d[0], open: parseFloat(d[1]), high: parseFloat(d[3]),
            low: parseFloat(d[4]), close: parseFloat(d[2]), volume: parseFloat(d[5]),
          }))
        } else {
          const type = { '5m': '5min', '15m': '15min', '30m': '30min', '1h': '1hour', '4h': '4hour' }[interval]!
          const { data } = await axios.get(`${API_URLS.kucoin.spot}/market/candles`, {
            params: { symbol, type },
          })
          return ((data?.data ?? []) as any[]).reverse().map((d: any) => ({
            time: parseInt(d[0]) * 1000, open: parseFloat(d[1]), close: parseFloat(d[2]),
            high: parseFloat(d[3]), low: parseFloat(d[4]), volume: parseFloat(d[5]),
          }))
        }
      }
      case 'okx': {
        const bar = { '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H' }[interval]!
        const { data } = await axios.get(`${API_URLS.okx.market}/candles`, {
          params: { instId: symbol, bar, limit: 150 },
        })
        return ((data?.data ?? []) as any[]).reverse().map((d: any) => ({
          time: parseInt(d[0]), open: parseFloat(d[1]), high: parseFloat(d[2]),
          low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]),
        }))
      }
      case 'cryptocom': {
        const { data } = await axios.get(
          `${API_URLS.cryptoCom.public}/get-candlestick`,
          { params: { instrument_name: symbol, timeframe: interval, count: 150 } }
        )
        return ((data?.result?.data ?? []) as any[]).reverse().map((d: any) => ({
          time: d.t, open: parseFloat(d.o), high: parseFloat(d.h),
          low: parseFloat(d.l), close: parseFloat(d.c), volume: parseFloat(d.v),
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
