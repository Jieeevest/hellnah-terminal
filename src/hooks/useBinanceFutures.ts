import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import type { Ticker, OrderBook, Trade } from '@/types'
import { API_URLS } from '@/constants/apiUrls'

const BASE = API_URLS.binance.futures
const WS_BASE = API_URLS.binance.wsFutures
const UI_FLUSH_MS = 250

export function useBinanceFutureTickers() {
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const [{ data: tickerData }, { data: premiumData }] = await Promise.all([
          axios.get(`${BASE}/ticker/24hr`),
          axios.get(`${BASE}/premiumIndex`),
        ])

        const fundingMap: Record<string, number> = {}
        const markMap: Record<string, number> = {}
        for (const item of premiumData as any[]) {
          fundingMap[item.symbol] = parseFloat(item.lastFundingRate) * 100
          markMap[item.symbol] = parseFloat(item.markPrice)
        }

        const usdt = (tickerData as any[])
          .filter((t: any) => t.symbol.endsWith('USDT'))
          .map((t: any) => ({
            symbol: t.symbol,
            baseAsset: t.symbol.replace('USDT', ''),
            quoteAsset: 'USDT',
            price: parseFloat(t.lastPrice),
            priceChange: parseFloat(t.priceChange),
            priceChangePercent: parseFloat(t.priceChangePercent),
            volume: parseFloat(t.quoteVolume),
            high24h: parseFloat(t.highPrice),
            low24h: parseFloat(t.lowPrice),
            fundingRate: fundingMap[t.symbol] ?? 0,
            openInterest: parseFloat(t.openInterest || 0),
            markPrice: markMap[t.symbol] ?? 0,
          }))
          .sort((a, b) => b.volume - a.volume)

        setTickers(usdt)
      } catch {
        // silent — keep last known data, retry on next interval
      } finally {
        setLoading(false)
      }
    }
    fetch()
    const id = setInterval(fetch, 10000)
    return () => clearInterval(id)
  }, [])

  return { tickers, loading }
}

export function useBinanceFutureOrderBook(symbol: string) {
  const [orderBook, setOrderBook] = useState<OrderBook>({ bids: [], asks: [] })
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!symbol) return
    wsRef.current?.close()
    const ws = new WebSocket(`${WS_BASE}/${symbol.toLowerCase()}@depth20@100ms`)
    wsRef.current = ws
    // depth@100ms = 10 pesan/detik; render tiap pesan bikin seluruh Dashboard ikut render ulang.
    let latest: OrderBook | null = null
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data)
      latest = {
        bids: (d.b as string[][]).slice(0, 20).map(([p, q]) => [parseFloat(p), parseFloat(q)]),
        asks: (d.a as string[][]).slice(0, 20).map(([p, q]) => [parseFloat(p), parseFloat(q)]),
      }
    }
    const flush = setInterval(() => {
      if (latest) { setOrderBook(latest); latest = null }
    }, UI_FLUSH_MS)
    return () => { ws.close(); clearInterval(flush) }
  }, [symbol])

  return orderBook
}

export function useBinanceFutureTrades(symbol: string) {
  const [trades, setTrades] = useState<Trade[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!symbol) return
    wsRef.current?.close()
    setTrades([])
    let cancelled = false
    // aggTrades (bukan /trades) supaya ID-nya satu jenis dengan stream @aggTrade — kalau beda, key React bisa bentrok.
    axios.get(`${BASE}/aggTrades`, { params: { symbol: symbol.toUpperCase(), limit: 30 } }).then(({ data }) => {
      if (cancelled) return
      const initial: Trade[] = (data as any[]).reverse().map((t: any) => ({
        id: t.a,
        price: parseFloat(t.p),
        qty: parseFloat(t.q),
        time: t.T,
        isBuyerMaker: t.m,
      }))
      setTrades((prev) => {
        const seen = new Set(prev.map((t) => t.id))
        return [...prev, ...initial.filter((t) => !seen.has(t.id))].slice(0, 30)
      })
    })

    const ws = new WebSocket(`${WS_BASE}/${symbol.toLowerCase()}@aggTrade`)
    wsRef.current = ws
    // Koin ramai bisa puluhan transaksi/detik — dikumpulkan dulu, dirender maksimal 4x/detik.
    let buffer: Trade[] = []
    ws.onmessage = (e) => {
      const t = JSON.parse(e.data)
      buffer.unshift({ id: t.a, price: parseFloat(t.p), qty: parseFloat(t.q), time: t.T, isBuyerMaker: t.m })
    }
    const flush = setInterval(() => {
      if (!buffer.length) return
      const batch = buffer
      buffer = []
      setTrades((prev) => [...batch, ...prev].slice(0, 30))
    }, UI_FLUSH_MS)
    return () => { cancelled = true; ws.close(); clearInterval(flush) }
  }, [symbol])

  return trades
}

export function useBinanceFuturePrice(symbol: string, onPrice: (p: number) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const cb = useCallback(onPrice, [onPrice])

  useEffect(() => {
    if (!symbol) return
    wsRef.current?.close()
    const ws = new WebSocket(`${WS_BASE}/${symbol.toLowerCase()}@miniTicker`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data)
      cb(parseFloat(d.c))
    }
    return () => ws.close()
  }, [symbol, cb])
}
