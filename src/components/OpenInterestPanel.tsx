import { useState } from 'react'
import { AlertTriangle, Loader2, TrendingUp, TrendingDown, Lightbulb, Users, Crown, Scale } from 'lucide-react'
import { useBinanceOpenInterest, type OpenInterestPoint } from '@/hooks/useBinanceOpenInterest'
import { cn, formatNumber } from '@/lib/utils'
import { CoinIcon } from '@/components/CoinIcon'
import { PanelHeader } from '@/components/ui/PanelHeader'
import { EmptyState } from '@/components/ui/EmptyState'

interface Props {
  symbol: string | null
  baseAsset: string | null
  priceChangePercent: number | null
}

function formatUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

// OI & harga dibaca berpasangan — ini tabel interpretasi klasik, cuma dibahasakan ulang.
function interpret(oiPct: number, pricePct: number): { text: string; tone: string } {
  const oiFlat = Math.abs(oiPct) < 1
  if (oiFlat) return { text: 'Jumlah posisi terbuka stabil — belum ada uang baru yang masuk atau keluar secara berarti.', tone: 'text-muted-foreground' }
  if (oiPct > 0 && pricePct >= 0) return { text: 'Posisi baru bertambah sambil harga naik — kenaikan didukung uang baru, tren naik cenderung kuat.', tone: 'text-green-400' }
  if (oiPct > 0 && pricePct < 0) return { text: 'Posisi baru bertambah sambil harga turun — banyak yang membuka short, tekanan turun cenderung kuat.', tone: 'text-red-400' }
  if (oiPct < 0 && pricePct >= 0) return { text: 'Posisi berkurang sambil harga naik — kenaikan karena short ditutup (short squeeze), bisa kurang bertenaga.', tone: 'text-yellow-400' }
  return { text: 'Posisi berkurang sambil harga turun — banyak long ditutup / terlikuidasi, tekanan jual biasanya mereda setelahnya.', tone: 'text-yellow-400' }
}

function OiBars({ history }: { history: OpenInterestPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const values = history.map((h) => h.valueUsd)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const shown = hover ?? history.length - 1

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5 text-xs">
        <span className="text-muted-foreground">
          {new Date(history[shown].time).toLocaleString('id-ID', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="font-mono font-semibold text-foreground">{formatUsd(history[shown].valueUsd)}</span>
      </div>
      <div className="flex items-end gap-[2px] h-20" onPointerLeave={() => setHover(null)}>
        {history.map((h, i) => {
          const up = i === 0 || h.valueUsd >= history[i - 1].valueUsd
          return (
            <div
              key={h.time}
              onPointerEnter={() => setHover(i)}
              className={cn(
                'flex-1 rounded-t-sm transition-opacity cursor-crosshair',
                up ? 'bg-primary/70' : 'bg-primary/35',
                hover != null && hover !== i && 'opacity-40'
              )}
              style={{ height: `${15 + ((h.valueUsd - min) / range) * 85}%` }}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>24 jam lalu</span>
        <span>sekarang</span>
      </div>
    </div>
  )
}

function RatioBar({ icon: Icon, label, hint, longPct }: { icon: typeof Users; label: string; hint: string; longPct: number }) {
  const shortPct = 100 - longPct
  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" /> {label}
      </div>
      <p className="text-xs text-muted-foreground mb-2">{hint}</p>
      <div className="flex h-7 rounded-lg overflow-hidden text-xs font-bold text-white">
        <div className="bg-green-600 flex items-center pl-2 transition-[width] duration-500" style={{ width: `${longPct}%` }}>
          Long {longPct.toFixed(1)}%
        </div>
        <div className="bg-red-600 flex items-center justify-end pr-2 transition-[width] duration-500" style={{ width: `${shortPct}%` }}>
          {shortPct.toFixed(1)}% Short
        </div>
      </div>
    </div>
  )
}

export function OpenInterestPanel({ symbol, baseAsset, priceChangePercent }: Props) {
  const { data, error, loading } = useBinanceOpenInterest(symbol)

  if (!symbol || !baseAsset) {
    return <EmptyState icon={Scale} title="Pilih koin terlebih dahulu" />
  }
  if (error) {
    return <EmptyState icon={AlertTriangle} title="Data open interest tidak tersedia" description={error} />
  }
  if (!data) {
    return <EmptyState loading title="Mengambil data open interest…" />
  }

  const oiUp = data.change24hPct >= 0
  const hint = interpret(data.change24hPct, priceChangePercent ?? 0)
  const crowdSkew = data.globalLongPct >= 65 ? 'long' : data.globalLongPct <= 35 ? 'short' : null

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        icon={Scale}
        title={`Open Interest · ${baseAsset}`}
        right={loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Binance Futures · tiap 1 mnt'}
        subtitle="Jumlah kontrak futures yang masih terbuka — naik berarti ada uang baru yang masuk."
      />
      <div className="flex-1 overflow-y-auto">
      <div className="p-3 space-y-4">
        <div className="flex items-center gap-3">
          <CoinIcon asset={baseAsset} size={32} />
          <div className="flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold font-mono text-foreground">{formatUsd(data.oiUsd)}</span>
              <span className={cn('flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-md', oiUp ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400')}>
                {oiUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {oiUp ? '+' : ''}{data.change24hPct.toFixed(2)}% 24j
              </span>
            </div>
            <div className="text-xs text-muted-foreground">{formatNumber(data.oiCoins)} {baseAsset} kontrak terbuka</div>
          </div>
        </div>

        <div className={cn('flex gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm', hint.tone)}>
          <Lightbulb className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{hint.text}</p>
        </div>

        {data.history.length > 1 && (
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-sm font-semibold text-foreground mb-2">Perubahan Open Interest per jam</div>
            <OiBars history={data.history} />
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-3 space-y-4">
          <RatioBar icon={Users} label="Semua trader" hint="Perbandingan jumlah akun yang posisi long vs short" longPct={data.globalLongPct} />
          <RatioBar icon={Crown} label="Trader besar (top)" hint="Posisi akun-akun terbesar — sering dianggap 'uang pintar'" longPct={data.topTraderLongPct} />
          {crowdSkew && (
            <p className="text-xs text-yellow-400">
              {crowdSkew === 'long'
                ? 'Mayoritas trader sedang long — waspadai long squeeze kalau harga berbalik turun.'
                : 'Mayoritas trader sedang short — waspadai short squeeze kalau harga berbalik naik.'}
            </p>
          )}
        </div>

      </div>
      </div>
    </div>
  )
}
