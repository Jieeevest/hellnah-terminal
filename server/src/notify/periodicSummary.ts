// Ringkasan periodik ke Slack (beda dari notif per-event OPEN/SL/TP1/dst) — equity,
// margin terpakai, PnL hari ini & bulan ini, dan floating position tiap saat ini. PnL
// bulanan dihitung dari closedTrades yang closedAt-nya masuk bulan UTC berjalan, bukan
// tracker terpisah — closedTrades sudah persist penuh, jadi gak perlu state baru.
import type { AppState } from '../store/state.js'
import { sendSlackMessage } from './slack.js'

function utcMonthKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 7) // 'YYYY-MM'
}

export function buildSummaryMessage(state: AppState, nowMs: number): string {
  const totalMargin = state.openPositions.reduce((sum, p) => sum + p.margin, 0)
  const marginPct = state.equity > 0 ? (totalMargin / state.equity) * 100 : 0

  const monthKey = utcMonthKey(nowMs)
  const monthlyPnl = state.closedTrades
    .filter((t) => utcMonthKey(t.closedAt) === monthKey)
    .reduce((sum, t) => sum + t.realizedPnlUsd, 0)

  const dailyPnl = state.dailyGuard.realizedPnl
  const totalFloating = state.openPositions.reduce((sum, p) => sum + p.unrealizedPnlUsd, 0)

  const lines = [
    `:bar_chart: *Ringkasan* (${state.tradingMode.toUpperCase()})`,
    `Equity: $${state.equity.toFixed(2)}`,
    `Margin terpakai: $${totalMargin.toFixed(2)} (${marginPct.toFixed(1)}%)`,
    `PnL hari ini: ${dailyPnl >= 0 ? '+' : ''}$${dailyPnl.toFixed(2)}`,
    `PnL bulan ini: ${monthlyPnl >= 0 ? '+' : ''}$${monthlyPnl.toFixed(2)}`,
  ]

  if (state.openPositions.length) {
    lines.push(`Floating (${state.openPositions.length} posisi): ${totalFloating >= 0 ? '+' : ''}$${totalFloating.toFixed(2)}`)
    for (const p of state.openPositions) {
      lines.push(`  • ${p.symbol} ${p.side.toUpperCase()} ${p.unrealizedPnlUsd >= 0 ? '+' : ''}$${p.unrealizedPnlUsd.toFixed(2)}`)
    }
  } else {
    lines.push('Floating: tidak ada posisi terbuka')
  }

  return lines.join('\n')
}

export async function sendPeriodicSummary(state: AppState, nowMs: number): Promise<void> {
  await sendSlackMessage(buildSummaryMessage(state, nowMs))
}
