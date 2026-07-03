import { useState, useEffect, useCallback, useRef } from 'react'
import { API_URLS } from '@/constants/apiUrls'

const POSITIVE_KW = [
  'bullish', 'surge', 'rally', 'breakout', 'ath', 'adoption', 'launch',
  'partnership', 'gain', 'rise', 'growth', 'positive', 'recovery', 'approve',
  'approval', 'etf', 'upgrade', 'record', 'milestone', 'integration',
]
const NEGATIVE_KW = [
  'bearish', 'crash', 'dump', 'fall', 'drop', 'ban', 'hack', 'scam',
  'fraud', 'lawsuit', 'sec', 'concern', 'fear', 'decline', 'loss',
  'warning', 'attack', 'exploit', 'weak', 'sell-off', 'plunge', 'probe',
]

export type NewsSentiment = 'Positif' | 'Netral' | 'Negatif'

export interface NewsArticle {
  id: string
  title: string
  url: string
  source: string
  publishedAt: number
  categories: string
  sentiment: NewsSentiment
  sentimentScore: number
}

const CACHE_TTL_MS = 30 * 60 * 1000

interface CacheEntry {
  articles: NewsArticle[]
  fetchedAt: number
}

function cacheKey(category?: string | null) {
  return `hellnah-terminal_news_${category ?? 'all'}`
}

function readCache(category?: string | null): NewsArticle[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(category))
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.fetchedAt < CACHE_TTL_MS) return entry.articles
    return null
  } catch {
    return null
  }
}

function writeCache(articles: NewsArticle[], category?: string | null) {
  try {
    localStorage.setItem(cacheKey(category), JSON.stringify({ articles, fetchedAt: Date.now() }))
  } catch {}
}

function analyzeSentiment(title: string, desc: string): { score: number; label: NewsSentiment } {
  const text = (title + ' ' + desc).toLowerCase()
  let pos = 0, neg = 0
  for (const kw of POSITIVE_KW) if (text.includes(kw)) pos++
  for (const kw of NEGATIVE_KW) if (text.includes(kw)) neg++
  const total = pos + neg
  if (total === 0) return { score: 0, label: 'Netral' }
  const score = (pos - neg) / total
  return { score, label: score > 0.2 ? 'Positif' : score < -0.2 ? 'Negatif' : 'Netral' }
}

function parseRSS(xml: string, source: string): NewsArticle[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const items = Array.from(doc.querySelectorAll('item'))

  return items.slice(0, 15).map((item) => {
    const title   = item.querySelector('title')?.textContent?.trim() ?? ''
    const link    = item.querySelector('link')?.textContent?.trim() ?? ''
    const pubDate = item.querySelector('pubDate')?.textContent ?? ''
    const desc    = item.querySelector('description')?.textContent ?? ''
    const { score, label } = analyzeSentiment(title, desc)

    return {
      id: link || `${source}-${pubDate}`,
      title,
      url: link,
      source,
      publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
      categories: '',
      sentiment: label,
      sentimentScore: score,
    }
  }).filter((a) => a.title && a.url)
}

const RSS_SOURCES: { url: string; label: string }[] = [
  { url: API_URLS.cryptoNewsRSS[0], label: 'CoinDesk' },
  { url: API_URLS.cryptoNewsRSS[1], label: 'CoinTelegraph' },
]

async function fetchAllRSS(): Promise<NewsArticle[]> {
  const results = await Promise.allSettled(
    RSS_SOURCES.map(({ url, label }) =>
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.text()
        })
        .then((xml) => parseRSS(xml, label)),
    ),
  )

  const articles: NewsArticle[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') articles.push(...r.value)
  }

  if (articles.length === 0) throw new Error('Semua sumber berita gagal dimuat')

  return articles
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, 25)
}

export function useCryptoNews(category?: string | null) {
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<number>(0)
  const categoryRef = useRef(category)
  categoryRef.current = category

  const doFetch = useCallback((force = false, cat?: string | null) => {
    const activeCat = cat !== undefined ? cat : categoryRef.current

    if (!force) {
      const cached = readCache(activeCat)
      if (cached) {
        setArticles(cached)
        setLastFetch(Date.now())
        return
      }
    }

    setLoading(true)
    setError(null)

    fetchAllRSS()
      .then((items) => {
        const filtered = activeCat
          ? items.filter((a) =>
              a.title.toLowerCase().includes(activeCat.toLowerCase()),
            )
          : items

        writeCache(filtered, activeCat)
        setArticles(filtered)
        setLastFetch(Date.now())
        setError(null)
      })
      .catch((err) => {
        console.warn('[CryptoNews] Gagal fetch:', err.message)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    doFetch(false, category)
  }, [category, doFetch])

  return { articles, loading, error, lastFetch, refresh: () => doFetch(true, category) }
}
