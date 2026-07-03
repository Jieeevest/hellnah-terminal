import { useState, useEffect } from 'react'

const CACHE_KEY = 'hellnah-terminal_btc_dominance'
const CACHE_TTL = 60 * 60 * 1000

interface CacheEntry {
  value: number
  fetchedAt: number
}

export function useBTCDominance() {
  const [dominance, setDominance] = useState<number | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const entry: CacheEntry = JSON.parse(raw)
        if (Date.now() - entry.fetchedAt < CACHE_TTL) {
          setDominance(entry.value)
          return
        }
      }
    } catch {}

    fetch('https://api.coingecko.com/api/v3/global')
      .then((r) => r.json())
      .then((json) => {
        const val: number | undefined = json?.data?.market_cap_percentage?.btc
        if (val != null) {
          setDominance(val)
          localStorage.setItem(CACHE_KEY, JSON.stringify({ value: val, fetchedAt: Date.now() }))
        }
      })
      .catch(() => {})
  }, [])

  return dominance
}
