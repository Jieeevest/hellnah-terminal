import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Play, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import type { Exchange, MarketType, Ticker } from '@/types'
import { useBacktest, type BtTrade } from '@/hooks/useBacktest'
import { SIGNAL_TIMEFRAMES, type SignalTimeframe } from '@/hooks/useSignalData'
import { cn } from '@/lib/utils'

interface Props {
  ticker: Ticker | null
  exchange: Exchange
  marketType: MarketType
}

const DIR_COLOR: Record<string, string> = {
  STRONG_BUY: 'text-green-400', BUY: 'text-green-400',
  NEUTRAL: 'text-yellow-400',
  SELL: 'text-red-400', STRONG_SELL: 'text-red-400',
}
const DIR_LABEL: Record<string, string> = {
  STRONG_BUY: '▲▲', BUY: '▲', NEUTRAL: '—', SELL: '▼', STRONG_SELL: '▼▼',
}

// ── Equity curve SVG ───────────────────────────────────────────
function EquityCurve({ curve }: { curve: number[] }) {
  if (curve.length < 2) return null
  const W = 220, H = 60, PAD = 4
  const min = Math.min(0, ...curve)
  const max = Math.max(0, ...curve)
  const range = max - min || 1
  const toX = (i: number) => PAD + (i / (curve.length - 1)) * (W - PAD * 2)
  const toY = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2)
  const pts = curve.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')
  const zeroY = toY(0)
  const lastPnl = curve[curve.length - 1]
  const lineColor = lastPnl >= 0 ? '#22c55e' : '#ef4444'

  return (
    <svg width={W} height={H} className="w-full">
      {/* zero line */}
      <line x1={PAD} x2={W - PAD} y1={zeroY} y2={zeroY} stroke="#374151" strokeWidth="0.5" strokeDasharray="2" />
      {/* area fill */}
      <polyline
        points={`${toX(0)},${zeroY} ${pts} ${toX(curve.length - 1)},${zeroY}`}
        fill={lastPnl >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}
        stroke="none"
      />
      {/* line */}
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ── Stat card ──────────────────────────────────────────────────
function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-bold font-mono', color ?? 'text-foreground')}>{value}</span>
      {sub && <span className="text-[9px] text-muted-foreground">{sub}</span>}
    </div>
  )
}

// ── Params form ────────────────────────────────────────────────
const TF_DEFAULTS: Record<SignalTimeframe, { lf: number; tp: number; sl: number }> = {
  '5m':  { lf: 12, tp: 1.5, sl: 0.8 },
  '15m': { lf: 8,  tp: 2,   sl: 1   },
  '30m': { lf: 6,  tp: 2.5, sl: 1.2 },
  '1h':  { lf: 5,  tp: 3,   sl: 1.5 },
  '4h':  { lf: 4,  tp: 4,   sl: 2   },
}

function PillGroup<T extends string>({
  options, value, onChange, className,
}: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('flex gap-1', className)}>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            'px-2 py-0.5 text-[10px] rounded border transition-colors',
            value === o.v
              ? 'border-primary text-primary bg-primary/10'
              : 'border-border text-muted-foreground hover:border-muted-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function BacktestPanel({ ticker, exchange, marketType }: Props) {
  const [tf, setTf] = useState<SignalTimeframe>('15m')
  const [tp, setTp] = useState(2)
  const [sl, setSl] = useState(1)
  const [lf, setLf] = useState(8)
  const [minConf, setMinConf] = useState(60)
  const [showAll, setShowAll] = useState(false)

  const { result, loading, error, progress, run } = useBacktest(
    ticker?.symbol ?? '', exchange, marketType
  )

  const handleTfChange = (t: SignalTimeframe) => {
    setTf(t)
    const d = TF_DEFAULTS[t]
    setTp(d.tp); setSl(d.sl); setLf(d.lf)
  }

  const handleRun = () => {
    run({ timeframe: tf, tp, sl, lookforward: lf, minConfluence: minConf })
  }

  const displayTrades = useMemo(
    () => showAll ? result?.trades ?? [] : (result?.trades ?? []).slice(-20),
    [result, showAll]
  )

  if (!ticker) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Pilih koin terlebih dahulu
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-3 py-2 gap-3">

      {/* ── Parameters ── */}
      <div className="flex flex-col gap-2 bg-muted/30 rounded-lg p-2.5 border border-border">
        <div className="text-[10px] font-semibold text-muted-foreground">Parameter Backtest</div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground w-16 shrink-0">Timeframe</span>
            <PillGroup
              options={SIGNAL_TIMEFRAMES.map((t) => ({ v: t, label: t }))}
              value={tf}
              onChange={handleTfChange}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground w-16 shrink-0">Take Profit</span>
            <PillGroup
              options={[1.5, 2, 3, 5].map((v) => ({ v: v as unknown as string, label: `${v}%` }))}
              value={tp as unknown as string}
              onChange={(v) => setTp(+v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground w-16 shrink-0">Stop Loss</span>
            <PillGroup
              options={[0.8, 1, 1.5, 2].map((v) => ({ v: v as unknown as string, label: `${v}%` }))}
              value={sl as unknown as string}
              onChange={(v) => setSl(+v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground w-16 shrink-0">Lookforward</span>
            <PillGroup
              options={[4, 6, 8, 12].map((v) => ({ v: v as unknown as string, label: `${v}c` }))}
              value={lf as unknown as string}
              onChange={(v) => setLf(+v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground w-16 shrink-0">Min. Konf.</span>
            <PillGroup
              options={[50, 60, 70, 80].map((v) => ({ v: v as unknown as string, label: `${v}%` }))}
              value={minConf as unknown as string}
              onChange={(v) => setMinConf(+v)}
            />
          </div>
        </div>

        <motion.button
          onClick={handleRun}
          disabled={loading}
          whileTap={{ scale: 0.97 }}
          className="w-full py-2 rounded-lg bg-primary text-white text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {progress || 'Menghitung...'}
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Jalankan Backtest — {ticker.baseAsset} {tf}
            </>
          )}
        </motion.button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-[10px] bg-red-500/10 rounded px-2 py-1.5 border border-red-500/20">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Results ── */}
      {result && result.totalTrades > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3"
        >
          {/* Win rate hero */}
          <div className={cn(
            'rounded-lg border p-3 text-center',
            result.winRate >= 60 ? 'bg-green-500/10 border-green-500/30'
            : result.winRate >= 50 ? 'bg-yellow-500/10 border-yellow-500/30'
            : 'bg-red-500/10 border-red-500/30'
          )}>
            <div className={cn(
              'text-3xl font-bold font-mono',
              result.winRate >= 60 ? 'text-green-400' : result.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'
            )}>
              {result.winRate.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Win Rate</div>
            <div className="text-[10px] mt-1 flex items-center justify-center gap-2">
              <span className="text-green-400 flex items-center gap-0.5">
                <CheckCircle className="h-3 w-3" />{result.wins} menang
              </span>
              <span className="text-red-400 flex items-center gap-0.5">
                <XCircle className="h-3 w-3" />{result.losses} kalah
              </span>
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/30 rounded border border-border p-2">
              <Stat
                label="Total P&L"
                value={`${result.totalPnl >= 0 ? '+' : ''}${result.totalPnl.toFixed(2)}%`}
                color={result.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}
              />
            </div>
            <div className="bg-muted/30 rounded border border-border p-2">
              <Stat label="Profit Factor" value={result.profitFactor === 999 ? '∞' : result.profitFactor.toFixed(2)}
                color={result.profitFactor >= 1.5 ? 'text-green-400' : result.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'}
              />
            </div>
            <div className="bg-muted/30 rounded border border-border p-2">
              <Stat label="Rata-rata Menang" value={`+${result.avgWin.toFixed(2)}%`} color="text-green-400" />
            </div>
            <div className="bg-muted/30 rounded border border-border p-2">
              <Stat label="Rata-rata Kalah" value={`-${result.avgLoss.toFixed(2)}%`} color="text-red-400" />
            </div>
            <div className="bg-muted/30 rounded border border-border p-2">
              <Stat label="Max Drawdown" value={`-${result.maxDrawdown.toFixed(2)}%`} color="text-yellow-400" />
            </div>
            <div className="bg-muted/30 rounded border border-border p-2">
              <Stat label="Total Trades" value={result.totalTrades.toString()} sub={`${result.candlesUsed} candle`} />
            </div>
          </div>

          {/* Equity curve */}
          <div className="bg-muted/20 rounded border border-border p-2">
            <div className="text-[9px] text-muted-foreground mb-1">Equity Curve (kumulatif P&L)</div>
            <EquityCurve curve={result.equityCurve} />
          </div>

          {/* By direction */}
          <div className="flex flex-col gap-1">
            <div className="text-[10px] font-medium text-muted-foreground">Akurasi per Sinyal</div>
            {Object.entries(result.byDir).map(([dir, { wins, total }]) => {
              const wr = (wins / total) * 100
              return (
                <div key={dir} className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-bold w-20 shrink-0', DIR_COLOR[dir])}>
                    {DIR_LABEL[dir]} {dir.replace('_', ' ')}
                  </span>
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', wr >= 60 ? 'bg-green-500' : wr >= 50 ? 'bg-yellow-500' : 'bg-red-500')}
                      style={{ width: `${wr}%` }}
                    />
                  </div>
                  <span className={cn('text-[10px] font-mono w-10 text-right', wr >= 60 ? 'text-green-400' : wr >= 50 ? 'text-yellow-400' : 'text-red-400')}>
                    {wr.toFixed(0)}%
                  </span>
                  <span className="text-[9px] text-muted-foreground w-10">{wins}/{total}</span>
                </div>
              )
            })}
          </div>

          {/* Period info */}
          <div className="text-[9px] text-muted-foreground text-center">
            {new Date(result.fromTime).toLocaleDateString('id-ID')} —{' '}
            {new Date(result.toTime).toLocaleDateString('id-ID')} · {result.timeframe}
          </div>

          {/* Trade list */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-medium text-muted-foreground">
                Riwayat Trade {!showAll && result.trades.length > 20 ? `(${result.trades.length - 20} tersembunyi)` : ''}
              </div>
              {result.trades.length > 20 && (
                <button
                  onClick={() => setShowAll((s) => !s)}
                  className="text-[9px] text-primary hover:underline"
                >
                  {showAll ? 'Tampilkan sedikit' : 'Tampilkan semua'}
                </button>
              )}
            </div>

            <div className="rounded border border-border overflow-hidden">
              {/* header */}
              <div className="grid grid-cols-[60px_32px_40px_52px_52px_40px] text-[9px] text-muted-foreground bg-muted/50 px-2 py-1 font-medium">
                <span>Waktu</span>
                <span>Arah</span>
                <span>Konf.</span>
                <span>Entry</span>
                <span>Exit</span>
                <span className="text-right">P&L</span>
              </div>
              {displayTrades.map((t) => (
                <TradeRow key={t.index} trade={t} />
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-1.5 rounded bg-muted/40 px-2 py-1.5 border border-border">
            <AlertTriangle className="h-3 w-3 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-[9px] text-muted-foreground leading-tight">
              Hasil backtest berbasis data historis. Past performance tidak menjamin hasil masa depan. Gunakan sebagai referensi saja.
            </p>
          </div>
        </motion.div>
      )}

      {result && result.totalTrades === 0 && !loading && (
        <div className="text-center py-4 text-[10px] text-muted-foreground">
          Tidak ada sinyal yang memenuhi filter confluence {minConf}%.
          Coba turunkan nilai Min. Konf.
        </div>
      )}
    </div>
  )
}

function TradeRow({ trade }: { trade: BtTrade }) {
  const time = new Date(trade.time)
  const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`
  const pnlColor = trade.win ? 'text-green-400' : 'text-red-400'

  return (
    <div className={cn(
      'grid grid-cols-[60px_32px_40px_52px_52px_40px] text-[9px] px-2 py-1 border-t border-border/50',
      trade.win ? 'bg-green-500/3' : 'bg-red-500/3'
    )}>
      <span className="text-muted-foreground font-mono truncate">{timeStr}</span>
      <span className={cn('font-bold', DIR_COLOR[trade.direction])}>{DIR_LABEL[trade.direction]}</span>
      <span className="text-muted-foreground">{trade.confluence}%</span>
      <span className="font-mono text-foreground">{trade.entryPrice.toPrecision(5)}</span>
      <span className={cn('font-mono', trade.exitReason === 'SL' ? 'text-red-400' : trade.exitReason === 'TP' ? 'text-green-400' : 'text-muted-foreground')}>
        {trade.exitPrice.toPrecision(5)}
      </span>
      <span className={cn('font-mono font-bold text-right', pnlColor)}>
        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}%
      </span>
    </div>
  )
}
