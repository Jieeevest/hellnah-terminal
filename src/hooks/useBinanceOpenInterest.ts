import { useState, useEffect } from 'react'
import { API_URLS } from '@/constants/apiUrls'

export interface OpenInterestPoint {
  time: number
  valueUsd: number
}

export interface OpenInterestData {
  oiCoins: number
  oiUsd: number
  change24hPct: number
  history: OpenInterestPoint[]
  globalLongPct: number
  topTraderLongPct: number
}

const REFRESH_MS = 60_000

async function getJson(url: string) {
  const res = await fetch(url)
  const json = await res.json()
  // Binance balikin {code, msg} (mis. -1121 Invalid symbol) dengan status non-2xx.
  if (!res.ok) throw new Error(json?.msg ?? `HTTP ${res.status}`)
  return json
}

export function useBinanceOpenInterest(symbol: string | null) {
  const [data, setData] = useState<OpenInterestData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    setData(null)
    setError(null)

    const run = async () => {
      setLoading(true)
      try {
        const q = `symbol=${symbol}`
        const [live, hist, global, top] = await Promise.all([
          getJson(`${API_URLS.binance.futures}/openInterest?${q}`),
          getJson(`${API_URLS.binance.futuresData}/openInterestHist?${q}&period=1h&limit=25`),
          getJson(`${API_URLS.binance.futuresData}/globalLongShortAccountRatio?${q}&period=5m&limit=1`),
          getJson(`${API_URLS.binance.futuresData}/topLongShortPositionRatio?${q}&period=5m&limit=1`),
        ])
        if (cancelled) return

        const history: OpenInterestPoint[] = (hist as { timestamp: number; sumOpenInterestValue: string }[])
          .map((h) => ({ time: h.timestamp, valueUsd: parseFloat(h.sumOpenInterestValue) }))
        const last = hist[hist.length - 1]
        const usdPerCoin = last ? parseFloat(last.sumOpenInterestValue) / parseFloat(last.sumOpenInterest) : 0
        const oiCoins = parseFloat(live.openInterest)
        const first = history[0]?.valueUsd ?? 0
        const oiUsd = oiCoins * usdPerCoin

        setData({
          oiCoins,
          oiUsd,
          change24hPct: first > 0 ? (oiUsd / first - 1) * 100 : 0,
          history,
          globalLongPct: parseFloat(global[0]?.longAccount ?? '0.5') * 100,
          topTraderLongPct: parseFloat(top[0]?.longAccount ?? '0.5') * 100,
        })
        setError(null)
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Gagal ambil data'
        setError(msg.includes('Invalid symbol') ? 'Koin ini tidak tersedia di Binance Futures.' : msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    const id = setInterval(run, REFRESH_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [symbol])

  return { data, error, loading }
}
