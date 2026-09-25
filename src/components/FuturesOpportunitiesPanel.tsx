import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Scan, SlidersHorizontal, TrendingDown, TrendingUp, X } from 'lucide-react'
import type { Exchange, Ticker } from '@/types'
import { useFuturesOpportunities, type FuturesOpportunity, type FuturesTradePlan } from '@/hooks/useFuturesOpportunities'
import { cn, formatPrice } from '@/lib/utils'
import type { Timeframe } from '@/lib/signals'
import { CoinIcon } from '@/components/CoinIcon'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Pill } from '@/components/ui/PillTabs'
import { PanelHeader } from '@/components/ui/PanelHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatFibRatio } from '@/lib/fibonacci'
import { getVerdict, hasReachedEntry, planEntryRef, VerdictBanner, VERDICT_ORDER, type Verdict } from '@/components/TradeVerdict'

interface Props {
  tickers: Ticker[]
  exchange: Exchange
  active?: boolean
  onSelectCoin: (ticker: Ticker) => void
}

type SideFilter = 'all' | 'long' | 'short'
type Preset = 'safe' | 'balanced' | 'all'
type Level = 'all' | 'Low' | 'Medium' | 'High'
type FundingFilter = 'all' | 'negative' | 'positive'

// R:R sengaja gak dijadikan filter: SL/TP di futuresEngine persentase tetap (TP 3% / SL 20%),
// jadi R:R semua kandidat selalu sama (0.15) — filter lama "R:R ≥ 1.2" bikin hasil selalu kosong.
const PRESETS: Record<Preset, { label: string; hint: string; minAccuracy: number; blockHighRisk: boolean; blockCrowded: boolean }> = {
  safe: { label: 'Aman', hint: 'Skor keyakinan ≥ 65%, risiko & keramaian tidak tinggi', minAccuracy: 65, blockHighRisk: true, blockCrowded: true },
  balanced: { label: 'Seimbang', hint: 'Skor keyakinan ≥ 55%, tidak terlalu ramai', minAccuracy: 55, blockHighRisk: false, blockCrowded: true },
  all: { label: 'Semua', hint: 'Tampilkan semua kandidat', minAccuracy: 0, blockHighRisk: false, blockCrowded: false },
}

const CONTEXT_LABEL: Record<string, string> = {
  'Trend Continuation': 'Lanjut tren',
  'Pullback Long': 'Koreksi, siap naik',
  'Overextended Long': 'Naik terlalu jauh',
  'Breakdown Short': 'Tembus ke bawah',
  'Bounce Short': 'Pantulan, siap turun',
  'Overextended Short': 'Turun terlalu jauh',
}

const LEVEL_ID: Record<'High' | 'Medium' | 'Low' | 'Moderate', string> = { High: 'tinggi', Medium: 'sedang', Moderate: 'sedang', Low: 'rendah' }

function levelTone(value: string, goodWhenHigh: boolean): BadgeTone {
  const good = goodWhenHigh ? value === 'High' : value === 'Low'
  const bad = goodWhenHigh ? value === 'Low' : value === 'High'
  return good ? 'green' : bad ? 'orange' : 'yellow'
}

const SCAN_INTERVAL_MS = 2 * 60_000
function PlanGrid({ plan, side }: { plan: FuturesTradePlan; side: 'long' | 'short' }) {
  return (
    <div className="grid grid-cols-3 gap-1 text-xs">
      <div className="rounded bg-muted/40 px-2 py-1">
        <div className="text-muted-foreground">Masuk</div>
        <div className="font-mono font-semibold text-foreground">{formatPrice(side === 'long' ? plan.openLow : plan.openHigh)}</div>
        <div className="font-mono text-muted-foreground opacity-70" title="Zona masuk dari analisa — batas rugi & target dihitung dari angka di atas">zona {formatPrice(plan.openLow)}–{formatPrice(plan.openHigh)}</div>
      </div>
      <div className="rounded bg-red-500/10 px-2 py-1">
        <div className="text-muted-foreground">Batas rugi</div>
        <div className="font-mono font-semibold text-red-400">{side === 'long' ? '<' : '>'} {formatPrice(plan.stopLoss)}</div>
      </div>
      <div className="rounded bg-green-500/10 px-2 py-1">
        <div className="text-muted-foreground">Target</div>
        <div className="font-mono font-semibold text-green-400">{formatPrice(plan.takeProfit1)}</div>
      </div>
    </div>
  )
}

interface PositionCalc {
  capital: number
  riskPct: number
}

const CALC_STORAGE_KEY = 'hellnah-position-calc'
const RISK_OPTIONS = [0.5, 1, 2, 3]

function readCalc(): PositionCalc {
  try {
    const parsed = JSON.parse(localStorage.getItem(CALC_STORAGE_KEY) ?? '')
    if (parsed.capital > 0 && parsed.riskPct > 0) return parsed
  } catch {
    // belum pernah disimpan / format rusak — pakai default
  }
  return { capital: 1000, riskPct: 1 }
}

function formatQty(q: number) {
  return q >= 1 ? q.toLocaleString('en-US', { maximumFractionDigits: 3 }) : q.toPrecision(4)
}

function PositionSize({ item, price, calc }: { item: FuturesOpportunity; price: number; calc: PositionCalc }) {
  const { stopLoss, takeProfit1 } = item.primaryPlan
  // Harga live kalau sudah sampai titik masuk rencana, kalau belum pakai titik masuk itu (harga order limit).
  const entry = hasReachedEntry(item, price) ? price : planEntryRef(item)
  const stopDist = Math.abs(entry - stopLoss) / entry
  if (stopDist <= 0) return null

  const riskUsd = calc.capital * (calc.riskPct / 100)
  const notional = riskUsd / stopDist
  const qty = notional / entry
  const leverage = Math.max(1, Math.ceil(notional / calc.capital))
  const profitUsd = notional * (Math.abs(takeProfit1 - entry) / entry)
  // Likuidasi kira-kira di jarak 1/leverage dari harga masuk — kalau itu lebih dekat dari
  // batas rugi, posisi bisa terlikuidasi sebelum stop loss sempat jalan.
  const liqBeforeStop = 1 / leverage <= stopDist

  return (
    <div className="rounded-lg border border-border bg-muted/20 px-2.5 py-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
      <div className="text-muted-foreground mb-1">
        Ukuran posisi · modal ${calc.capital.toLocaleString('en-US')} · risiko {calc.riskPct}%
      </div>
      <div className="grid grid-cols-4 gap-1">
        <div>
          <div className="text-muted-foreground">Posisi</div>
          <div className="font-mono font-semibold text-foreground">${notional.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          <div className="font-mono text-muted-foreground">{formatQty(qty)} {item.ticker.baseAsset}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Leverage</div>
          <div className={cn('font-mono font-semibold', liqBeforeStop ? 'text-red-400' : 'text-foreground')}>{leverage}x</div>
        </div>
        <div>
          <div className="text-muted-foreground">Rugi maks</div>
          <div className="font-mono font-semibold text-red-400">-${riskUsd.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Untung</div>
          <div className="font-mono font-semibold text-green-400">+${profitUsd.toFixed(2)}</div>
        </div>
      </div>
      {liqBeforeStop && (
        <p className="text-red-400 mt-1">Leverage terlalu tinggi — bisa terlikuidasi sebelum batas rugi. Turunkan risiko atau tambah modal.</p>
      )}
    </div>
  )
}

function OpportunityCard({ item, verdict, price, calc, onSelectCoin }: { item: FuturesOpportunity; verdict: Verdict; price: number; calc: PositionCalc; onSelectCoin: (ticker: Ticker) => void }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = item.side === 'long'
  const change = item.ticker.priceChangePercent
  const funding = item.ticker.fundingRate

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectCoin(item.ticker)}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelectCoin(item.ticker) }}
      className="px-3 py-2.5 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer space-y-2"
    >
      <div className="flex items-center gap-2">
        <CoinIcon asset={item.ticker.baseAsset} size={24} />
        <span className="text-sm font-bold text-foreground">{item.ticker.baseAsset}</span>
        <Badge tone={isLong ? 'green' : 'red'}>
          {isLong ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isLong ? 'Long' : 'Short'}
        </Badge>
        <span className={cn('text-xs font-mono', change >= 0 ? 'text-green-400' : 'text-red-400')}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </span>
        <div className="ml-auto flex items-center gap-1.5" title="Skor keyakinan mesin (arah multi-timeframe, funding & tren) — BUKAN peluang menang">
          <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full', isLong ? 'bg-green-500' : 'bg-red-500')} style={{ width: `${item.accuracyPct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">skor</span>
          <span className="text-sm font-bold font-mono text-foreground w-9 text-right">{item.accuracyPct}%</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <Badge tone="primary">{CONTEXT_LABEL[item.contextLabel] ?? item.contextLabel}</Badge>
        {item.fibLevel && (
          <Badge tone="yellow" title={`Titik masuk dekat level Fibonacci ${formatFibRatio(item.fibLevel.ratio)} (${formatPrice(item.fibLevel.price)}) — konfirmasi tambahan`}>
            Fib {formatFibRatio(item.fibLevel.ratio)}
          </Badge>
        )}
        <Badge tone={levelTone(item.confidenceLabel, true)} title="Tingkat keyakinan sinyal">Yakin {LEVEL_ID[item.confidenceLabel]}</Badge>
        <Badge tone={levelTone(item.riskLabel, false)} title="Risiko setup">Risiko {LEVEL_ID[item.riskLabel]}</Badge>
        <Badge tone={levelTone(item.crowdednessLabel, false)} title="Seberapa ramai trader lain di posisi yang sama">Ramai {LEVEL_ID[item.crowdednessLabel]}</Badge>
        {funding != null && (
          <Badge tone={funding <= 0 ? 'green' : 'orange'} title="Funding rate">
            Funding {funding >= 0 ? '+' : ''}{funding.toFixed(3)}%
          </Badge>
        )}
      </div>

      <VerdictBanner verdict={verdict} />

      <PositionSize item={item} price={price} calc={calc} />

      <PlanGrid plan={item.primaryPlan} side={item.side} />

      <button
        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {expanded ? 'Tutup detail' : 'Alasan & rencana per timeframe'}
      </button>

      {expanded && (
        <div className="space-y-2 text-xs text-muted-foreground leading-relaxed" onClick={(e) => e.stopPropagation()}>
          <p>{item.summary}</p>
          <p><span className="text-foreground font-medium">Pendorong:</span> {item.driver}</p>
          <p><span className="text-foreground font-medium">Batal kalau:</span> {item.invalidationReason}</p>
          {(['15m', '30m', '1h', '4h'] as Timeframe[]).map((tf) => {
            const plan = item.tradePlans[tf]
            if (!plan) return null
            return (
              <div key={tf}>
                <div className="text-foreground font-medium mb-1">Timeframe {tf}</div>
                <PlanGrid plan={plan} side={item.side} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function FuturesOpportunitiesPanel({ tickers, exchange, active = false, onSelectCoin }: Props) {
  const [preset, setPreset] = useState<Preset>('balanced')
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [riskFilter, setRiskFilter] = useState<Level>('all')
  const [fundingFilter, setFundingFilter] = useState<FundingFilter>('all')
  const [minAccuracyOverride, setMinAccuracyOverride] = useState<number | null>(null)
  const [calc, setCalcState] = useState<PositionCalc>(readCalc)
  const setCalc = (next: PositionCalc) => {
    setCalcState(next)
    localStorage.setItem(CALC_STORAGE_KEY, JSON.stringify(next))
  }
  const { opportunities, status, progress, scannedCount, totalCount, lastRunAt, runScan, cancelScan } =
    useFuturesOpportunities(tickers, exchange)

  useEffect(() => {
    if (!active || !tickers.length) return
    runScan()
    const id = setInterval(runScan, SCAN_INTERVAL_MS)
    return () => clearInterval(id)
  }, [active, exchange, tickers.length, runScan])

  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  const p = PRESETS[preset]
  const minAccuracy = minAccuracyOverride ?? p.minAccuracy

  const presetFiltered = useMemo(() => opportunities.filter((item) => {
    if (item.accuracyPct < minAccuracy) return false
    if (p.blockHighRisk && item.riskLabel === 'High') return false
    if (p.blockCrowded && item.crowdednessLabel === 'High') return false
    if (riskFilter !== 'all' && item.riskLabel !== riskFilter) return false
    const fr = item.ticker.fundingRate
    if (fundingFilter === 'negative' && !(fr != null && fr < 0)) return false
    if (fundingFilter === 'positive' && !(fr != null && fr > 0)) return false
    return true
  }), [opportunities, minAccuracy, p, riskFilter, fundingFilter])

  const counts = {
    all: presetFiltered.length,
    long: presetFiltered.filter((o) => o.side === 'long').length,
    short: presetFiltered.filter((o) => o.side === 'short').length,
  }
  const livePrice = useMemo(() => new Map(tickers.map((t) => [t.symbol, t.price])), [tickers])
  const filtered = (sideFilter === 'all' ? presetFiltered : presetFiltered.filter((o) => o.side === sideFilter))
    .map((item) => {
      const price = livePrice.get(item.ticker.symbol) ?? item.ticker.price
      return { item, price, verdict: getVerdict(item, price) }
    })
    .sort((a, b) => VERDICT_ORDER[a.verdict.kind] - VERDICT_ORDER[b.verdict.kind] || b.item.accuracyPct - a.item.accuracyPct)
  const readyCount = filtered.filter((f) => f.verdict.kind === 'enter').length

  const secondsAgo = lastRunAt ? Math.floor((Date.now() - lastRunAt) / 1000) : null
  const timeAgo = secondsAgo == null ? null : secondsAgo < 60 ? `${secondsAgo} dtk lalu` : `${Math.floor(secondsAgo / 60)} mnt lalu`
  const advancedActive = riskFilter !== 'all' || fundingFilter !== 'all' || minAccuracyOverride != null

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        icon={Scan}
        title="Scanner Long / Short"
        subtitle={
          status === 'scanning'
            ? `Memindai ${scannedCount}/${totalCount} kontrak...`
            : timeAgo ? `${readyCount} siap masuk · ${opportunities.length} kandidat · scan ${timeAgo} · otomatis tiap 2 mnt` : 'Mencari peluang Long / Short untuk trading manual'
        }
        right={
          status === 'scanning' ? (
            <button onClick={cancelScan} className="flex items-center gap-1 min-h-7 px-2.5 rounded-full border border-border text-xs text-red-400 hover:bg-red-500/10">
              <X className="h-3.5 w-3.5" /> Batal
            </button>
          ) : (
            <button
              onClick={runScan}
              disabled={!tickers.length}
              className="flex items-center gap-1 min-h-7 px-2.5 rounded-full border border-primary/40 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Scan
            </button>
          )
        }
      >
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
          <span>
            &quot;Skor&quot; = keyakinan mesin, bukan peluang menang. Backtest 3 tahun: mesin ini belum terbukti lebih baik dari acak (uji −0,09R/trade) — anggap kandidat, bukan jaminan. Lihat Analisa → Hasil Backtest.
          </span>
        </p>

        {status === 'scanning' && (
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(PRESETS) as Preset[]).map((id) => (
            <Pill key={id} active={preset === id} onClick={() => { setPreset(id); setMinAccuracyOverride(null) }} title={PRESETS[id].hint}>
              {PRESETS[id].label}
            </Pill>
          ))}
          <span className="w-px h-4 bg-border mx-0.5" />
          {(['all', 'long', 'short'] as SideFilter[]).map((id) => (
            <Pill key={id} active={sideFilter === id} onClick={() => setSideFilter(id)}>
              {id === 'all' ? 'Semua' : id === 'long' ? 'Long' : 'Short'} <span className="opacity-60">{counts[id]}</span>
            </Pill>
          ))}
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className={cn('ml-auto flex items-center gap-1 text-xs', advancedActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filter & modal
          </button>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-3 gap-2 text-xs rounded-lg border border-border bg-muted/20 p-2">
            <label className="flex flex-col gap-1 text-muted-foreground">
              Risiko
              <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as Level)} className="px-1.5 py-1 rounded border border-border bg-background text-foreground">
                <option value="all">Semua</option>
                <option value="Low">Rendah</option>
                <option value="Medium">Sedang</option>
                <option value="High">Tinggi</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-muted-foreground">
              Funding
              <select value={fundingFilter} onChange={(e) => setFundingFilter(e.target.value as FundingFilter)} className="px-1.5 py-1 rounded border border-border bg-background text-foreground">
                <option value="all">Semua</option>
                <option value="negative">Negatif</option>
                <option value="positive">Positif</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-muted-foreground">
              Skor ≥ {minAccuracy}%
              <input type="range" min={0} max={90} step={5} value={minAccuracy} onChange={(e) => setMinAccuracyOverride(Number(e.target.value))} />
            </label>
            <label className="flex flex-col gap-1 text-muted-foreground">
              Modal ($)
              <input
                type="number"
                min={10}
                step={100}
                value={calc.capital}
                onChange={(e) => { const v = Number(e.target.value); if (v > 0) setCalc({ ...calc, capital: v }) }}
                className="px-1.5 py-1 rounded border border-border bg-background text-foreground font-mono"
              />
            </label>
            <label className="flex flex-col gap-1 text-muted-foreground col-span-2">
              Risiko per trade (rugi maksimal dari modal)
              <div className="flex gap-1">
                {RISK_OPTIONS.map((r) => (
                  <Pill key={r} active={calc.riskPct === r} onClick={() => setCalc({ ...calc, riskPct: r })}>{r}%</Pill>
                ))}
              </div>
            </label>
          </div>
        )}
      </PanelHeader>

      <div className="flex-1 overflow-y-auto">
        {!opportunities.length && status !== 'scanning' && (
          status === 'idle'
            ? <EmptyState loading title="Menyiapkan scan…" />
            : <EmptyState icon={Scan} title="Belum ada setup kuat" description="Pasar sedang tidak memberi sinyal Long/Short yang cukup meyakinkan." />
        )}

        {opportunities.length > 0 && !filtered.length && (
          <EmptyState
            icon={SlidersHorizontal}
            title="Tidak ada kandidat untuk filter ini"
            action={
              <button onClick={() => { setPreset('all'); setSideFilter('all'); setRiskFilter('all'); setFundingFilter('all'); setMinAccuracyOverride(null) }} className="text-xs text-primary hover:underline">
              Tampilkan semua ({opportunities.length})
            </button>
            }
          />
        )}

        {filtered.map(({ item, price, verdict }) => (
          <OpportunityCard key={`${item.side}-${item.ticker.symbol}`} item={item} verdict={verdict} price={price} calc={calc} onSelectCoin={onSelectCoin} />
        ))}
      </div>
    </div>
  )
}
