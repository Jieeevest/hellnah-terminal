import { HARD_LIMITS } from '../config/limits.js'

export interface DailyGuardState {
  dayKeyUtc: string
  equityAtOpen: number
  realizedPnl: number
  consecutiveLosses: number
  cooldownUntil: number | null
}

export type DailyGuardBlockReason = 'stop_loss' | 'consecutive_loss_cooldown'

export type DailyGuardStatus =
  | { canOpenNewPosition: true }
  | { canOpenNewPosition: false; reason: DailyGuardBlockReason }

export function utcDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10)
}

export function initDailyGuardState(equityAtOpen: number, nowMs: number): DailyGuardState {
  return {
    dayKeyUtc: utcDayKey(nowMs),
    equityAtOpen,
    realizedPnl: 0,
    consecutiveLosses: 0,
    cooldownUntil: null,
  }
}

// Reset harian pada boundary 00:00 UTC (sejalan siklus funding 00/08/16 UTC). Dipanggil
// sebelum evaluasi apa pun — kalau mesin sempat mati melewati boundary, state otomatis
// dianggap hari baru begitu dipanggil lagi, tidak perlu proses terpisah buat "catch up".
export function rolloverIfNewDay(state: DailyGuardState, equityNow: number, nowMs: number): DailyGuardState {
  const currentKey = utcDayKey(nowMs)
  if (currentKey === state.dayKeyUtc) return state
  return initDailyGuardState(equityNow, nowMs)
}

export function recordTradeResult(state: DailyGuardState, realizedPnlDelta: number, nowMs: number): DailyGuardState {
  const isLoss = realizedPnlDelta < 0
  const consecutiveLosses = isLoss ? state.consecutiveLosses + 1 : 0
  const hitBreaker = isLoss && consecutiveLosses >= HARD_LIMITS.consecutiveLossBreaker

  return {
    ...state,
    realizedPnl: state.realizedPnl + realizedPnlDelta,
    consecutiveLosses,
    cooldownUntil: hitBreaker ? nowMs + HARD_LIMITS.consecutiveLossCooldownMs : state.cooldownUntil,
  }
}

export function evaluateDailyGuard(state: DailyGuardState, nowMs: number): DailyGuardStatus {
  if (state.cooldownUntil !== null && nowMs < state.cooldownUntil) {
    return { canOpenNewPosition: false, reason: 'consecutive_loss_cooldown' }
  }

  // Sengaja gak ada "stop-win" — dailyStopLossPct itu batas MINIMUM (kunci rugi), bukan
  // target maksimum. Untung harian gak dibatasin, bot tetap boleh cari entry baru berapa
  // pun realizedPnl positifnya.
  const pnlPct = state.equityAtOpen > 0 ? state.realizedPnl / state.equityAtOpen : 0

  if (pnlPct <= HARD_LIMITS.dailyStopLossPct) {
    return { canOpenNewPosition: false, reason: 'stop_loss' }
  }

  return { canOpenNewPosition: true }
}
