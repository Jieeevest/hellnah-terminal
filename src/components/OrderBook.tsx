import { useRef, useState, useEffect } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import type { OrderBook as OrderBookType } from '@/types'
import { cn, formatNumber, formatPrice } from '@/lib/utils'

interface Props {
  orderBook: OrderBookType
  currentPrice: number
}

const ROW_REM = 1.4

// Hitung berapa baris utuh yang muat — tanpa ini baris terakhir kepotong setengah di bawah.
function useFittingRows() {
  const ref = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState(10)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const rowPx = ROW_REM * parseFloat(getComputedStyle(document.documentElement).fontSize)
      setRows(Math.max(1, Math.floor(entry.contentRect.height / rowPx)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, rows] as const
}

type Level = { price: number; qty: number; cum: number }

function withCumulative(rows: [number, number][], levels: number): Level[] {
  let cum = 0
  return rows.slice(0, levels).map(([price, qty]) => {
    cum += price * qty
    return { price, qty, cum }
  })
}

function formatQty(q: number): string {
  if (q >= 1000) return formatNumber(q)
  if (q >= 1) return q.toFixed(3)
  return q.toFixed(4)
}

function LevelRow({ level, maxQty, isWall, side }: { level: Level; maxQty: number; isWall: boolean; side: 'bid' | 'ask' }) {
  const isBid = side === 'bid'
  return (
    <div className="relative grid grid-cols-3 items-center px-3 h-[1.4rem] text-xs tabular-nums hover:bg-white/[0.04]">
      <div
        className={cn(
          'absolute inset-y-[1px] right-0 rounded-l-sm transition-[width] duration-300',
          isBid ? 'bg-gradient-to-l from-green-500/25 to-green-500/5' : 'bg-gradient-to-l from-red-500/25 to-red-500/5'
        )}
        style={{ width: `${(level.qty / maxQty) * 100}%` }}
      />
      <span className={cn('relative font-mono font-medium flex items-center gap-1.5', isBid ? 'text-green-400' : 'text-red-400')}>
        {formatPrice(level.price)}
        {isWall && (
          <span
            title="Order terbesar di sisi ini — sering jadi 'tembok' penahan harga"
            className={cn('h-1.5 w-1.5 rounded-full', isBid ? 'bg-green-400' : 'bg-red-400')}
          />
        )}
      </span>
      <span className={cn('relative text-right font-mono', isWall ? 'text-foreground font-bold' : 'text-muted-foreground')}>
        {formatQty(level.qty)}
      </span>
      <span className="relative text-right font-mono text-muted-foreground">{formatNumber(level.cum)}</span>
    </div>
  )
}

export function OrderBook({ orderBook, currentPrice }: Props) {
  const [asksRef, levels] = useFittingRows()
  const prevPrice = useRef(currentPrice)
  const lastDirection = useRef<'up' | 'down'>('up')
  if (currentPrice !== prevPrice.current) {
    lastDirection.current = currentPrice > prevPrice.current ? 'up' : 'down'
    prevPrice.current = currentPrice
  }

  const bids = withCumulative(orderBook.bids, levels)
  const asks = withCumulative(orderBook.asks, levels)
  const bidWall = Math.max(...bids.map((l) => l.qty), 0)
  const askWall = Math.max(...asks.map((l) => l.qty), 0)
  const maxQty = Math.max(bidWall, askWall, Number.EPSILON)

  const bidTotal = bids[bids.length - 1]?.cum ?? 0
  const askTotal = asks[asks.length - 1]?.cum ?? 0
  const bidPct = bidTotal + askTotal > 0 ? (bidTotal / (bidTotal + askTotal)) * 100 : 50

  const bestBid = orderBook.bids[0]?.[0]
  const bestAsk = orderBook.asks[0]?.[0]
  const spread = bestBid && bestAsk ? bestAsk - bestBid : null
  const up = lastDirection.current === 'up'

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 pt-2 pb-2 shrink-0">
        <div className="flex justify-between text-xs font-semibold mb-1">
          <span className="text-green-400">Beli {bidPct.toFixed(0)}%</span>
          <span className="text-muted-foreground font-normal">Kekuatan antrean order</span>
          <span className="text-red-400">{(100 - bidPct).toFixed(0)}% Jual</span>
        </div>
        <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
          <div className="bg-green-500 transition-[width] duration-500" style={{ width: `${bidPct}%` }} />
          <div className="bg-red-500 flex-1" />
        </div>
      </div>

      <div className="grid grid-cols-3 px-3 py-1 text-xs text-muted-foreground border-y border-border shrink-0">
        <span>Harga (USDT)</span>
        <span className="text-right">Jumlah</span>
        <span className="text-right">Total (USDT)</span>
      </div>

      <div ref={asksRef} className="flex-1 min-h-0 flex flex-col-reverse justify-start overflow-hidden">
        {asks.map((l) => (
          <LevelRow key={`a-${l.price}`} level={l} maxQty={maxQty} isWall={l.qty === askWall} side="ask" />
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 border-y border-border bg-muted/30 shrink-0">
        <span className={cn('flex items-center gap-1 text-lg font-bold font-mono', up ? 'text-green-400' : 'text-red-400')}>
          {up ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          {formatPrice(currentPrice)}
        </span>
        {spread != null && (
          <span className="text-xs text-muted-foreground">Selisih beli-jual ${Number(spread.toPrecision(3))}</span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {bids.map((l) => (
          <LevelRow key={`b-${l.price}`} level={l} maxQty={maxQty} isWall={l.qty === bidWall} side="bid" />
        ))}
      </div>
    </div>
  )
}
