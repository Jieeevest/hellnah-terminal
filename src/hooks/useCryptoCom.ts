import { useState, useEffect } from 'react'
import axios from 'axios'
import type { Ticker, OrderBook, Trade } from '@/types'
import { API_URLS } from '@/constants/apiUrls'

const BASE = API_URLS.cryptoCom.public

export function useCryptoComTickers() {
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await axios.get(`${BASE}/get-tickers`)
      const result = data?.result?.data as any[]
      if (!result) return
      const usdt = result
        .filter((t: any) => t.i?.endsWith('_USDT'))
        .map((t: any) => {
          const sym = t.i as string
          return {
            symbol: sym,
            baseAsset: sym.replace('_USDT', ''),
            quoteAsset: 'USDT',
            price: parseFloat(t.a || t.k || 0),
            priceChange: parseFloat(t.c || 0),
            priceChangePercent: parseFloat(t.h && t.l ? (((t.a - t.l) / t.l) * 100).toFixed(2) : '0'),
            volume: parseFloat(t.vv || 0),
            high24h: parseFloat(t.h || 0),
            low24h: parseFloat(t.l || 0),
          }
        })
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

export function useCryptoComOrderBook(symbol: string) {
  const [orderBook, setOrderBook] = useState<OrderBook>({ bids: [], asks: [] })

  useEffect(() => {
    if (!symbol) return
    const fetch = async () => {
      const { data } = await axios.get(`${BASE}/get-book`, {
        params: { instrument_name: symbol, depth: 15 },
      })
      const d = data?.result?.data?.[0]
      if (!d) return
      setOrderBook({
        bids: (d.bids as any[][]).slice(0, 15).map(([p, q]) => [parseFloat(p), parseFloat(q)]),
        asks: (d.asks as any[][]).slice(0, 15).map(([p, q]) => [parseFloat(p), parseFloat(q)]),
      })
    }
    fetch()
    const id = setInterval(fetch, 1000)
    return () => clearInterval(id)
  }, [symbol])

  return orderBook
}

export function useCryptoComTrades(symbol: string) {
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    if (!symbol) return
    const fetch = async () => {
      const { data } = await axios.get(`${BASE}/get-trades`, {
        params: { instrument_name: symbol, count: 30 },
      })
      const result = data?.result?.data as any[]
      if (!result) return
      setTrades(
        result.map((t: any) => ({
          id: t.d,
          price: parseFloat(t.p),
          qty: parseFloat(t.q),
          time: t.t,
          isBuyerMaker: t.s === 'SELL',
        }))
      )
    }
    fetch()
    const id = setInterval(fetch, 1000)
    return () => clearInterval(id)
  }, [symbol])

  return trades
}
