export type LiquidationSide = 'buy' | 'sell'

// Simplified isolated-margin liquidation price. Untuk perhitungan risk sizing yang lebih
// presisi (server/src/risk), maintenance margin rate diambil per-tier dari exchange,
// bukan konstanta di sini — fungsi ini dipakai buat estimasi cepat di UI.
export function calcLiqPrice(entry: number, side: LiquidationSide, leverage: number): number {
  const mmr = 0.004
  if (side === 'buy') return entry * (1 - 1 / leverage + mmr)
  return entry * (1 + 1 / leverage - mmr)
}
