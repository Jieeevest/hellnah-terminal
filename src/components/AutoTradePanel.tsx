import { useState, useEffect } from 'react'
import { Bot, Power, PowerOff, Octagon, Wifi, WifiOff, Scan, XCircle, CheckCircle2, AlertTriangle, Clock, Activity, ChevronDown, ChevronRight, Eye, TrendingUp, TrendingDown } from 'lucide-react'
import { useAutoTrader } from '@/hooks/useAutoTrader'
import { cn, formatPrice } from '@/lib/utils'
import { CoinIcon } from '@/components/CoinIcon'
import { Badge, BADGE_TEXT_TONE, type BadgeTone } from '@/components/ui/Badge'
import { PanelHeader } from '@/components/ui/PanelHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import type { AutoTradeOpenPosition, AutoTradeClosedTrade, AutoTradeActivityEntry, AutoTradeExternalPosition } from '@/types/autoTrade'

interface Props {
  active: boolean
}

const EXIT_LABEL: Record<AutoTradeClosedTrade['exitReason'], string> = {
  SL: 'Stop loss',
  TP1: 'Take profit',
  TIME_STOP: 'Time stop',
  MAX_HOLD: 'Max hold',
  MANUAL: 'Manual',
}

function PositionRow({ pos }: { pos: AutoTradeOpenPosition }) {
  // Fallback ke 0 — posisi yang dibuka sebelum field ini ada (state.json lama sisa dari
  // deploy sebelumnya) belum punya markPrice/unrealizedPnl* sampai tick berikutnya ngisi.
  // Tanpa fallback ini, .toFixed() di undefined bikin seluruh halaman crash blank.
  const markPrice = pos.markPrice ?? pos.entry
  const unrealizedPnlUsd = pos.unrealizedPnlUsd ?? 0
  const unrealizedPnlPct = pos.unrealizedPnlPct ?? 0
  const pnlPositive = unrealizedPnlUsd >= 0
  return (
    <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CoinIcon asset={pos.symbol} size={22} />
          <span className="text-sm font-bold text-foreground">{coinOf(pos.symbol)}</span>
          <Badge tone={pos.side === 'long' ? 'green' : 'red'}>
            {pos.side.toUpperCase()} {pos.leverage}x
          </Badge>
        </div>
      </div>
      <div className={cn('flex items-center justify-between rounded px-2 py-1', pnlPositive ? 'bg-green-500/10' : 'bg-red-500/10')}>
        <span className="text-xs text-muted-foreground">Floating PnL (mark: {formatPrice(markPrice)})</span>
        <span className={cn('text-xs font-bold font-mono', pnlPositive ? 'text-green-400' : 'text-red-400')}>
          {pnlPositive ? '+' : ''}{unrealizedPnlUsd.toFixed(2)} ({pnlPositive ? '+' : ''}{unrealizedPnlPct.toFixed(1)}%)
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
        <span>Entry: <span className="text-foreground/80 font-mono">{formatPrice(pos.entry)}</span></span>
        <span>SL: <span className="text-foreground/80 font-mono">{formatPrice(pos.stopLoss)}</span></span>
        <span>Qty: <span className="text-foreground/80 font-mono">{pos.qtyRemaining}</span></span>
        <span>TP1: <span className="text-foreground/80 font-mono">{formatPrice(pos.takeProfit1)}</span></span>
        <span className="col-span-3">Margin: <span className="text-foreground/80 font-mono">${pos.margin.toFixed(2)}</span></span>
      </div>
    </div>
  )
}

// Read-only — posisi lain di akun Binance yang bukan dibuka/dikelola bot ini. Sengaja
// gak ada tombol aksi apa pun di sini (beda dari PositionRow), biar jelas ini cuma info.
function ExternalPositionRow({ pos }: { pos: AutoTradeExternalPosition }) {
  const pnlPositive = pos.unrealizedProfit >= 0
  return (
    <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-2.5 py-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-foreground">{pos.symbol}</span>
        <Badge tone={pos.side === 'long' ? 'green' : 'red'}>
          {pos.side.toUpperCase()} {pos.leverage}x
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
        <span>Entry: <span className="text-foreground/80 font-mono">{formatPrice(pos.entryPrice)}</span></span>
        <span>Qty: <span className="text-foreground/80 font-mono">{pos.qty}</span></span>
        <span>Liq: <span className="text-foreground/80 font-mono">{formatPrice(pos.liquidationPrice)}</span></span>
        <span className={cn('col-span-3 font-mono font-semibold', pnlPositive ? 'text-green-400' : 'text-red-400')}>
          PnL: {pnlPositive ? '+' : ''}{pos.unrealizedProfit.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (diffSec < 60) return 'baru'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  return `${Math.round(diffMin / 60)}j`
}

const coinOf = (symbol: string) => symbol.replace(/USDT$/, '')

type Tone = Extract<BadgeTone, 'green' | 'red' | 'orange' | 'blue' | 'muted'>

interface ParsedActivity {
  symbol?: string
  side?: 'long' | 'short'
  status: { label: string; tone: Tone; icon: typeof Activity }
  chips: string[]
  // Teks penjelas di bawah badge — dipakai untuk error supaya isi pesannya tidak hilang.
  detail?: string
}

// Label alasan dari server/src/strategy/entryGate.ts (ENTRY_GATE_REASON_LABEL) → badge pendek.
const REASON_CHIPS: [RegExp, string][] = [
  [/masih netral/, 'Netral'],
  [/keyakinan/, 'Sinyal lemah'],
  [/skor kelayakan/, 'Skor setup rendah'],
  [/akurasi historis/, 'Skor keyakinan rendah'],
  [/belum searah/, 'TF tak searah'],
  [/untung dibanding risiko/, 'R:R kecil'],
  [/terlalu ramai/, 'Terlalu ramai'],
  [/volume trading/, 'Volume kecil'],
  [/spread/, 'Spread lebar'],
  [/jarak stop loss/, 'SL tak aman'],
  [/tren Bitcoin/, 'BTC tak mendukung'],
  [/belum bertahan/, 'Belum konsisten'],
  [/daftar yang diizinkan/, 'Tak diizinkan'],
  [/sudah ada posisi/, 'Sudah ada posisi'],
  [/cooldown/, 'Cooldown'],
]

function reasonChips(text: string): string[] {
  const more = text.match(/\(\+(\d+) alasan lain\)/)
  const chips = text.replace(/\s*\(\+\d+ alasan lain\)/, '').split(';').map((part) => {
    const hit = REASON_CHIPS.find(([re]) => re.test(part))
    return hit ? hit[1] : part.trim()
  })
  return more ? [...chips, `+${more[1]}`] : chips
}

const ACTIVITY_PATTERNS: { re: RegExp; parse: (m: RegExpMatchArray) => ParsedActivity }[] = [
  { re: /^(\S+) short lolos gate \(rank=[\d.]+ acc=(\d+)%\) tapi DILEWATIN/, parse: (m) => ({ symbol: m[1], side: 'short', status: { label: 'Dipantau', tone: 'blue', icon: Eye }, chips: [`Skor ${m[2]}%`] }) },
  { re: /^(?:LIVE )?OPEN (long|short)( \(FLIP dari short\))? (\S+) @ (\S+) qty=\S+ lev=(\d+)x SL=(\S+)/, parse: (m) => ({ symbol: m[3], side: m[1] as 'long' | 'short', status: { label: 'Posisi dibuka', tone: 'green', icon: CheckCircle2 }, chips: [`@ ${m[4]}`, `${m[5]}x`, `SL ${m[6]}`, ...(m[2] ? ['Flip'] : [])] }) },
  { re: /^SL (\S+) @ (\S+)/, parse: (m) => ({ symbol: m[1], status: { label: 'Kena stop loss', tone: 'red', icon: XCircle }, chips: [`@ ${m[2]}`] }) },
  { re: /^TP1 (\S+) @ (\S+)/, parse: (m) => ({ symbol: m[1], status: { label: 'Take profit', tone: 'green', icon: CheckCircle2 }, chips: [`@ ${m[2]}`] }) },
  { re: /^TIME_STOP (\S+) @ (\S+)/, parse: (m) => ({ symbol: m[1], status: { label: 'Profit diamankan', tone: 'green', icon: Clock }, chips: [`@ ${m[2]}`] }) },
  { re: /^MAX_HOLD (\S+) @ (\S+) — udah (\d+) jam/, parse: (m) => ({ symbol: m[1], status: { label: 'Ditutup paksa', tone: 'orange', icon: Clock }, chips: [`@ ${m[2]}`, `${m[3]} jam`] }) },
  { re: /^scan (\d+) simbol/, parse: (m) => ({ status: { label: 'Scan', tone: 'muted', icon: Scan }, chips: [`${m[1]} koin`] }) },
  { re: /^(\S+) (long|short) ditolak: (.*)/, parse: (m) => ({ symbol: m[1], side: m[2] as 'long' | 'short', status: { label: 'Ditolak', tone: 'muted', icon: XCircle }, chips: reasonChips(m[3]) }) },
  { re: /^(\S+) ditolak sizing/, parse: (m) => ({ symbol: m[1], status: { label: 'Ditolak', tone: 'muted', icon: XCircle }, chips: ['Ukuran posisi'] }) },
  { re: /^(\S+) ditolak: total notional exposure/, parse: (m) => ({ symbol: m[1], status: { label: 'Ditolak', tone: 'muted', icon: XCircle }, chips: ['Batas exposure'] }) },
  { re: /^(\S+) ditolak: total margin bakal lewat plafon (\S+)/, parse: (m) => ({ symbol: m[1], status: { label: 'Ditolak', tone: 'muted', icon: XCircle }, chips: [`Batas margin ${m[2]}`] }) },
  { re: /^(\S+) DIHINDARI -- masuk blacklist/, parse: (m) => ({ symbol: m[1], status: { label: 'Dihindari', tone: 'orange', icon: AlertTriangle }, chips: ['Daftar hitam'] }) },
  { re: /^(\S+) DIHINDARI -- flip long udah kena SL (\d+)x/, parse: (m) => ({ symbol: m[1], status: { label: 'Dihindari', tone: 'orange', icon: AlertTriangle }, chips: [`${m[2]}x kena SL`] }) },
  { re: /^daily guard blokir entry baru/, parse: () => ({ status: { label: 'Rem harian aktif', tone: 'orange', icon: AlertTriangle }, chips: ['Tak buka posisi baru'] }) },
  { re: /^auto-trade ENABLED/, parse: () => ({ status: { label: 'Bot dinyalakan', tone: 'green', icon: Power }, chips: [] }) },
  { re: /^auto-trade DISABLED/, parse: () => ({ status: { label: 'Bot dimatikan', tone: 'muted', icon: PowerOff }, chips: ['Posisi tetap dijaga'] }) },
  { re: /^CLOSE ALL/, parse: () => ({ status: { label: 'Tutup semua', tone: 'red', icon: Octagon }, chips: [] }) },
  { re: /^(\S+) scalp \(trial\) OPEN long .*entry=(\S+)/, parse: (m) => ({ symbol: m[1], side: 'long', status: { label: 'Uji coba', tone: 'blue', icon: Activity }, chips: [`@ ${m[2]}`] }) },
  { re: /^(\S+) scalp \(trial\) CLOSE (\S+) @ (\S+) pnl=(\S+)/, parse: (m) => ({ symbol: m[1], status: { label: 'Uji coba selesai', tone: 'blue', icon: Activity }, chips: [`@ ${m[3]}`, m[4]] }) },
  { re: /^Trading server \((\w+) MODE\)/, parse: (m) => ({ status: { label: 'Server nyala', tone: 'muted', icon: Power }, chips: [m[1] === 'LIVE' ? 'Uang asli' : 'Simulasi'] }) },
  { re: /^\[Forward-test F3, bukan posisi bot\] (\S+): (.*)/, parse: (m) => ({ symbol: m[1], status: { label: 'Forward-test F3', tone: 'blue', icon: Activity }, chips: [], detail: m[2] }) },
  { re: /GAGAL|gagal|KRITIS|error/, parse: (m) => ({ status: { label: 'Error', tone: 'red', icon: AlertTriangle }, chips: [], detail: m.input }) },
]

function parseActivity(message: string): ParsedActivity | null {
  for (const { re, parse } of ACTIVITY_PATTERNS) {
    const m = message.match(re)
    if (m) return parse(m)
  }
  return null
}

function ActivityRow({ entry }: { entry: AutoTradeActivityEntry }) {
  const parsed = parseActivity(entry.message)
  const time = <span className="ml-auto pl-2 text-xs text-muted-foreground tabular-nums shrink-0">{formatRelativeTime(entry.timestamp)}</span>

  if (!parsed) {
    return (
      <div className="flex items-start gap-2 px-2.5 py-1.5 border-b border-border/30 last:border-0">
        <Activity className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground break-words flex-1">{entry.message}</p>
        {time}
      </div>
    )
  }

  const StatusIcon = parsed.status.icon
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border/30 last:border-0" title={entry.message}>
      {parsed.symbol ? (
        <CoinIcon asset={parsed.symbol} size={20} />
      ) : (
        <StatusIcon className={cn('h-5 w-5 shrink-0', BADGE_TEXT_TONE[parsed.status.tone])} />
      )}
      <div className="flex flex-wrap items-center gap-1 min-w-0">
        {parsed.symbol && <span className="text-xs font-bold text-foreground mr-0.5">{coinOf(parsed.symbol)}</span>}
        {parsed.side && (
          <Badge tone={parsed.side === 'long' ? 'green' : 'red'}>
            {parsed.side === 'long' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {parsed.side === 'long' ? 'Long' : 'Short'}
          </Badge>
        )}
        <Badge tone={parsed.status.tone}>
          <StatusIcon className="h-3 w-3" />
          {parsed.status.label}
        </Badge>
        {parsed.chips.map((chip) => (
          <span key={chip} className="px-1.5 py-px rounded bg-muted/40 text-xs text-muted-foreground font-mono whitespace-nowrap">{chip}</span>
        ))}
        {parsed.detail && <p className="basis-full text-xs text-muted-foreground break-words">{parsed.detail}</p>}
      </div>
      {time}
    </div>
  )
}

function ClosedTradeRow({ trade }: { trade: AutoTradeClosedTrade }) {
  const pnlPositive = trade.realizedPnlUsd >= 0
  return (
    <div className="flex items-center justify-between text-xs px-2 py-1.5 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2">
        <CoinIcon asset={trade.symbol} size={18} />
        <span className="font-semibold text-foreground">{coinOf(trade.symbol)}</span>
        <span className="text-muted-foreground">{trade.side === 'long' ? 'Long' : 'Short'}</span>
        <span className="text-xs text-muted-foreground">{EXIT_LABEL[trade.exitReason]}</span>
      </div>
      <span className={cn('font-mono font-semibold', pnlPositive ? 'text-green-400' : 'text-red-400')}>
        {pnlPositive ? '+' : ''}{trade.realizedPnlUsd.toFixed(2)} ({trade.rMultiple.toFixed(2)}R)
      </span>
    </div>
  )
}

// Fetch sekali per mount + refresh tiap 1 jam (kurs gak berubah cepat) — fallback ke
// approx terakhir diketahui kalau fetch gagal, biar tampilan gak pernah blank/error.
function useUsdIdrRate(): number {
  const [rate, setRate] = useState(18052)
  useEffect(() => {
    let cancelled = false
    async function fetchRate() {
      try {
        const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=IDR')
        const data = await res.json()
        if (!cancelled && data?.rates?.IDR) setRate(data.rates.IDR)
      } catch {
        // diamkan -- tetap pakai rate terakhir/fallback
      }
    }
    fetchRate()
    const interval = setInterval(fetchRate, 60 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])
  return rate
}

function formatIdr(usd: number, rate: number): string {
  const idr = Math.round(usd * rate)
  return `Rp${idr.toLocaleString('id-ID')}`
}

export function AutoTradePanel({ active }: Props) {
  const { state, status, actionError, enable, disable, closeAll } = useAutoTrader(active)
  const [confirmingCloseAll, setConfirmingCloseAll] = useState(false)
  const [showExternalPositions, setShowExternalPositions] = useState(false)
  const usdIdrRate = useUsdIdrRate()

  if (!state) {
    return status === 'disconnected'
      ? <EmptyState icon={WifiOff} title="Server bot tidak terhubung" description={<>Jalankan <code className="font-mono">cd server &amp;&amp; npm start</code> — panel tersambung otomatis.</>} />
      : <EmptyState loading title="Menghubungkan ke server bot…" />
  }

  const dailyPnlPct = state.dailyGuard.equityAtOpen > 0
    ? (state.dailyGuard.realizedPnl / state.dailyGuard.equityAtOpen) * 100
    : 0

  // Margin terpakai TETAP di-hide (user cuma minta PnL bulanan balik) -- gampang
  // dimunculin lagi, tinggal uncomment blok ini dan blok JSX "Margin terpakai" di bawah.
  // const totalMargin = state.openPositions.reduce((sum, p) => sum + p.margin, 0)
  // const marginPct = state.equity > 0 ? (totalMargin / state.equity) * 100 : 0

  const monthKey = new Date().toISOString().slice(0, 7)
  const monthlyPnl = state.closedTrades
    .filter((t) => new Date(t.closedAt).toISOString().slice(0, 7) === monthKey)
    .reduce((sum, t) => sum + t.realizedPnlUsd, 0)

  const displayedClosedTrades = state.closedTrades

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader
        icon={Bot}
        title="Bot Auto-Trade"
        right={
          <button
            onClick={() => (state.enabled ? disable() : enable())}
            className={cn(
              'flex items-center gap-1.5 min-h-8 px-3 rounded-lg text-xs font-semibold transition-colors',
              state.enabled ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
            )}
          >
            {state.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            {state.enabled ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
        }
        subtitle={
          <span className="flex items-center gap-1.5">
            {status === 'connected' ? <Wifi className="h-3.5 w-3.5 text-green-400" /> : <WifiOff className="h-3.5 w-3.5 text-red-400" />}
            {status === 'connected' ? 'Terhubung ke server' : status === 'connecting' ? 'Menghubungkan…' : 'Terputus'}
            <Badge tone={state.tradingMode === 'live' ? 'red' : 'yellow'}>
              {state.tradingMode === 'live' ? 'LIVE — UANG RIIL' : 'PAPER (simulasi)'}
            </Badge>
          </span>
        }
      />
      <div className="px-3 py-2.5 border-b border-border space-y-2 shrink-0">

        <div className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded-md', state.enabled ? 'bg-green-500/10' : 'bg-muted/40')}>
          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', state.enabled ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground')} />
          <span className={cn('text-xs font-semibold', state.enabled ? 'text-green-400' : 'text-muted-foreground')}>
            {state.enabled ? 'AKTIF — sedang scan otomatis tiap 60 detik' : 'NONAKTIF — tidak scan, tidak ada trade baru'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-md bg-muted/40 px-2 py-1.5">
            <div className="text-xs text-muted-foreground">Saldo ({state.tradingMode === 'live' ? 'real' : 'paper'})</div>
            <div className="text-sm font-bold font-mono text-foreground">${state.equity.toFixed(2)}</div>
            <div className="text-xs font-mono text-muted-foreground">{formatIdr(state.equity, usdIdrRate)}</div>
          </div>
          <div className="rounded-md bg-muted/40 px-2 py-1.5">
            <div className="text-xs text-muted-foreground" title="Bot berhenti buka posisi baru kalau rugi hari ini sudah -1%. Tidak ada batas untung.">PnL hari ini</div>
            <div className={cn('text-sm font-bold font-mono', dailyPnlPct >= 0 ? 'text-green-400' : 'text-red-400')}>
              {dailyPnlPct >= 0 ? '+' : ''}{dailyPnlPct.toFixed(2)}%
            </div>
            <div className={cn('text-xs font-mono', dailyPnlPct >= 0 ? 'text-green-400/80' : 'text-red-400/80')}>
              {state.dailyGuard.realizedPnl >= 0 ? '+' : ''}${state.dailyGuard.realizedPnl.toFixed(2)}
            </div>
          </div>
          <div className="rounded-md bg-muted/40 px-2 py-1.5">
            <div className="text-xs text-muted-foreground">PnL bulan ini</div>
            <div className={cn('text-sm font-bold font-mono', monthlyPnl >= 0 ? 'text-green-400' : 'text-red-400')}>
              {monthlyPnl >= 0 ? '+' : ''}${monthlyPnl.toFixed(2)}
            </div>
            <div className={cn('text-xs font-mono', monthlyPnl >= 0 ? 'text-green-400/80' : 'text-red-400/80')}>
              {monthlyPnl >= 0 ? '+' : '-'}{formatIdr(Math.abs(monthlyPnl), usdIdrRate)}
            </div>
          </div>
        </div>

        {/* Margin terpakai TETAP di-hide -- lihat komentar variabel di atas buat munculin lagi.
        <div className="rounded-md bg-muted/40 px-2 py-1.5">
          <div className="text-xs text-muted-foreground">Margin terpakai</div>
          <div className="text-sm font-bold font-mono text-foreground">${totalMargin.toFixed(2)}</div>
          <div className="text-xs font-mono text-muted-foreground">{marginPct.toFixed(1)}% dari equity</div>
        </div>
        */}

        {state.dailyGuard.cooldownUntil && state.dailyGuard.cooldownUntil > Date.now() && (
          <div className="text-xs text-orange-400 bg-orange-500/10 rounded px-2 py-1">
            Cooldown loss beruntun aktif sampai {new Date(state.dailyGuard.cooldownUntil).toLocaleTimeString('id-ID')}
          </div>
        )}

        {actionError && (
          <div className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">{actionError}</div>
        )}

        {confirmingCloseAll ? (
          <div className="rounded-lg border-2 border-red-500 bg-red-500/10 p-2.5 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
              <p className="text-sm text-foreground">
                Semua <b>{state.openPositions.length} posisi</b> akan ditutup sekarang di harga pasar. Lanjutkan?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmingCloseAll(false)}
                className="min-h-9 rounded-lg bg-muted text-foreground text-sm font-semibold hover:bg-muted/70"
              >
                Batal
              </button>
              <button
                onClick={() => { closeAll(); setConfirmingCloseAll(false) }}
                className="min-h-9 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-500"
              >
                Ya, tutup semua
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingCloseAll(true)}
            disabled={!state.openPositions.length}
            className="w-full min-h-9 flex items-center justify-center gap-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-500 transition-colors disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
          >
            <Octagon className="h-4 w-4" />
            {state.openPositions.length
              ? `TUTUP SEMUA POSISI (${state.openPositions.length})`
              : 'Tombol darurat — tidak ada posisi terbuka'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 border-b border-border/60">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
            <Activity className="h-4 w-4" />
            Aktivitas sekarang
          </div>
          {state.activityLog.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {state.enabled ? 'Menunggu siklus scan pertama...' : 'Aktifkan dulu buat mulai scan.'}
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-md border border-border/40 bg-background/30">
              {[...state.activityLog].reverse().slice(0, 60).map((entry, i) => (
                <ActivityRow key={`${entry.timestamp}-${i}`} entry={entry} />
              ))}
            </div>
          )}
        </div>

        <div className="px-3 py-2">
          <div className="text-xs font-semibold text-muted-foreground mb-1.5">
            Posisi terbuka ({state.openPositions.length})
          </div>
          {state.openPositions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tidak ada posisi terbuka.</p>
          ) : (
            <div className="space-y-1.5">
              {state.openPositions.map((pos) => <PositionRow key={pos.id} pos={pos} />)}
            </div>
          )}
        </div>

        {state.tradingMode === 'live' && state.externalPositions.length > 0 && (
          <div className="px-3 py-2 border-t border-border/60">
            <button
              onClick={() => setShowExternalPositions((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mb-1.5 hover:text-foreground"
            >
              {showExternalPositions ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Posisi lain di akun ({state.externalPositions.length}) — bukan dikelola bot
            </button>
            {showExternalPositions && (
              <div className="space-y-1.5">
                {state.externalPositions.map((pos) => <ExternalPositionRow key={pos.symbol} pos={pos} />)}
              </div>
            )}
          </div>
        )}

        <div className="px-3 py-2 border-t border-border/60">
          <div className="text-xs font-semibold text-muted-foreground mb-1">
            Riwayat trade ({displayedClosedTrades.length})
          </div>
          {displayedClosedTrades.length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada trade selesai.</p>
          ) : (
            <div>
              {[...displayedClosedTrades].reverse().slice(0, 30).map((trade) => (
                <ClosedTradeRow key={trade.id} trade={trade} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
