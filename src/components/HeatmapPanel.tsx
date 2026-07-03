import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { Ticker } from '@/types'

interface Props {
  tickers: Ticker[]
  onSelectCoin: (ticker: Ticker) => void
}

type Filter = 'all' | 'gainers' | 'losers'

function cellColor(pct: number): { bg: string; text: string } {
  if (pct >= 10)  return { bg: '#064e2b', text: '#ffffff' }
  if (pct >= 5)   return { bg: '#065f46', text: '#ffffff' }
  if (pct >= 3)   return { bg: '#047857', text: '#ffffff' }
  if (pct >= 1)   return { bg: '#059669', text: '#d1fae5' }
  if (pct >= 0)   return { bg: '#1e2d22', text: '#6ee7b7' }
  if (pct >= -1)  return { bg: '#2d1e1e', text: '#fca5a5' }
  if (pct >= -3)  return { bg: '#7f1d1d', text: '#fecaca' }
  if (pct >= -5)  return { bg: '#991b1b', text: '#ffffff' }
  return           { bg: '#450a0a', text: '#ffffff' }
}

export function HeatmapPanel({ tickers, onSelectCoin }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    let arr = [...tickers].sort((a, b) => b.priceChangePercent - a.priceChangePercent)
    if (filter === 'gainers') arr = arr.filter((t) => t.priceChangePercent > 0)
    if (filter === 'losers')  arr = arr.filter((t) => t.priceChangePercent < 0)
    return arr
  }, [tickers, filter])

  const gainers = tickers.filter((t) => t.priceChangePercent > 0).length
  const losers  = tickers.filter((t) => t.priceChangePercent < 0).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 bg-muted/20">
        <span className="text-[10px] font-semibold text-foreground">
          Heatmap 24h · {tickers.length} koin
        </span>
        <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
          <span className="text-green-400 font-semibold">↑{gainers}</span>
          <span className="text-red-400 font-semibold">↓{losers}</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex border-b border-border shrink-0">
        {(['all', 'gainers', 'losers'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 text-[10px] font-semibold transition-colors ${
              filter === f ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'all' ? 'Semua' : f === 'gainers' ? 'Naik' : 'Turun'}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {filtered.map((ticker) => {
            const pct = ticker.priceChangePercent
            const { bg, text } = cellColor(pct)
            return (
              <motion.button
                key={ticker.symbol}
                onClick={() => onSelectCoin(ticker)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
                className="rounded p-2 flex flex-col items-center justify-center gap-0.5 min-h-[52px] hover:opacity-90 active:scale-95 transition-transform"
                style={{ backgroundColor: bg }}
              >
                <span className="text-[10px] font-bold leading-none" style={{ color: text }}>
                  {ticker.baseAsset}
                </span>
                <span className="text-[9px] font-mono font-semibold leading-none" style={{ color: text }}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                </span>
              </motion.button>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[10px] text-muted-foreground">
            Tidak ada data
          </div>
        )}
      </div>
    </div>
  )
}
