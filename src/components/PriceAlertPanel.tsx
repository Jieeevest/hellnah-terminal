import { useState } from 'react'
import { Bell, Trash2, BellRing, Plus, BellOff, Activity } from 'lucide-react'
import type { Ticker, Exchange, MarketType } from '@/types'
import type { PriceAlert, AlertDirection } from '@/hooks/usePriceAlerts'
import type { TechnicalAlert, TechIndicator, TechCondition } from '@/hooks/useTechnicalAlerts'
import { SIGNAL_TIMEFRAMES, type SignalTimeframe } from '@/hooks/useSignalData'
import { cn } from '@/lib/utils'
import { CoinIcon } from '@/components/CoinIcon'
import { PanelHeader } from '@/components/ui/PanelHeader'
import { Pill, PillTabs } from '@/components/ui/PillTabs'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

interface Props {
  ticker: Ticker | null
  currentPrice: number
  exchange: Exchange
  marketType: MarketType
  alerts: PriceAlert[]
  onAdd: (symbol: string, baseAsset: string, targetPrice: number, direction: AlertDirection) => void
  onRemove: (id: string) => void
  onClearTriggered: () => void
  onRequestPermission: () => void
  technicalAlerts: TechnicalAlert[]
  onAddTechnical: (params: Omit<TechnicalAlert, 'id' | 'triggered' | 'createdAt'>) => void
  onRemoveTechnical: (id: string) => void
  onClearTriggeredTechnical: () => void
}

type SubTab = 'price' | 'technical'

const notifSupported = 'Notification' in window
const notifGranted = () => notifSupported && Notification.permission === 'granted'

const INPUT_CLASS = 'flex-1 min-w-0 min-h-9 bg-muted/50 border border-border rounded-lg px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50'
const ADD_BUTTON_CLASS = 'flex items-center gap-1 min-h-9 px-3 rounded-lg border border-primary/40 bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 shrink-0'

function AlertRow({ baseAsset, triggered, badges, detail, onRemove }: { baseAsset: string; triggered: boolean; badges: React.ReactNode; detail: React.ReactNode; onRemove: () => void }) {
  return (
    <div className={cn('flex items-center gap-2.5 px-3 py-2 border-b border-border/50', triggered && 'opacity-50')}>
      <CoinIcon asset={baseAsset} size={22} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-foreground">{baseAsset}</span>
          {badges}
          {triggered && <Badge>Terpicu</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      <button onClick={onRemove} title="Hapus alert" className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

export function PriceAlertPanel({
  ticker, currentPrice, exchange, marketType,
  alerts, onAdd, onRemove, onClearTriggered, onRequestPermission,
  technicalAlerts, onAddTechnical, onRemoveTechnical, onClearTriggeredTechnical,
}: Props) {
  const [subTab, setSubTab] = useState<SubTab>('price')
  const [targetInput, setTargetInput] = useState('')
  const [direction, setDirection] = useState<AlertDirection>('above')
  const [techIndicator, setTechIndicator] = useState<TechIndicator>('RSI')
  const [techCondition, setTechCondition] = useState<TechCondition>('below')
  const [techValue, setTechValue] = useState('')
  const [techTf, setTechTf] = useState<SignalTimeframe>('1h')

  const activeAlerts = alerts.filter((a) => a.symbol === ticker?.symbol)
  const triggeredCount = activeAlerts.filter((a) => a.triggered).length
  const activeTechAlerts = technicalAlerts.filter((a) => a.symbol === ticker?.symbol)
  const triggeredTechCount = activeTechAlerts.filter((a) => a.triggered).length
  const totalCount = activeAlerts.length + activeTechAlerts.length
  const canClear = subTab === 'price' ? triggeredCount > 0 : triggeredTechCount > 0

  const handleAddPrice = () => {
    if (!ticker) return
    const price = parseFloat(targetInput)
    if (isNaN(price) || price <= 0) return
    onAdd(ticker.symbol, ticker.baseAsset, price, direction)
    setTargetInput('')
  }

  const handleAddTech = () => {
    if (!ticker) return
    const val = parseFloat(techValue)
    if (isNaN(val) || val <= 0) return
    onAddTechnical({ symbol: ticker.symbol, baseAsset: ticker.baseAsset, exchange, marketType, indicator: techIndicator, condition: techCondition, value: val, timeframe: techTf })
    setTechValue('')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader
        icon={Bell}
        title={ticker ? `Alert · ${ticker.baseAsset}` : 'Alert'}
        right={
          <>
            {totalCount > 0 && <Badge tone="primary">{totalCount} aktif</Badge>}
            {canClear && (
              <button onClick={subTab === 'price' ? onClearTriggered : onClearTriggeredTechnical} className="hover:text-foreground">
                Hapus terpicu
              </button>
            )}
          </>
        }
        subtitle="Notifikasi browser berbunyi saat harga atau indikator menyentuh target (selama aplikasi terbuka)."
      >
        <PillTabs
          value={subTab}
          onChange={setSubTab}
          options={[{ id: 'price', label: 'Harga' }, { id: 'technical', label: 'Teknikal' }]}
        />
        {notifSupported && !notifGranted() && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-2.5 py-1.5">
            <BellOff className="h-4 w-4 text-yellow-400 shrink-0" />
            <p className="text-xs text-yellow-300 flex-1">Izinkan notifikasi agar alert berbunyi.</p>
            <button onClick={onRequestPermission} className="text-xs text-yellow-400 hover:text-yellow-200 font-semibold shrink-0">Izinkan</button>
          </div>
        )}
      </PanelHeader>

      {!ticker ? (
        <EmptyState icon={Bell} title="Pilih koin terlebih dahulu" description="Alert dibuat untuk koin yang sedang dipilih." />
      ) : subTab === 'price' ? (
        <>
          <div className="px-3 py-2.5 border-b border-border shrink-0 space-y-2">
            <p className="text-xs text-muted-foreground">
              Harga sekarang: <span className="font-mono text-foreground">{currentPrice > 0 ? currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8 }) : '—'}</span>
            </p>
            <div className="flex gap-1.5">
              {(['above', 'below'] as AlertDirection[]).map((d) => (
                <Pill key={d} active={direction === d} onClick={() => setDirection(d)} className="flex-1">
                  {d === 'above' ? '↑ Naik ke atas' : '↓ Turun ke bawah'}
                </Pill>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="number"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPrice()}
                placeholder="Target harga…"
                className={INPUT_CLASS}
              />
              <button onClick={handleAddPrice} disabled={!targetInput} className={ADD_BUTTON_CLASS}>
                <Plus className="h-4 w-4" /> Tambah
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeAlerts.length === 0 ? (
              <EmptyState icon={BellRing} title="Belum ada alert harga" />
            ) : activeAlerts.map((a) => (
              <AlertRow
                key={a.id}
                baseAsset={a.baseAsset}
                triggered={a.triggered}
                badges={<Badge tone={a.direction === 'above' ? 'green' : 'red'}>{a.direction === 'above' ? '↑ Di atas' : '↓ Di bawah'}</Badge>}
                detail={<span className="font-mono">Target: {a.targetPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}</span>}
                onRemove={() => onRemove(a.id)}
              />
            ))}
          </div>
          {alerts.length > activeAlerts.length && (
            <div className="px-3 py-1.5 border-t border-border shrink-0 text-xs text-muted-foreground">Total tersimpan: {alerts.length} alert</div>
          )}
        </>
      ) : (
        <>
          <div className="px-3 py-2.5 border-b border-border shrink-0 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {(['RSI', 'EMA'] as TechIndicator[]).map((ind) => (
                <Pill key={ind} active={techIndicator === ind} onClick={() => setTechIndicator(ind)}>{ind}</Pill>
              ))}
              <span className="w-px h-5 bg-border self-center mx-0.5" />
              {(['above', 'below'] as TechCondition[]).map((c) => (
                <Pill key={c} active={techCondition === c} onClick={() => setTechCondition(c)}>{c === 'above' ? '↑ Di atas' : '↓ Di bawah'}</Pill>
              ))}
            </div>
            {techIndicator === 'EMA' && (
              <div className="flex gap-1.5">
                {[20, 50, 200].map((p) => (
                  <Pill key={p} active={techValue === String(p)} onClick={() => setTechValue(String(p))}>EMA{p}</Pill>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <input
                type="number"
                value={techValue}
                onChange={(e) => setTechValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTech()}
                placeholder={techIndicator === 'RSI' ? 'Nilai RSI (0-100)' : 'Periode EMA'}
                className={INPUT_CLASS}
              />
              <select
                value={techTf}
                onChange={(e) => setTechTf(e.target.value as SignalTimeframe)}
                className="min-h-9 bg-muted/50 border border-border rounded-lg px-2 text-sm text-foreground focus:outline-none"
              >
                {SIGNAL_TIMEFRAMES.filter((tf) => tf !== '5m').map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
              <button onClick={handleAddTech} disabled={!techValue} className={ADD_BUTTON_CLASS}>
                <Plus className="h-4 w-4" /> Tambah
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {techIndicator === 'RSI'
                ? `Berbunyi saat RSI ${techCondition === 'above' ? '>' : '<'} ${techValue || '?'} di grafik ${techTf}`
                : `Berbunyi saat harga ${techCondition === 'above' ? 'di atas' : 'di bawah'} EMA${techValue || '?'} di grafik ${techTf}`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeTechAlerts.length === 0 ? (
              <EmptyState icon={Activity} title="Belum ada alert teknikal" description="Dicek setiap 2 menit." />
            ) : activeTechAlerts.map((a) => (
              <AlertRow
                key={a.id}
                baseAsset={a.baseAsset}
                triggered={a.triggered}
                badges={<Badge tone="blue">{a.indicator}</Badge>}
                detail={a.indicator === 'RSI'
                  ? `RSI ${a.condition === 'above' ? '>' : '<'} ${a.value} · grafik ${a.timeframe}`
                  : `Harga ${a.condition === 'above' ? 'di atas' : 'di bawah'} EMA${a.value} · grafik ${a.timeframe}`}
                onRemove={() => onRemoveTechnical(a.id)}
              />
            ))}
          </div>
          {technicalAlerts.length > activeTechAlerts.length && (
            <div className="px-3 py-1.5 border-t border-border shrink-0 text-xs text-muted-foreground">Total tersimpan: {technicalAlerts.length} alert teknikal</div>
          )}
        </>
      )}
    </div>
  )
}
