import { Ban, CheckCircle2, Hourglass, PauseCircle, XCircle } from 'lucide-react'
import type { FuturesOpportunity } from '@/hooks/useFuturesOpportunities'
import { cn, formatPrice } from '@/lib/utils'
import type { BtcRegime } from '@/hooks/useBtcRegime'

// Scanner ini buat trading manual — ambang kualitasnya sengaja dipinjam dari
// DEFAULT_ENTRY_GATE_THRESHOLDS (server/src/strategy/entryGate.ts) karena sudah dikalibrasi.
const QUALITY_GATE = { minScore: 60, minAccuracy: 55, minAlignment: 0.35, minVolume: 100_000_000 }
const ZONE_TOLERANCE = 0.0015

export type VerdictKind = 'enter' | 'wait-price' | 'wait-signal' | 'avoid' | 'invalid'

export interface Verdict {
  kind: VerdictKind
  title: string
  detail: string
  reasons: string[]
}

const VERDICT_STYLE: Record<VerdictKind, { box: string; icon: typeof CheckCircle2 }> = {
  enter: { box: 'bg-green-500/15 border-green-500/40 text-green-400', icon: CheckCircle2 },
  'wait-price': { box: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400', icon: Hourglass },
  'wait-signal': { box: 'bg-muted/40 border-border text-muted-foreground', icon: PauseCircle },
  avoid: { box: 'bg-orange-500/10 border-orange-500/30 text-orange-400', icon: Ban },
  invalid: { box: 'bg-red-500/10 border-red-500/30 text-red-400', icon: XCircle },
}

export const VERDICT_ORDER: Record<VerdictKind, number> = { enter: 0, 'wait-price': 1, 'wait-signal': 2, avoid: 3, invalid: 4 }

// SL/TP di futuresEngine dihitung dari tepi zona yang paling dalam (long: openLow, short: openHigh),
// bukan dari tepi yang dekat — masuk di tepi dekat bisa bikin target ada di sisi yang salah.
export function planEntryRef(item: FuturesOpportunity): number {
  return item.side === 'long' ? item.primaryPlan.openLow : item.primaryPlan.openHigh
}

export function hasReachedEntry(item: FuturesOpportunity, price: number): boolean {
  const ref = planEntryRef(item)
  return item.side === 'long' ? price <= ref * (1 + ZONE_TOLERANCE) : price >= ref * (1 - ZONE_TOLERANCE)
}

export function getVerdict(item: FuturesOpportunity, price: number, regime?: BtcRegime | null): Verdict {
  const isLong = item.side === 'long'
  const { stopLoss } = item.primaryPlan

  if (isLong ? price <= stopLoss : price >= stopLoss) {
    return { kind: 'invalid', title: 'Batal', detail: 'Harga sudah melewati batas rugi — setup ini tidak berlaku lagi', reasons: [] }
  }

  // Backtest 2 tahun: short rugi kecuali saat pasar turun, long paling rugi saat pasar turun.
  if (regime && !isLong && regime.kind !== 'bear') {
    return { kind: 'avoid', title: 'Tidak disarankan', detail: 'Pasar tidak sedang turun — sinyal short rugi di backtest kecuali saat BTC turun', reasons: [] }
  }
  if (regime && isLong && regime.kind === 'bear') {
    return { kind: 'avoid', title: 'Tidak disarankan', detail: `BTC turun ${regime.drawdownPct.toFixed(1)}% dari puncak 30 hari — bot juga berhenti buka posisi baru`, reasons: [] }
  }

  const reasons: string[] = []
  if (item.confidenceLabel === 'Low') reasons.push('Sinyal lemah')
  if (item.score < QUALITY_GATE.minScore) reasons.push('Skor setup rendah')
  if (item.accuracyPct < QUALITY_GATE.minAccuracy) reasons.push('Skor keyakinan rendah')
  if (item.alignment < QUALITY_GATE.minAlignment) reasons.push('TF tak searah')
  if (item.crowdednessLabel === 'High') reasons.push('Terlalu ramai')
  if (item.ticker.volume < QUALITY_GATE.minVolume) reasons.push('Volume kecil')
  if (reasons.length) {
    return { kind: 'wait-signal', title: 'Tunggu sinyal', detail: 'Sinyal belum cukup kuat untuk masuk', reasons }
  }

  if (hasReachedEntry(item, price)) {
    return { kind: 'enter', title: isLong ? 'Beli (long) sekarang' : 'Short sekarang', detail: 'Harga sudah di titik masuk rencana', reasons: [] }
  }

  const entry = planEntryRef(item)
  const distPct = (Math.abs(price - entry) / price) * 100
  return {
    kind: 'wait-price',
    title: 'Tunggu harga',
    detail: `${isLong ? 'Tunggu turun' : 'Tunggu naik'} ke ${formatPrice(entry)} (${distPct.toFixed(2)}% lagi) — bisa pasang order limit di harga itu`,
    reasons: [],
  }
}

export function VerdictBanner({ verdict }: { verdict: Verdict }) {
  const style = VERDICT_STYLE[verdict.kind]
  const Icon = style.icon
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border px-2.5 py-1.5', style.box)}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold leading-tight">{verdict.title}</div>
        <div className="text-xs opacity-90">{verdict.detail}</div>
        {verdict.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {verdict.reasons.map((r) => (
              <span key={r} className="px-1.5 py-px rounded bg-background/60 text-xs text-muted-foreground">{r}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

