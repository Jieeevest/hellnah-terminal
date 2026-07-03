import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, RefreshCw, ShieldAlert, Activity, AlertTriangle } from 'lucide-react'
import type { Exchange, MarketType, Ticker } from '@/types'
import { useSignalData, SIGNAL_TIMEFRAMES, type SignalTimeframe } from '@/hooks/useSignalData'
import { useFearGreed } from '@/hooks/useFearGreed'
import { useLunarCrush } from '@/hooks/useLunarCrush'
import { computeBTCMarketStatus } from '@/lib/btcMarketStatus'
import { generateSignal, generateWeightedSignal, type Direction, type SignalResult, type WeightedSignalResult, type BullishLabel } from '@/lib/signals'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  ticker: Ticker | null
  exchange: Exchange
  marketType: MarketType
  currentPrice: number
  btcChangePercent?: number | null
}

// ── Direction config (existing engine) ─────────────────────────────────────
const DIR_CFG: Record<Direction, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  STRONG_BUY:  { label: 'BULLISH KUAT',  color: 'text-green-400',  bg: 'bg-green-500/15',  border: 'border-green-500/40',  icon: <TrendingUp className="h-4 w-4" /> },
  BUY:         { label: 'BULLISH',        color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  icon: <TrendingUp className="h-4 w-4" /> },
  NEUTRAL:     { label: 'NETRAL',         color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: <Minus className="h-4 w-4" /> },
  SELL:        { label: 'BEARISH',        color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    icon: <TrendingDown className="h-4 w-4" /> },
  STRONG_SELL: { label: 'BEARISH KUAT',  color: 'text-red-400',    bg: 'bg-red-500/15',    border: 'border-red-500/40',    icon: <TrendingDown className="h-4 w-4" /> },
}

// ── Bullish % label config ──────────────────────────────────────────────────
const LABEL_CFG: Record<BullishLabel, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  'Bullish':      { color: 'text-green-400',  bg: 'bg-green-500/15',  border: 'border-green-500/40',  icon: <TrendingUp className="h-4 w-4" /> },
  'Mild Bullish': { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: <TrendingUp className="h-4 w-4" /> },
  'Neutral':      { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: <Minus className="h-4 w-4" /> },
  'Mild Bearish': { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: <TrendingDown className="h-4 w-4" /> },
  'Bearish':      { color: 'text-red-400',    bg: 'bg-red-500/15',    border: 'border-red-500/40',    icon: <TrendingDown className="h-4 w-4" /> },
}

// ── Gauge arc (SVG semicircle) ──────────────────────────────────────────────
function BullishGauge({ pct }: { pct: number }) {
  const R = 42
  const cx = 56, cy = 56
  const circ = Math.PI * R  // semicircle
  const offset = circ * (1 - pct / 100)
  const gaugeColor =
    pct >= 65 ? '#4ade80' :
    pct >= 55 ? '#34d399' :
    pct >= 45 ? '#facc15' :
    pct >= 35 ? '#fb923c' :
    '#f87171'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="112" height="64" viewBox="0 0 112 64">
        {/* Track */}
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Fill */}
        <motion.path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          fill="none"
          stroke={gaugeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        {/* Center label */}
        <text x={cx} y={cy - 6} textAnchor="middle" className="font-bold" fill={gaugeColor} fontSize="18" fontWeight="700" fontFamily="monospace">
          {pct.toFixed(1)}%
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8">
          BULLISH
        </text>
      </svg>
    </div>
  )
}

// ── Category bar ────────────────────────────────────────────────────────────
function CategoryBar({ label, weight, score }: { label: string; weight: string; score: number }) {
  const pct = ((score + 1) / 2) * 100   // -1..+1 → 0..100%
  const isPos = score >= 0
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 shrink-0">
        <div className="text-[9px] text-foreground font-medium leading-tight">{label}</div>
        <div className="text-[8px] text-muted-foreground">{weight}</div>
      </div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border/60 z-10" />
        <motion.div
          className={cn('absolute inset-y-0 rounded-full', isPos ? 'bg-green-500' : 'bg-red-500')}
          style={isPos
            ? { left: '50%', width: 0 }
            : { right: `${pct}%`, left: 'auto', width: 0 }
          }
          animate={isPos
            ? { width: `${Math.abs(pct - 50)}%` }
            : { width: `${Math.abs(pct - 50)}%` }
          }
          initial={{ width: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <div className={cn('text-[9px] font-mono w-10 text-right shrink-0', isPos ? 'text-green-400' : 'text-red-400')}>
        {score >= 0 ? '+' : ''}{score.toFixed(2)}
      </div>
    </div>
  )
}

// ── Existing engine sub-components ─────────────────────────────────────────
function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.round(((score + max) / (max * 2)) * 100)
  return (
    <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className="absolute inset-y-0 left-1/2 w-px bg-border z-10" />
      <motion.div
        className={cn('absolute inset-y-0 rounded-full', score >= 0 ? 'bg-green-500' : 'bg-red-500')}
        style={{ left: '50%', width: `${Math.abs(pct - 50)}%`, ...(score < 0 ? { right: `${50 - (pct)}%`, left: 'auto' } : {}) }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.abs(pct - 50)}%` }}
        transition={{ duration: 0.4 }}
      />
    </div>
  )
}

function IndRow({ label, signal, detail, score, maxScore }: {
  label: string; signal: 1 | 0 | -1; detail: string; score: number; maxScore: number
}) {
  const dot = signal === 1 ? 'bg-green-400' : signal === -1 ? 'bg-red-400' : 'bg-yellow-400'
  const dots = Array.from({ length: maxScore }, (_, i) => i)
  return (
    <div className="flex items-start gap-2 py-1 border-b border-border/50 last:border-0">
      <span className={cn('mt-1 shrink-0 w-1.5 h-1.5 rounded-full', dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-medium text-foreground">{label}</span>
          <div className="flex gap-0.5">
            {dots.map((i) => (
              <span
                key={i}
                className={cn('w-1.5 h-1.5 rounded-full',
                  i < Math.abs(score)
                    ? signal === 1 ? 'bg-green-400' : signal === -1 ? 'bg-red-400' : 'bg-yellow-400'
                    : 'bg-muted'
                )}
              />
            ))}
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground leading-tight">{detail}</p>
      </div>
    </div>
  )
}

function TFBadge({ direction }: { direction: Direction | null }) {
  if (!direction) return <span className="text-[9px] text-muted-foreground">—</span>
  const cfg = DIR_CFG[direction]
  return (
    <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded', cfg.color, cfg.bg)}>
      {direction === 'STRONG_BUY' ? '▲▲' : direction === 'BUY' ? '▲' : direction === 'NEUTRAL' ? '—' : direction === 'SELL' ? '▼' : '▼▼'}
      {' '}{cfg.label}
    </span>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export function SignalPanel({ ticker, exchange, marketType, currentPrice, btcChangePercent }: Props) {
  const [activeTF, setActiveTF] = useState<SignalTimeframe>('15m')
  const [mode, setMode] = useState<'weighted' | 'classic'>('weighted')

  const { candles, loading } = useSignalData(ticker?.symbol ?? '', exchange, marketType, currentPrice)
  const { data: fgData } = useFearGreed()
  const { getCoin: getLCCoin } = useLunarCrush()
  const lcCoin = ticker ? getLCCoin(ticker.baseAsset) : null
  const marketStatus = computeBTCMarketStatus(btcChangePercent ?? null, fgData?.value ?? null)

  // Funding rate dari ticker (futures saja)
  const fundingRate = marketType === 'futures' ? (ticker?.fundingRate ?? null) : null

  // Classic signal engine
  const classicSignals = useMemo(() => {
    const map: Partial<Record<SignalTimeframe, SignalResult>> = {}
    for (const tf of SIGNAL_TIMEFRAMES) {
      const s = generateSignal(candles[tf])
      if (s) map[tf] = s
    }
    return map
  }, [candles])

  // Weighted signal engine (docs-analisis.md formula)
  const weightedSignals = useMemo(() => {
    const map: Partial<Record<SignalTimeframe, WeightedSignalResult>> = {}
    for (const tf of SIGNAL_TIMEFRAMES) {
      const s = generateWeightedSignal(candles[tf], fgData?.value ?? null, fundingRate, lcCoin?.galaxyScore ?? null, lcCoin?.sentiment ?? null)
      if (s) map[tf] = s
    }
    return map
  }, [candles, fgData, fundingRate, lcCoin])

  const activeClassic  = classicSignals[activeTF]
  const activeWeighted = weightedSignals[activeTF]
  const hasPrice = currentPrice > 0

  if (!ticker) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Pilih koin untuk melihat sinyal
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* BTC Market Status */}
      {marketStatus.level !== 'safe' && (
        <div className={cn(
          'flex items-start gap-2 px-3 py-2 border-b shrink-0',
          marketStatus.level === 'danger'
            ? 'bg-red-950/60 border-red-800/40 text-red-300'
            : 'bg-yellow-950/60 border-yellow-800/40 text-yellow-300'
        )}>
          {marketStatus.level === 'danger'
            ? <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" />
            : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          }
          <div>
            <p className={cn('text-[10px] font-bold', marketStatus.level === 'danger' ? 'text-red-200' : 'text-yellow-200')}>
              {marketStatus.label}
            </p>
            <p className="text-[9px] leading-tight mt-0.5">{marketStatus.message}</p>
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setMode('weighted')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold transition-colors',
            mode === 'weighted' ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/5' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Activity className="h-3 w-3" />
          Weighted
        </button>
        <button
          onClick={() => setMode('classic')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold transition-colors',
            mode === 'classic' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Classic
        </button>
      </div>

      {/* Timeframe tabs */}
      <div className="flex border-b border-border shrink-0">
        {SIGNAL_TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setActiveTF(tf)}
            className={cn(
              'flex-1 py-1.5 text-[10px] font-semibold transition-colors',
              activeTF === tf
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Live indicator */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-muted/20 shrink-0">
        <span className="text-[9px] text-muted-foreground">
          Harga live: <span className="font-mono text-foreground">{currentPrice > 0 ? currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8 }) : '—'}</span>
        </span>
        <span className="flex items-center gap-1 text-[9px]">
          {hasPrice ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              <span className="text-green-400">Real-time</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
              <span className="text-muted-foreground">Menunggu harga</span>
            </>
          )}
        </span>
      </div>

      {/* Multi-TF snapshot */}
      <div className="grid grid-cols-5 gap-1 px-2 py-2 border-b border-border shrink-0">
        {SIGNAL_TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setActiveTF(tf)}
            className={cn('flex flex-col items-center gap-0.5 p-1 rounded transition-colors',
              activeTF === tf ? 'bg-muted' : 'hover:bg-muted/50'
            )}
          >
            <span className="text-[9px] text-muted-foreground">{tf}</span>
            {loading && !classicSignals[tf] ? (
              <RefreshCw className="h-2.5 w-2.5 animate-spin text-muted-foreground" />
            ) : mode === 'weighted' ? (
              weightedSignals[tf] ? (
                <span className={cn(
                  'text-[9px] font-bold px-0.5 py-0.5 rounded',
                  LABEL_CFG[weightedSignals[tf]!.label].color,
                  LABEL_CFG[weightedSignals[tf]!.label].bg
                )}>
                  {weightedSignals[tf]!.bullishPct.toFixed(0)}%
                </span>
              ) : <span className="text-[9px] text-muted-foreground">—</span>
            ) : (
              <TFBadge direction={classicSignals[tf]?.direction ?? null} />
            )}
          </button>
        ))}
      </div>

      {/* Detail panel */}
      <div className="flex-1 px-3 py-2">
        {loading && !activeClassic ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Menghitung sinyal {activeTF}...</span>
          </div>
        ) : mode === 'weighted' ? (
          /* ── WEIGHTED MODE ── */
          <AnimatePresence mode="wait">
            {activeWeighted ? (
              <motion.div
                key={`w-${activeTF}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-3"
              >
                {/* Gauge */}
                <div className={cn(
                  'rounded-lg border p-3 flex flex-col items-center gap-1',
                  LABEL_CFG[activeWeighted.label].bg,
                  LABEL_CFG[activeWeighted.label].border
                )}>
                  <BullishGauge pct={activeWeighted.bullishPct} />
                  <div className={cn('text-sm font-bold flex items-center gap-1', LABEL_CFG[activeWeighted.label].color)}>
                    {LABEL_CFG[activeWeighted.label].icon}
                    {activeWeighted.label.toUpperCase()}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-mono">
                    raw signal: {activeWeighted.rawSignal >= 0 ? '+' : ''}{activeWeighted.rawSignal.toFixed(3)}
                  </div>
                </div>

                {/* Fear & Greed badge */}
                {fgData && (
                  <div className="flex items-center justify-between rounded border border-border px-2 py-1.5 bg-muted/30">
                    <span className="text-[9px] text-muted-foreground">Fear & Greed Index</span>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded',
                        fgData.value <= 25 ? 'bg-green-500/20 text-green-400' :
                        fgData.value <= 40 ? 'bg-emerald-500/20 text-emerald-400' :
                        fgData.value <= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                        fgData.value <= 75 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-red-500/20 text-red-400'
                      )}>
                        {fgData.value} — {fgData.label}
                      </span>
                    </div>
                  </div>
                )}

                {/* 4-kategori breakdown */}
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium mb-1.5">Breakdown Kategori</p>
                  <div className="flex flex-col gap-1.5 rounded border border-border px-2 py-2">
                    <CategoryBar label="Price Action"   weight="30%"  score={activeWeighted.price.score} />
                    <CategoryBar label="Volume"         weight="20%"  score={activeWeighted.volume.score} />
                    <CategoryBar label="Technical"      weight="35%"  score={activeWeighted.technical.score} />
                    <CategoryBar label="Sentiment"      weight="15%"  score={activeWeighted.sentiment.score} />
                    {lcCoin && (
                      <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/50 mt-0.5">
                        <span className="text-[8px] text-purple-400/70 font-semibold">LC</span>
                        <span className="text-[8px] text-muted-foreground">
                          GS <span className={cn('font-mono font-bold', lcCoin.galaxyScore >= 65 ? 'text-green-400' : lcCoin.galaxyScore >= 50 ? 'text-yellow-400' : 'text-red-400')}>{lcCoin.galaxyScore}</span>
                          {' · '}
                          Sent <span className={cn('font-mono font-bold', lcCoin.sentiment >= 60 ? 'text-green-400' : lcCoin.sentiment >= 40 ? 'text-yellow-400' : 'text-red-400')}>{lcCoin.sentiment}%</span>
                          {' · '}
                          Rank <span className="font-mono font-bold text-foreground">#{lcCoin.altRank}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Volume info */}
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-muted-foreground">Volume vs avg-7</span>
                  <span className={cn('font-mono font-bold',
                    activeWeighted.volumeVsAvg >= 1.5 ? 'text-green-400' :
                    activeWeighted.volumeVsAvg < 0.5  ? 'text-red-400' :
                    'text-muted-foreground'
                  )}>
                    {activeWeighted.volumeVsAvg.toFixed(2)}×
                    {activeWeighted.volumeVsAvg < 0.5 && ' ⚠ rendah'}
                  </span>
                </div>

                {/* Disclaimer */}
                <div className="flex items-start gap-1.5 rounded bg-muted/50 px-2 py-1.5">
                  <ShieldAlert className="h-3 w-3 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-muted-foreground leading-tight">
                    Sinyal bersifat informatif. Formula: Price 30% + Volume 20% + Technical 35% + Sentiment 15%.
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="flex items-center justify-center py-6 text-[10px] text-muted-foreground">
                Data tidak cukup untuk timeframe {activeTF}
              </div>
            )}
          </AnimatePresence>
        ) : (
          /* ── CLASSIC MODE ── */
          <AnimatePresence mode="wait">
            {activeClassic ? (
              <motion.div
                key={`c-${activeTF}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-3"
              >
                {/* Main signal */}
                <div className={cn('rounded-lg border p-3 flex items-center gap-3', DIR_CFG[activeClassic.direction].bg, DIR_CFG[activeClassic.direction].border)}>
                  <div className={cn('shrink-0', DIR_CFG[activeClassic.direction].color)}>
                    {DIR_CFG[activeClassic.direction].icon}
                  </div>
                  <div className="flex-1">
                    <div className={cn('text-sm font-bold', DIR_CFG[activeClassic.direction].color)}>
                      {DIR_CFG[activeClassic.direction].label}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{activeClassic.summary}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn('text-base font-bold font-mono', DIR_CFG[activeClassic.direction].color)}>
                      {activeClassic.confluence}%
                    </div>
                    <div className="text-[9px] text-muted-foreground">konfluensi</div>
                  </div>
                </div>

                {/* Score bar */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>Skor: {activeClassic.score > 0 ? '+' : ''}{activeClassic.score} / {activeClassic.maxScore}</span>
                    <span className={cn('font-medium',
                      activeClassic.trend === 'Uptrend' ? 'text-green-400'
                      : activeClassic.trend === 'Downtrend' ? 'text-red-400'
                      : 'text-yellow-400'
                    )}>
                      {activeClassic.trend}
                    </span>
                  </div>
                  <ScoreBar score={activeClassic.score} max={activeClassic.maxScore} />
                </div>

                {/* Pattern */}
                {activeClassic.pattern.name !== '—' && (
                  <div className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded border text-[10px]',
                    activeClassic.pattern.signal === 1 ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : activeClassic.pattern.signal === -1 ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  )}>
                    <span className="font-bold">Pola:</span>
                    <span>{activeClassic.pattern.name}</span>
                    <span className="ml-auto opacity-60">{'●'.repeat(activeClassic.pattern.strength)}</span>
                  </div>
                )}

                {/* Indicators */}
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">Indikator</p>
                  <div className="rounded border border-border px-2">
                    {Object.values(activeClassic.indicators).map((ind) => (
                      <IndRow key={ind.label} {...ind} />
                    ))}
                  </div>
                </div>

                {/* Support / Resistance */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded border border-green-500/20 bg-green-500/5 px-2 py-1.5">
                    <div className="text-[9px] text-muted-foreground">Support</div>
                    <div className="text-xs font-mono font-bold text-green-400">
                      {formatPrice(activeClassic.support)}
                    </div>
                  </div>
                  <div className="rounded border border-red-500/20 bg-red-500/5 px-2 py-1.5">
                    <div className="text-[9px] text-muted-foreground">Resistance</div>
                    <div className="text-xs font-mono font-bold text-red-400">
                      {formatPrice(activeClassic.resistance)}
                    </div>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="flex items-start gap-1.5 rounded bg-muted/50 px-2 py-1.5">
                  <ShieldAlert className="h-3 w-3 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-muted-foreground leading-tight">
                    Sinyal bersifat informatif. Konfluensi tinggi menunjukkan probabilitas lebih besar, bukan jaminan.
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="flex items-center justify-center py-6 text-[10px] text-muted-foreground">
                Data tidak cukup untuk timeframe {activeTF}
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
