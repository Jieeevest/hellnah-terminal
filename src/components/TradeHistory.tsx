import { Zap } from 'lucide-react'
import type { Trade } from '@/types'
import { formatNumber, formatPrice, cn } from '@/lib/utils'

interface Props {
  trades: Trade[]
}

export function TradeHistory({ trades }: Props) {
  const values = trades.map((t) => t.price * t.qty)
  const avgValue = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  // "Besar" relatif ke transaksi lain di daftar ini, bukan angka absolut — koin kecil & BTC beda skala.
  const bigThreshold = avgValue * 3

  let buyValue = 0
  let sellValue = 0
  trades.forEach((t, i) => {
    if (t.isBuyerMaker) sellValue += values[i]
    else buyValue += values[i]
  })
  const buyPct = buyValue + sellValue > 0 ? (buyValue / (buyValue + sellValue)) * 100 : 50

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 pt-2 pb-2 shrink-0">
        <div className="flex justify-between text-xs font-semibold mb-1">
          <span className="text-green-400">Dibeli {buyPct.toFixed(0)}%</span>
          <span className="text-muted-foreground font-normal">Transaksi terakhir</span>
          <span className="text-red-400">{(100 - buyPct).toFixed(0)}% Dijual</span>
        </div>
        <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
          <div className="bg-green-500 transition-[width] duration-500" style={{ width: `${buyPct}%` }} />
          <div className="bg-red-500 flex-1" />
        </div>
      </div>

      <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-2 px-3 py-1 text-xs text-muted-foreground border-y border-border shrink-0">
        <span>Harga</span>
        <span className="text-right">Jumlah</span>
        <span className="text-right">Nilai</span>
        <span className="text-right w-16">Waktu</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
          {trades.map((trade, i) => {
            const isSell = trade.isBuyerMaker
            const isBig = values[i] >= bigThreshold && bigThreshold > 0
            return (
              <div
                key={trade.id}
                className={cn(
                  'grid grid-cols-[1.2fr_1fr_1fr_auto] gap-2 items-center px-3 h-[1.4rem] text-xs tabular-nums font-mono',
                  isSell ? 'animate-flash-sell' : 'animate-flash-buy',
                  isBig && (isSell ? 'bg-red-500/10' : 'bg-green-500/10')
                )}
              >
                <span className={cn('flex items-center gap-1', isSell ? 'text-red-400' : 'text-green-400', isBig && 'font-bold')}>
                  {formatPrice(trade.price)}
                  {isBig && <Zap className="h-3 w-3 fill-current" />}
                </span>
                <span className={cn('text-right', isBig ? 'text-foreground font-bold' : 'text-muted-foreground')}>
                  {trade.qty < 1 ? trade.qty.toFixed(4) : formatNumber(trade.qty, 3)}
                </span>
                <span className={cn('text-right', isBig ? 'text-foreground font-bold' : 'text-muted-foreground')}>
                  ${formatNumber(values[i])}
                </span>
                <span className="text-right w-16 text-muted-foreground">
                  {new Date(trade.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            )
          })}
      </div>
    </div>
  )
}
