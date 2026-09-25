import { AlertTriangle, FlaskConical, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PanelHeader } from '@/components/ui/PanelHeader'
import { Badge } from '@/components/ui/Badge'

// Ringkasan statis hasil riset backtest (25 Sep 2026). Angka mesin bot bisa diperbarui dengan
// `node scripts/backtest-autotrade.mjs`; angka F3 berasal dari backtest 3 tahun data funding.
const UPDATED = '25 Sep 2026'

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded bg-muted/40 px-2 py-1">
      <div className="text-muted-foreground">{label}</div>
      <div className={cn('font-mono font-semibold', tone ?? 'text-foreground')}>{value}</div>
    </div>
  )
}

export function BacktestResultsPanel() {
  return (
    <div className="flex flex-col h-full">
      <PanelHeader icon={FlaskConical} title="Hasil Backtest" subtitle={<>Diuji dengan data yang tidak dipakai saat menyusun aturan (out-of-sample), setelah biaya transaksi. Diperbarui {UPDATED}.</>} />
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">

      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">Mesin sinyal bot & scanner</p>
          <Badge tone="red"><XCircle className="h-3.5 w-3.5" />Rugi dalam 2 tahun</Badge>
        </div>
        <p className="text-muted-foreground">Target 3% · batas rugi 20% · tutup paksa 72 jam. Diuji 2 tahun (Agu 2024–Sep 2026), 42 koin dengan histori penuh.</p>
        <p className="text-muted-foreground">Sinyal LONG (yang dijalankan bot):</p>
        <div className="grid grid-cols-3 gap-1">
          <Stat label="Trade" value="225" />
          <Stat label="Win rate" value="72%" />
          <Stat label="Hasil / trade" value="−0,98%" tone="text-red-400" />
        </div>
        <p className="text-muted-foreground">Per kuartal, hasil long mengikuti arah BTC:</p>
        <div className="grid grid-cols-3 gap-1">
          <Stat label="BTC naik (2025 Q2–Q3, 2026 Q3)" value="+1,2 s/d +1,6%" tone="text-green-400" />
          <Stat label="BTC turun (2025 Q1, Q4, 2026 Q1)" value="−1,0 s/d −2,1%" tone="text-red-400" />
          <Stat label="Short (semua periode)" value="−0,80%" tone="text-red-400" />
        </div>
        <p className="text-muted-foreground">
          Hasil bagus di data Mei–Sep 2026 ternyata karena pasar sedang naik, bukan keunggulan sinyal. Dalam 2 tahun, long maupun short sama-sama rugi.
          Jangan pakai uang sungguhan dengan aturan ini.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">F3 Funding Squeeze</p>
          <Badge tone="yellow"><FlaskConical className="h-3.5 w-3.5" />Menjanjikan, belum terbukti</Badge>
        </div>
        <p className="text-muted-foreground">35 koin · 3 tahun · periode uji Jul 2025 – Sep 2026 (pasar sedang turun)</p>
        <div className="grid grid-cols-3 gap-1">
          <Stat label="Trade (uji)" value="271" />
          <Stat label="Hasil / trade" value="+1,40%" tone="text-green-400" />
          <Stat label="Minggu untung" value="34 / 57" />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <Stat label="vs long acak" value="+1,76%" tone="text-green-400" />
          <Stat label="Tanpa 10 terbaik" value="+0,19%" />
          <Stat label="Rugi terburuk" value="−24%" tone="text-red-400" />
        </div>
        <p className="text-muted-foreground">
          Satu-satunya yang untung di periode uji, tapi keuntungannya bergantung pada beberapa pantulan besar dan tingkat keyakinan
          statistiknya belum kuat (t≈1,6 per minggu). Sedang dicatat otomatis lewat forward-test — lihat Analisa → Funding Squeeze.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
        <p className="text-sm font-semibold text-foreground">Sudah dicoba, tidak lolos</p>
        <p className="flex items-start gap-1.5 text-muted-foreground"><XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" /> Momentum/reversal antar-koin — untungnya datang dari satu koin yang naik +857%; minggu lain bisa −36%.</p>
        <p className="flex items-start gap-1.5 text-muted-foreground"><XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" /> Breakout tren Donchian 4 jam — periode uji −0,26R/trade.</p>
        <p className="flex items-start gap-1.5 text-muted-foreground"><XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" /> Batas rugi sempit (1%) — tampak untung di backtest lama, ternyata akibat bug simulasi yang sudah diperbaiki.</p>
      </div>

      <p className="flex items-start gap-1.5 text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
        <span>Hasil masa lalu tidak menjamin hasil ke depan. Angka mesin bot terbaru bisa dihitung ulang dengan <code className="font-mono break-all">node scripts/backtest-autotrade.mjs</code>.</span>
      </p>
      </div>
    </div>
  )
}
