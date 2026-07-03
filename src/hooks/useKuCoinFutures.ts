import { useState, useEffect } from 'react'
import axios from 'axios'
import type { Ticker, OrderBook, Trade } from '@/types'
import { API_URLS } from '@/constants/apiUrls'

const BASE = API_URLS.kucoin.futures

export function useKuCoinFutureTickers() {
  const [tickers, setTickers] = useState<Ticker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await axios.get(`${BASE}/contracts/active`)
      const items = data?.data as any[]
      if (!items) return

      const usdt = items
        .filter((t: any) => t.symbol?.endsWith('USDTM'))
        .map((t: any) => ({
          symbol: t.symbol,
          baseAsset: t.rootSymbol ?? t.symbol.replace('USDTM', ''),
          quoteAsset: 'USDT',
          price: parseFloat(t.lastTradePrice || 0),
          priceChange: 0,
          priceChangePercent: parseFloat(t.priceChgPct || 0) * 100,
          volume: parseFloat(t.turnoverOf24h || 0),
          high24h: parseFloat(t.highPrice || 0),
          low24h: parseFloat(t.lowPrice || 0),
          fundingRate: parseFloat(t.fundingFeeRate || 0) * 100,
          openInterest: parseFloat(t.openInterest || t.openInterestValue || 0),
          markPrice: parseFloat(t.markPrice || 0),
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

export function useKuCoinFutureOrderBook(symbol: string) {
  const [orderBook, setOrderBook] = useState<OrderBook>({ bids: [], asks: [] })

  useEffect(() => {
    if (!symbol) return
    const fetch = async () => {
      const { data } = await axios.get(`${BASE}/level2/snapshot`, { params: { symbol } })
      const d = data?.data
      if (!d) return
      setOrderBook({
        bids: (d.bids as [number, number][]).slice(0, 15),
        asks: (d.asks as [number, number][]).slice(0, 15),
      })
    }
    fetch()
    const id = setInterval(fetch, 1000)
    return () => clearInterval(id)
  }, [symbol])

  return orderBook
}

export function useKuCoinFutureTrades(symbol: string) {
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    if (!symbol) return
    const fetch = async () => {
      const { data } = await axios.get(`${BASE}/trade/history`, { params: { symbol } })
      const items = data?.data as any[]
      if (!items) return
      setTrades(
        items.slice(0, 30).map((t: any) => ({
          id: t.tradeId,
          price: parseFloat(t.price),
          qty: parseFloat(t.size),
          time: t.ts / 1_000_000,
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
