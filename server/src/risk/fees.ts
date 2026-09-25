export interface FeeAssumptions {
  takerFeeRate: number
  slippagePct: number
  fundingPct: number
}

// Estimasi konservatif Binance USDS-M: taker 0.04%, slippage & funding diperkirakan
// dari observasi umum simbol likuid. Dipakai sebagai guard, bukan buat akuntansi PnL final
// (PnL final harus dari /fapi/v1/income begitu terhubung ke exchange).
export const DEFAULT_FEE_ASSUMPTIONS: FeeAssumptions = {
  takerFeeRate: 0.0004,
  slippagePct: 0.0003,
  fundingPct: 0.0002,
}

export function estimateRoundTripCostPct(fees: FeeAssumptions = DEFAULT_FEE_ASSUMPTIONS): number {
  return fees.takerFeeRate * 2 + fees.slippagePct + fees.fundingPct
}

// Tolak setup kalau biaya round-trip melebihi porsi tertentu dari risk (R) —
// tanpa ini, edge statistik dari signal engine bisa habis dimakan fee di stop yang sempit.
export function passesFeeToRiskGuard(
  stopDistPct: number,
  fees: FeeAssumptions = DEFAULT_FEE_ASSUMPTIONS,
  maxFeeToRiskRatio = 0.15
): boolean {
  if (stopDistPct <= 0) return false
  const cost = estimateRoundTripCostPct(fees)
  return cost / stopDistPct <= maxFeeToRiskRatio
}
