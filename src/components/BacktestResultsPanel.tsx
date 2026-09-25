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
          <p className="text-sm font-semibold text-foreground">Strategi bot (long saja)</p>
          <Badge tone="yellow"><AlertTriangle className="h-3.5 w-3.5" />Untung hanya saat pasar naik</Badge>
        </div>
        <p className="text-muted-foreground">Keduanya: batas rugi 20% · leverage 5x · margin 4%/posisi · total margin maks 15% · rem BTC 10%.</p>
        <p className="text-muted-foreground"><span className="text-foreground font-medium">Stabil (Akun A)</span> — target 3%, tutup paksa 72 jam:</p>
        <div className="grid grid-cols-3 gap-1">
          <Stat label="6 bln · 68 koin" value="+0,51%" tone="text-green-400" />
          <Stat label="Win rate 6 bln" value="85%" />
          <Stat label="1 thn · 21 koin" value="−0,10%" tone="text-red-400" />
        </div>
        <p className="text-muted-foreground"><span className="text-foreground font-medium">Trailing (Akun B)</span> — aktif setelah +3%, jarak 3%, tahan maks 2 minggu:</p>
        <div className="grid grid-cols-3 gap-1">
          <Stat label="6 bln · 68 koin" value="+1,34%" tone="text-green-400" />
          <Stat label="Win rate 6 bln" value="85%" />
          <Stat label="1 thn · 21 koin" value="−0,35%" tone="text-red-400" />
        </div>
        <p className="text-muted-foreground">
          Hasil per trade = gerak harga setelah biaya. Dalam 2 tahun (42 koin) long rugi −0,98%/trade: untung saat BTC naik, rugi −1% s/d −5% saat BTC turun.
          Trailing lebih untung saat bull tapi lebih rugi saat pasar berbalik. Sedang diuji berdampingan di paper mode.
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
        <p className="flex items-start gap-1.5 text-muted-foreground"><XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" /> Tanpa batas waktu / tahan 1 minggu (target 3%) — win rate naik ke 82%, tapi kena batas rugi 3x lebih sering: 1 thn −1,36%/trade.</p>
        <p className="flex items-start gap-1.5 text-muted-foreground"><XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" /> Target 5% / 8% — 6 bln bagus (target 8%: +1,63%), tapi saat pasar turun −8%/trade; win rate turun ke 54–62%.</p>
        <p className="flex items-start gap-1.5 text-muted-foreground"><XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" /> Target 8% + trailing — lebih buruk dari trailing saja.</p>
        <p className="flex items-start gap-1.5 text-muted-foreground"><XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" /> Filter tren BTC (rata-rata 50 hari) untuk long — 2 thn malah −2,77%/trade.</p>
        <p className="flex items-start gap-1.5 text-muted-foreground"><XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" /> Short cepat hanya saat BTC turun (target 1–2%) — untung di 2025, rugi di 2026; win rate 57–66%.</p>
        <p className="flex items-start gap-1.5 text-muted-foreground"><XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" /> Ranking koin — koin terbaik 3 bulan pertama tidak lebih baik di 3 bulan berikutnya (tiap koin cuma 1–3 trade).</p>
      </div>

      <p className="flex items-start gap-1.5 text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
        <span>Hasil masa lalu tidak menjamin hasil ke depan. Angka mesin bot terbaru bisa dihitung ulang dengan <code className="font-mono break-all">node scripts/backtest-autotrade.mjs</code>.</span>
      </p>
      </div>
    </div>
  )
}
