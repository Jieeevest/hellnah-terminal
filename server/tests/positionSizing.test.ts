import { describe, it, expect } from 'vitest'
import { sizePosition } from '../src/risk/positionSizing.js'

const BASE = {
  equity: 1000,
  entry: 100,
  stopLoss: 80, // stopDist 20% -- sesuai SL_PCT tetap di futuresEngine.ts
  side: 'long' as const,
  maintenanceMarginRate: 0.004,
  stepSize: 0.001,
  minNotional: 5,
}

describe('sizePosition', () => {
  it('menghasilkan qty positif dan margin proporsional untuk setup wajar', () => {
    const outcome = sizePosition(BASE)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.qty).toBeGreaterThan(0)
    expect(outcome.result.leverage).toBeGreaterThanOrEqual(1)
    expect(outcome.result.leverage).toBeLessThanOrEqual(5)
    expect(outcome.result.notional).toBeCloseTo(outcome.result.qty * BASE.entry, 6)
    expect(outcome.result.margin).toBeCloseTo(outcome.result.notional / outcome.result.leverage, 6)
  })

  it('qty dibulatkan ke bawah sesuai stepSize', () => {
    const outcome = sizePosition({ ...BASE, equity: 10000, stepSize: 1 })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(Number.isInteger(outcome.result.qty)).toBe(true)
  })

  it('marginPct dalam range [minMarginPct, maxMarginPct] dipakai apa adanya (bukan di-clamp ke max lagi)', () => {
    // Range sekarang [0.02, 0.04] (dulu fixed 0.04=0.04) -- margin short sengaja lebih
    // kecil dari long (lihat livePositionManager.ts/positionManager.ts), jadi 0.02 di
    // dalam range HARUS dipakai persis, bukan di-clamp ke 0.04.
    const outcome = sizePosition({ ...BASE, marginPct: 0.02, fixedLeverage: 3 })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.margin).toBeCloseTo(BASE.equity * 0.02, 6)
  })

  it('marginPct di luar range di-clamp ke batas terdekat', () => {
    const outcome = sizePosition({ ...BASE, marginPct: 0.1, fixedLeverage: 3 })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.margin).toBeCloseTo(BASE.equity * 0.04, 6)
  })

  it('menolak stopDist di luar range (terlalu sempit)', () => {
    const outcome = sizePosition({ ...BASE, stopLoss: 99.95 }) // 0.05%
    expect(outcome).toEqual({ ok: false, reason: 'stop_dist_out_of_range' })
  })

  it('menolak stopDist di luar range (terlalu lebar)', () => {
    const outcome = sizePosition({ ...BASE, stopLoss: 70 }) // 30%
    expect(outcome).toEqual({ ok: false, reason: 'stop_dist_out_of_range' })
  })

  it('menolak kalau notional di bawah minNotional', () => {
    const outcome = sizePosition({ ...BASE, equity: 1, minNotional: 5 })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(['qty_rounds_to_zero', 'below_min_notional']).toContain(outcome.reason)
  })

  it('menolak entry/stopLoss tidak valid', () => {
    expect(sizePosition({ ...BASE, entry: 0 })).toEqual({ ok: false, reason: 'invalid_stop' })
    expect(sizePosition({ ...BASE, stopLoss: BASE.entry })).toEqual({ ok: false, reason: 'invalid_stop' })
  })

  it('cross margin: availableEquity penuh (gak ada posisi lain) -> leverage mepet ke max (5x)', () => {
    const outcome = sizePosition(BASE)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.leverage).toBe(5)
  })

  it('cross margin: availableEquity sempit (posisi lain udah pegang margin) -> leverage turun', () => {
    // equity=1000, margin default 2%, availableEquity cuma 30 (bukan 1000 penuh) -> notional
    // gede relatif ke availableEquity, leverage 5-4 gagal cek buffer, lolos pertama di 3x
    // (dicek manual: buffer(3)/2=24.8% >= stopDist 20%, buffer(4)/2=18.55% gagal)
    const outcome = sizePosition({ ...BASE, availableEquity: 30 })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.leverage).toBe(3)
  })

  it('fixedLeverage dipakai langsung, lepas dari perhitungan cross', () => {
    // Skenario sama kayak test "leverage turun" di atas (cross bakal jatuh ke 3x), tapi
    // fixedLeverage=5 tetap menang -- override, bukan input tambahan buat cross.
    const outcome = sizePosition({ ...BASE, availableEquity: 30, fixedLeverage: 5 })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.leverage).toBe(5)
  })

  it('fixedLeverage di-clamp ke range [minLeverage..maxLeverage]', () => {
    const outcome = sizePosition({ ...BASE, fixedLeverage: 999 })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.leverage).toBe(5)
  })

  it('side short dihitung dengan stopLoss di atas entry', () => {
    const outcome = sizePosition({ ...BASE, side: 'short', stopLoss: 120 })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.stopDistPct).toBeCloseTo(0.2, 6)
  })
})
