import { HARD_LIMITS } from '../config/limits.js'
import { pickLeverage, crossMarginBufferPct, type PositionSide } from './liquidation.js'
import { passesFeeToRiskGuard } from './fees.js'

export interface PositionSizingInput {
  equity: number
  // Equity yang belum "dipegang" margin posisi lain yang masih open — bantalan cross
  // margin buat posisi INI. Default = equity penuh (anggap gak ada posisi lain berjalan).
  availableEquity?: number
  entry: number
  stopLoss: number
  side: PositionSide
  // Fixed % equity per trade (bukan risk-based lagi) — default HARD_LIMITS.minMarginPct (1%).
  marginPct?: number
  minLeverage?: number
  maxLeverage?: number
  // Override leverage langsung, lepas dari pemilihan cross/isolated di bawah (lihat
  // CONFIG.leverage di env.ts).
  fixedLeverage?: number
  maintenanceMarginRate: number
  stepSize: number
  minNotional: number
}

export interface PositionSizingResult {
  qty: number
  notional: number
  margin: number
  leverage: number
  riskUsd: number
  stopDistPct: number
}

export type PositionSizingRejectReason =
  | 'invalid_stop'
  | 'stop_dist_out_of_range'
  | 'fee_to_risk_guard'
  | 'no_valid_leverage'
  | 'qty_rounds_to_zero'
  | 'below_min_notional'

export type PositionSizingOutcome =
  | { ok: true; result: PositionSizingResult }
  | { ok: false; reason: PositionSizingRejectReason }

function floorToStep(value: number, step: number): number {
  if (step <= 0) return value
  return Math.floor(value / step) * step
}

// marginPct = fixed % equity yang dipakai sebagai margin tiap trade (default 1%, lihat
// HARD_LIMITS.minMarginPct) — qty diturunkan dari situ × leverage, bukan dari risk % lagi.
export function sizePosition(input: PositionSizingInput): PositionSizingOutcome {
  const {
    equity,
    entry,
    stopLoss,
    maintenanceMarginRate,
    stepSize,
    minNotional,
  } = input

  const availableEquity = input.availableEquity ?? equity
  const marginPct = clamp(input.marginPct ?? HARD_LIMITS.minMarginPct, HARD_LIMITS.minMarginPct, HARD_LIMITS.maxMarginPct)
  const minLeverage = input.minLeverage ?? HARD_LIMITS.minLeverage
  const maxLeverage = input.maxLeverage ?? HARD_LIMITS.maxLeverage

  if (entry <= 0 || stopLoss <= 0 || stopLoss === entry) {
    return { ok: false, reason: 'invalid_stop' }
  }

  const rUnit = Math.abs(entry - stopLoss)
  const stopDistPct = rUnit / entry

  if (stopDistPct < HARD_LIMITS.minStopDistPct || stopDistPct > HARD_LIMITS.maxStopDistPct) {
    return { ok: false, reason: 'stop_dist_out_of_range' }
  }
  if (!passesFeeToRiskGuard(stopDistPct)) {
    return { ok: false, reason: 'fee_to_risk_guard' }
  }

  // Margin FIXED per trade (marginPct % equity, default 1%) — bukan risk-based lagi.
  // qty = margin × leverage / entry. Beda dari versi risk-based lama: notional (dan risk $
  // riil kalau SL kena) sekarang IKUT NAIK seiring leverage, bukan konstan — makanya
  // leverage & qty tetap dipilih BARENG di loop bawah (buffer cross butuh notional final).
  const qtyForLeverage = (lev: number): number => {
    const qtyMargin = (equity * marginPct * lev) / entry
    return floorToStep(qtyMargin, stepSize)
  }

  let leverage: number
  let qty: number

  if (input.fixedLeverage !== undefined) {
    // Override manual — lihat catatan CONFIG.leverage di env.ts, cuma di-clamp ke range.
    leverage = clamp(Math.round(input.fixedLeverage), minLeverage, maxLeverage)
    qty = qtyForLeverage(leverage)
  } else {
    // CROSS margin: cari leverage TERTINGGI di [minLeverage..maxLeverage] yang notional
    // hasil qty-nya masih nyisain buffer aman terhadap availableEquity (bukan cuma margin
    // posisi ini). Beda dari versi risk-based lama: notional NAIK seiring leverage (margin
    // fixed × leverage), jadi leverage lebih tinggi = risk $ lebih gede juga kalau SL kena.
    let picked: { leverage: number; qty: number } | null = null
    for (let lev = maxLeverage; lev >= minLeverage; lev--) {
      const candidateQty = qtyForLeverage(lev)
      if (candidateQty <= 0) continue
      const buffer = crossMarginBufferPct(availableEquity, candidateQty * entry, maintenanceMarginRate)
      if (buffer / 2 >= stopDistPct) {
        picked = { leverage: lev, qty: candidateQty }
        break
      }
    }
    if (picked) {
      leverage = picked.leverage
      qty = picked.qty
    } else {
      // Fallback isolated — last resort kalau cross gak nemu leverage aman sama sekali
      // (mis. availableEquity udah kepakai hampir habis posisi lain).
      const isolatedLev = pickLeverage(stopDistPct, minLeverage, maxLeverage, maintenanceMarginRate)
      if (isolatedLev === null) {
        return { ok: false, reason: 'no_valid_leverage' }
      }
      leverage = isolatedLev
      qty = qtyForLeverage(isolatedLev)
    }
  }

  if (qty <= 0) {
    return { ok: false, reason: 'qty_rounds_to_zero' }
  }

  const notional = qty * entry
  if (notional < minNotional) {
    return { ok: false, reason: 'below_min_notional' }
  }

  return {
    ok: true,
    result: {
      qty,
      notional,
      margin: notional / leverage,
      leverage,
      riskUsd: qty * rUnit,
      stopDistPct,
    },
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
