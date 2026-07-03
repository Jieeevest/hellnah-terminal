import { motion, AnimatePresence } from 'framer-motion'
import type { Trade } from '@/types'
import { formatPrice, cn } from '@/lib/utils'

interface Props {
  trades: Trade[]
}

export function TradeHistory({ trades }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="text-[10px] text-muted-foreground flex px-2 py-1 border-b border-border font-medium">
        <span className="flex-1">Harga</span>
        <span className="flex-1 text-right">Jumlah</span>
        <span className="flex-1 text-right">Waktu</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {trades.map((trade) => (
            <motion.div
              key={trade.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                'flex text-[11px] px-2 py-0.5',
                trade.isBuyerMaker ? 'text-red-400' : 'text-green-400'
              )}
            >
              <span className="flex-1 font-mono">{formatPrice(trade.price)}</span>
              <span className="flex-1 text-right text-muted-foreground">{trade.qty.toFixed(4)}</span>
              <span className="flex-1 text-right text-muted-foreground">
                {new Date(trade.time).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
