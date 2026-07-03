import type { Ticker } from '@/types'

export interface VolumeAnomalyResult {
  ticker: Ticker
  zScore: number
  volumeRatio: number
}

export function detectVolumeAnomalies(
  tickers: Ticker[],
  minZScore = 1.5,
): VolumeAnomalyResult[] {
  if (tickers.length < 5) return []

  const volumes = tickers.map((t) => t.volume)
  const mean = volumes.reduce((a, b) => a + b, 0) / volumes.length
  const variance = volumes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / volumes.length
  const std = Math.sqrt(variance)

  if (std === 0) return []

  return tickers
    .map((t) => ({
      ticker: t,
      zScore: (t.volume - mean) / std,
      volumeRatio: t.volume / mean,
    }))
    .filter((r) => r.zScore >= minZScore)
    .sort((a, b) => b.zScore - a.zScore)
    .slice(0, 25)
}
