import { useState, useMemo, useEffect } from 'react'
import { Search, TrendingUp, TrendingDown, ChevronUp, ChevronDown, ChevronsUpDown, Loader2, Star } from 'lucide-react'
import type { Ticker, Exchange, MarketType } from '@/types'
import { formatNumber, formatPrice, cn } from '@/lib/utils'
import { useTimeframePercent } from '@/hooks/useTimeframePercent'
import { CoinIcon } from '@/components/CoinIcon'
import { Pill } from '@/components/ui/PillTabs'

type SortKey = 'default' | 'volume' | 'change'
type SortDir = 'asc' | 'desc'
type Timeframe = '24h' | '4h' | '1h' | '15m' | '5m'
type FilterMode = 'all' | 'top10' | 'top25' | 'watchlist'

const TIMEFRAMES: Timeframe[] = ['24h', '4h', '1h', '15m', '5m']

interface Props {
  tickers: Ticker[]
  loading: boolean
  selectedSymbol: string
  exchange: Exchange
  marketType: MarketType
  onSelect: (ticker: Ticker) => void
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-4 w-4 opacity-40" />
  return dir === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
}

function PctCell({ pct, loading }: { pct: number | null | undefined; loading: boolean }) {
  if (loading && pct == null) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
  }
  if (pct == null) return <span className="text-muted-foreground text-xs">—</span>
  const pos = pct >= 0
  return (
    <div className={cn('text-xs font-medium flex items-center justify-end gap-0.5', pos ? 'text-green-400' : 'text-red-400')}>
      {pos ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      {Math.abs(pct).toFixed(2)}%
    </div>
  )
}

export function CoinList({ tickers, loading, selectedSymbol, exchange, marketType, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('default')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [timeframe, setTimeframe] = useState<Timeframe>('24h')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [watchlist, setWatchlist] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('hellnah-terminal_watchlist')
      if (stored) setWatchlist(JSON.parse(stored))
    } catch (e) {}
  }, [])

  const toggleWatchlist = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation()
    setWatchlist(prev => {
      const next = prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
      localStorage.setItem('hellnah-terminal_watchlist', JSON.stringify(next))
      return next
    })
  }

  const isFutures = marketType === 'futures'


  const symbols = useMemo(() => tickers.map((t) => t.symbol), [tickers])

  const { percents: tfPercents, loading: tfLoading } = useTimeframePercent(
    symbols,
    exchange,
    marketType,
    timeframe === '24h' ? null : timeframe
  )

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    let filtered = tickers.filter(
      (t) =>
        t.baseAsset.toLowerCase().includes(search.toLowerCase()) ||
        t.symbol.toLowerCase().includes(search.toLowerCase())
    )

    if (filterMode === 'watchlist') {
      filtered = filtered.filter(t => watchlist.includes(t.symbol))
    } else if (filterMode === 'top10') {
      filtered = [...filtered].sort((a, b) => b.volume - a.volume).slice(0, 10)
    } else if (filterMode === 'top25') {
      filtered = [...filtered].sort((a, b) => b.volume - a.volume).slice(0, 25)
    }

    if (sortKey === 'default') return filtered

    return [...filtered].sort((a, b) => {
      let valA: number
      let valB: number
      if (sortKey === 'volume') {
        valA = a.volume
        valB = b.volume
      } else {
        // sort by active timeframe percent
        valA = timeframe === '24h' ? a.priceChangePercent : (tfPercents[a.symbol] ?? -Infinity)
        valB = timeframe === '24h' ? b.priceChangePercent : (tfPercents[b.symbol] ?? -Infinity)
      }
      return sortDir === 'desc' ? valB - valA : valA - valB
    })
  }, [tickers, search, sortKey, sortDir, timeframe, tfPercents, filterMode, watchlist])

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-5 w-5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari koin..."
            className="w-full min-h-9 bg-muted rounded-lg pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Filter Mode & Timeframe */}
      <div className="flex flex-col gap-1.5 px-3 py-2 border-b border-border">
        <div className="flex gap-1">
          {(['all', 'top10', 'top25', 'watchlist'] as FilterMode[]).map((mode) => (
            <Pill key={mode} active={filterMode === mode} onClick={() => setFilterMode(mode)} className="flex-1 px-1">
              {mode === 'all' ? 'Semua' : mode === 'top10' ? 'Top 10' : mode === 'top25' ? 'Top 25' : '★ Favorit'}
            </Pill>
          ))}
        </div>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <Pill key={tf} active={timeframe === tf} onClick={() => setTimeframe(tf)} className="flex-1 px-1">
              {tf}
            </Pill>
          ))}
        </div>
      </div>

      {/* Column header */}
      <div className="flex items-center text-xs text-muted-foreground px-3 py-1.5 border-b border-border font-medium select-none">
        <span className="flex-1">Pasangan</span>
        <button
          onClick={() => handleSort('volume')}
          className={cn(
            'flex items-center gap-0.5 w-20 justify-end hover:text-foreground transition-colors',
            sortKey === 'volume' && 'text-primary'
          )}
        >
          Vol
          <SortIcon active={sortKey === 'volume'} dir={sortDir} />
        </button>
        <button
          onClick={() => handleSort('change')}
          className={cn(
            'flex items-center gap-0.5 w-16 justify-end hover:text-foreground transition-colors',
            sortKey === 'change' && 'text-primary'
          )}
        >
          {timeframe}
          {tfLoading && timeframe !== '24h' && (
            <Loader2 className="h-4 w-4 animate-spin ml-0.5" />
          )}
          <SortIcon active={sortKey === 'change'} dir={sortDir} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          sorted.map((ticker) => {
            const isSelected = ticker.symbol === selectedSymbol
            const displayPct = timeframe === '24h'
              ? ticker.priceChangePercent
              : (tfPercents[ticker.symbol] ?? null)

            return (
              <button
                key={ticker.symbol}
                onClick={() => onSelect(ticker)}
                className={cn(
                  'w-full flex items-center px-3 py-1.5 hover:bg-muted/50 transition-colors text-left group',
                  isSelected && 'bg-muted border-l-2 border-primary'
                )}
              >
                <div 
                  onClick={(e) => toggleWatchlist(e, ticker.symbol)}
                  className="mr-2 text-muted-foreground hover:text-yellow-400 transition-colors shrink-0"
                >
                  <Star className={cn("h-4 w-4", watchlist.includes(ticker.symbol) && "fill-yellow-400 text-yellow-400")} />
                </div>
                <CoinIcon
                  asset={ticker.baseAsset}
                  size={24}
                  className={cn('mr-2.5 group-hover:scale-110', isSelected && 'ring-2 ring-primary')}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-sm font-bold text-foreground truncate">{ticker.baseAsset}</span>
                    <span className="text-xs text-muted-foreground hidden 2xl:inline">
                      {isFutures ? '/PERP' : '/USDT'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap truncate">
                    Vol {formatNumber(ticker.volume)}
                  </div>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <div className="text-sm font-mono font-semibold text-foreground">{formatPrice(ticker.price)}</div>
                  <PctCell pct={displayPct} loading={tfLoading} />
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
