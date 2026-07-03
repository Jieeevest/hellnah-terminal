import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import type { Ticker, OrderBook, Trade } from '@/types'
import { API_URLS } from '@/constants/apiUrls'

const BASE = API_URLS.binance.spot
const WS_BASE = API_URLS.binance.ws

export function useBinanceTickers() {
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await axios.get(`${BASE}/ticker/24hr`)
        const usdt = (data as any[])
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

export function useBinanceOrderBook(symbol: string) {
  const [orderBook, setOrderBook] = useState<OrderBook>({ bids: [], asks: [] })
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!symbol) return
    wsRef.current?.close()
    const ws = new WebSocket(`${WS_BASE}/${symbol.toLowerCase()}@depth20@100ms`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data)
      setOrderBook({
        bids: (d.bids as string[][]).slice(0, 15).map(([p, q]) => [parseFloat(p), parseFloat(q)]),
        asks: (d.asks as string[][]).slice(0, 15).map(([p, q]) => [parseFloat(p), parseFloat(q)]),
      })
    }
    return () => ws.close()
  }, [symbol])

  return orderBook
}

export function useBinanceTrades(symbol: string) {
  const [trades, setTrades] = useState<Trade[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!symbol) return
    wsRef.current?.close()
    axios.get(`${BASE}/trades`, { params: { symbol: symbol.toUpperCase(), limit: 30 } }).then(({ data }) => {
      setTrades(
        (data as any[]).reverse().map((t: any) => ({
          id: t.id,
          price: parseFloat(t.price),
          qty: parseFloat(t.qty),
          time: t.time,
          isBuyerMaker: t.isBuyerMaker,
        }))
      )
    })

    const ws = new WebSocket(`${WS_BASE}/${symbol.toLowerCase()}@trade`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      const t = JSON.parse(e.data)
      setTrades((prev) => [
        { id: t.t, price: parseFloat(t.p), qty: parseFloat(t.q), time: t.T, isBuyerMaker: t.m },
        ...prev.slice(0, 29),
      ])
    }
    return () => ws.close()
  }, [symbol])

  return trades
}

export function useBinancePrice(symbol: string, onPrice: (p: number) => void) {
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
