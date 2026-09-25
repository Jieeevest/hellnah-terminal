import { TrendingUp, TrendingDown, Zap } from 'lucide-react'
import type { Ticker, Exchange, MarketType } from '@/types'
import { useVolumeSpikes } from '@/hooks/useVolumeSpikes'
import { cn, formatNumber } from '@/lib/utils'
import { CoinIcon } from '@/components/CoinIcon'
import { PanelHeader } from '@/components/ui/PanelHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge, type BadgeTone } from '@/components/ui/Badge'

interface Props {
  tickers: Ticker[]
  exchange: Exchange
  marketType: MarketType
  onSelectCoin: (ticker: Ticker) => void
}

function spikeLevel(ratio: number): { label: string; tone: BadgeTone; bar: string } {
  if (ratio >= 5) return { label: 'Sangat ramai', tone: 'orange', bar: 'bg-orange-400' }
  if (ratio >= 3) return { label: 'Ramai', tone: 'yellow', bar: 'bg-yellow-400' }
  return { label: 'Naik', tone: 'blue', bar: 'bg-sky-400' }
}

export function VolumeAnomalyPanel({ tickers, marketType, onSelectCoin }: Props) {
  const { spikes, progress, scanning, lastRunAt } = useVolumeSpikes(tickers, marketType)
  const maxRatio = Math.max(...spikes.map((s) => s.ratio), 1)
  const minutesAgo = lastRunAt ? Math.floor((Date.now() - lastRunAt) / 60_000) : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader
        icon={Zap}
        iconClassName="text-yellow-400"
        title="Lonjakan Volume"
        right={scanning ? `Memindai ${progress}%` : minutesAgo != null ? `${spikes.length} koin · ${minutesAgo < 1 ? 'baru saja' : `${minutesAgo} mnt lalu`}` : null}
        subtitle="Volume 24 jam dibanding rata-rata harian 7 hari koin itu sendiri · 100 koin teratas, tanpa stablecoin"
      >
        {scanning && (
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-yellow-400 transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}
      </PanelHeader>

      <div className="flex-1 overflow-y-auto">
        {!spikes.length ? (
          scanning || !lastRunAt
            ? <EmptyState loading title="Membandingkan volume dengan 7 hari terakhir…" />
            : <EmptyState icon={Zap} title="Tidak ada lonjakan volume saat ini" description="Minimal 1,8× dari rata-rata hariannya" />
        ) : (
          spikes.map(({ ticker, ratio, avgDailyVolume }) => {
            const isUp = ticker.priceChangePercent >= 0
            const level = spikeLevel(ratio)
            return (
              <button
                key={ticker.symbol}
                onClick={() => onSelectCoin(ticker)}
                className="w-full flex items-center gap-2.5 px-3 py-2 border-b border-border/40 hover:bg-muted/30 transition-colors text-left"
              >
                <CoinIcon asset={ticker.baseAsset} size={24} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{ticker.baseAsset}</span>
                    <span className={cn('inline-flex items-center gap-0.5 text-xs font-mono', isUp ? 'text-green-400' : 'text-red-400')}>
                      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {isUp ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}%
                    </span>
                    <Badge tone={level.tone}>{level.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full', level.bar)} style={{ width: `${(ratio / maxRatio) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                      ${formatNumber(ticker.volume)} <span className="opacity-60">vs ${formatNumber(avgDailyVolume)}</span>
                    </span>
                  </div>
                </div>
                <span className="text-lg font-bold font-mono text-foreground w-14 text-right">{ratio.toFixed(1)}×</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
