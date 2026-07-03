import { useState, useEffect, useCallback } from 'react'
import { API_URLS } from '@/constants/apiUrls'

export interface LunarCoin {
  symbol: string
  name: string
  price: number
  percentChange24h: number
  galaxyScore: number
  altRank: number
  socialVolume: number
  sentiment: number       // 0–100 (bullish %)
  socialDominance: number // % of total crypto social volume
}

const CACHE_KEY = 'hellnah-terminal_lunarcrush_cache'
const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  data: LunarCoin[]
  fetchedAt: number
}

function readCache(): LunarCoin[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.fetchedAt < CACHE_TTL_MS) return entry.data
    return null
  } catch {
    return null
  }
}

function writeCache(data: LunarCoin[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }))
  } catch {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCoins(raw: any[]): LunarCoin[] {
  return raw
    .filter((c) => c.symbol && c.galaxy_score != null)
    .map((c) => ({
      symbol: String(c.symbol).toUpperCase(),
      name: c.name ?? c.symbol,
      price: c.price ?? 0,
      percentChange24h: c.percent_change_24h ?? 0,
      galaxyScore: c.galaxy_score ?? 0,
      altRank: c.alt_rank ?? 0,
      socialVolume: c.social_volume ?? 0,
      // sentiment bisa 1–5 (average_sentiment) atau 0–100 — normalkan ke 0–100
      sentiment: c.sentiment != null
        ? c.sentiment > 5 ? c.sentiment : Math.round(((c.sentiment - 1) / 4) * 100)
        : c.average_sentiment != null
          ? Math.round(((c.average_sentiment - 1) / 4) * 100)
          : 50,
      socialDominance: c.social_dominance ?? 0,
    }))
}

export function useLunarCrush() {
  const [coins, setCoins] = useState<LunarCoin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const apiKey = import.meta.env.VITE_LUNARCRUSH_API_KEY as string | undefined

  const fetchData = useCallback(async (force = false) => {
    if (!apiKey) {
      setError('VITE_LUNARCRUSH_API_KEY belum dikonfigurasi')
      return
    }

    if (!force) {
      const cached = readCache()
      if (cached) {
        setCoins(cached)
        setLastUpdated(Date.now())
        return
      }
    }

    setLoading(true)
    try {
      const res = await fetch(
        `${API_URLS.lunarCrush}/public/coins/list/v2?sort=galaxy_score&limit=50`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const parsed = parseCoins(json?.data ?? [])
      writeCache(parsed)
      setCoins(parsed)
      setLastUpdated(Date.now())
      setError(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal fetch LunarCrush'
      console.warn('[LunarCrush]', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [apiKey])

  useEffect(() => {
    fetchData()
    const id = setInterval(() => fetchData(true), CACHE_TTL_MS)
    return () => clearInterval(id)
  }, [fetchData])

  const getCoin = (symbol: string): LunarCoin | null =>
    coins.find((c) => c.symbol === symbol.toUpperCase()) ?? null

  return { coins, loading, error, lastUpdated, getCoin, refetch: () => fetchData(true) }
}
