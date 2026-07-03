import {
  calcEMA, calcRSI, calcMACD, calcStochRSI, calcSupertrend,
  calcBollingerBands, calcOBV,
  detectPattern, findSR,
  type Candle, type PatternResult,
} from './indicators'

export type Direction = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL'

export interface IndicatorSignal {
  signal: 1 | 0 | -1
  label: string
  detail: string
  score: number
  maxScore: number
}

export interface SignalResult {
  direction: Direction
  confluence: number   // 0–100 — berapa % indikator sepakat
  score: number
  maxScore: number
  trend: 'Uptrend' | 'Downtrend' | 'Sideways'
  indicators: {
    ema: IndicatorSignal
    rsi: IndicatorSignal
    macd: IndicatorSignal
    stochRsi: IndicatorSignal
    supertrend: IndicatorSignal
    volume: IndicatorSignal
  }
  pattern: PatternResult
  support: number
  resistance: number
  summary: string
}

function sigOf(score: number): 1 | 0 | -1 {
  return score > 0 ? 1 : score < 0 ? -1 : 0
}

export function generateSignal(candles: Candle[]): SignalResult | null {
  if (candles.length < 60) return null

  const closes = candles.map((c) => c.close)
  const volumes = candles.map((c) => c.volume)
  const lastClose = closes[closes.length - 1]
  const lastCandle = candles[candles.length - 1]

  // ── Indicators ───────────────────────────────────────────────
  const ema9  = calcEMA(closes, 9)
  const ema21 = calcEMA(closes, 21)
  const ema50 = calcEMA(closes, 50)
  const rsiArr = calcRSI(closes, 14)
  const { histogram: histArr } = calcMACD(closes)
  const { k: stochK, d: stochD } = calcStochRSI(closes)
  const stArr = calcSupertrend(candles)
  const pattern = detectPattern(candles)
  const { support, resistance } = findSR(candles)

  const e9  = ema9[ema9.length - 1]
  const e21 = ema21[ema21.length - 1]
  const e50 = ema50[ema50.length - 1]
  const rsi = rsiArr[rsiArr.length - 1]
  const hist    = histArr[histArr.length - 1]
  const prevHist = histArr[histArr.length - 2]
  const sk = stochK[stochK.length - 1]
  const sd = stochD[stochD.length - 1]
  const prevSk = stochK[stochK.length - 2]
  const st = stArr[stArr.length - 1]

  const avgVol  = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
  const lastVol = volumes[volumes.length - 1]
  const volRatio = lastVol / (avgVol || 1)
  const isBull  = lastCandle.close >= lastCandle.open

  // ── EMA (max 3) ──────────────────────────────────────────────
  let emaScore = 0
  let emaLabel = ''
  const allBull = lastClose > e9 && e9 > e21 && e21 > e50
  const allBear = lastClose < e9 && e9 < e21 && e21 < e50

  if (allBull)                    { emaScore = 3;  emaLabel = 'Bullish sempurna (9>21>50)' }
  else if (allBear)               { emaScore = -3; emaLabel = 'Bearish sempurna (9<21<50)' }
  else if (lastClose > e21 && e9 > e21) { emaScore = 2; emaLabel = 'Di atas EMA 21 & 9' }
  else if (lastClose < e21 && e9 < e21) { emaScore = -2; emaLabel = 'Di bawah EMA 21 & 9' }
  else if (lastClose > e21)       { emaScore = 1;  emaLabel = 'Di atas EMA 21' }
  else                            { emaScore = -1; emaLabel = 'Di bawah EMA 21' }

  // ── RSI (max 2) ──────────────────────────────────────────────
  let rsiScore = 0
  let rsiLabel = ''

  if (rsi < 30)      { rsiScore = 2;  rsiLabel = `Oversold (${rsi.toFixed(1)}) — potensi rebound` }
  else if (rsi > 70) { rsiScore = -2; rsiLabel = `Overbought (${rsi.toFixed(1)}) — potensi koreksi` }
  else if (rsi >= 55 && rsi < 70) { rsiScore = 1;  rsiLabel = `Bullish zone (${rsi.toFixed(1)})` }
  else if (rsi > 30  && rsi < 45) { rsiScore = -1; rsiLabel = `Bearish zone (${rsi.toFixed(1)})` }
  else                             { rsiScore = 0;  rsiLabel = `Netral (${rsi.toFixed(1)})` }

  // ── MACD (max 3) ─────────────────────────────────────────────
  let macdScore = 0
  let macdLabel = ''
  const macdCrossUp   = prevHist < 0 && hist >= 0
  const macdCrossDown = prevHist > 0 && hist <= 0

  if (macdCrossUp)                   { macdScore = 3;  macdLabel = 'Golden cross (bullish)' }
  else if (macdCrossDown)            { macdScore = -3; macdLabel = 'Death cross (bearish)' }
  else if (hist > 0 && hist > prevHist) { macdScore = 2; macdLabel = 'Histogram naik (momentum +)' }
  else if (hist < 0 && hist < prevHist) { macdScore = -2; macdLabel = 'Histogram turun (momentum -)' }
  else if (hist > 0)                 { macdScore = 1;  macdLabel = 'Positif (lemah)' }
  else                               { macdScore = -1; macdLabel = 'Negatif (lemah)' }

  // ── Stoch RSI (max 2) ────────────────────────────────────────
  let stochScore = 0
  let stochLabel = ''
  const prevSd = stochD[stochD.length - 2]
  const stochCrossUp   = prevSk !== undefined && prevSd !== undefined && sk > sd && prevSk <= prevSd
  const stochCrossDown = prevSk !== undefined && prevSd !== undefined && sk < sd && prevSk >= prevSd

  if (sk < 20)          { stochScore = 2;  stochLabel = `Oversold (${sk.toFixed(0)}) — rebound` }
  else if (sk > 80)     { stochScore = -2; stochLabel = `Overbought (${sk.toFixed(0)}) — koreksi` }
  else if (stochCrossUp)   { stochScore = 2; stochLabel = `K melewati D ke atas (${sk.toFixed(0)})` }
  else if (stochCrossDown) { stochScore = -2; stochLabel = `K melewati D ke bawah (${sk.toFixed(0)})` }
  else if (sk > sd && sk > 50) { stochScore = 1;  stochLabel = `K>D zona bullish (${sk.toFixed(0)})` }
  else if (sk < sd && sk < 50) { stochScore = -1; stochLabel = `K<D zona bearish (${sk.toFixed(0)})` }
  else                  { stochScore = 0;  stochLabel = `Netral (${sk.toFixed(0)})` }

  // ── Supertrend (max 3) ───────────────────────────────────────
  let stScore = 0
  let stLabel = ''
  if (st) {
    const prevSt = stArr[stArr.length - 2]
    const switched = prevSt && st.direction !== prevSt.direction
    if (st.direction === 1) {
      stScore = switched ? 3 : 2
      stLabel = switched ? 'Baru balik ke Bullish ↑' : 'Bullish (harga di atas)'
    } else {
      stScore = switched ? -3 : -2
      stLabel = switched ? 'Baru balik ke Bearish ↓' : 'Bearish (harga di bawah)'
    }
  }

  // ── Volume (max 2) ───────────────────────────────────────────
  let volScore = 0
  let volLabel = ''
  if (volRatio > 1.5) {
    volScore  = isBull ? 2 : -2
    volLabel  = `Volume ${volRatio.toFixed(1)}x — konfirmasi ${isBull ? 'bullish' : 'bearish'}`
  } else if (volRatio > 1) {
    volScore  = isBull ? 1 : -1
    volLabel  = `Volume di atas rata-rata (${volRatio.toFixed(1)}x)`
  } else {
    volScore  = 0
    volLabel  = `Volume rendah (${volRatio.toFixed(1)}x) — konfirmasi lemah`
  }

  // ── Pattern (max 3) ──────────────────────────────────────────
  const patternScore = pattern.signal * pattern.strength

  // ── Total ────────────────────────────────────────────────────
  const MAX = 3 + 2 + 3 + 2 + 3 + 2 + 3   // 18
  const totalScore = emaScore + rsiScore + macdScore + stochScore + stScore + volScore + patternScore

  // Confluence: % indikator (tanpa pattern) yang sepakat dengan arah mayoritas
  const indScores = [emaScore, rsiScore, macdScore, stochScore, stScore, volScore]
  const bullCount = indScores.filter((s) => s > 0).length
  const bearCount = indScores.filter((s) => s < 0).length
  const totalInd  = indScores.length
  const confluence = Math.round((Math.max(bullCount, bearCount) / totalInd) * 100)

  // Direction thresholds
  let direction: Direction
  if (totalScore >= 11)       direction = 'STRONG_BUY'
  else if (totalScore >= 5)   direction = 'BUY'
  else if (totalScore <= -11) direction = 'STRONG_SELL'
  else if (totalScore <= -5)  direction = 'SELL'
  else                        direction = 'NEUTRAL'

  // Trend structure (EMA 21 vs 50)
  const trend: SignalResult['trend'] =
    e21 > e50 && lastClose > e21 ? 'Uptrend'
    : e21 < e50 && lastClose < e21 ? 'Downtrend'
    : 'Sideways'

  // Summary text
  const summaryMap: Record<Direction, string> = {
    STRONG_BUY:  'Momentum bullish kuat — mayoritas indikator konfirmasi naik',
    BUY:         'Momentum bullish — lebih banyak indikator mendukung kenaikan',
    NEUTRAL:     'Sinyal campuran — tunggu konfirmasi lebih lanjut',
    SELL:        'Momentum bearish — lebih banyak indikator mendukung penurunan',
    STRONG_SELL: 'Momentum bearish kuat — mayoritas indikator konfirmasi turun',
  }

  return {
    direction,
    confluence,
    score: totalScore,
    maxScore: MAX,
    trend,
    indicators: {
      ema:        { signal: sigOf(emaScore),   label: 'EMA 9/21/50',   detail: emaLabel,   score: emaScore,   maxScore: 3 },
      rsi:        { signal: sigOf(rsiScore),   label: 'RSI 14',        detail: rsiLabel,   score: rsiScore,   maxScore: 2 },
      macd:       { signal: sigOf(macdScore),  label: 'MACD',          detail: macdLabel,  score: macdScore,  maxScore: 3 },
      stochRsi:   { signal: sigOf(stochScore), label: 'Stoch RSI',     detail: stochLabel, score: stochScore, maxScore: 2 },
      supertrend: { signal: sigOf(stScore),    label: 'Supertrend',    detail: stLabel,    score: stScore,    maxScore: 3 },
      volume:     { signal: sigOf(volScore),   label: 'Volume',        detail: volLabel,   score: volScore,   maxScore: 2 },
    },
    pattern,
    support,
    resistance,
    summary: summaryMap[direction],
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// WEIGHTED SIGNAL ENGINE — sesuai docs-analisis.md
// Formula: Price 30% + Volume 20% + Technical 35% + Sentiment 15%
// Output: bullishPct (0–100%) + label
// ══════════════════════════════════════════════════════════════════════════════

export type BullishLabel = 'Bullish' | 'Mild Bullish' | 'Neutral' | 'Mild Bearish' | 'Bearish'

export interface WeightedCategory {
  score: number      // -1.0 to +1.0
  breakdown: Record<string, number>
}

export interface WeightedSignalResult {
  bullishPct: number           // 0–100
  label: BullishLabel
  rawSignal: number            // -1.0 to +1.0
  volumeVsAvg: number          // ratio e.g. 1.4 = 40% di atas rata-rata
  price: WeightedCategory
  volume: WeightedCategory
  technical: WeightedCategory
  sentiment: WeightedCategory
}

/** Linear interpolation antara a dan b sebesar t (0–1) */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Clamp nilai ke range -1 .. +1 */
function clamp1(v: number): number {
  return Math.max(-1, Math.min(1, v))
}

// ── RSI score sesuai docs-analisis.md ─────────────────────────────────────
function scoreRSI(rsi: number): number {
  if (rsi < 30)  return lerp(0.8, 1.0, (30 - rsi) / 30)    // +0.8 → +1.0
  if (rsi < 45)  return lerp(0.2, 0.8, (45 - rsi) / 15)    // +0.2 → +0.8
  if (rsi <= 55) return 0
  if (rsi <= 70) return -lerp(0.2, 0.5, (rsi - 55) / 15)   // -0.2 → -0.5
  return -lerp(0.8, 1.0, Math.min((rsi - 70) / 30, 1))      // -0.8 → -1.0
}

// ── MACD score sesuai docs-analisis.md ────────────────────────────────────
function scoreMACD(macd: number, signal: number, hist: number, prevHist: number): number {
  const aboveSignal = macd > signal
  const histRising  = hist > prevHist
  if (aboveSignal && histRising)   return  1.0
  if (aboveSignal)                 return  0.5
  if (!aboveSignal && !histRising) return -1.0
  return -0.5
}

// ── EMA alignment score (EMA 20/50/200) sesuai docs-analisis.md ───────────
function scoreEMA(price: number, ema20: number, ema50: number, ema200: number): number {
  if (price > ema20 && ema20 > ema50 && ema50 > ema200) return  1.0
  if (price > ema20 && ema20 > ema50)                   return  0.6
  if (price > ema20)                                     return  0.3
  if (price < ema20 && ema20 < ema50 && ema50 < ema200) return -1.0
  if (price < ema20 && ema20 < ema50)                   return -0.6
  return -0.3
}

// ── Bollinger Bands score sesuai docs-analisis.md ─────────────────────────
function scoreBB(price: number, upper: number, lower: number, width: number): number {
  const bandWidth  = upper - lower
  const isSqueeze  = width < 0.04
  if (bandWidth === 0) return 0
  const pctInBand  = (price - lower) / bandWidth   // 0 = at lower, 1 = at upper

  let score = 0
  if (price <= lower)        score =  0.8
  else if (pctInBand < 0.2)  score =  0.3
  else if (price >= upper)   score = -0.8
  else if (pctInBand > 0.8)  score = -0.8
  else                        score =  0

  if (isSqueeze) score *= 0.5   // uncertainty saat band menyempit
  return clamp1(score)
}

// ── Volume vs 7d avg score sesuai docs-analisis.md ────────────────────────
function scoreVolumeRatio(volRatio: number, priceUp: boolean): number {
  if (volRatio >= 2)                         return priceUp ?  1.0 : -1.0
  if (volRatio >= 0.8 && volRatio <= 1.2)   return 0
  if (volRatio > 1.2)                        return priceUp ?  0.5 : -0.5
  return 0   // volume rendah, sinyal lemah
}

// ── OBV score sesuai docs-analisis.md ─────────────────────────────────────
function scoreOBV(obvArr: number[], closeArr: number[], lookback = 7): number {
  if (obvArr.length < lookback + 1 || closeArr.length < lookback) return 0
  const recentObv   = obvArr.slice(-lookback)
  const recentClose = closeArr.slice(-lookback)

  const obvTrend   = recentObv[recentObv.length - 1] - recentObv[0]
  const closeTrend = recentClose[recentClose.length - 1] - recentClose[0]

  // OBV divergence: harga naik tapi OBV turun
  if (closeTrend > 0 && obvTrend < 0) return -0.6
  // OBV naik konsisten
  const obvRising = recentObv.every((v, i) => i === 0 || v >= recentObv[i - 1])
  if (obvRising) return 0.7
  // OBV flat
  if (Math.abs(obvTrend) < Math.abs(recentObv[0]) * 0.01) return 0
  return obvTrend > 0 ? 0.3 : -0.3
}

// ── Funding Rate score sesuai docs-analisis.md ────────────────────────────
export function scoreFundingRate(fundingRatePct: number): number {
  if (fundingRatePct < -0.1) return  0.5
  if (fundingRatePct < 0)    return  0.2
  if (fundingRatePct <= 0.05) return  0
  if (fundingRatePct <= 0.1) return -0.2
  return -0.5
}

// ── Fear & Greed score (inline, hindari circular import) ──────────────────
function scoreFG(value: number | null): number {
  if (value === null) return 0
  if (value <= 25)   return  0.7   // Extreme Fear — contrarian bullish
  if (value <= 40)   return  0.3   // Fear
  if (value <= 60)   return  0     // Neutral
  if (value <= 75)   return -0.3   // Greed
  return -0.7                       // Extreme Greed — contrarian bearish
}

// ── LunarCrush Galaxy Score score ─────────────────────────────────────────
function scoreLCGalaxy(gs: number | null): number {
  if (gs === null) return 0
  if (gs >= 75) return  1.0
  if (gs >= 65) return  0.5
  if (gs >= 50) return  0.0
  if (gs >= 35) return -0.5
  return -1.0
}

// ── LunarCrush Coin Sentiment score (0–100 bullish %) ─────────────────────
function scoreLCSentiment(pct: number | null): number {
  if (pct === null) return 0
  if (pct >= 70) return  0.7
  if (pct >= 60) return  0.3
  if (pct >= 40) return  0.0
  if (pct >= 30) return -0.3
  return -0.7
}

/**
 * Hitung weighted signal sesuai formula docs-analisis.md.
 *
 * @param candles        - OHLCV candles (min 60, ideal 200+)
 * @param fgValue        - Fear & Greed index 0–100 (null → tidak tersedia)
 * @param fundingRatePct - Funding rate dalam % (null → spot market)
 * @param lcGalaxyScore  - LunarCrush Galaxy Score 0–100 (null → tidak tersedia)
 * @param lcSentiment    - LunarCrush Coin Sentiment 0–100 bullish % (null → tidak tersedia)
 */
export function generateWeightedSignal(
  candles: Candle[],
  fgValue: number | null = null,
  fundingRatePct: number | null = null,
  lcGalaxyScore: number | null = null,
  lcSentiment: number | null = null
): WeightedSignalResult | null {
  if (candles.length < 60) return null

  const closes  = candles.map((c) => c.close)
  const volumes = candles.map((c) => c.volume)
  const lastClose  = closes[closes.length - 1]
  const lastCandle = candles[candles.length - 1]
  const priceUp    = lastCandle.close >= lastCandle.open

  // ── Hitung indikator ──────────────────────────────────────────────────
  const rsiArr  = calcRSI(closes, 14)
  const { macd: macdArr, signal: sigArr, histogram: histArr } = calcMACD(closes)
  const ema20Arr  = calcEMA(closes, 20)
  const ema50Arr  = calcEMA(closes, 50)
  const ema200Arr = calcEMA(closes, 200)
  const bb        = calcBollingerBands(closes, 20, 2)
  const obvArr    = calcOBV(closes, volumes)

  // Volume vs 7-candle avg
  const vol7   = volumes.slice(-7)
  const avgVol = vol7.reduce((a, b) => a + b, 0) / vol7.length
  const volRatio = avgVol > 0 ? volumes[volumes.length - 1] / avgVol : 1

  // Nilai terakhir
  const rsi      = rsiArr[rsiArr.length - 1]
  const macdVal  = macdArr[macdArr.length - 1]
  const sigVal   = sigArr[sigArr.length - 1]
  const hist     = histArr[histArr.length - 1]
  const prevHist = histArr[histArr.length - 2] ?? 0
  const ema20    = ema20Arr[ema20Arr.length - 1]
  const ema50    = ema50Arr[ema50Arr.length - 1]
  const ema200   = ema200Arr.length > 0 ? ema200Arr[ema200Arr.length - 1] : ema50
  const bbUpper  = bb.upper[bb.upper.length - 1]
  const bbLower  = bb.lower[bb.lower.length - 1]
  const bbWidth  = bb.width[bb.width.length - 1]

  if (!rsi || !ema20) return null

  // ── Skor per indikator ────────────────────────────────────────────────
  const rsiScore  = scoreRSI(rsi)
  const bbScore   = scoreBB(lastClose, bbUpper, bbLower, bbWidth)
  const macdScore = scoreMACD(macdVal, sigVal, hist, prevHist)
  const emaScore  = scoreEMA(lastClose, ema20, ema50, ema200)
  const volScore  = scoreVolumeRatio(volRatio, priceUp)
  const obvScore  = scoreOBV(obvArr, closes)
  const fgS        = scoreFG(fgValue)
  const fundingS   = fundingRatePct !== null ? scoreFundingRate(fundingRatePct) : 0
  const lcGalaxyS  = scoreLCGalaxy(lcGalaxyScore)
  const lcSentS    = scoreLCSentiment(lcSentiment)
  const hasLC      = lcGalaxyScore !== null && lcSentiment !== null

  // ── Step 1: Skor per kategori (docs-analisis.md) ─────────────────────
  const scorePrice = rsiScore  * 0.5 + bbScore  * 0.5
  const scoreVol   = volScore  * 0.5 + obvScore * 0.5
  const scoreTech  = macdScore * 0.4 + emaScore * 0.6

  // Sentiment: blending Fear&Greed + LunarCrush (jika tersedia) + Funding (futures)
  const scoreSentiment = (() => {
    if (fundingRatePct !== null && hasLC)
      return fgS * 0.3 + fundingS * 0.3 + lcGalaxyS * 0.2 + lcSentS * 0.2
    if (fundingRatePct !== null)
      return fgS * 0.5 + fundingS * 0.5
    if (hasLC)
      return fgS * 0.4 + lcGalaxyS * 0.3 + lcSentS * 0.3
    return fgS
  })()

  // ── Step 2: Weighted aggregate ────────────────────────────────────────
  let rawSignal =
    scorePrice     * 0.30 +
    scoreVol       * 0.20 +
    scoreTech      * 0.35 +
    scoreSentiment * 0.15
  rawSignal = clamp1(rawSignal)

  // ── Step 3: Konversi ke % bullish ─────────────────────────────────────
  let bullishPct = ((rawSignal + 1) / 2) * 100

  // ── Step 4: Volume confidence multiplier ──────────────────────────────
  if (volRatio < 0.5) {
    bullishPct = lerp(bullishPct, 50, 0.4)   // tarik ke netral
  }
  bullishPct = Math.max(0, Math.min(100, bullishPct))

  // ── Step 5: Label ─────────────────────────────────────────────────────
  let label: BullishLabel
  if (bullishPct >= 65)       label = 'Bullish'
  else if (bullishPct >= 55)  label = 'Mild Bullish'
  else if (bullishPct >= 45)  label = 'Neutral'
  else if (bullishPct >= 35)  label = 'Mild Bearish'
  else                         label = 'Bearish'

  return {
    bullishPct: Math.round(bullishPct * 10) / 10,
    label,
    rawSignal: Math.round(rawSignal * 1000) / 1000,
    volumeVsAvg: Math.round(volRatio * 100) / 100,
    price:     { score: scorePrice,     breakdown: { rsi: rsiScore, bb: bbScore } },
    volume:    { score: scoreVol,       breakdown: { volume: volScore, obv: obvScore } },
    technical: { score: scoreTech,      breakdown: { macd: macdScore, ema: emaScore } },
    sentiment: { score: scoreSentiment, breakdown: { fearGreed: fgS, ...(fundingRatePct !== null ? { funding: fundingS } : {}), ...(hasLC ? { lcGalaxy: lcGalaxyS, lcSentiment: lcSentS } : {}) } },
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MULTI-TIMEFRAME (MTF) ENGINE
// Menggabungkan Classic & Weighted Signal untuk 15m, 30m, 1h, 4h
// ══════════════════════════════════════════════════════════════════════════════

export type Timeframe = '15m' | '30m' | '1h' | '4h'

export interface MTFSignalResult {
  bullishPct: number
  label: BullishLabel
  trend: 'Uptrend' | 'Downtrend' | 'Sideways'
  breakdown: Partial<Record<Timeframe, {
    classicDirection: Direction | null
    weightedPct: number
    combinedScore: number
  }>>
}

function directionToScore(dir: Direction): number {
  switch (dir) {
    case 'STRONG_BUY': return 100
    case 'BUY': return 75
    case 'NEUTRAL': return 50
    case 'SELL': return 25
    case 'STRONG_SELL': return 0
  }
}

export function generateMTFSignal(
  candlesMap: Record<string, Candle[]>,
  fgValue: number | null = null,
  fundingRatePct: number | null = null
): MTFSignalResult | null {
  const weights: Record<string, number> = {
    '15m': 0.10,
    '30m': 0.20,
    '1h':  0.30,
    '4h':  0.40,
  }

  const breakdown: MTFSignalResult['breakdown'] = {}
  let totalScore = 0
  let totalWeight = 0
  let primaryTrend: 'Uptrend' | 'Downtrend' | 'Sideways' = 'Sideways'

  for (const [tf, candles] of Object.entries(candlesMap)) {
    if (!candles || candles.length < 60) continue
    
    const classic = generateSignal(candles)
    const weighted = generateWeightedSignal(candles, fgValue, fundingRatePct)
    
    if (!classic || !weighted) continue

    const classicScore = directionToScore(classic.direction)
    const weightedScore = weighted.bullishPct

    // Gabungkan metode Classic (40%) dan Weighted (60%) untuk TF ini
    const combinedScore = (classicScore * 0.4) + (weightedScore * 0.6)
    
    breakdown[tf as Timeframe] = {
      classicDirection: classic.direction,
      weightedPct: weighted.bullishPct,
      combinedScore,
    }

    const w = weights[tf] || 0
    totalScore += combinedScore * w
    totalWeight += w

    // Gunakan trend dari 1h atau 4h (timframe besar)
    if (tf === '1h' || tf === '4h') {
      primaryTrend = classic.trend
    }
  }

  if (totalWeight === 0) return null

  const finalPct = totalScore / totalWeight
  
  let label: BullishLabel
  if (finalPct >= 65)       label = 'Bullish'
  else if (finalPct >= 55)  label = 'Mild Bullish'
  else if (finalPct >= 45)  label = 'Neutral'
  else if (finalPct >= 35)  label = 'Mild Bearish'
  else                      label = 'Bearish'

  return {
    bullishPct: Math.round(finalPct * 10) / 10,
    label,
    trend: primaryTrend,
    breakdown,
  }
}


