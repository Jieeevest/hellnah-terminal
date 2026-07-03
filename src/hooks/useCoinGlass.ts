import { useState, useEffect, useCallback, useRef } from 'react'
import { API_URLS } from '@/constants/apiUrls'

export interface CGExchangeOI {
  exchange: string
  oiUsd: number
}

export interface CoinGlassData {
  oiTotalUsd: number
  longPercent: number
  shortPercent: number
  oiByExchange: CGExchangeOI[]
}

const CACHE_PREFIX = 'hellnah-terminal_cg_'
const CACHE_TTL_MS = 2 * 60 * 1000

function readCache(key: string): CoinGlassData | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { data, fetchedAt } = JSON.parse(raw)
    if (Date.now() - fetchedAt < CACHE_TTL_MS) return data
    return null
  } catch { return null }
}

function writeCache(key: string, data: CoinGlassData) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, fetchedAt: Date.now() }))
  } catch {}
}

export function useCoinGlass(baseAsset: string | null) {
  const [data, setData] = useState<CoinGlassData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiKey = import.meta.env.VITE_COINGLASS_API_KEY as string | undefined
  const baseRef = useRef(baseAsset)
  useEffect(() => { baseRef.current = baseAsset })

  const fetchData = useCallback(async (asset: string, force = false) => {
    if (!apiKey) { setError('VITE_COINGLASS_API_KEY belum dikonfigurasi'); return }

    const cacheKey = `${CACHE_PREFIX}${asset}`
    if (!force) {
      const cached = readCache(cacheKey)
      if (cached) { setData(cached); return }
    }

    setLoading(true)
    try {
      const base = API_URLS.coinGlass
      const headers: HeadersInit = { coinglassSecret: apiKey }

      const [oiRes, lsRes] = await Promise.all([
        fetch(`${base}/futures/openInterest?symbol=${asset}`, { headers }),
        fetch(`${base}/futures/globalLongShortAccountRatio?symbol=${asset}USDT&period=5m&limit=1`, { headers }),
      ])

      const [oiJson, lsJson] = await Promise.all([oiRes.json(), lsRes.json()])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oiList: CGExchangeOI[] = (oiJson?.data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((d: any) => (d.openInterestAmount ?? d.oiAmount ?? 0) > 0)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((d: any) => ({
          exchange: d.exchangeName ?? d.exchange ?? 'Unknown',
          oiUsd: d.openInterestAmount ?? d.oiAmount ?? 0,
        }))
        .sort((a: CGExchangeOI, b: CGExchangeOI) => b.oiUsd - a.oiUsd)
        .slice(0, 8)

      const oiTotalUsd = oiList.reduce((sum: number, e: CGExchangeOI) => sum + e.oiUsd, 0)

      const lsEntry = lsJson?.data?.[0]
      const rawLong = parseFloat(lsEntry?.longAccount ?? lsEntry?.longRatio ?? '0.5')
      const longPercent = rawLong <= 1 ? rawLong * 100 : rawLong

      const result: CoinGlassData = {
        oiTotalUsd,
        longPercent: Math.round(longPercent * 10) / 10,
        shortPercent: Math.round((100 - longPercent) * 10) / 10,
        oiByExchange: oiList,
      }
      writeCache(cacheKey, result)
      setData(result)
      setError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal fetch CoinGlass'
      console.warn('[CoinGlass]', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [apiKey])

  useEffect(() => {
    if (!baseAsset) { setData(null); return }
    fetchData(baseAsset)
    const id = setInterval(() => {
      if (baseRef.current) fetchData(baseRef.current, true)
    }, CACHE_TTL_MS)
    return () => clearInterval(id)
  }, [baseAsset, fetchData])

  return {
    data,
    loading,
    error,
    refetch: () => { if (baseAsset) fetchData(baseAsset, true) },
  }
}
