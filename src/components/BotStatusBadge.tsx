import { Bot } from 'lucide-react'
import type { AutoTradeConnectionStatus } from '@/hooks/useAutoTrader'
import type { AutoTradeState } from '@/types/autoTrade'
import { cn } from '@/lib/utils'

interface Props {
  state: AutoTradeState | null
  status: AutoTradeConnectionStatus
  onClick: () => void
  compact?: boolean
}

export function BotStatusBadge({ state, status, onClick, compact }: Props) {
  if (!state || status === 'disconnected') {
    return (
      <button
        onClick={onClick}
        title="Server bot tidak terhubung"
        className="flex items-center gap-2 min-h-9 px-3 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:bg-muted"
      >
        <Bot className="h-5 w-5" />
        {!compact && (status === 'disconnected' ? 'Bot offline' : 'Bot...')}
      </button>
    )
  }

  const pnlPct = state.dailyGuard.equityAtOpen > 0
    ? (state.dailyGuard.realizedPnl / state.dailyGuard.equityAtOpen) * 100
    : 0
  const floating = state.openPositions.reduce((sum, p) => sum + (p.unrealizedPnlUsd ?? 0), 0)
  const pnlPositive = pnlPct >= 0

  return (
    <button
      onClick={onClick}
      title="Buka panel Auto-Trade"
      className={cn(
        'flex items-center gap-2 min-h-9 px-3 rounded-lg border text-sm font-semibold transition-colors',
        state.enabled ? 'border-green-500/40 bg-green-500/10 hover:bg-green-500/20' : 'border-border bg-muted/40 hover:bg-muted'
      )}
    >
      <span className="relative flex h-3 w-3 shrink-0">
        {state.enabled && <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-60" />}
        <span className={cn('relative h-3 w-3 rounded-full', state.enabled ? 'bg-green-400' : 'bg-muted-foreground')} />
      </span>
      <span className={state.enabled ? 'text-green-400' : 'text-muted-foreground'}>
        {compact ? <Bot className="h-5 w-5" /> : state.enabled ? 'Bot AKTIF' : 'Bot MATI'}
      </span>
      {!compact && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground font-normal">Hari ini</span>
        </>
      )}
      <span className={cn('font-mono font-bold', pnlPositive ? 'text-green-400' : 'text-red-400')}>
        {pnlPositive ? '+' : ''}{pnlPct.toFixed(2)}%
      </span>
      {!compact && state.openPositions.length > 0 && (
        <span className={cn('px-2 py-0.5 rounded-md text-xs font-mono', floating >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400')}>
          {state.openPositions.length} posisi {floating >= 0 ? '+' : ''}${floating.toFixed(2)}
        </span>
      )}
    </button>
  )
}
