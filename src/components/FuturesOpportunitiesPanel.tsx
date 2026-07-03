import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, RefreshCw, Scan, X } from 'lucide-react'
import type { Exchange, Ticker } from '@/types'
import { useFuturesOpportunities, type FuturesOpportunity, type FuturesTradePlan } from '@/hooks/useFuturesOpportunities'
import { cn, formatNumber, formatPrice } from '@/lib/utils'
import type { Timeframe } from '@/lib/signals'

interface Props {
  tickers: Ticker[]
  exchange: Exchange
  active?: boolean
  onSelectCoin: (ticker: Ticker) => void
}

type SideFilter = 'all' | 'long' | 'short'
type RiskFilter = 'all' | 'low' | 'medium' | 'high'
type CrowdedFilter = 'all' | 'low' | 'moderate' | 'high'
type FundingFilter = 'all' | 'negative' | 'positive' | 'hot'

function sideTone(side: 'long' | 'short') {
  return side === 'long'
    ? { label: 'LONG', className: 'text-green-400 bg-green-500/10' }
    : { label: 'SHORT', className: 'text-red-400 bg-red-500/10' }
}

function timeframeLabel(tf: Timeframe) {
  if (tf === '15m') return '15m'
  if (tf === '30m') return '30m'
  if (tf === '1h') return '1 jam'
  return '4 jam'
}

function metricTone(kind: 'confidence' | 'risk' | 'crowdedness', value: string) {
  if (kind === 'confidence') {
    return value === 'High' ? 'text-green-400 bg-green-500/10'
      : value === 'Medium' ? 'text-yellow-400 bg-yellow-500/10'
      : 'text-orange-400 bg-orange-500/10'
  }
  if (kind === 'risk') {
    return value === 'Low' ? 'text-green-400 bg-green-500/10'
      : value === 'Medium' ? 'text-yellow-400 bg-yellow-500/10'
      : 'text-orange-400 bg-orange-500/10'
  }
  return value === 'Low' ? 'text-green-400 bg-green-500/10'
    : value === 'Moderate' ? 'text-yellow-400 bg-yellow-500/10'
    : 'text-orange-400 bg-orange-500/10'
}

function PlanCard({ timeframe, plan, side }: { timeframe: Timeframe; plan: FuturesTradePlan; side: 'long' | 'short' }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 px-2 py-2">
      <div className="text-[10px] font-semibold text-foreground mb-1">{timeframeLabel(timeframe)}</div>
      <div className="space-y-1 text-[9px] leading-relaxed text-muted-foreground">
        <p>
          <span className="text-foreground font-medium">Open:</span> {formatPrice(plan.openLow)} - {formatPrice(plan.openHigh)}
        </p>
        <p>
          <span className="text-foreground font-medium">Close rugi:</span> {side === 'long' ? 'di bawah' : 'di atas'} {formatPrice(plan.stopLoss)}
        </p>
        <p>
          <span className="text-foreground font-medium">Close untung:</span> {formatPrice(plan.takeProfit1)} lalu {formatPrice(plan.takeProfit2)}
        </p>
        <p>{plan.note}</p>
      </div>
    </div>
  )
}

function OpportunityRow({ item, onSelectCoin }: { item: FuturesOpportunity; onSelectCoin: (ticker: Ticker) => void }) {
  const [showPlans, setShowPlans] = useState(false)
  const tone = sideTone(item.side)

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      onClick={() => onSelectCoin(item.ticker)}
      className="w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-bold text-xs text-foreground flex-1 truncate">
          {item.ticker.baseAsset}<span className="text-muted-foreground font-normal">/PERP</span>
        </span>
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-semibold', tone.className)}>
          {tone.label}
        </span>
        <span className="text-[10px] font-mono text-foreground">{item.accuracyPct}%</span>
      </div>

      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', item.side === 'long' ? 'bg-green-500' : 'bg-red-500')}
            initial={{ width: 0 }}
            animate={{ width: `${item.accuracyPct}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>
        <span className={cn(
          'text-[10px] font-mono w-14 text-right',
          item.ticker.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
        )}>
          {item.ticker.priceChangePercent >= 0 ? '+' : ''}{item.ticker.priceChangePercent.toFixed(2)}%
        </span>
      </div>

      <div className="text-[10px] leading-relaxed text-muted-foreground space-y-1">
        <p><span className="text-foreground font-medium">{item.contextLabel}:</span> {item.summary}</p>
        <p>{item.oneLiner}</p>
        <p><span className="text-foreground font-medium">Pendorong:</span> {item.driver}</p>
        <p><span className="text-foreground font-medium">Invalidation:</span> {item.invalidationReason}</p>
        <p>
          <span className="text-foreground font-medium">Open:</span> {formatPrice(item.primaryPlan.openLow)} - {formatPrice(item.primaryPlan.openHigh)}
        </p>
        <p>
          <span className="text-foreground font-medium">Close rugi:</span>{' '}
          {item.side === 'long' ? 'di bawah' : 'di atas'} {formatPrice(item.primaryPlan.stopLoss)}
        </p>
        <p>
          <span className="text-foreground font-medium">Close untung:</span>{' '}
          {formatPrice(item.primaryPlan.takeProfit1)} lalu {formatPrice(item.primaryPlan.takeProfit2)}
        </p>
      </div>

      <div className="mt-1.5 flex gap-1 flex-wrap">
        <span className="text-[9px] px-1.5 py-0.5 rounded text-primary bg-primary/10">
          Score {item.score.toFixed(1)}%
        </span>
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded', metricTone('confidence', item.confidenceLabel))}>
          Confidence {item.confidenceLabel}
        </span>
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded', metricTone('risk', item.riskLabel))}>
          Risk {item.riskLabel}
        </span>
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded', metricTone('crowdedness', item.crowdednessLabel))}>
          Crowded {item.crowdednessLabel}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded text-sky-400 bg-sky-500/10">
          Vol {formatNumber(item.ticker.volume)}
        </span>
        {item.ticker.openInterest ? (
          <span className="text-[9px] px-1.5 py-0.5 rounded text-fuchsia-400 bg-fuchsia-500/10">
            OI {formatNumber(item.ticker.openInterest)}
          </span>
        ) : null}
        {item.ticker.fundingRate != null ? (
          <span className={cn(
            'text-[9px] px-1.5 py-0.5 rounded',
            item.ticker.fundingRate <= 0 ? 'text-green-400 bg-green-500/10' : 'text-orange-400 bg-orange-500/10'
          )}>
            Fund {item.ticker.fundingRate >= 0 ? '+' : ''}{item.ticker.fundingRate.toFixed(4)}%
          </span>
        ) : null}
      </div>

      <div className="mt-2">
        <button
          onClick={(event) => {
            event.stopPropagation()
            setShowPlans((prev) => !prev)
          }}
          className="text-[10px] text-sky-300 hover:text-sky-200 transition-colors"
        >
          {showPlans ? 'Sembunyikan' : 'Lihat'} area close semua timeframe
        </button>

        {showPlans && (
          <div className="mt-2 grid gap-2">
            {(['15m', '30m', '1h', '4h'] as const).map((tf) => {
              const plan = item.tradePlans[tf]
              if (!plan) return null
              return <PlanCard key={tf} timeframe={tf} plan={plan} side={item.side} />
            })}
          </div>
        )}
      </div>
    </motion.button>
  )
}

export function FuturesOpportunitiesPanel({ tickers, exchange, active = false, onSelectCoin }: Props) {
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
  const [crowdedFilter, setCrowdedFilter] = useState<CrowdedFilter>('all')
  const [fundingFilter, setFundingFilter] = useState<FundingFilter>('all')
  const [minAccuracy, setMinAccuracy] = useState(60)
  const [minRR, setMinRR] = useState(1.2)
  const { opportunities, status, progress, scannedCount, totalCount, lastRunAt, runScan, cancelScan } =
    useFuturesOpportunities(tickers, exchange)

  useEffect(() => {
    if (!active || !tickers.length) return

    runScan()
    const id = setInterval(() => {
      runScan()
    }, 45_000)

    return () => clearInterval(id)
  }, [active, exchange, tickers.length, runScan]) // runScan is stable (useCallback with no deps)

  const filtered = useMemo(() => {
    return opportunities.filter((item) => {
      if (sideFilter !== 'all' && item.side !== sideFilter) return false
      if (item.accuracyPct < minAccuracy) return false
      if (item.primaryPlan.riskReward < minRR) return false

      if (riskFilter !== 'all') {
        const wanted = riskFilter.charAt(0).toUpperCase() + riskFilter.slice(1)
        if (item.riskLabel !== wanted) return false
      }

      if (crowdedFilter !== 'all') {
        const wanted = crowdedFilter === 'moderate'
          ? 'Moderate'
          : crowdedFilter.charAt(0).toUpperCase() + crowdedFilter.slice(1)
        if (item.crowdednessLabel !== wanted) return false
      }

      const fundingRate = item.ticker.fundingRate
      if (fundingFilter === 'negative' && !(fundingRate != null && fundingRate < 0)) return false
      if (fundingFilter === 'positive' && !(fundingRate != null && fundingRate > 0)) return false
      if (fundingFilter === 'hot' && !(fundingRate != null && fundingRate > 0.03)) return false

      return true
    })
  }, [opportunities, sideFilter, minAccuracy, minRR, riskFilter, crowdedFilter, fundingFilter])

  const timeAgo = lastRunAt
    ? (() => {
        const s = Math.floor((Date.now() - lastRunAt) / 1000)
        return s < 60 ? `${s}d lalu` : `${Math.floor(s / 60)}m lalu`
      })()
    : null

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-bold text-foreground">Long / Short Now</p>
            <p className="text-[10px] text-muted-foreground">
              Daftar kandidat futures yang paling layak dipantau saat ini.
            </p>
          </div>
          {timeAgo && status !== 'scanning' && (
            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" /> {timeAgo}
            </span>
          )}
        </div>

        <div className="flex gap-1 mb-2">
          {([
            { id: 'all', label: 'Semua' },
            { id: 'long', label: 'Long' },
            { id: 'short', label: 'Short' },
          ] as { id: SideFilter; label: string }[]).map((item) => (
            <button
              key={item.id}
              onClick={() => setSideFilter(item.id)}
              className={cn(
                'px-2 py-0.5 text-[9px] rounded border transition-colors',
                sideFilter === item.id
                  ? 'border-primary/50 text-primary bg-primary/10'
                  : 'border-border text-muted-foreground hover:border-muted-foreground'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1 mb-2">
          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
            className="px-2 py-1 text-[9px] rounded border border-border bg-background text-foreground"
          >
            <option value="all">Semua Risk</option>
            <option value="low">Risk Low</option>
            <option value="medium">Risk Medium</option>
            <option value="high">Risk High</option>
          </select>
          <select
            value={crowdedFilter}
            onChange={(event) => setCrowdedFilter(event.target.value as CrowdedFilter)}
            className="px-2 py-1 text-[9px] rounded border border-border bg-background text-foreground"
          >
            <option value="all">Semua Crowd</option>
            <option value="low">Crowded Low</option>
            <option value="moderate">Crowded Moderate</option>
            <option value="high">Crowded High</option>
          </select>
          <select
            value={fundingFilter}
            onChange={(event) => setFundingFilter(event.target.value as FundingFilter)}
            className="px-2 py-1 text-[9px] rounded border border-border bg-background text-foreground"
          >
            <option value="all">Semua Funding</option>
            <option value="negative">Funding Negatif</option>
            <option value="positive">Funding Positif</option>
            <option value="hot">Funding Panas</option>
          </select>
          <div className="px-2 py-1 text-[9px] rounded border border-border bg-background text-foreground">
            RR ≥ {minRR.toFixed(1)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2 text-[9px] text-muted-foreground">
          <label className="flex flex-col gap-1">
            Akurasi ≥ {minAccuracy}%
            <input
              type="range"
              min={50}
              max={90}
              step={5}
              value={minAccuracy}
              onChange={(event) => setMinAccuracy(Number(event.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1">
            RR ≥ {minRR.toFixed(1)}
            <input
              type="range"
              min={1}
              max={3}
              step={0.2}
              value={minRR}
              onChange={(event) => setMinRR(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="rounded-md border border-sky-500/20 bg-sky-500/5 px-2.5 py-2 mb-2 text-[10px] leading-relaxed text-muted-foreground">
          <p>
            <span className="text-foreground font-medium">Akurasi:</span> ini adalah estimasi confidence scanner berdasarkan arah multi-timeframe,
            funding, dan trend. Bukan jaminan hasil trade.
          </p>
          <p>
            <span className="text-foreground font-medium">Auto refresh:</span> saat tab ini aktif, daftar akan scan ulang otomatis tiap 45 detik.
          </p>
        </div>

        {status === 'scanning' ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Mencari kandidat {scannedCount}/{totalCount}...
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
                className="h-full bg-primary rounded-full"
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
            className="w-full py-1.5 rounded-md bg-primary/15 text-primary text-[11px] font-bold
                       border border-primary/30 flex items-center justify-center gap-1.5
                       hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'idle'
              ? <><Scan className="h-3 w-3" /> Cari Long / Short ({Math.min(tickers.length, 60)} kontrak)</>
              : <><RefreshCw className="h-3 w-3" /> Scan Ulang</>}
          </motion.button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {status === 'idle' && !opportunities.length && (
          <div className="h-full flex items-center justify-center px-4 text-center text-[10px] text-muted-foreground">
            Jalankan scan untuk melihat kandidat long dan short futures saat ini.
          </div>
        )}

        {status === 'done' && !filtered.length && (
          <div className="h-full flex items-center justify-center px-4 text-center text-[10px] text-muted-foreground">
            Tidak ada kandidat yang cocok dengan filter saat ini.
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {filtered.map((item) => (
            <OpportunityRow
              key={`${item.side}-${item.ticker.symbol}`}
              item={item}
              onSelectCoin={onSelectCoin}
            />
          ))}
        </AnimatePresence>

        {status === 'scanning' && filtered.length > 0 && (
          <div className="px-3 py-2 text-[9px] text-muted-foreground flex items-center gap-1 border-t border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            Daftar kandidat diperbarui secara live...
          </div>
        )}
      </div>
    </div>
  )
}
