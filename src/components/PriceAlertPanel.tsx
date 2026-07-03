import { useState } from 'react'
import { Bell, Trash2, BellRing, Plus, BellOff, Activity } from 'lucide-react'
import type { Ticker, Exchange, MarketType } from '@/types'
import type { PriceAlert, AlertDirection } from '@/hooks/usePriceAlerts'
import type { TechnicalAlert, TechIndicator, TechCondition } from '@/hooks/useTechnicalAlerts'
import { SIGNAL_TIMEFRAMES, type SignalTimeframe } from '@/hooks/useSignalData'
import { cn } from '@/lib/utils'

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

function PriceAlertRow({ alert, onRemove }: { alert: PriceAlert; onRemove: (id: string) => void }) {
  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 border-b border-border/50', alert.triggered && 'opacity-50')}>
      <div className={cn('w-1.5 h-1.5 rounded-full shrink-0',
        alert.triggered ? 'bg-muted-foreground' : alert.direction === 'above' ? 'bg-green-400' : 'bg-red-400'
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-foreground">{alert.baseAsset}</span>
          <span className={cn('text-[9px] px-1 py-0.5 rounded font-semibold',
            alert.direction === 'above' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
          )}>
            {alert.direction === 'above' ? '↑ Di atas' : '↓ Di bawah'}
          </span>
          {alert.triggered && <span className="text-[9px] bg-muted px-1 py-0.5 rounded text-muted-foreground">Terpicu</span>}
        </div>
        <span className="text-[9px] font-mono text-muted-foreground">
          Target: {alert.targetPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}
        </span>
      </div>
      <button onClick={() => onRemove(alert.id)} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

function TechAlertRow({ alert, onRemove }: { alert: TechnicalAlert; onRemove: (id: string) => void }) {
  const label = alert.indicator === 'RSI'
    ? `RSI ${alert.condition === 'above' ? '>' : '<'} ${alert.value} @${alert.timeframe}`
    : `Harga ${alert.condition === 'above' ? 'di atas' : 'di bawah'} EMA${alert.value} @${alert.timeframe}`
  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 border-b border-border/50', alert.triggered && 'opacity-50')}>
      <div className={cn('w-1.5 h-1.5 rounded-full shrink-0',
        alert.triggered ? 'bg-muted-foreground' : 'bg-purple-400'
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-foreground">{alert.baseAsset}</span>
          <span className="text-[9px] px-1 py-0.5 rounded font-semibold bg-purple-500/15 text-purple-400">
            {alert.indicator}
          </span>
          {alert.triggered && <span className="text-[9px] bg-muted px-1 py-0.5 rounded text-muted-foreground">Terpicu</span>}
        </div>
        <span className="text-[9px] text-muted-foreground">{label}</span>
      </div>
      <button onClick={() => onRemove(alert.id)} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0">
        <Trash2 className="h-3 w-3" />
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
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-foreground">Alert</span>
          {totalCount > 0 && (
            <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">{totalCount}</span>
          )}
        </div>
        {subTab === 'price' && triggeredCount > 0 && (
          <button onClick={onClearTriggered} className="text-[9px] text-muted-foreground hover:text-foreground transition-colors">
            Hapus terpicu
          </button>
        )}
        {subTab === 'technical' && triggeredTechCount > 0 && (
          <button onClick={onClearTriggeredTechnical} className="text-[9px] text-muted-foreground hover:text-foreground transition-colors">
            Hapus terpicu
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setSubTab('price')}
          className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold transition-colors',
            subTab === 'price' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Bell className="h-3 w-3" /> Harga
        </button>
        <button
          onClick={() => setSubTab('technical')}
          className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold transition-colors',
            subTab === 'technical' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Activity className="h-3 w-3" /> Teknikal
        </button>
      </div>

      {/* Notification permission */}
      {notifSupported && !notifGranted() && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-950/40 border-b border-yellow-800/30 shrink-0">
          <BellOff className="h-3 w-3 text-yellow-400 shrink-0" />
          <p className="text-[9px] text-yellow-300 flex-1">Izinkan notifikasi agar alert berbunyi.</p>
          <button onClick={onRequestPermission} className="text-[9px] text-yellow-400 hover:text-yellow-200 font-semibold shrink-0">Izinkan</button>
        </div>
      )}

      {subTab === 'price' ? (
        <>
          {/* Price alert form */}
          {ticker ? (
            <div className="px-3 py-2.5 border-b border-border shrink-0">
              <p className="text-[9px] text-muted-foreground mb-2">
                Alert harga untuk <span className="text-foreground font-semibold">{ticker.baseAsset}</span>
                {currentPrice > 0 && <span className="ml-1 font-mono">(live: {currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })})</span>}
              </p>
              <div className="flex gap-1 mb-2">
                {(['above', 'below'] as AlertDirection[]).map((d) => (
                  <button key={d} onClick={() => setDirection(d)}
                    className={cn('flex-1 py-1 text-[9px] font-semibold rounded transition-colors',
                      direction === d
                        ? d === 'above' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}>
                    {d === 'above' ? '↑ Di atas' : '↓ Di bawah'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <input type="number" value={targetInput} onChange={(e) => setTargetInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPrice()}
                  placeholder="Target harga..."
                  className="flex-1 bg-muted/50 border border-border rounded px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
                <button onClick={handleAddPrice} disabled={!targetInput}
                  className="px-2 py-1 bg-primary/20 text-primary rounded text-[9px] font-semibold hover:bg-primary/30 transition-colors disabled:opacity-40 shrink-0">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2.5 border-b border-border shrink-0">
              <p className="text-[9px] text-muted-foreground">Pilih koin terlebih dahulu.</p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {activeAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <BellRing className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-[10px] text-muted-foreground">Belum ada price alert</p>
              </div>
            ) : activeAlerts.map((a) => <PriceAlertRow key={a.id} alert={a} onRemove={onRemove} />)}
          </div>
          {alerts.length > activeAlerts.length && (
            <div className="px-3 py-1.5 border-t border-border shrink-0">
              <p className="text-[9px] text-muted-foreground">Total tersimpan: {alerts.length} koin</p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Technical alert form */}
          {ticker ? (
            <div className="px-3 py-2.5 border-b border-border shrink-0 flex flex-col gap-2">
              <p className="text-[9px] text-muted-foreground">
                Alert teknikal untuk <span className="text-foreground font-semibold">{ticker.baseAsset}</span>
              </p>
              <div className="flex gap-1">
                {(['RSI', 'EMA'] as TechIndicator[]).map((ind) => (
                  <button key={ind} onClick={() => setTechIndicator(ind)}
                    className={cn('flex-1 py-1 text-[9px] font-semibold rounded transition-colors',
                      techIndicator === ind ? 'bg-purple-500/20 text-purple-400' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}>
                    {ind}
                  </button>
                ))}
                {(['above', 'below'] as TechCondition[]).map((c) => (
                  <button key={c} onClick={() => setTechCondition(c)}
                    className={cn('flex-1 py-1 text-[9px] font-semibold rounded transition-colors',
                      techCondition === c
                        ? c === 'above' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}>
                    {c === 'above' ? '↑' : '↓'}
                  </button>
                ))}
              </div>
              {techIndicator === 'EMA' && (
                <div className="flex gap-1">
                  {[20, 50, 200].map((p) => (
                    <button key={p} onClick={() => setTechValue(String(p))}
                      className={cn('flex-1 py-1 text-[9px] font-semibold rounded transition-colors',
                        techValue === String(p) ? 'bg-purple-500/20 text-purple-400' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      )}>
                      EMA{p}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1">
                <input type="number" value={techValue} onChange={(e) => setTechValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTech()}
                  placeholder={techIndicator === 'RSI' ? 'Nilai RSI (0-100)' : 'Period EMA'}
                  className="flex-1 bg-muted/50 border border-border rounded px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
                <select value={techTf} onChange={(e) => setTechTf(e.target.value as SignalTimeframe)}
                  className="bg-muted/50 border border-border rounded px-1 py-1 text-[10px] text-foreground focus:outline-none">
                  {SIGNAL_TIMEFRAMES.filter((tf) => tf !== '5m').map((tf) => (
                    <option key={tf} value={tf}>{tf}</option>
                  ))}
                </select>
                <button onClick={handleAddTech} disabled={!techValue}
                  className="px-2 py-1 bg-primary/20 text-primary rounded text-[9px] font-semibold hover:bg-primary/30 transition-colors disabled:opacity-40 shrink-0">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <p className="text-[8px] text-muted-foreground">
                {techIndicator === 'RSI' ? `Alert saat RSI ${techCondition === 'above' ? '>' : '<'} ${techValue || '?'}` : `Alert saat harga ${techCondition === 'above' ? 'di atas' : 'di bawah'} EMA${techValue || '?'}`}
              </p>
            </div>
          ) : (
            <div className="px-3 py-2.5 border-b border-border shrink-0">
              <p className="text-[9px] text-muted-foreground">Pilih koin terlebih dahulu.</p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {activeTechAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <Activity className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-[10px] text-muted-foreground">Belum ada technical alert</p>
                <p className="text-[9px] text-muted-foreground/60">Dicek setiap 2 menit</p>
              </div>
            ) : activeTechAlerts.map((a) => <TechAlertRow key={a.id} alert={a} onRemove={onRemoveTechnical} />)}
          </div>
          {technicalAlerts.length > activeTechAlerts.length && (
            <div className="px-3 py-1.5 border-t border-border shrink-0">
              <p className="text-[9px] text-muted-foreground">Total tech alerts: {technicalAlerts.length}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
