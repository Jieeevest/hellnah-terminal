import { useState, useEffect } from 'react'
import axios from 'axios'
import type { Ticker, OrderBook, Trade } from '@/types'
import { API_URLS } from '@/constants/apiUrls'

const BASE = API_URLS.okx.market
const PUBLIC = API_URLS.okx.public

export function useOKXFutureTickers() {
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const [{ data: tickerData }] = await Promise.all([
        axios.get(`${BASE}/tickers`, { params: { instType: 'SWAP' } }),
        axios.get(`${PUBLIC}/funding-rate-history`, { params: { instId: 'BTC-USDT-SWAP', limit: 1 } }),
      ])

      const items = tickerData?.data as any[]
      if (!items) return

      const usdt = items
        .filter((t: any) => t.instId?.endsWith('-USDT-SWAP'))
        .map((t: any) => {
          const open = parseFloat(t.open24h || 0)
          const last = parseFloat(t.last || 0)
          return {
            symbol: t.instId,
            baseAsset: t.instId.replace('-USDT-SWAP', ''),
            quoteAsset: 'USDT',
            price: last,
            priceChange: last - open,
            priceChangePercent: open > 0 ? ((last - open) / open) * 100 : 0,
            volume: parseFloat(t.volCcy24h || 0),
            high24h: parseFloat(t.high24h || 0),
            low24h: parseFloat(t.low24h || 0),
            openInterest: parseFloat(t.oiCcy || t.oi || 0),
            markPrice: parseFloat(t.markPx || 0),
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

export function useOKXFutureOrderBook(symbol: string) {
  const [orderBook, setOrderBook] = useState<OrderBook>({ bids: [], asks: [] })

  useEffect(() => {
    if (!symbol) return
    const fetch = async () => {
      const { data } = await axios.get(`${BASE}/books`, {
        params: { instId: symbol, sz: 15 },
      })
      const d = data?.data?.[0]
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

export function useOKXFutureTrades(symbol: string) {
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    if (!symbol) return
    const fetch = async () => {
      const { data } = await axios.get(`${BASE}/trades`, {
        params: { instId: symbol, limit: 30 },
      })
      const items = data?.data as any[]
      if (!items) return
      setTrades(
        items.map((t: any) => ({
          id: t.tradeId,
          price: parseFloat(t.px),
          qty: parseFloat(t.sz),
          time: parseInt(t.ts),
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
