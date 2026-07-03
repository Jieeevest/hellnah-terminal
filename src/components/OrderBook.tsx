import { motion } from 'framer-motion'
import type { OrderBook as OrderBookType } from '@/types'
import { formatPrice } from '@/lib/utils'

interface Props {
  orderBook: OrderBookType
  currentPrice: number
  onPriceClick: (price: number) => void
}

export function OrderBook({ orderBook, currentPrice, onPriceClick }: Props) {
  const maxBid = Math.max(...orderBook.bids.map(([, q]) => q), 1)
  const maxAsk = Math.max(...orderBook.asks.map(([, q]) => q), 1)

  return (
    <div className="flex flex-col h-full">
      <div className="text-[10px] text-muted-foreground flex px-2 py-1 border-b border-border font-medium">
        <span className="flex-1">Harga</span>
        <span className="flex-1 text-right">Jumlah</span>
        <span className="flex-1 text-right">Total</span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Asks (sell orders) - reversed so lowest ask is at bottom */}
        <div className="flex-1 flex flex-col-reverse overflow-hidden">
          {orderBook.asks.slice(0, 12).map(([price, qty], i) => (
            <motion.button
              key={`ask-${i}`}
              className="relative w-full flex text-[11px] px-2 py-0.5 hover:bg-red-500/10 text-left"
              onClick={() => onPriceClick(price)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div
                className="absolute inset-y-0 right-0 bg-red-500/10"
                style={{ width: `${(qty / maxAsk) * 100}%` }}
              />
              <span className="flex-1 font-mono text-red-400 z-10">{formatPrice(price)}</span>
              <span className="flex-1 text-right text-muted-foreground z-10">{qty.toFixed(4)}</span>
              <span className="flex-1 text-right text-muted-foreground z-10">
                {(price * qty).toFixed(2)}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Spread */}
        <div className="flex items-center justify-center gap-2 py-1.5 border-y border-border bg-muted/30">
          <span className="text-sm font-bold font-mono text-foreground">
            {formatPrice(currentPrice)}
          </span>
          {orderBook.asks[0] && orderBook.bids[0] && (
            <span className="text-[10px] text-muted-foreground">
              spread {(orderBook.asks[0][0] - orderBook.bids[0][0]).toFixed(4)}
            </span>
          )}
        </div>

        {/* Bids (buy orders) */}
        <div className="flex-1 overflow-hidden">
          {orderBook.bids.slice(0, 12).map(([price, qty], i) => (
            <motion.button
              key={`bid-${i}`}
              className="relative w-full flex text-[11px] px-2 py-0.5 hover:bg-green-500/10 text-left"
              onClick={() => onPriceClick(price)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div
                className="absolute inset-y-0 right-0 bg-green-500/10"
                style={{ width: `${(qty / maxBid) * 100}%` }}
              />
              <span className="flex-1 font-mono text-green-400 z-10">{formatPrice(price)}</span>
              <span className="flex-1 text-right text-muted-foreground z-10">{qty.toFixed(4)}</span>
              <span className="flex-1 text-right text-muted-foreground z-10">
                {(price * qty).toFixed(2)}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
