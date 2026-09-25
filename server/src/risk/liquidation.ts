export type PositionSide = 'long' | 'short'

export interface LiquidationInput {
  entry: number
  side: PositionSide
  leverage: number
  maintenanceMarginRate: number
}

export function calcLiquidationPrice({ entry, side, leverage, maintenanceMarginRate }: LiquidationInput): number {
  const buffer = 1 / leverage - maintenanceMarginRate
  return side === 'long' ? entry * (1 - buffer) : entry * (1 + buffer)
}

// Jarak stop-loss maksimum (dalam % dari entry) yang masih menyisakan setidaknya separuh
// jarak ke harga likuidasi — supaya SL selalu kena duluan sebelum posisi kena liquidate.
export function maxStopDistPctForLeverage(leverage: number, maintenanceMarginRate: number): number {
  const buffer = 1 / leverage - maintenanceMarginRate
  return buffer / 2
}

// Pilih leverage TERTINGGI dalam [minLeverage..maxLeverage] yang masih memenuhi syarat
// jarak SL terhadap liquidation (ISOLATED margin — margin posisi sendiri satu-satunya
// bantalan). Dipertahankan sebagai fallback kalau CONFIG.leverage kosong DAN loop cross
// margin di sizePosition (positionSizing.ts) gagal nemu leverage aman.
export function pickLeverage(
  stopDistPct: number,
  minLeverage: number,
  maxLeverage: number,
  maintenanceMarginRate: number
): number | null {
  for (let lev = maxLeverage; lev >= minLeverage; lev--) {
    if (stopDistPct <= maxStopDistPctForLeverage(lev, maintenanceMarginRate)) return lev
  }
  return null
}

// CROSS margin — bantalan ke liquidation itu EQUITY AKUN yang belum kepakai posisi lain
// (availableEquity), bukan cuma margin posisi ini sendiri. Beda total dari isolated:
// gak bergantung leverage sama sekali, cuma rasio availableEquity terhadap notional.
// Leverage tinggi jadi gak nambah risiko liquidation di cross — dia cuma ngatur berapa
// margin yang "dipegang" (qty/notional/risk $ tetap sama, lihat positionSizing.ts).
export function crossMarginBufferPct(availableEquity: number, notional: number, maintenanceMarginRate: number): number {
  if (notional <= 0) return Infinity
  return availableEquity / notional - maintenanceMarginRate
}
