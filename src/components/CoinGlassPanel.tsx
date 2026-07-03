import { RefreshCw, Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { useCoinGlass } from '@/hooks/useCoinGlass'
import { cn } from '@/lib/utils'

interface Props {
  baseAsset: string | null
}

function formatUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toFixed(0)}`
}

export function CoinGlassPanel({ baseAsset }: Props) {
  const { data, loading, error, refetch } = useCoinGlass(baseAsset)

  const lsWarning = data
    ? data.longPercent >= 65 ? 'long' : data.shortPercent >= 65 ? 'short' : null
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-foreground">
            Open Interest{baseAsset ? ` · ${baseAsset}` : ''}
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <button
          onClick={refetch}
          disabled={loading || !baseAsset}
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {!baseAsset ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[10px] text-muted-foreground">Pilih koin terlebih dahulu</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-[10px] text-red-400 text-center">{error}</p>
        </div>
      ) : !data ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* OI Total */}
          <div className="px-3 py-3 border-b border-border">
            <p className="text-[9px] text-muted-foreground mb-0.5">Total Open Interest</p>
            <p className="text-xl font-bold font-mono text-foreground">{formatUsd(data.oiTotalUsd)}</p>
          </div>

          {/* Long/Short Bar */}
          <div className="px-3 py-3 border-b border-border">
            <p className="text-[9px] text-muted-foreground mb-2">Long / Short Ratio</p>
            <div className="flex rounded overflow-hidden h-5 mb-1.5">
              <div
                className="bg-green-500/80 flex items-center justify-center"
                style={{ width: `${data.longPercent}%` }}
              >
                <span className="text-[9px] font-bold text-white">{data.longPercent.toFixed(1)}%</span>
              </div>
              <div
                className="bg-red-500/80 flex items-center justify-center"
                style={{ width: `${data.shortPercent}%` }}
              >
                <span className="text-[9px] font-bold text-white">{data.shortPercent.toFixed(1)}%</span>
              </div>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="flex items-center gap-0.5 text-green-400">
                <TrendingUp className="h-2.5 w-2.5" /> Long
              </span>
              <span className="flex items-center gap-0.5 text-red-400">
                Short <TrendingDown className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>

          {/* Warning jika skewed */}
          {lsWarning && (
            <div className={cn(
              'flex items-start gap-2 px-3 py-2.5 border-b border-border',
              lsWarning === 'long' ? 'bg-green-950/30' : 'bg-red-950/30'
            )}>
              <AlertTriangle className={cn(
                'h-3 w-3 shrink-0 mt-0.5',
                lsWarning === 'long' ? 'text-yellow-400' : 'text-yellow-400'
              )} />
              <p className="text-[9px] text-muted-foreground">
                {lsWarning === 'long'
                  ? 'Long dominan — waspadai long squeeze jika harga berbalik turun.'
                  : 'Short dominan — waspadai short squeeze jika harga berbalik naik.'}
              </p>
            </div>
          )}

          {/* OI per Exchange */}
          {data.oiByExchange.length > 0 && (
            <div className="px-3 py-3">
              <p className="text-[9px] text-muted-foreground mb-2">Per Exchange</p>
              <div className="flex flex-col gap-2.5">
                {data.oiByExchange.map((ex) => {
                  const pct = data.oiTotalUsd > 0 ? (ex.oiUsd / data.oiTotalUsd) * 100 : 0
                  return (
                    <div key={ex.exchange}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-foreground">{ex.exchange}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-muted-foreground">{formatUsd(ex.oiUsd)}</span>
                          <span className="text-[9px] text-muted-foreground w-8 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-muted/40 rounded-full h-1">
                        <div
                          className="bg-primary/60 h-1 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="px-3 py-2 border-t border-border">
            <p className="text-[8px] text-muted-foreground">Data dari CoinGlass · refresh tiap 2 menit</p>
          </div>
        </div>
      )}
    </div>
  )
}
