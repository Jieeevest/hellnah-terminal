import { describe, it, expect } from 'vitest'
import { calcLiquidationPrice, maxStopDistPctForLeverage, pickLeverage, crossMarginBufferPct } from '../src/risk/liquidation.js'

describe('calcLiquidationPrice', () => {
  it('menghitung liq price long di bawah entry', () => {
    const liq = calcLiquidationPrice({ entry: 100, side: 'long', leverage: 10, maintenanceMarginRate: 0.004 })
    expect(liq).toBeCloseTo(100 * (1 - (1 / 10 - 0.004)), 6)
    expect(liq).toBeLessThan(100)
  })

  it('menghitung liq price short di atas entry', () => {
    const liq = calcLiquidationPrice({ entry: 100, side: 'short', leverage: 10, maintenanceMarginRate: 0.004 })
    expect(liq).toBeCloseTo(100 * (1 + (1 / 10 - 0.004)), 6)
    expect(liq).toBeGreaterThan(100)
  })

  it('leverage lebih tinggi -> liq price lebih dekat ke entry', () => {
    const liq10 = calcLiquidationPrice({ entry: 100, side: 'long', leverage: 10, maintenanceMarginRate: 0.004 })
    const liq20 = calcLiquidationPrice({ entry: 100, side: 'long', leverage: 20, maintenanceMarginRate: 0.004 })
    expect(100 - liq20).toBeLessThan(100 - liq10)
  })
})

describe('pickLeverage', () => {
  it('pilih leverage tertinggi kalau stop dekat', () => {
    // buffer(20) = 1/20 - 0.004 = 0.046 -> maxStopDist = 0.023 (2.3%)
    const lev = pickLeverage(0.01, 10, 20, 0.004)
    expect(lev).toBe(20)
  })

  it('turunkan leverage kalau stop terlalu lebar untuk leverage max', () => {
    // buffer(20)/2 = 0.023 gagal untuk stopDist 0.03 -> turun bertahap, lolos pertama di 15x
    // (buffer(15)/2 = 0.0313, buffer(16)/2 = 0.0293 masih gagal)
    const lev = pickLeverage(0.03, 10, 20, 0.004)
    expect(lev).toBe(15)
  })

  it('turun sampai leverage minimum kalau stop mendekati batas terlebar', () => {
    // buffer(10)/2 = 0.048 -> stopDist 0.045 cuma lolos di leverage rendah
    const lev = pickLeverage(0.045, 10, 20, 0.004)
    expect(lev).toBe(10)
  })

  it('null kalau stop terlalu lebar bahkan untuk leverage minimum', () => {
    const lev = pickLeverage(0.5, 10, 20, 0.004)
    expect(lev).toBeNull()
  })

  it('maxStopDistPctForLeverage konsisten dengan pickLeverage', () => {
    const maxAt20 = maxStopDistPctForLeverage(20, 0.004)
    expect(pickLeverage(maxAt20, 10, 20, 0.004)).toBe(20)
    expect(pickLeverage(maxAt20 + 0.0001, 10, 20, 0.004)).not.toBe(20)
  })
})

describe('crossMarginBufferPct', () => {
  it('equity jauh lebih besar dari notional -> buffer lebar, gak bergantung leverage', () => {
    // beda mendasar dari isolated: fungsi ini bahkan gak nerima parameter leverage
    const buffer = crossMarginBufferPct(1000, 50, 0.004)
    expect(buffer).toBeCloseTo(1000 / 50 - 0.004, 6)
    expect(buffer).toBeGreaterThan(1) // >100%, jauh lebih lebar dari isolated mana pun
  })

  it('notional mendekati availableEquity -> buffer sempit/negatif', () => {
    const buffer = crossMarginBufferPct(100, 100, 0.004)
    expect(buffer).toBeCloseTo(1 - 0.004, 6)

    const bufferTipis = crossMarginBufferPct(10, 100, 0.004)
    expect(bufferTipis).toBeLessThan(0.1) // 10% availableEquity vs notional -> nyaris gak ada bantalan
  })

  it('notional 0 -> buffer tak terhingga (gak ada eksposur, gak ada risiko liquidation)', () => {
    expect(crossMarginBufferPct(1000, 0, 0.004)).toBe(Infinity)
  })
})
