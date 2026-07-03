import { useState, useEffect } from 'react'
import axios from 'axios'
import type { Ticker, OrderBook, Trade } from '@/types'
import { API_URLS } from '@/constants/apiUrls'

const BASE = API_URLS.cryptoCom.public

export function useCryptoComFutureTickers() {
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await axios.get(`${BASE}/get-instruments`)
      const items = data?.result?.data as any[]
      if (!items) return

      const perpetuals = items.filter(
        (t: any) => t.inst_type === 'PERPETUAL_SWAP' && t.quote_ccy === 'USD'
      )

      const tickerRes = await axios.get(`${BASE}/get-tickers`)
      const tickerMap: Record<string, any> = {}
      for (const t of tickerRes.data?.result?.data ?? []) {
        tickerMap[t.i] = t
      }

      const result = perpetuals
        .map((inst: any) => {
          const t = tickerMap[inst.instrument_name] ?? {}
          const last = parseFloat(t.a || t.k || 0)
          const open = parseFloat(t.oi || 0)
          return {
            symbol: inst.instrument_name,
            baseAsset: inst.base_ccy,
            quoteAsset: 'USD',
            price: last,
            priceChange: parseFloat(t.c || 0),
            priceChangePercent: open > 0 ? ((last - open) / open) * 100 : 0,
            volume: parseFloat(t.vv || 0),
            high24h: parseFloat(t.h || 0),
            low24h: parseFloat(t.l || 0),
            openInterest: parseFloat(t.oi || 0),
          }
        })
        .sort((a, b) => b.volume - a.volume)
        

      setTickers(result)
      setLoading(false)
    }
    fetch()
    const id = setInterval(fetch, 10000)
    return () => clearInterval(id)
  }, [])

  return { tickers, loading }
}

export function useCryptoComFutureOrderBook(symbol: string) {
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

export function useCryptoComFutureTrades(symbol: string) {
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
    const id = setInterval(fetch, 1500)
    return () => clearInterval(id)
  }, [symbol])

  return trades
}
