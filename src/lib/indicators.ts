export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function calcEMA(values: number[], period: number): number[] {
  if (values.length < period) return []
  const k = 2 / (period + 1)
  let ema = values.slice(0, period).reduce((a, b) => a + b) / period
  const result = [ema]
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k)
    result.push(ema)
  }
  return result
}

export function calcRSI(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return []
  const changes = closes.slice(1).map((c, i) => c - closes[i])
  const gains = changes.map((c) => Math.max(c, 0))
  const losses = changes.map((c) => Math.max(-c, 0))
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period
  const result: number[] = []
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    result.push(100 - 100 / (1 + rs))
  }
  return result
}

export function calcMACD(closes: number[], fast = 12, slow = 26, sig = 9) {
  const emaFast = calcEMA(closes, fast)
  const emaSlow = calcEMA(closes, slow)
  const offset = slow - fast
  if (emaFast.length <= offset) return { macd: [], signal: [], histogram: [] }
  const macdLine = emaFast.slice(offset).map((v, i) => v - emaSlow[i])
  const signalLine = calcEMA(macdLine, sig)
  const histogram = macdLine.slice(sig - 1).map((v, i) => v - signalLine[i])
  return { macd: macdLine.slice(sig - 1), signal: signalLine, histogram }
}

function calcATR(candles: Candle[], period = 10): number[] {
  if (candles.length < period + 1) return []
  const trs = candles.slice(1).map((c, i) => {
    const prev = candles[i]
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close))
  })
  let atr = trs.slice(0, period).reduce((a, b) => a + b) / period
  const result = [atr]
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
    result.push(atr)
  }
  return result
}

export function calcSupertrend(
  candles: Candle[],
  period = 10,
  factor = 3
): { direction: 1 | -1; value: number }[] {
  const atrs = calcATR(candles, period)
  if (atrs.length === 0) return []
  const result: { direction: 1 | -1; value: number }[] = []
  let direction: 1 | -1 = 1
  let supert = 0

  for (let i = 0; i < atrs.length; i++) {
    const idx = period + i
    const hl2 = (candles[idx].high + candles[idx].low) / 2
    const atr = atrs[i]
    const upper = hl2 + factor * atr
    const lower = hl2 - factor * atr

    if (i === 0) {
      supert = lower
      direction = 1
    } else {
      const prev = result[i - 1]
      if (prev.direction === 1) {
        supert = Math.max(lower, prev.value)
        if (candles[idx].close < supert) { direction = -1; supert = upper }
        else direction = 1
      } else {
        supert = Math.min(upper, prev.value)
        if (candles[idx].close > supert) { direction = 1; supert = lower }
        else direction = -1
      }
    }
    result.push({ direction, value: supert })
  }
  return result
}

export function calcStochRSI(closes: number[], rsiP = 14, stochP = 14, smoothK = 3, smoothD = 3) {
  const rsi = calcRSI(closes, rsiP)
  if (rsi.length < stochP) return { k: [], d: [] }
  const rawK: number[] = []
  for (let i = stochP - 1; i < rsi.length; i++) {
    const slice = rsi.slice(i - stochP + 1, i + 1)
    const min = Math.min(...slice)
    const max = Math.max(...slice)
    rawK.push(max === min ? 50 : ((rsi[i] - min) / (max - min)) * 100)
  }
  const k = calcEMA(rawK, smoothK)
  const d = calcEMA(k, smoothD)
  return { k, d }
}

// ── Bollinger Bands ────────────────────────────────────────────
export interface BollingerBands {
  upper: number[]
  middle: number[] // SMA
  lower: number[]
  width: number[]  // (upper - lower) / middle — normalized band width
}

export function calcBollingerBands(closes: number[], period = 20, stdDevMult = 2): BollingerBands {
  const upper: number[] = []
  const middle: number[] = []
  const lower: number[] = []
  const width: number[] = []

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1)
    const sma = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((sum, v) => sum + Math.pow(v - sma, 2), 0) / period
    const sd = Math.sqrt(variance)
    const up = sma + stdDevMult * sd
    const lo = sma - stdDevMult * sd
    upper.push(up)
    middle.push(sma)
    lower.push(lo)
    width.push(sma > 0 ? (up - lo) / sma : 0)
  }
  return { upper, middle, lower, width }
}

// ── OBV (On Balance Volume) ────────────────────────────────────
export function calcOBV(closes: number[], volumes: number[]): number[] {
  if (closes.length < 2 || closes.length !== volumes.length) return []
  const result: number[] = [0]
  for (let i = 1; i < closes.length; i++) {
    const prev = result[result.length - 1]
    if (closes[i] > closes[i - 1]) result.push(prev + volumes[i])
    else if (closes[i] < closes[i - 1]) result.push(prev - volumes[i])
    else result.push(prev)
  }
  return result
}

export interface PatternResult {
  name: string
  signal: 1 | -1 | 0
  strength: 1 | 2 | 3
}

export function detectPattern(candles: Candle[]): PatternResult {
  if (candles.length < 3) return { name: '—', signal: 0, strength: 1 }
  const c0 = candles[candles.length - 1]
  const c1 = candles[candles.length - 2]
  const c2 = candles[candles.length - 3]

  const body0 = Math.abs(c0.close - c0.open)
  const body1 = Math.abs(c1.close - c1.open)
  const body2 = Math.abs(c2.close - c2.open)
  const range0 = c0.high - c0.low || 0.0001
  const isGreen0 = c0.close >= c0.open
  const isGreen1 = c1.close >= c1.open
  const isGreen2 = c2.close >= c2.open
  const lowerWick0 = Math.min(c0.open, c0.close) - c0.low
  const upperWick0 = c0.high - Math.max(c0.open, c0.close)

  // Doji
  if (body0 / range0 < 0.1) return { name: 'Doji', signal: 0, strength: 1 }

  // Bullish Engulfing
  if (!isGreen1 && isGreen0 && c0.open <= c1.close && c0.close >= c1.open && body0 > body1)
    return { name: 'Bullish Engulfing', signal: 1, strength: 3 }

  // Bearish Engulfing
  if (isGreen1 && !isGreen0 && c0.open >= c1.close && c0.close <= c1.open && body0 > body1)
    return { name: 'Bearish Engulfing', signal: -1, strength: 3 }

  // Morning Star
  if (!isGreen2 && body1 < body2 * 0.5 && isGreen0 && c0.close > (c2.open + c2.close) / 2)
    return { name: 'Morning Star', signal: 1, strength: 3 }

  // Evening Star
  if (isGreen2 && body1 < body2 * 0.5 && !isGreen0 && c0.close < (c2.open + c2.close) / 2)
    return { name: 'Evening Star', signal: -1, strength: 3 }

  // Hammer
  if (lowerWick0 >= body0 * 2 && upperWick0 <= body0 * 0.5)
    return { name: 'Hammer', signal: 1, strength: 2 }

  // Shooting Star
  if (upperWick0 >= body0 * 2 && lowerWick0 <= body0 * 0.5)
    return { name: 'Shooting Star', signal: -1, strength: 2 }

  // Pinbar bullish
  if (lowerWick0 >= range0 * 0.6 && body0 <= range0 * 0.3)
    return { name: 'Pinbar Bullish', signal: 1, strength: 2 }

  // Pinbar bearish
  if (upperWick0 >= range0 * 0.6 && body0 <= range0 * 0.3)
    return { name: 'Pinbar Bearish', signal: -1, strength: 2 }

  // Marubozu
  if (body0 / range0 > 0.9)
    return { name: isGreen0 ? 'Marubozu Bullish' : 'Marubozu Bearish', signal: isGreen0 ? 1 : -1, strength: 2 }

  // Three white soldiers
  if (isGreen0 && isGreen1 && isGreen2 && c0.close > c1.close && c1.close > c2.close)
    return { name: 'Three White Soldiers', signal: 1, strength: 3 }

  // Three black crows
  if (!isGreen0 && !isGreen1 && !isGreen2 && c0.close < c1.close && c1.close < c2.close)
    return { name: 'Three Black Crows', signal: -1, strength: 3 }

  return { name: '—', signal: 0, strength: 1 }
}

export function findSR(candles: Candle[], lookback = 20) {
  const slice = candles.slice(-lookback)
  return {
    support: Math.min(...slice.map((c) => c.low)),
    resistance: Math.max(...slice.map((c) => c.high)),
  }
}
