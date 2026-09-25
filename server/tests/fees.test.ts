import { describe, it, expect } from 'vitest'
import { estimateRoundTripCostPct, passesFeeToRiskGuard, DEFAULT_FEE_ASSUMPTIONS } from '../src/risk/fees.js'

describe('fees', () => {
  it('estimateRoundTripCostPct menjumlahkan taker*2 + slippage + funding', () => {
    const cost = estimateRoundTripCostPct()
    const expected = DEFAULT_FEE_ASSUMPTIONS.takerFeeRate * 2 + DEFAULT_FEE_ASSUMPTIONS.slippagePct + DEFAULT_FEE_ASSUMPTIONS.fundingPct
    expect(cost).toBeCloseTo(expected, 8)
  })

  it('menolak stopDist yang terlalu sempit relatif ke biaya', () => {
    expect(passesFeeToRiskGuard(0.001)).toBe(false)
  })

  it('meloloskan stopDist yang cukup lebar relatif ke biaya', () => {
    expect(passesFeeToRiskGuard(0.02)).toBe(true)
  })

  it('stopDist 0 selalu ditolak', () => {
    expect(passesFeeToRiskGuard(0)).toBe(false)
  })
})
