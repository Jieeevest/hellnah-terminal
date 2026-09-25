import { useState, useMemo } from 'react'
import { LayoutGrid } from 'lucide-react'
import type { Ticker } from '@/types'
import { CoinIcon } from '@/components/CoinIcon'
import { PanelHeader } from '@/components/ui/PanelHeader'
import { PillTabs } from '@/components/ui/PillTabs'
import { EmptyState } from '@/components/ui/EmptyState'

interface Props {
  tickers: Ticker[]
  onSelectCoin: (ticker: Ticker) => void
}

type Filter = 'all' | 'gainers' | 'losers'
type SortKey = 'change-desc' | 'change-asc' | 'volume' | 'name'

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'change-desc', label: 'Naik tertinggi' },
  { id: 'change-asc', label: 'Turun terdalam' },
  { id: 'volume', label: 'Volume terbesar' },
  { id: 'name', label: 'Nama A–Z' },
]

const SORTERS: Record<SortKey, (a: Ticker, b: Ticker) => number> = {
  'change-desc': (a, b) => b.priceChangePercent - a.priceChangePercent,
  'change-asc': (a, b) => a.priceChangePercent - b.priceChangePercent,
  volume: (a, b) => b.volume - a.volume,
  name: (a, b) => a.baseAsset.localeCompare(b.baseAsset),
}

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
  const [sortKey, setSortKey] = useState<SortKey>('change-desc')

  const filtered = useMemo(() => {
    let arr = [...tickers].sort(SORTERS[sortKey])
    if (filter === 'gainers') arr = arr.filter((t) => t.priceChangePercent > 0)
    if (filter === 'losers')  arr = arr.filter((t) => t.priceChangePercent < 0)
    return arr
  }, [tickers, filter, sortKey])

  // Filter "Turun" paling berguna kalau yang paling anjlok di atas — ikut ganti urutan otomatis.
  const changeFilter = (f: Filter) => {
    setFilter(f)
    if (f === 'losers' && sortKey === 'change-desc') setSortKey('change-asc')
    if (f === 'gainers' && sortKey === 'change-asc') setSortKey('change-desc')
  }

  const gainers = tickers.filter((t) => t.priceChangePercent > 0).length
  const losers  = tickers.filter((t) => t.priceChangePercent < 0).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader
        icon={LayoutGrid}
        title="Heatmap 24 jam"
        right={<><span className="text-green-400 font-semibold">↑{gainers}</span><span className="text-red-400 font-semibold">↓{losers}</span></>}
        subtitle={`${tickers.length} koin · klik kotak untuk membuka koinnya`}
      >
        <PillTabs
          value={filter}
          onChange={changeFilter}
          options={[{ id: 'all', label: 'Semua' }, { id: 'gainers', label: 'Naik' }, { id: 'losers', label: 'Turun' }]}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Urutkan:</span>
          <PillTabs value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} />
        </div>
      </PanelHeader>

      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="Tidak ada data" />
        ) : (
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {filtered.map((ticker) => {
              const pct = ticker.priceChangePercent
              const { bg, text } = cellColor(pct)
              return (
                <button
                  key={ticker.symbol}
                  onClick={() => onSelectCoin(ticker)}
                  className="rounded-lg p-2 flex flex-col items-center justify-center gap-1 min-h-14 hover:brightness-125 active:scale-95 transition"
                  style={{ backgroundColor: bg }}
                >
                  <span className="flex items-center gap-1 max-w-full">
                    <CoinIcon asset={ticker.baseAsset} size={16} />
                    <span className="text-xs font-bold leading-none truncate" style={{ color: text }}>{ticker.baseAsset}</span>
                  </span>
                  <span className="text-xs font-mono font-semibold leading-none" style={{ color: text }}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
