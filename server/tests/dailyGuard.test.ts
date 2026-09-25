import { describe, it, expect } from 'vitest'
import {
  initDailyGuardState,
  rolloverIfNewDay,
  recordTradeResult,
  evaluateDailyGuard,
  utcDayKey,
} from '../src/risk/dailyGuard.js'

const DAY1 = Date.parse('2026-07-30T00:00:00.000Z')
const DAY1_LATER = Date.parse('2026-07-30T12:00:00.000Z')
const DAY2 = Date.parse('2026-07-31T00:00:01.000Z')

describe('dailyGuard', () => {
  it('canOpenNewPosition true saat fresh state', () => {
    const state = initDailyGuardState(1000, DAY1)
    expect(evaluateDailyGuard(state, DAY1)).toEqual({ canOpenNewPosition: true })
  })

  it('gak ada batas untung harian -- realized PnL positif berapa pun tetap canOpenNewPosition true', () => {
    let state = initDailyGuardState(1000, DAY1)
    state = recordTradeResult(state, 50, DAY1_LATER) // +5%, jauh di atas bekas dailyStopWinPct 1%
    expect(evaluateDailyGuard(state, DAY1_LATER)).toEqual({ canOpenNewPosition: true })
  })

  it('batas rugi harian praktis mati (-100%) -- rugi 1% gak blok, baru terpicu di -100% equity', () => {
    let state = initDailyGuardState(1000, DAY1)
    state = recordTradeResult(state, -10, DAY1_LATER)
    expect(evaluateDailyGuard(state, DAY1_LATER)).toEqual({ canOpenNewPosition: true })
    state = recordTradeResult(state, -990, DAY1_LATER)
    expect(evaluateDailyGuard(state, DAY1_LATER)).toEqual({ canOpenNewPosition: false, reason: 'stop_loss' })
  })

  it('consecutive loss breaker aktif setelah 3 loss beruntun, sebelum threshold pnl kena', () => {
    let state = initDailyGuardState(1000, DAY1)
    state = recordTradeResult(state, -2, DAY1_LATER)
    state = recordTradeResult(state, -2, DAY1_LATER)
    state = recordTradeResult(state, -2, DAY1_LATER)
    expect(state.consecutiveLosses).toBe(3)
    expect(evaluateDailyGuard(state, DAY1_LATER)).toEqual({ canOpenNewPosition: false, reason: 'consecutive_loss_cooldown' })
  })

  it('win memutus streak loss beruntun', () => {
    let state = initDailyGuardState(1000, DAY1)
    state = recordTradeResult(state, -2, DAY1_LATER)
    state = recordTradeResult(state, -2, DAY1_LATER)
    state = recordTradeResult(state, 5, DAY1_LATER)
    expect(state.consecutiveLosses).toBe(0)
    expect(evaluateDailyGuard(state, DAY1_LATER)).toEqual({ canOpenNewPosition: true })
  })

  it('cooldown berakhir setelah durasinya lewat', () => {
    let state = initDailyGuardState(1000, DAY1)
    state = recordTradeResult(state, -2, DAY1_LATER)
    state = recordTradeResult(state, -2, DAY1_LATER)
    state = recordTradeResult(state, -2, DAY1_LATER)
    const afterCooldown = DAY1_LATER + 4 * 60 * 60 * 1000 + 1
    expect(evaluateDailyGuard(state, afterCooldown)).toEqual({ canOpenNewPosition: true })
  })

  it('rolloverIfNewDay reset state saat boundary UTC terlewati', () => {
    let state = initDailyGuardState(1000, DAY1)
    state = recordTradeResult(state, -10, DAY1_LATER)
    const rolled = rolloverIfNewDay(state, 990, DAY2)
    expect(rolled.dayKeyUtc).toBe(utcDayKey(DAY2))
    expect(rolled.realizedPnl).toBe(0)
    expect(rolled.equityAtOpen).toBe(990)
  })

  it('rolloverIfNewDay tidak mengubah state kalau masih hari yang sama', () => {
    const state = initDailyGuardState(1000, DAY1)
    const rolled = rolloverIfNewDay(state, 1005, DAY1_LATER)
    expect(rolled).toEqual(state)
  })
})
