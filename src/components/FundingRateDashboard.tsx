import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { Ticker, Exchange } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  tickers: Ticker[]
  exchange: Exchange
  onSelectCoin: (ticker: Ticker) => void
}

type SortKey = 'funding' | 'price' | 'oi'

export function FundingRateDashboard({ tickers, onSelectCoin }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('funding')
  const [sortAsc, setSortAsc] = useState(false)

  const withFunding = useMemo(
    () => tickers.filter((t) => t.fundingRate != null),
    [tickers],
  )

  const sorted = useMemo(() => {
    return [...withFunding].sort((a, b) => {
      let diff = 0
      if (sortKey === 'funding') diff = (a.fundingRate ?? 0) - (b.fundingRate ?? 0)
      else if (sortKey === 'price') diff = a.priceChangePercent - b.priceChangePercent
      else if (sortKey === 'oi') diff = (a.openInterest ?? 0) - (b.openInterest ?? 0)
      return sortAsc ? diff : -diff
    })
  }, [withFunding, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const SortBtn = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      onClick={() => toggleSort(k)}
      className={cn(
        'text-[9px] font-semibold transition-colors',
        sortKey === k ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
    </button>
  )

  if (withFunding.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground px-4 text-center">
        Tidak ada data funding rate. Pastikan mode Futures aktif.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary */}
      <div className="px-3 py-1.5 border-b border-border shrink-0 flex items-center gap-3 text-[9px] text-muted-foreground">
        <span>{withFunding.length} pairs</span>
        <span className="text-green-400">
          Long bayar: {withFunding.filter(t => (t.fundingRate ?? 0) > 0).length}
        </span>
        <span className="text-red-400 ml-auto">
          Short bayar: {withFunding.filter(t => (t.fundingRate ?? 0) < 0).length}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-1 border-b border-border shrink-0">
        <span className="text-[9px] text-muted-foreground">Koin</span>
        <SortBtn label="Funding" k="funding" />
        <SortBtn label="24h %" k="price" />
        <SortBtn label="OI" k="oi" />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((ticker) => {
          const fr = ticker.fundingRate ?? 0
          const isUp = ticker.priceChangePercent >= 0
          const frExtreme = Math.abs(fr) >= 0.05
          return (
            <button
              key={ticker.symbol}
              onClick={() => onSelectCoin(ticker)}
              className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-3 py-1.5 border-b border-border/40 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-foreground truncate">{ticker.baseAsset}</p>
                <p className="text-[9px] font-mono text-muted-foreground truncate">
                  {ticker.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </p>
              </div>
              <span className={cn(
                'text-[9px] font-mono font-bold text-right',
                fr > 0 ? 'text-orange-400' : fr < 0 ? 'text-blue-400' : 'text-muted-foreground',
                frExtreme && 'bg-opacity-20 px-1 rounded',
                fr > 0 && frExtreme && 'bg-orange-500/20',
                fr < 0 && frExtreme && 'bg-blue-500/20',
              )}>
                {fr >= 0 ? '+' : ''}{fr.toFixed(4)}%
              </span>
              <span className={cn('text-[9px] font-mono text-right flex items-center gap-0.5 justify-end',
                isUp ? 'text-green-400' : 'text-red-400'
              )}>
                {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {isUp ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}%
              </span>
              <span className="text-[9px] font-mono text-muted-foreground text-right">
                {ticker.openInterest != null
                  ? `${(ticker.openInterest / 1_000_000).toFixed(1)}M`
                  : '—'
                }
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
