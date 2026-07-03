export type Exchange = 'binance' | 'cryptocom' | 'kucoin' | 'okx'
export type MarketType = 'spot' | 'futures'

export interface Ticker {
  symbol: string
  baseAsset: string
  quoteAsset: string
  price: number
  priceChange: number
  priceChangePercent: number
  volume: number
  high24h: number
  low24h: number
  fundingRate?: number   // futures only, in %
  openInterest?: number  // futures only, in quote currency
  markPrice?: number     // futures only
}

export interface OrderBook {
  bids: [number, number][]
  asks: [number, number][]
  lastUpdateId?: number
}

export interface Trade {
  id: string | number
  price: number
  qty: number
  time: number
  isBuyerMaker: boolean
}

export interface OrderForm {
  type: 'limit' | 'market'
  side: 'buy' | 'sell'
  price: string
  amount: string
  total: string
}
