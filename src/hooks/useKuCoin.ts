import { useState, useEffect } from 'react'
import axios from 'axios'
import type { Ticker, OrderBook, Trade } from '@/types'
import { API_URLS } from '@/constants/apiUrls'

const BASE = API_URLS.kucoin.spot

export function useKuCoinTickers() {
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await axios.get(`${BASE}/market/allTickers`)
      const items = data?.data?.ticker as any[]
      if (!items) return
      const usdt = items
        .filter((t: any) => t.symbol?.endsWith('-USDT'))
        .map((t: any) => ({
          symbol: t.symbol,
          baseAsset: t.symbol.replace('-USDT', ''),
          quoteAsset: 'USDT',
          price: parseFloat(t.last || 0),
          priceChange: parseFloat(t.changePrice || 0),
          priceChangePercent: parseFloat(t.changeRate || 0) * 100,
          volume: parseFloat(t.volValue || 0),
          high24h: parseFloat(t.high || 0),
          low24h: parseFloat(t.low || 0),
        }))
        .sort((a, b) => b.volume - a.volume)
        
      setTickers(usdt)
      setLoading(false)
    }
    fetch()
    const id = setInterval(fetch, 10000)
    return () => clearInterval(id)
  }, [])

  return { tickers, loading }
}

export function useKuCoinOrderBook(symbol: string) {
  const [orderBook, setOrderBook] = useState<OrderBook>({ bids: [], asks: [] })

  useEffect(() => {
    if (!symbol) return
    const fetch = async () => {
      const { data } = await axios.get(`${BASE}/market/orderbook/level2_20`, {
        params: { symbol },
      })
      const d = data?.data
      if (!d) return
      setOrderBook({
        bids: (d.bids as string[][]).slice(0, 15).map(([p, q]) => [parseFloat(p), parseFloat(q)]),
        asks: (d.asks as string[][]).slice(0, 15).map(([p, q]) => [parseFloat(p), parseFloat(q)]),
      })
    }
    fetch()
    const id = setInterval(fetch, 1000)
    return () => clearInterval(id)
  }, [symbol])

  return orderBook
}

export function useKuCoinTrades(symbol: string) {
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    if (!symbol) return
    const fetch = async () => {
      const { data } = await axios.get(`${BASE}/market/histories`, { params: { symbol } })
      const items = data?.data as any[]
      if (!items) return
      setTrades(
        items.slice(0, 30).map((t: any) => ({
          id: t.sequence,
          price: parseFloat(t.price),
          qty: parseFloat(t.size),
          time: parseInt(t.time) / 1_000_000,
          isBuyerMaker: t.side === 'sell',
        }))
      )
    }
    fetch()
    const id = setInterval(fetch, 1500)
    return () => clearInterval(id)
  }, [symbol])

  return trades
}
