import { useState, useEffect } from 'react'
import { API_URLS } from '@/constants/apiUrls'

const FG_URL = API_URLS.fearGreed
const CACHE_KEY = 'hellnah-terminal_fg_cache'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 jam

export interface FearGreedData {
  value: number          // 0–100
  label: string          // e.g. "Extreme Fear", "Greed"
  timestamp: number      // unix timestamp
}

interface CacheEntry {
  data: FearGreedData
  fetchedAt: number
}

function readCache(): FearGreedData | null {
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

function writeCache(data: FearGreedData) {
  try {
    const entry: CacheEntry = { data, fetchedAt: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // ignore
  }
}

export function useFearGreed() {
  const [data, setData] = useState<FearGreedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Cek cache dulu
    const cached = readCache()
    if (cached) {
      setData(cached)
      return
    }

    setLoading(true)
    fetch(FG_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        const item = json?.data?.[0]
        if (!item) throw new Error('Data tidak ditemukan')
        const fg: FearGreedData = {
          value: parseInt(item.value, 10),
          label: item.value_classification,
          timestamp: parseInt(item.timestamp, 10) * 1000,
        }
        writeCache(fg)
        setData(fg)
        setError(null)
      })
      .catch((err) => {
        console.warn('[FearGreed] Gagal fetch:', err.message)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}

/**
 * Hitung Fear & Greed score berdasarkan docs-analisis.md:
 * - 0–25  Extreme Fear  → +0.7 (contrarian bullish)
 * - 25–40 Fear          → +0.3
 * - 40–60 Neutral       → 0
 * - 60–75 Greed         → -0.3
 * - 75–100 Extreme Greed → -0.7 (contrarian bearish)
 */
export function scoreFearGreed(value: number): number {
  if (value <= 25) return 0.7
  if (value <= 40) return 0.3
  if (value <= 60) return 0.0
  if (value <= 75) return -0.3
  return -0.7
}
