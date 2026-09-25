import { describe, it, expect } from 'vitest'
import { evaluateEntryGate, type EntryGateInput } from '../src/strategy/entryGate.js'

const IDEAL: EntryGateInput = {
  label: 'Bullish',
  rankingScore: 75,
  accuracyPct: 65,
  confidenceLabel: 'High',
  timeframeAlignment: 0.8,
  riskReward: 2,
  crowdednessLabel: 'Low',
  quoteVolume24h: 500_000_000,
  spreadPct: 0.0002,
  stopDistPct: 0.2, // sesuai SL_PCT tetap di futuresEngine.ts
  btcRegimeSafe: true,
  confirmedCandleCloses: 2,
  symbolWhitelisted: true,
  hasOpenPositionForSymbol: false,
  symbolCooldownActive: false,
}

describe('evaluateEntryGate', () => {
  it('lolos kalau semua kondisi ideal', () => {
    expect(evaluateEntryGate(IDEAL)).toEqual({ pass: true })
  })

  it('gagal karena label Neutral', () => {
    const result = evaluateEntryGate({ ...IDEAL, label: 'Neutral' })
    expect(result.pass).toBe(false)
    if (result.pass) return
    expect(result.reasons).toContain('neutral_label')
  })

  it('lolos dengan label Mild Bullish (bukan cuma Bullish penuh) — lihat catatan kalibrasi di DEFAULT_ENTRY_GATE_THRESHOLDS', () => {
    const result = evaluateEntryGate({ ...IDEAL, label: 'Mild Bullish' })
    expect(result).toEqual({ pass: true })
  })

  it('gagal karena confidence Low', () => {
    const result = evaluateEntryGate({ ...IDEAL, confidenceLabel: 'Low' })
    expect(result.pass).toBe(false)
    if (result.pass) return
    expect(result.reasons).toEqual(['confidence_too_low'])
  })

  it('lolos dengan confidence Medium (bukan cuma High)', () => {
    const result = evaluateEntryGate({ ...IDEAL, confidenceLabel: 'Medium' })
    expect(result).toEqual({ pass: true })
  })

  it('mengumpulkan banyak reasons sekaligus, bukan berhenti di reason pertama', () => {
    const result = evaluateEntryGate({
      ...IDEAL,
      rankingScore: 10,
      accuracyPct: 10,
      symbolWhitelisted: false,
      hasOpenPositionForSymbol: true,
    })
    expect(result.pass).toBe(false)
    if (result.pass) return
    expect(result.reasons).toEqual(
      expect.arrayContaining(['ranking_score_too_low', 'accuracy_too_low', 'symbol_not_whitelisted', 'symbol_already_open'])
    )
  })

  it('gagal karena crowdedness High meski sinyal bagus', () => {
    const result = evaluateEntryGate({ ...IDEAL, crowdednessLabel: 'High' })
    expect(result.pass).toBe(false)
    if (result.pass) return
    expect(result.reasons).toEqual(['crowdedness_high'])
  })

  it('gagal karena btc regime tidak aman', () => {
    const result = evaluateEntryGate({ ...IDEAL, btcRegimeSafe: false })
    expect(result.pass).toBe(false)
    if (result.pass) return
    expect(result.reasons).toEqual(['btc_regime_unsafe'])
  })

  it('gagal karena belum konfirmasi 2 candle close', () => {
    const result = evaluateEntryGate({ ...IDEAL, confirmedCandleCloses: 1 })
    expect(result.pass).toBe(false)
    if (result.pass) return
    expect(result.reasons).toEqual(['not_confirmed_across_candles'])
  })

  it('gagal karena symbol cooldown aktif', () => {
    const result = evaluateEntryGate({ ...IDEAL, symbolCooldownActive: true })
    expect(result.pass).toBe(false)
    if (result.pass) return
    expect(result.reasons).toEqual(['symbol_cooldown_active'])
  })
})
