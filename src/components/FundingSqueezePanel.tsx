import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, FlaskConical, Hourglass, Info, WifiOff, Zap } from 'lucide-react'
import type { Ticker } from '@/types'
import { useFundingSqueeze } from '@/hooks/useFundingSqueeze'
import { F3_ENTRY_WINDOW_MS, F3_THRESHOLD, type F3Row, type F3ShadowSummary } from '@/lib/fundingSqueeze'
import { cn, formatPrice } from '@/lib/utils'
import { CoinIcon } from '@/components/CoinIcon'
import { PanelHeader } from '@/components/ui/PanelHeader'
import { EmptyState } from '@/components/ui/EmptyState'

interface Props {
  futuresTickers: Ticker[]
  onSelectCoin: (ticker: Ticker) => void
}

const fmtPct = (x: number, digits = 2) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(digits)}%`
const fmtTime = (t: number) => new Date(t).toLocaleString('id-ID', { weekday: 'short', hour: '2-digit', minute: '2-digit' })

function fmtCountdown(ms: number) {
  const h = Math.floor(ms / 3600e3)
  const m = Math.floor((ms % 3600e3) / 60e3)
  return h >= 24 ? `${Math.floor(h / 24)}h ${h % 24}j` : `${h}j ${m}m`
}

type Stage = 'ready' | 'enter' | 'holding'

function stageOf(row: F3Row, now: number): Stage | null {
  if (!row.trade) return null
  if (now < row.trade.entryTime) return 'ready'
  if (now < row.trade.entryTime + F3_ENTRY_WINDOW_MS) return 'enter'
  return 'holding'
}

const STAGE_STYLE: Record<Stage, { label: string; box: string; icon: typeof CheckCircle2 }> = {
  ready: { label: 'Siap masuk', box: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400', icon: Hourglass },
  enter: { label: 'Beli (long) sekarang', box: 'border-green-500/40 bg-green-500/15 text-green-400', icon: CheckCircle2 },
  holding: { label: 'Dalam masa tahan', box: 'border-sky-500/30 bg-sky-500/10 text-sky-300', icon: Clock },
}

function SignalCard({ row, ticker, now, onSelect }: { row: F3Row; ticker?: Ticker; now: number; onSelect: () => void }) {
  const trade = row.trade!
  const stage = stageOf(row, now)!
  const style = STAGE_STYLE[stage]
  const Icon = style.icon
  const price = ticker?.price
  const pnl = trade.entryPrice && price ? price / trade.entryPrice - 1 + trade.fundingSinceEntry : null
  const base = row.symbol.replace(/USDT$/, '')

  return (
    <button onClick={onSelect} className="w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/30 transition-colors space-y-2">
      <div className="flex items-center gap-2">
        <CoinIcon asset={base} size={24} />
        <span className="text-sm font-bold text-foreground">{base}</span>
        <span className="text-xs font-mono text-muted-foreground" title="Rata-rata 3 funding terakhir yang sudah dibayar">funding {fmtPct(row.avg24, 3)}</span>
        {price != null && <span className="ml-auto text-sm font-mono text-foreground">{formatPrice(price)}</span>}
      </div>
      <div className={cn('flex items-start gap-2 rounded-lg border px-2.5 py-1.5', style.box)}>
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1 text-xs">
          <div className="text-sm font-bold">{style.label}</div>
          {stage === 'ready' && <div>Masuk long pukul {fmtTime(trade.entryTime)} (awal jam berikutnya)</div>}
          {stage === 'enter' && <div>Jendela masuk sampai {fmtTime(trade.entryTime + F3_ENTRY_WINDOW_MS)} · tutup {fmtTime(trade.exitTime)}</div>}
          {stage === 'holding' && (
            <div>Tutup {fmtTime(trade.exitTime)} ({fmtCountdown(trade.exitTime - now)} lagi). Kalau belum masuk, lewati — jendela masuk sudah lewat.</div>
          )}
        </div>
      </div>
      {trade.entryPrice != null && (
        <div className="grid grid-cols-3 gap-1 text-xs">
          <div className="rounded bg-muted/40 px-2 py-1">
            <div className="text-muted-foreground">Harga masuk</div>
            <div className="font-mono font-semibold text-foreground">{formatPrice(trade.entryPrice)}</div>
          </div>
          <div className="rounded bg-muted/40 px-2 py-1" title="Funding diterima (+) / dibayar (−) sejak masuk">
            <div className="text-muted-foreground">Funding</div>
            <div className={cn('font-mono font-semibold', trade.fundingSinceEntry >= 0 ? 'text-green-400' : 'text-red-400')}>{fmtPct(trade.fundingSinceEntry, 3)}</div>
          </div>
          <div className="rounded bg-muted/40 px-2 py-1">
            <div className="text-muted-foreground">Hasil sejauh ini</div>
            <div className={cn('font-mono font-semibold', pnl == null ? 'text-muted-foreground' : pnl >= 0 ? 'text-green-400' : 'text-red-400')}>{pnl == null ? '—' : fmtPct(pnl)}</div>
          </div>
        </div>
      )}
    </button>
  )
}

const BACKTEST_AVG_RET = 0.014

function ForwardTestCard({ summary, disconnected }: { summary: F3ShadowSummary | null; disconnected: boolean }) {
  return (
    <div className="mx-3 my-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-foreground">
        <FlaskConical className="h-3.5 w-3.5 text-sky-300" /> Forward-test otomatis
        {summary && <span className="ml-auto font-normal text-muted-foreground">sejak {new Date(summary.startedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
      </div>
      <p className="text-muted-foreground mt-0.5">Server mencatat setiap sinyal F3 dengan aturan persis seperti backtest — hanya dicatat, bukan posisi bot.</p>
      {disconnected && !summary ? (
        <p className="text-muted-foreground mt-1.5">Server bot tidak terhubung — hasil forward-test tidak bisa ditampilkan.</p>
      ) : !summary ? (
        <p className="text-muted-foreground mt-1.5">Memuat…</p>
      ) : summary.closedCount === 0 ? (
        <p className="mt-1.5 text-foreground">
          Belum ada trade selesai{summary.open.length ? ` · ${summary.open.length} sedang dicatat (${summary.open.map((o) => o.symbol.replace(/USDT$/, '')).join(', ')})` : ''}. Butuh ±2–3 bulan untuk mulai bisa disimpulkan.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1 mt-1.5">
            <div><div className="text-muted-foreground">Trade</div><div className="font-mono font-semibold text-foreground">{summary.closedCount}</div></div>
            <div title={`Backtest: ${fmtPct(BACKTEST_AVG_RET)}/trade`}>
              <div className="text-muted-foreground">Rata-rata</div>
              <div className={cn('font-mono font-semibold', (summary.avgRet ?? 0) >= 0 ? 'text-green-400' : 'text-red-400')}>{fmtPct(summary.avgRet ?? 0)}</div>
            </div>
            <div><div className="text-muted-foreground">Win rate</div><div className="font-mono font-semibold text-foreground">{((summary.winRate ?? 0) * 100).toFixed(0)}%</div></div>
            <div><div className="text-muted-foreground">Minggu untung</div><div className="font-mono font-semibold text-foreground">{summary.positiveWeeks}/{summary.weeks}</div></div>
          </div>
          <p className="text-muted-foreground mt-1">Pembanding backtest: {fmtPct(BACKTEST_AVG_RET)}/trade, 60% minggu untung.{summary.closedCount < 30 ? ' Sampel masih kecil — jangan disimpulkan dulu.' : ''}</p>
          {summary.recent.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {summary.recent.slice(0, 6).map((t) => (
                <span key={`${t.symbol}-${t.entryTime}`} className={cn('px-1.5 py-px rounded font-mono', (t.ret ?? 0) >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400')}>
                  {t.symbol.replace(/USDT$/, '')} {fmtPct(t.ret ?? 0, 1)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function FundingSqueezePanel({ futuresTickers, onSelectCoin }: Props) {
  const { snapshot, status } = useFundingSqueeze()
  const rows = snapshot?.rows ?? []
  const disconnected = status === 'disconnected'
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const tickerOf = (symbol: string) => futuresTickers.find((t) => t.symbol === symbol)
  const select = (symbol: string) => { const t = tickerOf(symbol); if (t) onSelectCoin(t) }
  const ORDER: Record<Stage, number> = { enter: 0, ready: 1, holding: 2 }
  const active = rows.filter((r) => r.trade).sort((a, b) => ORDER[stageOf(a, now)!] - ORDER[stageOf(b, now)!])
  const near = rows
    .filter((r) => !r.trade && r.projectedAvg != null && r.projectedAvg <= F3_THRESHOLD * 0.7)
    .sort((a, b) => (a.projectedAvg ?? 0) - (b.projectedAvg ?? 0))
  const lowest = [...rows].sort((a, b) => a.avg24 - b.avg24).slice(0, 5)

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        icon={Zap}
        iconClassName="text-yellow-400"
        title="Funding Squeeze (F3)"
        right={
          snapshot
            ? `${active.length} sinyal aktif · 35 koin · ${new Date(snapshot.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}${disconnected ? ' · terputus' : ''}`
            : disconnected ? 'Server tidak terhubung' : 'Memuat…'
        }
        subtitle={<>Long saat rata-rata 3 funding terakhir ≤ {fmtPct(F3_THRESHOLD, 2)} (trader short terlalu ramai), masuk di jam berikutnya, tutup setelah 72 jam.</>}
      >
        <div className="flex items-start gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-2 py-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
          <span>
            Backtest 3 tahun: periode uji 14 bulan <b className="text-foreground">+1,40%/trade</b>, 34 dari 57 minggu untung — tapi untungnya bergantung pada beberapa pantulan besar dan belum terbukti kuat. Tanpa stop loss (rugi terburuk −24%). Pakai modal kecil.
          </span>
        </div>
      </PanelHeader>

      <div className="flex-1 overflow-y-auto">
        <ForwardTestCard summary={snapshot?.summary ?? null} disconnected={disconnected} />
        {!snapshot ? (
          disconnected ? (
            <EmptyState icon={WifiOff} title="Server bot tidak terhubung" description={<>Data Funding Squeeze dihitung di server. Jalankan <code className="font-mono">cd server && npm start</code> — panel tersambung otomatis.</>} />
          ) : (
            <EmptyState loading title="Menunggu data dari server…" />
          )
        ) : (
          <>
            {active.length ? (
              active.map((row) => <SignalCard key={row.symbol} row={row} ticker={tickerOf(row.symbol)} now={now} onSelect={() => select(row.symbol)} />)
            ) : (
              <EmptyState icon={Zap} title="Belum ada sinyal" description="Sinyal jarang muncul (±1 kali per koin per 2 bulan) — biasanya saat pasar sedang panik dan banyak yang short." />
            )}

            {near.length > 0 && (
              <div className="px-3 py-2 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><Info className="h-3.5 w-3.5" /> Hampir sinyal (perkiraan settlement berikutnya)</p>
                {near.map((r) => (
                  <button key={r.symbol} onClick={() => select(r.symbol)} className="w-full flex items-center gap-2 py-1 text-xs hover:bg-muted/30 rounded">
                    <CoinIcon asset={r.symbol.replace(/USDT$/, '')} size={18} />
                    <span className="font-semibold text-foreground">{r.symbol.replace(/USDT$/, '')}</span>
                    <span className="ml-auto font-mono text-yellow-400">{fmtPct(r.projectedAvg ?? 0, 3)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="px-3 py-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Funding paling negatif sekarang (rata-rata 3 terakhir)</p>
              {lowest.map((r) => (
                <button key={r.symbol} onClick={() => select(r.symbol)} className="w-full flex items-center gap-2 py-1 text-xs hover:bg-muted/30 rounded">
                  <CoinIcon asset={r.symbol.replace(/USDT$/, '')} size={18} />
                  <span className="font-semibold text-foreground">{r.symbol.replace(/USDT$/, '')}</span>
                  <div className="flex-1 mx-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', r.avg24 <= F3_THRESHOLD ? 'bg-green-500' : 'bg-muted-foreground/60')} style={{ width: `${Math.min(100, Math.max(4, (r.avg24 / F3_THRESHOLD) * 100))}%` }} />
                  </div>
                  <span className={cn('font-mono', r.avg24 <= F3_THRESHOLD ? 'text-green-400' : 'text-muted-foreground')}>{fmtPct(r.avg24, 3)}</span>
                </button>
              ))}
              <p className="text-xs text-muted-foreground mt-1">Bar penuh = sudah mencapai ambang {fmtPct(F3_THRESHOLD, 2)}.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
