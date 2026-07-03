import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Radio, TrendingUp, TrendingDown, Minus, Zap, AlertTriangle } from 'lucide-react'
import { useLunarCrush, type LunarCoin } from '@/hooks/useLunarCrush'
import type { Ticker } from '@/types'
import { cn } from '@/lib/utils'

type SortBy = 'galaxy' | 'altrank' | 'social' | 'sentiment'

interface Props {
  selectedCoin: string | null
  onSelectCoin?: (baseAsset: string) => void
  tickers?: Ticker[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function gsColor(score: number) {
  if (score >= 75) return 'text-green-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

function gsBg(score: number) {
  if (score >= 75) return 'bg-green-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

function sentimentColor(pct: number) {
  if (pct >= 60) return 'text-green-400'
  if (pct >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

function sentimentBadge(pct: number) {
  if (pct >= 60) return { label: 'Bullish', color: 'text-green-400', bg: 'bg-green-500/15', icon: <TrendingUp className="h-3 w-3" /> }
  if (pct >= 40) return { label: 'Netral',  color: 'text-yellow-400', bg: 'bg-yellow-500/15', icon: <Minus className="h-3 w-3" /> }
  return           { label: 'Bearish', color: 'text-red-400',    bg: 'bg-red-500/15',    icon: <TrendingDown className="h-3 w-3" /> }
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GalaxyBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', gsBg(score))}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className={cn('text-[10px] font-mono font-bold w-6 text-right', gsColor(score))}>
        {score}
      </span>
    </div>
  )
}

function CoinDetailCard({ coin }: { coin: LunarCoin }) {
  const badge = sentimentBadge(coin.sentiment)
  return (
    <div className="mx-3 mt-3 mb-2 rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-foreground">{coin.symbol}</span>
          <span className="ml-1.5 text-[10px] text-muted-foreground">{coin.name}</span>
        </div>
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1', badge.color, badge.bg)}>
          {badge.icon}{badge.label}
        </span>
      </div>

      <div>
        <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
          <span>Galaxy Score</span>
          <span className={gsColor(coin.galaxyScore)}>
            {coin.galaxyScore >= 75 ? 'Tinggi' : coin.galaxyScore >= 50 ? 'Sedang' : 'Rendah'}
          </span>
        </div>
        <GalaxyBar score={coin.galaxyScore} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded border border-border bg-background/50 px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground mb-0.5">AltRank</div>
          <div className={cn('text-xs font-bold font-mono',
            coin.altRank <= 10 ? 'text-green-400' : coin.altRank <= 50 ? 'text-yellow-400' : 'text-foreground'
          )}>#{coin.altRank}</div>
        </div>
        <div className="rounded border border-border bg-background/50 px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground mb-0.5">Sentimen</div>
          <div className={cn('text-xs font-bold font-mono', sentimentColor(coin.sentiment))}>{coin.sentiment}%</div>
        </div>
        <div className="rounded border border-border bg-background/50 px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground mb-0.5">Social/24h</div>
          <div className="text-xs font-bold font-mono text-foreground">{fmt(coin.socialVolume)}</div>
        </div>
      </div>

      {coin.socialDominance > 0 && (
        <div className="flex items-center justify-between text-[9px]">
          <span className="text-muted-foreground">Social Dominance</span>
          <span className="font-mono text-foreground">{coin.socialDominance.toFixed(2)}%</span>
        </div>
      )}
    </div>
  )
}

function TrendingRow({ coin, rank, onClick }: { coin: LunarCoin; rank: number; onClick?: () => void }) {
  const badge = sentimentBadge(coin.sentiment)
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 border-b border-border/50 last:border-0 transition-colors',
        onClick ? 'cursor-pointer hover:bg-muted/30 active:bg-muted/50' : 'hover:bg-muted/20'
      )}
    >
      <span className="text-[9px] text-muted-foreground w-4 shrink-0 text-right">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-foreground">{coin.symbol}</span>
          <span className={cn('text-[8px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5', badge.color, badge.bg)}>
            {coin.sentiment}%
          </span>
        </div>
        <GalaxyBar score={coin.galaxyScore} />
      </div>
      <div className="shrink-0 text-right">
        <div className={cn('text-[9px] font-mono font-bold',
          coin.altRank <= 10 ? 'text-green-400' : coin.altRank <= 50 ? 'text-yellow-400' : 'text-muted-foreground'
        )}>#{coin.altRank}</div>
        <div className="text-[8px] text-muted-foreground">{fmt(coin.socialVolume)}</div>
      </div>
    </div>
  )
}

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: 'galaxy',    label: 'GS' },
  { id: 'altrank',   label: 'Rank' },
  { id: 'social',    label: 'Vol' },
  { id: 'sentiment', label: 'Sent' },
]

// ── Main component ────────────────────────────────────────────────────────────

export function LunarCrushPanel({ selectedCoin, onSelectCoin, tickers }: Props) {
  const { coins, loading, error, lastUpdated, getCoin, refetch } = useLunarCrush()
  const [sortBy, setSortBy] = useState<SortBy>('galaxy')
  const [onlyExchange, setOnlyExchange] = useState(false)

  const selectedData = selectedCoin ? getCoin(selectedCoin) : null

  // Set baseAsset dari exchange aktif
  const exchangeSet = useMemo(
    () => new Set(tickers?.map((t) => t.baseAsset) ?? []),
    [tickers]
  )

  // Map baseAsset → priceChangePercent untuk divergence
  const priceMap = useMemo(
    () => new Map(tickers?.map((t) => [t.baseAsset, t.priceChangePercent]) ?? []),
    [tickers]
  )

  const sortedCoins = useMemo(() => {
    let arr = onlyExchange && exchangeSet.size > 0
      ? coins.filter((c) => exchangeSet.has(c.symbol))
      : [...coins]
    switch (sortBy) {
      case 'galaxy':    return arr.sort((a, b) => b.galaxyScore - a.galaxyScore)
      case 'altrank':   return arr.sort((a, b) => a.altRank - b.altRank)
      case 'social':    return arr.sort((a, b) => b.socialVolume - a.socialVolume)
      case 'sentiment': return arr.sort((a, b) => b.sentiment - a.sentiment)
    }
  }, [coins, sortBy, onlyExchange, exchangeSet])

  // [2] Divergence detector
  const divergences = useMemo(() => {
    if (!tickers?.length || !coins.length) return { bullish: [], bearish: [] }
    const bullish: Array<{ coin: LunarCoin; pricePct: number }> = []
    const bearish: Array<{ coin: LunarCoin; pricePct: number }> = []
    for (const coin of coins) {
      const pct = priceMap.get(coin.symbol)
      if (pct == null) continue
      if (coin.sentiment >= 60 && pct <= -3)
        bullish.push({ coin, pricePct: pct })
      else if (coin.sentiment <= 40 && pct >= 3)
        bearish.push({ coin, pricePct: pct })
    }
    return {
      bullish: bullish.sort((a, b) => a.pricePct - b.pricePct).slice(0, 4),
      bearish: bearish.sort((a, b) => b.pricePct - a.pricePct).slice(0, 4),
    }
  }, [coins, tickers, priceMap])

  // [4] Social spike detection — coins di atas 2.5× median social volume
  const spikes = useMemo(() => {
    if (coins.length === 0) return []
    const vols = [...coins].map((c) => c.socialVolume).sort((a, b) => a - b)
    const median = vols[Math.floor(vols.length / 2)]
    if (median === 0) return []
    return coins
      .filter((c) => c.socialVolume > median * 2.5 && c.socialVolume > 500)
      .sort((a, b) => b.socialVolume - a.socialVolume)
      .slice(0, 5)
  }, [coins])

  const hasDivergence = divergences.bullish.length > 0 || divergences.bearish.length > 0
  const minutesAgo = lastUpdated ? Math.floor((Date.now() - lastUpdated) / 60_000) : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 bg-muted/20">
        <div className="flex items-center gap-1.5">
          <Radio className="h-3 w-3 text-purple-400" />
          <span className="text-[10px] font-semibold text-foreground">LunarCrush Social</span>
        </div>
        <div className="flex items-center gap-2">
          {minutesAgo != null && (
            <span className="text-[9px] text-muted-foreground">{minutesAgo}m lalu</span>
          )}
          <button
            onClick={refetch}
            disabled={loading}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {error && !loading && (
        <div className="mx-3 mt-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 shrink-0">
          <p className="text-[10px] text-red-400 font-medium">Gagal memuat data</p>
          <p className="text-[9px] text-red-400/70 mt-0.5">{error}</p>
        </div>
      )}

      {loading && coins.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 flex-1">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Memuat data sosial...</span>
        </div>
      )}

      {coins.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          {/* Selected coin card */}
          {selectedData && <CoinDetailCard coin={selectedData} />}

          {/* [2] Divergence section */}
          {hasDivergence && (
            <div className="mx-3 mt-3 mb-2 rounded-lg border border-border overflow-hidden">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/30 border-b border-border">
                <Zap className="h-3 w-3 text-yellow-400" />
                <span className="text-[9px] font-semibold text-foreground uppercase tracking-wide">Divergence Signal</span>
              </div>

              {divergences.bullish.length > 0 && (
                <div className="px-2.5 py-1.5 border-b border-border/50">
                  <div className="flex items-center gap-1 mb-1.5">
                    <TrendingUp className="h-3 w-3 text-green-400" />
                    <span className="text-[9px] font-semibold text-green-400">Akumulasi Potensial</span>
                    <span className="text-[8px] text-muted-foreground ml-auto">Sosial bullish, harga turun</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {divergences.bullish.map(({ coin, pricePct }) => (
                      <div
                        key={coin.symbol}
                        onClick={() => onSelectCoin?.(coin.symbol)}
                        className={cn('flex items-center justify-between', onSelectCoin && 'cursor-pointer hover:opacity-80')}
                      >
                        <span className="text-[10px] font-bold text-foreground">{coin.symbol}</span>
                        <div className="flex items-center gap-2 text-[9px]">
                          <span className="text-red-400 font-mono">{pricePct.toFixed(1)}%</span>
                          <span className="text-green-400 font-mono">sent {coin.sentiment}%</span>
                          <span className={cn('font-mono', gsColor(coin.galaxyScore))}>GS {coin.galaxyScore}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {divergences.bearish.length > 0 && (
                <div className="px-2.5 py-1.5">
                  <div className="flex items-center gap-1 mb-1.5">
                    <AlertTriangle className="h-3 w-3 text-orange-400" />
                    <span className="text-[9px] font-semibold text-orange-400">Warning Distribusi</span>
                    <span className="text-[8px] text-muted-foreground ml-auto">Sosial bearish, harga naik</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {divergences.bearish.map(({ coin, pricePct }) => (
                      <div
                        key={coin.symbol}
                        onClick={() => onSelectCoin?.(coin.symbol)}
                        className={cn('flex items-center justify-between', onSelectCoin && 'cursor-pointer hover:opacity-80')}
                      >
                        <span className="text-[10px] font-bold text-foreground">{coin.symbol}</span>
                        <div className="flex items-center gap-2 text-[9px]">
                          <span className="text-green-400 font-mono">+{pricePct.toFixed(1)}%</span>
                          <span className="text-red-400 font-mono">sent {coin.sentiment}%</span>
                          <span className={cn('font-mono', gsColor(coin.galaxyScore))}>GS {coin.galaxyScore}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* [4] Social spike section */}
          {spikes.length > 0 && (
            <div className="mx-3 mb-2 rounded-lg border border-border overflow-hidden">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/30 border-b border-border">
                <Zap className="h-3 w-3 text-purple-400" />
                <span className="text-[9px] font-semibold text-foreground uppercase tracking-wide">Social Spike</span>
                <span className="text-[8px] text-muted-foreground ml-auto">Volume sosial melonjak</span>
              </div>
              <div className="flex flex-col">
                {spikes.map((coin) => {
                  const badge = sentimentBadge(coin.sentiment)
                  return (
                    <div
                      key={coin.symbol}
                      onClick={() => onSelectCoin?.(coin.symbol)}
                      className={cn(
                        'flex items-center justify-between px-2.5 py-1.5 border-b border-border/40 last:border-0',
                        onSelectCoin && 'cursor-pointer hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-foreground">{coin.symbol}</span>
                        <span className={cn('text-[8px] font-bold px-1 rounded', badge.color, badge.bg)}>
                          {coin.sentiment}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px]">
                        <span className="text-purple-400 font-mono font-bold">{fmt(coin.socialVolume)}</span>
                        <span className={cn('font-mono', gsColor(coin.galaxyScore))}>GS {coin.galaxyScore}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sort + filter + trending header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/10 sticky top-0 z-10">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Trending</span>
            <div className="flex items-center gap-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id)}
                  className={cn(
                    'text-[8px] font-semibold px-1.5 py-0.5 rounded transition-colors',
                    sortBy === opt.id
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {/* [1] Filter exchange toggle */}
              {tickers?.length ? (
                <button
                  onClick={() => setOnlyExchange((v) => !v)}
                  className={cn(
                    'text-[8px] font-semibold px-1.5 py-0.5 rounded transition-colors border ml-1',
                    onlyExchange
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'text-muted-foreground border-border hover:text-foreground'
                  )}
                  title={onlyExchange ? 'Tampilkan semua koin' : 'Filter ke koin di exchange ini'}
                >
                  {onlyExchange ? 'Exchange' : 'Semua'}
                </button>
              ) : null}
            </div>
          </div>

          {sortedCoins.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-[10px] text-muted-foreground">
              Tidak ada koin yang cocok dengan filter exchange
            </div>
          ) : (
            sortedCoins.map((coin, i) => (
              <TrendingRow
                key={coin.symbol}
                coin={coin}
                rank={i + 1}
                onClick={onSelectCoin ? () => onSelectCoin(coin.symbol) : undefined}
              />
            ))
          )}

          <div className="px-3 py-3 text-center">
            <span className="text-[8px] text-muted-foreground">
              Data dari LunarCrush · diperbarui tiap 5 menit
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
