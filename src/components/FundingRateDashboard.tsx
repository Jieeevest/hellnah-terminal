import { useMemo, useState } from 'react'
import { Percent, TrendingUp, TrendingDown } from 'lucide-react'
import type { Ticker, Exchange } from '@/types'
import { cn } from '@/lib/utils'
import { CoinIcon } from '@/components/CoinIcon'
import { PanelHeader } from '@/components/ui/PanelHeader'
import { Pill } from '@/components/ui/PillTabs'
import { EmptyState } from '@/components/ui/EmptyState'

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

  const SORT_LABEL: Record<SortKey, string> = { funding: 'Funding', price: 'Perubahan 24j', oi: 'Open Interest' }
  // Ticker futures dari Binance tidak selalu membawa open interest — kolomnya disembunyikan kalau kosong semua.
  const hasOI = withFunding.some((t) => (t.openInterest ?? 0) > 0)
  const sortKeys = (Object.keys(SORT_LABEL) as SortKey[]).filter((k) => k !== 'oi' || hasOI)
  const cols = hasOI ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto]'

  if (withFunding.length === 0) {
    return <EmptyState icon={Percent} title="Tidak ada data funding rate" description="Funding rate hanya ada di mode Futures." />
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader
        icon={Percent}
        title="Funding Rate"
        right={<><span className="text-orange-400">{withFunding.filter((t) => (t.fundingRate ?? 0) > 0).length} long bayar</span><span className="text-sky-400">{withFunding.filter((t) => (t.fundingRate ?? 0) < 0).length} short bayar</span></>}
        subtitle="Positif = long membayar short (banyak yang long). Negatif = short membayar long (banyak yang short)."
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Urutkan:</span>
          {sortKeys.map((k) => (
            <Pill key={k} active={sortKey === k} onClick={() => toggleSort(k)} title="Klik lagi untuk membalik urutan">
              {SORT_LABEL[k]} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
            </Pill>
          ))}
        </div>
      </PanelHeader>

      <div className={cn('grid gap-3 px-3 py-1 border-b border-border shrink-0 text-xs text-muted-foreground', cols)}>
        <span>Koin</span>
        <span className="text-right">Funding</span>
        <span className="text-right">24j</span>
        {hasOI && <span className="text-right w-12">OI</span>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {sorted.map((ticker) => {
          const fr = ticker.fundingRate ?? 0
          const isUp = ticker.priceChangePercent >= 0
          const frExtreme = Math.abs(fr) >= 0.05
          return (
            <button
              key={ticker.symbol}
              onClick={() => onSelectCoin(ticker)}
              className={cn('w-full grid gap-3 items-center px-3 py-1.5 border-b border-border/40 hover:bg-muted/30 transition-colors text-left', cols)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <CoinIcon asset={ticker.baseAsset} size={22} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{ticker.baseAsset}</p>
                  <p className="text-xs font-mono text-muted-foreground truncate">
                    {ticker.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                  </p>
                </div>
              </div>
              <span className={cn(
                'text-xs font-mono font-bold text-right px-1 rounded',
                fr > 0 ? 'text-orange-400' : fr < 0 ? 'text-sky-400' : 'text-muted-foreground',
                fr > 0 && frExtreme && 'bg-orange-500/20',
                fr < 0 && frExtreme && 'bg-sky-500/20',
              )}>
                {fr >= 0 ? '+' : ''}{fr.toFixed(4)}%
              </span>
              <span className={cn('text-xs font-mono text-right flex items-center gap-0.5 justify-end', isUp ? 'text-green-400' : 'text-red-400')}>
                {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {isUp ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}%
              </span>
              {hasOI && (
                <span className="text-xs font-mono text-muted-foreground text-right w-12">
                  {ticker.openInterest ? `${(ticker.openInterest / 1_000_000).toFixed(1)}M` : '—'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
