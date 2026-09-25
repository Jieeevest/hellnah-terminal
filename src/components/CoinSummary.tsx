import { useState, useEffect, useMemo } from 'react'
import { LineChart, BarChart2, Bot, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { fetchCandles } from '@/hooks/useSignalData'
import type { Candle } from '@/lib/indicators'
import { calcFibRetracement, FIB_LOOKBACK_CANDLES, formatFibRatio, nearestFibLevel, type FibRetracement } from '@/lib/fibonacci'
import type { Exchange, MarketType, Ticker } from '@/types'
import type { AutoTradeState } from '@/types/autoTrade'
import { cn, formatNumber, formatPrice } from '@/lib/utils'
import { CoinIcon } from '@/components/CoinIcon'
import { useFuturesSetup } from '@/hooks/useFuturesOpportunities'
import { getVerdict, planEntryRef, VerdictBanner } from '@/components/TradeVerdict'

interface Props {
  ticker: Ticker | null
  currentPrice: number
  exchange: Exchange
  marketType: MarketType
  botState: AutoTradeState | null
  futuresTickers: Ticker[]
  onShowChart: () => void
  onOpenAnalysis: () => void
  onOpenBot: () => void
}

// Level yang paling sering dipantau trader — ditonjolkan warnanya.
const KEY_FIB = [0.382, 0.5, 0.618]
const SHOW_FIB_KEY = 'hellnah-show-fib'

function describeFib(fib: FibRetracement, price: number): string {
  const near = nearestFibLevel(fib, price)
  if (near) return `Harga dekat level ${formatFibRatio(near.ratio)} (${formatPrice(near.price)}) — area yang sering jadi titik pantul`
  const sorted = [...fib.levels].sort((a, b) => a.price - b.price)
  const below = [...sorted].reverse().find((l) => l.price <= price)
  const above = sorted.find((l) => l.price >= price)
  if (!below) return `Harga di bawah swing terendah 3 hari (${formatPrice(fib.swingLow)})`
  if (!above) return `Harga di atas swing tertinggi 3 hari (${formatPrice(fib.swingHigh)})`
  return `Harga di antara level ${formatFibRatio(below.ratio)} (${formatPrice(below.price)}) dan ${formatFibRatio(above.ratio)} (${formatPrice(above.price)})`
}

function Sparkline({ candles, positive, fib }: { candles: Candle[]; positive: boolean; fib?: FibRetracement | null }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const W = 600
  const H = 140
  const closes = candles.map((c) => c.close)
  // Swing high/low fib pakai high/low candle, bisa di luar rentang harga close — skala ikut diperlebar.
  const min = Math.min(...closes, ...(fib ? [fib.swingLow] : []))
  const max = Math.max(...closes, ...(fib ? [fib.swingHigh] : []))
  const range = max - min || 1
  const yOf = (v: number) => H - ((v - min) / range) * (H - 16) - 8
  const points = closes.map((v, i) => [(i / (closes.length - 1)) * W, yOf(v)] as const)
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const color = positive ? '#4ade80' : '#f87171'
  const hover = hoverIdx != null ? points[hoverIdx] : null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={cn('w-full cursor-crosshair touch-none', fib ? 'h-44' : 'h-24')}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const ratio = (e.clientX - rect.left) / rect.width
          setHoverIdx(Math.round(ratio * (closes.length - 1)))
        }}
        onPointerLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {fib?.levels.map((level) => (
          <line
            key={level.ratio}
            x1="0" x2={W} y1={yOf(level.price)} y2={yOf(level.price)}
            stroke={KEY_FIB.includes(level.ratio) ? '#eab308' : '#737373'}
            strokeOpacity={KEY_FIB.includes(level.ratio) ? 0.8 : 0.5}
            strokeDasharray="6 5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#spark-fill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover && (
          <>
            <line x1={hover[0]} x2={hover[0]} y1="0" y2={H} stroke="currentColor" className="text-muted-foreground" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <circle cx={hover[0]} cy={hover[1]} r="6" fill={color} stroke="#000" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {fib?.levels.map((level) => (
        <span
          key={level.ratio}
          className={cn('absolute right-0 -translate-y-1/2 px-1 rounded text-xs font-mono pointer-events-none bg-card/80', KEY_FIB.includes(level.ratio) ? 'text-yellow-400' : 'text-muted-foreground')}
          style={{ top: `${(yOf(level.price) / H) * 100}%` }}
        >
          {formatFibRatio(level.ratio)} · {formatPrice(level.price)}
        </span>
      ))}
      {hoverIdx != null && (
        <div
          className="absolute -top-2 -translate-x-1/2 -translate-y-full px-3 py-1.5 rounded-lg bg-card border border-border shadow-xl text-sm whitespace-nowrap pointer-events-none"
          style={{ left: `${Math.min(88, Math.max(12, (hoverIdx / (closes.length - 1)) * 100))}%` }}
        >
          <span className="font-mono font-bold text-foreground">{formatPrice(closes[hoverIdx])}</span>
          <span className="text-muted-foreground ml-2">
            {new Date(candles[hoverIdx].time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-base font-bold font-mono mt-0.5 break-all', tone ?? 'text-foreground')}>{value}</div>
    </div>
  )
}

export function CoinSummary({ ticker, currentPrice, exchange, marketType, botState, futuresTickers, onShowChart, onOpenAnalysis, onOpenBot }: Props) {
  const [candles, setCandles] = useState<Candle[]>([])
  const symbol = ticker?.symbol ?? ''

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    setCandles([])
    const run = () => fetchCandles(symbol, exchange, marketType, '1h').then((c) => { if (!cancelled) setCandles(c) })
    run()
    const id = setInterval(run, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [symbol, exchange, marketType])

  const { setup, status: setupStatus } = useFuturesSetup(ticker?.symbol ?? null, futuresTickers)
  const [showFib, setShowFib] = useState(() => localStorage.getItem(SHOW_FIB_KEY) === '1')
  const toggleFib = () => {
    setShowFib((v) => {
      localStorage.setItem(SHOW_FIB_KEY, v ? '0' : '1')
      return !v
    })
  }
  const fib = useMemo(() => calcFibRetracement(candles), [candles])

  if (!ticker) {
    return (
      <div className="flex h-full items-center justify-center text-base text-muted-foreground">
        Memuat data koin...
      </div>
    )
  }

  const price = currentPrice || ticker.price
  const positive = ticker.priceChangePercent >= 0
  const rangePct = ticker.high24h > ticker.low24h
    ? Math.min(100, Math.max(0, ((price - ticker.low24h) / (ticker.high24h - ticker.low24h)) * 100))
    : 50
  const isFutures = marketType === 'futures'
  const botPosition = botState?.openPositions.find((p) => p.symbol === ticker.symbol)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <CoinIcon asset={ticker.baseAsset} size={40} />
          <div>
            <div className="text-xl font-bold text-foreground">
              {ticker.baseAsset}<span className="text-muted-foreground font-medium">/{isFutures ? 'PERP' : 'USDT'}</span>
            </div>
            <div className="text-sm text-muted-foreground">{isFutures ? 'Futures' : 'Spot'} · Binance</div>
          </div>
          <div className="flex-1" />
          <button
            onClick={onShowChart}
            className="flex items-center gap-2 min-h-9 px-4 rounded-lg border border-border bg-muted/40 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <LineChart className="h-5 w-5" /> Tampilkan Chart
          </button>
        </div>

        <div className="flex items-end gap-4 flex-wrap">
          <span className={cn('text-4xl font-bold font-mono tracking-tight', positive ? 'text-green-400' : 'text-red-400')}>
            {formatPrice(price)}
          </span>
          <span className={cn('flex items-center gap-1.5 text-base font-semibold px-2.5 py-1 rounded-lg mb-0.5', positive ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400')}>
            {positive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            {positive ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}% <span className="text-sm font-normal opacity-80">24 jam</span>
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm text-muted-foreground">
              {showFib ? 'Pergerakan 3 hari + Fibonacci retracement' : 'Pergerakan 24 jam · arahkan mouse untuk lihat harga'}
            </span>
            <button
              onClick={toggleFib}
              className={cn(
                'shrink-0 min-h-7 px-2.5 rounded-full border text-xs font-semibold transition-colors',
                showFib ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              Fibonacci
            </button>
          </div>
          {candles.length > 1 ? (
            <Sparkline candles={candles.slice(showFib ? -FIB_LOOKBACK_CANDLES : -24)} positive={positive} fib={showFib ? fib : null} />
          ) : (
            <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">Memuat grafik...</div>
          )}
          {showFib && fib && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">
                Swing {fib.direction === 'up' ? 'naik' : 'turun'} {formatPrice(fib.direction === 'up' ? fib.swingLow : fib.swingHigh)} → {formatPrice(fib.direction === 'up' ? fib.swingHigh : fib.swingLow)}.
              </span>{' '}
              {describeFib(fib, price)}
            </p>
          )}
        </div>

        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Terendah 24j</span>
            <span className="hidden sm:inline">Posisi harga sekarang</span>
            <span>Tertinggi 24j</span>
          </div>
          <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500/60 via-yellow-500/50 to-green-500/60">
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-white border-2 border-background shadow-lg transition-[left] duration-500"
              style={{ left: `${rangePct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <StatTile label="Tertinggi 24j" value={formatPrice(ticker.high24h)} />
          <StatTile label="Terendah 24j" value={formatPrice(ticker.low24h)} />
          <StatTile label="Volume 24j" value={formatNumber(ticker.volume)} />
          {isFutures && ticker.fundingRate !== undefined ? (
            <StatTile
              label="Funding rate"
              value={`${ticker.fundingRate >= 0 ? '+' : ''}${ticker.fundingRate.toFixed(4)}%`}
              tone={ticker.fundingRate >= 0 ? 'text-green-400' : 'text-red-400'}
            />
          ) : (
            <StatTile label="Perubahan 24j" value={`${positive ? '+' : ''}${ticker.priceChange.toLocaleString('en-US', { maximumSignificantDigits: 6 })}`} tone={positive ? 'text-green-400' : 'text-red-400'} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onOpenAnalysis}
            className={cn(
              'flex flex-col justify-start text-left rounded-xl border p-3 transition-colors hover:brightness-125',
              setup ? (setup.side === 'long' ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30') : 'border-border bg-muted/40'
            )}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <BarChart2 className="h-5 w-5" /> Setup Futures
            </div>
            {setupStatus === 'loading' ? (
              <div className="text-base text-muted-foreground">Menganalisa...</div>
            ) : setupStatus === 'unavailable' ? (
              <div className="text-base text-muted-foreground">Koin ini tidak ada di Binance Futures</div>
            ) : setup ? (
              <>
                <div className="flex items-center gap-2 text-lg font-bold">
                  {setup.side === 'long' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  {setup.side === 'long' ? 'Long' : 'Short'}
                  <span className="ml-auto text-base font-mono"><span className="text-xs font-normal opacity-70">skor </span>{setup.accuracyPct}%</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{setup.oneLiner}</div>
                <div className="mt-2 text-left">
                  <VerdictBanner verdict={getVerdict(setup, price)} />
                </div>
                <div className="grid grid-cols-3 gap-1 mt-2 text-xs">
                  <div><div className="text-muted-foreground">Masuk</div><div className="font-mono text-foreground">{formatPrice(planEntryRef(setup))}</div></div>
                  <div><div className="text-muted-foreground">Batas rugi</div><div className="font-mono text-red-400">{formatPrice(setup.primaryPlan.stopLoss)}</div></div>
                  <div><div className="text-muted-foreground">Target</div><div className="font-mono text-green-400">{formatPrice(setup.primaryPlan.takeProfit1)}</div></div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <Minus className="h-5 w-5" /> Tunggu
                </div>
                <div className="text-sm text-muted-foreground mt-1">Belum ada setup Long/Short yang cukup kuat.</div>
              </>
            )}
            <div className="text-sm text-primary mt-2 font-semibold">Buka scanner →</div>
          </button>

          <button
            onClick={onOpenBot}
            className="flex flex-col justify-start text-left rounded-xl border border-border bg-muted/40 p-3 transition-colors hover:bg-muted"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Bot className="h-5 w-5" /> Bot di koin ini
            </div>
            {!botState ? (
              <div className="text-base text-muted-foreground">Bot tidak terhubung</div>
            ) : botPosition ? (
              <>
                <div className={cn('text-lg font-bold', botPosition.side === 'long' ? 'text-green-400' : 'text-red-400')}>
                  Posisi {botPosition.side === 'long' ? 'NAIK (long)' : 'TURUN (short)'} {botPosition.leverage}x
                </div>
                <div className={cn('text-base font-mono font-bold mt-1', (botPosition.unrealizedPnlUsd ?? 0) >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {(botPosition.unrealizedPnlUsd ?? 0) >= 0 ? '+' : ''}${(botPosition.unrealizedPnlUsd ?? 0).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Masuk {formatPrice(botPosition.entry)} · Batas rugi {formatPrice(botPosition.stopLoss)}
                </div>
              </>
            ) : (
              <div className="text-lg font-semibold text-foreground">Tidak ada posisi</div>
            )}
            <div className="text-sm text-primary mt-2 font-semibold">Buka panel bot →</div>
          </button>
        </div>
      </div>
    </div>
  )
}
