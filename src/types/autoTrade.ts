export type PositionSide = 'long' | 'short'
export type AutoTradeStrategy = 'stable' | 'trailing'

export interface AutoTradeOpenPosition {
  id: string
  symbol: string
  side: PositionSide
  entry: number
  qty: number
  qtyRemaining: number
  leverage: number
  margin: number
  stopLoss: number
  takeProfit1: number
  openedAt: number
  strategy?: AutoTradeStrategy
  markPrice: number
  unrealizedPnlUsd: number
  unrealizedPnlPct: number
}

export interface AutoTradeClosedTrade {
  id: string
  symbol: string
  side: PositionSide
  entry: number
  exitPrice: number
  exitReason: 'SL' | 'TP1' | 'TIME_STOP' | 'MAX_HOLD' | 'TRAIL' | 'MANUAL'
  realizedPnlUsd: number
  rMultiple: number
  openedAt: number
  closedAt: number
  strategy?: AutoTradeStrategy
}

export interface AutoTradeDailyGuard {
  dayKeyUtc: string
  equityAtOpen: number
  realizedPnl: number
  consecutiveLosses: number
  cooldownUntil: number | null
}

export interface AutoTradeActivityEntry {
  timestamp: number
  message: string
}

// Posisi lain di akun Binance yang BUKAN dibuka/dikelola bot ini — read-only, cuma buat
// ditampilkan. Cuma keisi di TRADING_MODE=live.
export interface AutoTradeExternalPosition {
  symbol: string
  side: PositionSide
  qty: number
  entryPrice: number
  leverage: number
  unrealizedProfit: number
  liquidationPrice: number
}

export interface AutoTradeState {
  enabled: boolean
  tradingMode: string
  strategy?: AutoTradeStrategy
  equity: number
  dailyGuard: AutoTradeDailyGuard
  openPositions: AutoTradeOpenPosition[]
  closedTrades: AutoTradeClosedTrade[]
  externalPositions: AutoTradeExternalPosition[]
  symbolCooldownUntil: Record<string, number>
  lastSeenLabel: Record<string, string>
  activityLog: AutoTradeActivityEntry[]
  updatedAt: number
}
