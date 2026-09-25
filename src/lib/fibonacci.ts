import type { Candle } from '@/lib/indicators'

export const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
export const FIB_LOOKBACK_CANDLES = 72

export interface FibLevel {
  ratio: number
  price: number
}

export interface FibRetracement {
  // 'up' = swing low terjadi duluan lalu naik ke high → retracement diukur turun dari high.
  direction: 'up' | 'down'
  swingHigh: number
  swingLow: number
  levels: FibLevel[]
}

export function calcFibRetracement(candles: Candle[], lookback = FIB_LOOKBACK_CANDLES): FibRetracement | null {
  const recent = candles.slice(-lookback)
  if (recent.length < 10) return null

  let highIdx = 0
  let lowIdx = 0
  recent.forEach((c, i) => {
    if (c.high > recent[highIdx].high) highIdx = i
    if (c.low < recent[lowIdx].low) lowIdx = i
  })
  const swingHigh = recent[highIdx].high
  const swingLow = recent[lowIdx].low
  const range = swingHigh - swingLow
  if (range <= 0) return null

  const direction = lowIdx < highIdx ? 'up' : 'down'
  const levels = FIB_RATIOS.map((ratio) => ({
    ratio,
    price: direction === 'up' ? swingHigh - range * ratio : swingLow + range * ratio,
  }))
  return { direction, swingHigh, swingLow, levels }
}

// Level 0% & 100% cuma titik swing — yang dianggap "level fib" buat konfirmasi cuma yang di tengah.
export function nearestFibLevel(fib: FibRetracement, price: number, maxDistPct = 0.5): FibLevel | null {
  let best: FibLevel | null = null
  for (const level of fib.levels) {
    if (level.ratio === 0 || level.ratio === 1) continue
    const dist = (Math.abs(price - level.price) / price) * 100
    if (dist <= maxDistPct && (!best || dist < (Math.abs(price - best.price) / price) * 100)) best = level
  }
  return best
}

export function formatFibRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(1).replace(/\.0$/, '')}%`
}
