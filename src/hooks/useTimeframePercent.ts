import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import type { Exchange, MarketType } from '@/types'
import { API_URLS } from '@/constants/apiUrls'

const BATCH = 20

async function fetchOnePercent(
  symbol: string,
  exchange: Exchange,
  marketType: MarketType,
  interval: string
): Promise<number | null> {
  try {
    switch (exchange) {
      case 'binance': {
        const base = marketType === 'futures'
          ? API_URLS.binance.futures
          : API_URLS.binance.spot
        const { data } = await axios.get(`${base}/klines`, {
          params: { symbol, interval, limit: 1 },
        })
        if (!data?.[0]) return null
        const open = parseFloat(data[0][1])
        const close = parseFloat(data[0][4])
        return ((close - open) / open) * 100
      }
    }
  } catch {
    return null
  }
}

export function useTimeframePercent(
  symbols: string[],
  exchange: Exchange,
  marketType: MarketType,
  interval: string | null
) {
  const [percents, setPercents] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const fetchingRef = useRef(false)
  const cancelledRef = useRef(false)

  // stable key — only changes when exchange/marketType/interval change
  // or when the actual set of symbols changes (not just their order)
  const symbolsKey = [...symbols].sort().join(',')

  useEffect(() => {
    if (!interval || symbols.length === 0) {
      setPercents({})
      setLoading(false)
      return
    }

    if (fetchingRef.current) return

    cancelledRef.current = false
    fetchingRef.current = true
    setLoading(true)
    setPercents({})

    const fetchAll = async () => {
      const result: Record<string, number> = {}
      for (let i = 0; i < symbols.length; i += BATCH) {
        if (cancelledRef.current) break
        const batch = symbols.slice(i, i + BATCH)
        const values = await Promise.all(
          batch.map((sym) => fetchOnePercent(sym, exchange, marketType, interval))
        )
        values.forEach((pct, j) => {
          if (pct !== null) result[batch[j]] = pct
        })
        if (!cancelledRef.current) setPercents({ ...result })
      }
      fetchingRef.current = false
      if (!cancelledRef.current) setLoading(false)
    }

    fetchAll()
    const id = setInterval(() => {
      if (!fetchingRef.current) fetchAll()
    }, 60_000)

    return () => {
      cancelledRef.current = true
      fetchingRef.current = false
      clearInterval(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, exchange, marketType, interval])

  return { percents, loading }
}
