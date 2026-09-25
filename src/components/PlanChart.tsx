import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart, CandlestickSeries, LineSeries, LineStyle, ColorType, CrosshairMode,
  type IChartApi, type ISeriesApi, type IPriceLine, type UTCTimestamp,
} from 'lightweight-charts'
import { Loader2 } from 'lucide-react'
import type { MarketType, Ticker } from '@/types'
import type { Candle } from '@/lib/indicators'
import { calcEMA } from '@/lib/indicators'
import { fetchCandles, type SignalTimeframe } from '@/hooks/useSignalData'
import { useFuturesSetup } from '@/hooks/useFuturesOpportunities'
import { calcFibRetracement, formatFibRatio } from '@/lib/fibonacci'
import { analyzeSmc } from '@/lib/smc'
import { SmcPrimitive } from '@/lib/smcPrimitive'
import { getVerdict, planEntryRef, VerdictBanner } from '@/components/TradeVerdict'
import { cn, formatPrice } from '@/lib/utils'

interface Props {
  symbol: string
  marketType: MarketType
  currentPrice: number
  futuresTickers: Ticker[]
}

type Layers = { plan: boolean; fib: boolean; ema: boolean; smc: boolean }

const TIMEFRAMES: SignalTimeframe[] = ['5m', '15m', '30m', '1h', '4h']
const TF_KEY = 'hellnah-plan-tf'
const LAYERS_KEY = 'hellnah-plan-layers'
const REFRESH_MS = 20_000
const EMA_LINES = [
  { period: 9, color: '#f59e0b' },
  { period: 21, color: '#3b82f6' },
  { period: 50, color: '#a855f7' },
]
// Lightweight Charts selalu tampil dalam UTC — digeser ke zona waktu lokal (WIB) di sini.
const TZ_OFFSET_SEC = -new Date().getTimezoneOffset() * 60
const toTime = (ms: number) => (ms / 1000 + TZ_OFFSET_SEC) as UTCTimestamp

// Default Lightweight Charts cuma 2 desimal — koin murah (mis. 0.0023) jadi kebaca "0.00" semua.
function pricePrecision(price: number): number {
  if (price >= 1000) return 2
  if (price >= 1) return 4
  return Math.min(8, Math.ceil(-Math.log10(price)) + 3)
}

function readLayers(): Layers {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAYERS_KEY) ?? '')
    if (typeof parsed.plan === 'boolean') return { ...parsed, smc: parsed.smc ?? false }
  } catch {
    // belum pernah disimpan — pakai default
  }
  return { plan: true, fib: true, ema: true, smc: false }
}

function useCandles(symbol: string, marketType: MarketType, tf: SignalTimeframe) {
  const [candles, setCandles] = useState<Candle[]>([])
  useEffect(() => {
    setCandles([])
    if (!symbol) return
    let cancelled = false
    const run = () => fetchCandles(symbol, 'binance', marketType, tf).then((c) => { if (!cancelled) setCandles(c) })
    run()
    const id = setInterval(run, REFRESH_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [symbol, marketType, tf])
  return candles
}

function Toggle({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 min-h-7 px-2.5 rounded-full border text-xs font-medium transition-colors',
        active ? 'border-border bg-muted text-foreground' : 'border-border/60 text-muted-foreground opacity-60 hover:opacity-100'
      )}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </button>
  )
}

export function PlanChart({ symbol, marketType, currentPrice, futuresTickers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const emaSeriesRef = useRef<ISeriesApi<'Line'>[]>([])
  const priceLinesRef = useRef<IPriceLine[]>([])
  const fittedRef = useRef('')
  const smcPrimitiveRef = useRef(new SmcPrimitive(toTime))

  const [tf, setTfState] = useState<SignalTimeframe>(() => {
    const stored = localStorage.getItem(TF_KEY) as SignalTimeframe | null
    return stored && TIMEFRAMES.includes(stored) ? stored : '1h'
  })
  const [layers, setLayersState] = useState<Layers>(readLayers)
  const setTf = (next: SignalTimeframe) => { setTfState(next); localStorage.setItem(TF_KEY, next) }
  const toggleLayer = (key: keyof Layers) => {
    const next = { ...layers, [key]: !layers[key] }
    setLayersState(next)
    localStorage.setItem(LAYERS_KEY, JSON.stringify(next))
  }

  const candles = useCandles(symbol, marketType, tf)
  // Fib selalu dari grafik 1 jam (72 candle) supaya sama dengan ringkasan koin & badge scanner.
  const hourly = useCandles(tf === '1h' ? '' : symbol, marketType, '1h')
  const fib = calcFibRetracement(tf === '1h' ? candles : hourly)
  const { setup, status: setupStatus } = useFuturesSetup(symbol, futuresTickers)
  const smc = useMemo(() => (layers.smc && candles.length ? analyzeSmc(candles) : null), [candles, layers.smc])
  const lastBreak = smc?.breaks[smc.breaks.length - 1] ?? null

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#a3a3a3', fontFamily: 'Space Grotesk, system-ui, sans-serif' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true, secondsVisible: false },
    })
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444', borderVisible: false, wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    })
    candleSeriesRef.current.attachPrimitive(smcPrimitiveRef.current)
    emaSeriesRef.current = EMA_LINES.map(({ color }) =>
      chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
    )
    chartRef.current = chart
    return () => {
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      emaSeriesRef.current = []
      priceLinesRef.current = []
    }
  }, [])

  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series || !candles.length) return
    const precision = pricePrecision(candles[candles.length - 1].close)
    series.applyOptions({ priceFormat: { type: 'price', precision, minMove: 10 ** -precision } })
    series.setData(candles.map((c) => ({ time: toTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close })))

    const closes = candles.map((c) => c.close)
    EMA_LINES.forEach(({ period }, i) => {
      const values = calcEMA(closes, period)
      // calcEMA mulai dari index period-1 — disejajarkan ke candle yang sesuai.
      const data = layers.ema ? values.map((v, j) => ({ time: toTime(candles[j + period - 1].time), value: v })) : []
      emaSeriesRef.current[i]?.setData(data)
    })

    // Zoom ulang cuma saat koin/timeframe ganti, bukan tiap refresh (biar posisi geser user gak hilang).
    const fitKey = `${symbol}-${marketType}-${tf}`
    if (fittedRef.current !== fitKey) {
      chartRef.current?.timeScale().fitContent()
      fittedRef.current = fitKey
    }
  }, [candles, layers.ema, symbol, marketType, tf])

  useEffect(() => {
    smcPrimitiveRef.current.setData(smc)
  }, [smc])

  useEffect(() => {
    const series = candleSeriesRef.current
    const last = candles[candles.length - 1]
    if (!series || !last || !currentPrice) return
    series.update({
      time: toTime(last.time),
      open: last.open,
      high: Math.max(last.high, currentPrice),
      low: Math.min(last.low, currentPrice),
      close: currentPrice,
    })
  }, [currentPrice, candles])

  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series) return
    priceLinesRef.current.forEach((line) => series.removePriceLine(line))
    priceLinesRef.current = []
    const add = (price: number, color: string, title: string, lineStyle: LineStyle, lineWidth: 1 | 2 = 1) => {
      priceLinesRef.current.push(series.createPriceLine({ price, color, title, lineStyle, lineWidth, axisLabelVisible: true }))
    }

    if (layers.fib && fib) {
      fib.levels.forEach((level) => {
        const key = [0.382, 0.5, 0.618].includes(level.ratio)
        add(level.price, key ? 'rgba(234,179,8,0.8)' : 'rgba(163,163,163,0.45)', `Fib ${formatFibRatio(level.ratio)}`, LineStyle.Dashed)
      })
    }
    if (layers.plan && setup) {
      const { openLow, openHigh, stopLoss, takeProfit1 } = setup.primaryPlan
      const entry = planEntryRef(setup)
      const otherEdge = entry === openLow ? openHigh : openLow
      add(otherEdge, 'rgba(229,229,229,0.5)', 'Zona', LineStyle.Dotted)
      add(entry, '#e5e5e5', setup.side === 'long' ? 'Masuk (long)' : 'Masuk (short)', LineStyle.Solid, 2)
      add(stopLoss, '#ef4444', 'Batas rugi', LineStyle.Solid, 2)
      add(takeProfit1, '#22c55e', 'Target', LineStyle.Solid, 2)
    }
  }, [setup, fib?.swingHigh, fib?.swingLow, layers.fib, layers.plan])

  const price = currentPrice || candles[candles.length - 1]?.close || 0

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/20 shrink-0">
        <div className="flex rounded-full border border-border overflow-hidden mr-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={cn('min-h-7 px-2.5 text-xs font-medium', tf === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
            >
              {t}
            </button>
          ))}
        </div>
        <Toggle active={layers.plan} onClick={() => toggleLayer('plan')} color="#e5e5e5">Rencana</Toggle>
        <Toggle active={layers.fib} onClick={() => toggleLayer('fib')} color="#eab308">Fibonacci</Toggle>
        <Toggle active={layers.ema} onClick={() => toggleLayer('ema')} color="#3b82f6">EMA 9/21/50</Toggle>
        <Toggle active={layers.smc} onClick={() => toggleLayer('smc')} color="#38bdf8">SMC</Toggle>
      </div>

      {smc && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 border-b border-border text-xs text-muted-foreground shrink-0">
          <span>
            Struktur:{' '}
            <span className={cn('font-semibold', smc.trend === 'bull' ? 'text-green-400' : smc.trend === 'bear' ? 'text-red-400' : 'text-foreground')}>
              {smc.trend === 'bull' ? 'Naik' : smc.trend === 'bear' ? 'Turun' : 'Belum jelas'}
            </span>
          </span>
          {lastBreak && (
            <span title={lastBreak.kind === 'CHoCH' ? 'Change of Character — tanda awal tren berbalik' : 'Break of Structure — tren berlanjut'}>
              Terakhir: <span className="font-semibold text-foreground">{lastBreak.kind} {lastBreak.side === 'bull' ? 'naik' : 'turun'}</span> di {formatPrice(lastBreak.level)}
            </span>
          )}
          <span><span className="text-green-400">OB</span>/<span className="text-red-400">OB</span> = area order besar</span>
          <span><span className="text-sky-300">FVG</span>/<span className="text-orange-300">FVG</span> = celah harga belum terisi</span>
        </div>
      )}

      {layers.plan && (
        <div className="px-3 py-2 border-b border-border shrink-0">
          {setupStatus === 'loading' ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menganalisa setup...</p>
          ) : setupStatus === 'unavailable' ? (
            <p className="text-xs text-muted-foreground">Koin ini tidak ada di Binance Futures — garis rencana tidak tersedia.</p>
          ) : setup ? (
            <VerdictBanner verdict={getVerdict(setup, price)} />
          ) : (
            <p className="text-xs text-muted-foreground">Belum ada setup Long/Short yang cukup kuat — garis rencana tidak digambar.</p>
          )}
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        {!candles.length && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat candle...
          </div>
        )}
      </div>
    </div>
  )
}
