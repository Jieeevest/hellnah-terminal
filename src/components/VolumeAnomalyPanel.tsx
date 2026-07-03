import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Zap } from 'lucide-react'
import type { Ticker, Exchange, MarketType } from '@/types'
import { detectVolumeAnomalies } from '@/lib/volumeAnomaly'
import { cn, formatNumber } from '@/lib/utils'

interface Props {
  tickers: Ticker[]
  exchange: Exchange
  marketType: MarketType
  onSelectCoin: (ticker: Ticker) => void
}

export function VolumeAnomalyPanel({ tickers, onSelectCoin }: Props) {
  const anomalies = useMemo(() => detectVolumeAnomalies(tickers), [tickers])

  if (tickers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">
        Menunggu data ticker...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header info */}
      <div className="px-3 py-1.5 border-b border-border shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <Zap className="h-3 w-3 text-yellow-400" />
          Volume spike vs rata-rata pasar · {tickers.length} koin dipantau
        </div>
        <span className="text-[9px] font-semibold text-yellow-400">{anomalies.length} anomali</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 px-3 py-1 border-b border-border shrink-0 text-[9px] text-muted-foreground">
        <span>Koin</span>
        <span className="text-right">Volume 24h</span>
        <span className="text-right">Rasio</span>
        <span className="text-right">Z-Score</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {anomalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <Zap className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-[10px] text-muted-foreground">Tidak ada volume anomali saat ini</p>
            <p className="text-[9px] text-muted-foreground/60">Threshold: Z-Score ≥ 1.5</p>
          </div>
        ) : (
          anomalies.map(({ ticker, zScore, volumeRatio }) => {
            const isUp = ticker.priceChangePercent >= 0
            return (
              <button
                key={ticker.symbol}
                onClick={() => onSelectCoin(ticker)}
                className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-1 items-center px-3 py-2 border-b border-border/40 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    zScore >= 3 ? 'bg-orange-400' : 'bg-yellow-400'
                  )} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-foreground truncate">{ticker.baseAsset}</p>
                    <p className={cn('text-[9px] flex items-center gap-0.5', isUp ? 'text-green-400' : 'text-red-400')}>
                      {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {isUp ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-muted-foreground text-right">
                  {formatNumber(ticker.volume)}
                </span>
                <span className={cn(
                  'text-[9px] font-mono font-semibold text-right',
                  volumeRatio >= 5 ? 'text-orange-400' : volumeRatio >= 3 ? 'text-yellow-400' : 'text-foreground/70'
                )}>
                  {volumeRatio.toFixed(1)}×
                </span>
                <span className={cn(
                  'text-[9px] font-mono font-bold text-right',
                  zScore >= 3 ? 'text-orange-400' : 'text-yellow-400'
                )}>
                  {zScore.toFixed(1)}σ
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
