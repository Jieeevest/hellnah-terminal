import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scan, X, TrendingUp, TrendingDown, Minus, RefreshCw, Clock, Filter, Info } from 'lucide-react'
import type { Ticker, Exchange, MarketType } from '@/types'
import { useBullishScanner, type ScanResult, type FuturesTradePlan } from '@/hooks/useBullishScanner'
import type { BullishLabel, Timeframe } from '@/lib/signals'
import { cn, formatNumber, formatPrice } from '@/lib/utils'
import { InfoTooltip } from '@/components/InfoTooltip'

interface Props {
  tickers: Ticker[]
  exchange: Exchange
  marketType: MarketType
  onSelectCoin: (ticker: Ticker) => void
}

// ── Label styling ───────────────────────────────────────────────────────────
const LABEL_CFG: Record<BullishLabel, { color: string; bg: string; icon: React.ReactNode }> = {
  'Bullish':      { color: 'text-green-400',  bg: 'bg-green-500/15',   icon: <TrendingUp className="h-3 w-3" /> },
  'Mild Bullish': { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <TrendingUp className="h-3 w-3" /> },
  'Neutral':      { color: 'text-yellow-400', bg: 'bg-yellow-500/10',  icon: <Minus className="h-3 w-3" /> },
  'Mild Bearish': { color: 'text-orange-400', bg: 'bg-orange-500/10',  icon: <TrendingDown className="h-3 w-3" /> },
  'Bearish':      { color: 'text-red-400',    bg: 'bg-red-500/15',     icon: <TrendingDown className="h-3 w-3" /> },
}

const THRESHOLD_OPTIONS = [
  { label: 'Semua',   value: 0   },
  { label: '≥ 55%',   value: 55  },
  { label: '≥ 60%',   value: 60  },
  { label: '≥ 65%',   value: 65  },
]

function describeFunding(rate?: number) {
  if (rate == null) {
    return {
      short: 'Funding belum tersedia',
      detail: 'Data funding belum masuk, jadi baca hasil ini dengan konfirmasi harga dan volume.',
    }
  }

  if (rate < 0) {
    return {
      short: 'Funding minus',
      detail: 'Posisi long belum terlalu padat. Jika trend mulai naik, setup long biasanya lebih sehat.',
    }
  }

  if (rate <= 0.03) {
    return {
      short: 'Funding masih wajar',
      detail: 'Minat long ada, tapi belum terlalu ramai. Biasanya masih aman untuk dipantau.',
    }
  }

  return {
    short: 'Funding mulai panas',
    detail: 'Posisi long sudah ramai. Risiko entry telat dan kena pullback jadi lebih tinggi.',
  }
}

function describeOpenInterest(openInterest?: number) {
  if (!openInterest) {
    return 'Minat posisi terbuka belum menonjol.'
  }
  if (openInterest >= 1_000_000_000) {
    return 'Banyak posisi masih terbuka, artinya market ini ramai dan diperhatikan.'
  }
  if (openInterest >= 100_000_000) {
    return 'Open interest cukup besar, jadi ada minat trader yang lumayan kuat.'
  }
  return 'Open interest masih relatif kecil, jadi setup ini perlu konfirmasi ekstra.'
}

function buildFuturesQuickTake(result: ScanResult) {
  const { signal, ticker, rankingScore } = result

  if (signal.bullishPct >= 65 && (ticker.fundingRate ?? 0) <= 0) {
    return 'Trend naik terlihat kuat dan posisi long belum terlalu ramai.'
  }
  if (signal.bullishPct >= 65 && (ticker.fundingRate ?? 0) > 0.03) {
    return 'Trend naik kuat, tetapi trader long sudah mulai ramai. Hindari entry terlalu telat.'
  }
  if (rankingScore >= 60) {
    return 'Setup masih menarik, tetapi perlu lihat candle masuk agar tidak membeli di pucuk.'
  }
  return 'Sinyal belum sekuat kandidat teratas. Lebih cocok dipantau dulu daripada langsung entry.'
}

function buildFuturesGuideItems() {
  return [
    {
      label: 'Score',
      text: 'Semakin tinggi, semakin rapi kombinasi trend, volume, funding, dan open interest.',
    },
    {
      label: 'Funding',
      text: 'Funding minus sering lebih nyaman untuk cari long. Funding terlalu positif artinya long sudah ramai.',
    },
    {
      label: 'OI',
      text: 'Open Interest menunjukkan banyaknya posisi terbuka. Tinggi = market ramai, tapi bukan sinyal buy sendirian.',
    },
    {
      label: '15m-4h',
      text: 'Semakin banyak timeframe yang searah, semakin mudah hasil scan dipercaya.',
    },
  ]
}

function tradePlanTone(plan: FuturesTradePlan) {
  if (plan.riskReward >= 1.8) {
    return { label: 'Siap long', className: 'text-green-400 bg-green-500/10' }
  }
  if (plan.riskReward >= 1.2) {
    return { label: 'Tunggu pullback', className: 'text-yellow-400 bg-yellow-500/10' }
  }
  return { label: 'Risiko tinggi', className: 'text-orange-400 bg-orange-500/10' }
}

function infoTone(kind: 'context' | 'confidence' | 'risk' | 'crowdedness', value?: string) {
  if (!value) return 'text-muted-foreground bg-muted/40'

  if (kind === 'confidence') {
    if (value === 'High') return 'text-green-400 bg-green-500/10'
    if (value === 'Medium') return 'text-yellow-400 bg-yellow-500/10'
    return 'text-orange-400 bg-orange-500/10'
  }

  if (kind === 'risk') {
    if (value === 'Low') return 'text-green-400 bg-green-500/10'
    if (value === 'Medium') return 'text-yellow-400 bg-yellow-500/10'
    return 'text-orange-400 bg-orange-500/10'
  }

  if (kind === 'crowdedness') {
    if (value === 'Low') return 'text-green-400 bg-green-500/10'
    if (value === 'Moderate') return 'text-yellow-400 bg-yellow-500/10'
    return 'text-orange-400 bg-orange-500/10'
  }

  if (value === 'Trend Continuation' || value === 'Breakdown Short') {
    return 'text-green-400 bg-green-500/10'
  }
  if (value === 'Pullback Long' || value === 'Bounce Short') {
    return 'text-yellow-400 bg-yellow-500/10'
  }
  return 'text-orange-400 bg-orange-500/10'
}

function timeframeLabel(tf: Timeframe) {
  if (tf === '15m') return '15m'
  if (tf === '30m') return '30m'
  if (tf === '1h') return '1 jam'
  return '4 jam'
}

// ── Tooltip helpers ────────────────────────────────────────────────────────
function scoreTooltip(score: number) {
  const interp =
    score >= 70 ? 'Setup sangat rapi — banyak faktor mendukung.' :
    score >= 60 ? 'Setup menarik — layak dipantau lebih dekat.' :
    score >= 55 ? 'Setup moderat — butuh konfirmasi tambahan.' :
    'Setup lemah — perlu lebih banyak konfirmasi sebelum entry.'
  return {
    title: `Ranking Score · ${score.toFixed(1)}`,
    description: `Skor komposit dari trend multi-timeframe, volume, RSI, dan momentum. ${interp}`,
  }
}

function labelTooltip(label: BullishLabel, pct: number) {
  const map: Record<BullishLabel, string> = {
    'Bullish':      `${pct.toFixed(1)}% indikator teknikal mendukung kenaikan — sinyal kuat, momentum solid.`,
    'Mild Bullish': `${pct.toFixed(1)}% indikator mendukung naik — sinyal positif tapi belum sekuat Bullish penuh.`,
    'Neutral':      `${pct.toFixed(1)}% — indikator belum menunjukkan arah yang jelas, tunggu konfirmasi.`,
    'Mild Bearish': `${pct.toFixed(1)}% — mayoritas indikator menekan, hati-hati untuk long.`,
    'Bearish':      `${pct.toFixed(1)}% — tekanan jual dominan, setup long tidak disarankan saat ini.`,
  }
  return { title: `Label · ${label}`, description: map[label] }
}

function bullishPctTooltip(pct: number) {
  const interp =
    pct >= 65 ? 'Kuat — mayoritas besar indikator bullish.' :
    pct >= 55 ? 'Moderat — lebih banyak indikator bullish dari bearish.' :
    pct >= 45 ? 'Netral — sinyal seimbang, pasar ragu.' :
    'Lemah — indikator bearish lebih dominan.'
  return {
    title: `Bullish Score · ${pct.toFixed(1)}%`,
    description: `Persentase indikator teknikal yang mendukung kenaikan dari total yang dievaluasi. ${interp}`,
  }
}

function priceChangeTip(pct: number) {
  const dir = pct >= 0 ? 'naik' : 'turun'
  const abs = Math.abs(pct)
  const interp =
    abs >= 10 ? 'Pergerakan besar — waspadai volatilitas tinggi.' :
    abs >= 5  ? 'Pergerakan signifikan dalam sehari.' :
    abs >= 2  ? 'Pergerakan normal.' :
    'Pergerakan kecil, pasar relatif flat.'
  return {
    title: `Perubahan 24 Jam · ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
    description: `Harga ${dir} ${abs.toFixed(2)}% dari penutupan kemarin. ${interp}`,
  }
}

function barTooltip(pct: number) {
  const color =
    pct >= 65 ? 'Hijau (Bullish ≥65%)' :
    pct >= 55 ? 'Emerald (Mild Bullish 55-64%)' :
    pct >= 45 ? 'Kuning (Neutral 45-54%)' :
    pct >= 35 ? 'Oranye (Mild Bearish 35-44%)' :
    'Merah (Bearish <35%)'
  return {
    title: 'Bullish Strength Bar',
    description: `Visualisasi kekuatan sinyal. Saat ini: ${color}. Semakin panjang ke kanan, semakin kuat tekanan beli.`,
  }
}

function tfTooltip(tf: Timeframe, score: number) {
  const tfDesc: Record<Timeframe, string> = {
    '15m': 'Candle 15 menit — berguna untuk melihat momentum intraday jangka pendek.',
    '30m': 'Candle 30 menit — konfirmasi lebih stabil dari 15m.',
    '1h':  'Candle 1 jam — menunjukkan arah medium-term yang lebih andal.',
    '4h':  'Candle 4 jam — tren utama pasar. Paling berbobot untuk keputusan entry.',
  }
  const interp =
    score >= 70 ? 'Sinyal kuat di timeframe ini.' :
    score >= 60 ? 'Sinyal bagus, layak dipantau.' :
    score >= 50 ? 'Sinyal moderat, butuh konfirmasi.' :
    'Sinyal lemah di timeframe ini.'
  return {
    title: `Timeframe ${tf.toUpperCase()} · ${score.toFixed(0)}%`,
    description: `${tfDesc[tf]} ${interp}`,
  }
}

function FuturesPlanCard({ timeframe, plan }: { timeframe: Timeframe; plan: FuturesTradePlan }) {
  const tone = tradePlanTone(plan)

  return (
    <div className="rounded-md border border-border/60 bg-background/40 px-2 py-2">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[10px] font-semibold text-foreground">{timeframeLabel(timeframe)}</span>
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-medium', tone.className)}>
          {tone.label}
        </span>
      </div>
      <div className="space-y-1 text-[9px] leading-relaxed text-muted-foreground">
        <p>
          <span className="text-foreground font-medium">Open:</span> {formatPrice(plan.openLow)} - {formatPrice(plan.openHigh)}
        </p>
        <p>
          <span className="text-foreground font-medium">Close rugi:</span> di bawah {formatPrice(plan.stopLoss)}
        </p>
        <p>
          <span className="text-foreground font-medium">Close untung:</span> {formatPrice(plan.takeProfit1)} lalu {formatPrice(plan.takeProfit2)}
        </p>
        <p>
          <span className="text-foreground font-medium">RR:</span> {plan.riskReward.toFixed(2)}x
        </p>
        <p>{plan.note}</p>
      </div>
    </div>
  )
}

// ── Mini gauge bar ────────────────────────────────────────────────────────
function PctBar({ pct }: { pct: number }) {
  const color =
    pct >= 65 ? 'bg-green-500' :
    pct >= 55 ? 'bg-emerald-500' :
    pct >= 45 ? 'bg-yellow-500' :
    pct >= 35 ? 'bg-orange-500' :
    'bg-red-500'
  return (
    <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full', color)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  )
}

// ── Single result row ─────────────────────────────────────────────────────
function ResultRow({ result, rank, onClick, marketType }: {
  result: ScanResult
  rank: number
  onClick: () => void
  marketType: MarketType
}) {
  const { ticker, signal, rankingScore } = result
  const cfg = LABEL_CFG[signal.label]
  const pctColor = ticker.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
  const isFutures = marketType === 'futures'
  const [showTradePlans, setShowTradePlans] = useState(false)
  const fundingTone =
    ticker.fundingRate == null
      ? 'text-muted-foreground bg-muted/40'
      : ticker.fundingRate <= 0
        ? 'text-green-400 bg-green-500/10'
        : 'text-orange-400 bg-orange-500/10'
  const fundingCopy = describeFunding(ticker.fundingRate)
  const quickTake = buildFuturesQuickTake(result)

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="w-full flex flex-col gap-1 px-3 py-2.5 border-b border-border/50 hover:bg-muted/30 text-left transition-colors"
    >
      {/* Row 1: rank + symbol + label + pct */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground w-4 shrink-0 font-mono">{rank}</span>
        <span className="font-bold text-xs text-foreground flex-1 truncate flex items-center gap-1">
          {ticker.baseAsset}
          <span className="text-muted-foreground font-normal">{isFutures ? '/PERP' : '/USDT'}</span>
          {signal.trend === 'Uptrend' && <TrendingUp className="h-3 w-3 text-green-400 ml-0.5" />}
          {signal.trend === 'Downtrend' && <TrendingDown className="h-3 w-3 text-red-400 ml-0.5" />}
        </span>
        <InfoTooltip {...scoreTooltip(rankingScore)}>
          <div className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold cursor-default">
            {rankingScore.toFixed(1)}
          </div>
        </InfoTooltip>
        <InfoTooltip {...labelTooltip(signal.label, signal.bullishPct)}>
          <div className={cn('flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-semibold cursor-default', cfg.bg, cfg.color)}>
            {cfg.icon}
            {signal.label}
          </div>
        </InfoTooltip>
      </div>

      {/* Row 2: gauge bar + bullish pct + 24h change */}
      <div className="flex items-center gap-2 pl-6">
        <InfoTooltip {...barTooltip(signal.bullishPct)} className="flex flex-1 min-w-0" side="bottom">
          <PctBar pct={signal.bullishPct} />
        </InfoTooltip>
        <InfoTooltip {...bullishPctTooltip(signal.bullishPct)} side="bottom">
          <span className="text-[11px] font-mono font-bold text-foreground w-10 text-right cursor-default">
            {signal.bullishPct.toFixed(1)}%
          </span>
        </InfoTooltip>
        <InfoTooltip {...priceChangeTip(ticker.priceChangePercent)} side="bottom">
          <span className={cn('text-[10px] font-mono w-14 text-right cursor-default', pctColor)}>
            {ticker.priceChangePercent >= 0 ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}%
          </span>
        </InfoTooltip>
      </div>

      {/* Row 3: futures context */}
      {isFutures && (
        <div className="flex gap-1 pl-6 flex-wrap">
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded', fundingTone)}>
            Fund {ticker.fundingRate == null ? '—' : `${ticker.fundingRate >= 0 ? '+' : ''}${ticker.fundingRate.toFixed(4)}%`}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded text-sky-400 bg-sky-500/10">
            Vol {formatNumber(ticker.volume)}
          </span>
          {ticker.openInterest ? (
            <span className="text-[9px] px-1.5 py-0.5 rounded text-fuchsia-400 bg-fuchsia-500/10">
              OI {formatNumber(ticker.openInterest)}
            </span>
          ) : null}
        </div>
      )}

      {isFutures && (
        <div className="pl-6 pr-1 text-[10px] leading-relaxed text-muted-foreground">
          <span className="text-foreground font-medium">Bacaan cepat:</span> {result.summary ?? quickTake}
          <br />
          <span className="text-foreground font-medium">Ringkasan:</span> {result.oneLiner ?? result.driver ?? fundingCopy.detail}
          <br />
          <span className="text-foreground font-medium">Invalidation:</span> {result.invalidationReason ?? describeOpenInterest(ticker.openInterest)}
        </div>
      )}

      {isFutures && (
        <div className="flex gap-1 pl-6 flex-wrap">
          {result.contextLabel ? (
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded', infoTone('context', result.contextLabel))}>
              {result.contextLabel}
            </span>
          ) : null}
          {result.confidenceLabel ? (
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded', infoTone('confidence', result.confidenceLabel))}>
              Confidence {result.confidenceLabel}
            </span>
          ) : null}
          {result.riskLabel ? (
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded', infoTone('risk', result.riskLabel))}>
              Risk {result.riskLabel}
            </span>
          ) : null}
          {result.crowdednessLabel ? (
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded', infoTone('crowdedness', result.crowdednessLabel))}>
              Crowded {result.crowdednessLabel}
            </span>
          ) : null}
        </div>
      )}

      {isFutures && result.tradePlans && (
        <div className="pl-6 pr-1">
          <button
            onClick={(event) => {
              event.stopPropagation()
              setShowTradePlans((prev) => !prev)
            }}
            className="text-[10px] text-sky-300 hover:text-sky-200 transition-colors"
          >
            {showTradePlans ? 'Sembunyikan' : 'Lihat'} rekomendasi open/close per timeframe
          </button>

          {showTradePlans && (
            <div className="mt-2 grid gap-2">
              {(['15m', '30m', '1h', '4h'] as const).map((tf) => {
                const plan = result.tradePlans?.[tf]
                if (!plan) return null
                return <FuturesPlanCard key={tf} timeframe={tf} plan={plan} />
              })}
            </div>
          )}
        </div>
      )}

      {/* Row 4: timeframe breakdown pills */}
      <div className="flex gap-1 pl-6 flex-wrap">
        {(['15m', '30m', '1h', '4h'] as const).map((tf) => {
          const tfData = signal.breakdown[tf]
          if (!tfData) return null
          const score = tfData.combinedScore
          const c = score >= 60 ? 'text-green-400 bg-green-500/10' :
                    score <= 40 ? 'text-red-400 bg-red-500/10' :
                    'text-yellow-400 bg-yellow-500/10'
          return (
            <InfoTooltip key={tf} {...tfTooltip(tf, score)} side="bottom">
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded cursor-default', c)}>
                {tf.toUpperCase()} {score.toFixed(0)}%
              </span>
            </InfoTooltip>
          )
        })}
      </div>
    </motion.button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export function BullishWatchlist({ tickers, exchange, marketType, onSelectCoin }: Props) {
  const [threshold, setThreshold] = useState(55)
  const [showFuturesGuide, setShowFuturesGuide] = useState(true)
  const { results, status, progress, scannedCount, totalCount, lastRunAt, runScan, cancelScan } =
    useBullishScanner(tickers, exchange, marketType)
  const isFutures = marketType === 'futures'
  const futuresGuideItems = useMemo(() => buildFuturesGuideItems(), [])

  const filtered = useMemo(
    () => results.filter((r) => r.signal.bullishPct >= threshold),
    [results, threshold]
  )

  const timeAgo = lastRunAt
    ? (() => {
        const s = Math.floor((Date.now() - lastRunAt) / 1000)
        return s < 60 ? `${s}d lalu` : `${Math.floor(s / 60)}m lalu`
      })()
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs font-bold text-foreground">
              {isFutures ? 'Futures Scanner' : 'Bullish Scanner'}
            </span>
            {status === 'done' && (
              <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {filtered.length} hasil
              </span>
            )}
          </div>
          {timeAgo && status !== 'scanning' && (
            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" /> {timeAgo}
            </span>
          )}
        </div>

        {/* Threshold filter */}
        <div className="flex items-center gap-1 mb-2">
          <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
          <div className="flex gap-1">
            {THRESHOLD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setThreshold(opt.value)}
                className={cn(
                  'px-2 py-0.5 text-[9px] rounded border transition-colors',
                  threshold === opt.value
                    ? 'border-green-500/50 text-green-400 bg-green-500/10'
                    : 'border-border text-muted-foreground hover:border-muted-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isFutures && (
          <div className="mb-2 rounded-md border border-sky-500/20 bg-sky-500/5 px-2.5 py-2">
            <button
              onClick={() => setShowFuturesGuide((prev) => !prev)}
              className="w-full flex items-center justify-between gap-2 text-left"
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-sky-300">
                <Info className="h-3 w-3" />
                Cara baca hasil futures
              </span>
              <span className="text-[9px] text-muted-foreground">
                {showFuturesGuide ? 'Sembunyikan' : 'Tampilkan'}
              </span>
            </button>

            {showFuturesGuide && (
              <div className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-muted-foreground">
                <p>
                  Scanner ini membantu mencari kontrak futures yang sedang terlihat menarik. Hasil tinggi bukan berarti wajib buy,
                  tetapi berarti setup-nya lebih layak dipantau.
                </p>
                {futuresGuideItems.map((item) => (
                  <p key={item.label}>
                    <span className="text-foreground font-medium">{item.label}:</span> {item.text}
                  </p>
                ))}
                <p>
                  <span className="text-foreground font-medium">Open / Close:</span> Anggap sebagai zona rencana,
                  bukan harga pasti. Open adalah area masuk, close rugi adalah batas batal, dan close untung adalah area ambil profit.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Scan button / progress */}
        {status === 'scanning' ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Scanning {scannedCount}/{totalCount} koin...
              </span>
              <button
                onClick={cancelScan}
                className="text-[9px] text-red-400 hover:text-red-300 flex items-center gap-0.5"
              >
                <X className="h-2.5 w-2.5" /> Batal
              </button>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <motion.div
                className="h-full bg-green-500 rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        ) : (
          <motion.button
            onClick={runScan}
            disabled={tickers.length === 0}
            whileTap={{ scale: 0.97 }}
            className="w-full py-1.5 rounded-md bg-green-500/15 text-green-400 text-[11px] font-bold
                       border border-green-500/30 flex items-center justify-center gap-1.5
                       hover:bg-green-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'idle' ? (
              <><Scan className="h-3 w-3" /> Mulai Scan ({Math.min(tickers.length, 80)} {isFutures ? 'kontrak' : 'koin'})</>
            ) : (
              <><RefreshCw className="h-3 w-3" /> Scan Ulang</>
            )}
          </motion.button>
        )}
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {status === 'idle' && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground mb-1">
                {isFutures ? 'Futures Setup Scanner' : 'Bullish Scanner MTF'}
              </p>
              <p className="text-[10px] leading-relaxed">
                Klik "Mulai Scan" untuk menganalisis {isFutures ? 'kontrak futures' : 'semua koin'} berdasarkan<br />
                Multi-Timeframe (15m, 30m, 1h, 4h)<br />
                dengan kombinasi Classic & Weighted Signal{isFutures ? ' + funding context.' : '.'}
              </p>
            </div>
          </div>
        )}

        {filtered.length === 0 && status === 'done' && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground px-4 text-center">
            <Minus className="h-5 w-5" />
            <p className="text-[10px]">Tidak ada koin yang memenuhi threshold {threshold}% saat ini.</p>
            <button
              onClick={() => setThreshold(0)}
              className="text-[10px] text-primary hover:underline"
            >
              Tampilkan semua
            </button>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {filtered.map((result, i) => (
            <ResultRow
              key={result.ticker.symbol}
              result={result}
              rank={i + 1}
              marketType={marketType}
              onClick={() => onSelectCoin(result.ticker)}
            />
          ))}
        </AnimatePresence>

        {/* Live streaming indicator while scanning */}
        {status === 'scanning' && filtered.length > 0 && (
          <div className="px-3 py-2 text-[9px] text-muted-foreground flex items-center gap-1 border-t border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            Hasil diperbarui secara live...
          </div>
        )}
      </div>
    </div>
  )
}
