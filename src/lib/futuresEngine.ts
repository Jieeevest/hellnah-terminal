import type { Ticker } from '@/types'
import type { Candle } from '@/lib/indicators'
import type { MTFSignalResult, Timeframe } from '@/lib/signals'

export interface FuturesTradePlan {
  timeframe: Timeframe
  openLow: number
  openHigh: number
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  riskReward: number
  note: string
}

export interface FuturesSetupAnalysis {
  side: 'long' | 'short'
  longScore: number
  shortScore: number
  rankingScore: number
  accuracyPct: number
  confidenceLabel: 'High' | 'Medium' | 'Low'
  riskLabel: 'Low' | 'Medium' | 'High'
  crowdednessLabel: 'Low' | 'Moderate' | 'High'
  contextLabel: 'Trend Continuation' | 'Pullback Long' | 'Overextended Long' | 'Breakdown Short' | 'Bounce Short' | 'Overextended Short'
  summary: string
  oneLiner: string
  driver: string
  invalidationReason: string
  primaryPlan: FuturesTradePlan | null
  tradePlans: Partial<Record<Timeframe, FuturesTradePlan>>
}

function normalizeLogMetric(value: number | undefined, maxValue: number) {
  if (!value || value <= 0 || maxValue <= 0) return 0
  return Math.min(1, Math.log10(value + 1) / Math.log10(maxValue + 1))
}

function scoreFundingForLong(fundingRate?: number) {
  if (fundingRate == null) return 0.55
  if (fundingRate <= -0.1) return 1
  if (fundingRate < 0) return 0.85
  if (fundingRate <= 0.03) return 0.65
  if (fundingRate <= 0.08) return 0.35
  return 0.15
}

function scoreFundingForShort(fundingRate?: number) {
  if (fundingRate == null) return 0.55
  if (fundingRate >= 0.1) return 1
  if (fundingRate > 0.03) return 0.85
  if (fundingRate >= 0) return 0.65
  if (fundingRate >= -0.08) return 0.35
  return 0.15
}

function clampPrice(value: number) {
  return value > 0 ? value : 0
}

function calcAtrApprox(candles: Candle[], period = 14) {
  if (candles.length < 2) return 0

  const trs = candles.slice(1).map((candle, index) => {
    const prevClose = candles[index].close
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - prevClose),
      Math.abs(candle.low - prevClose)
    )
  })

  const slice = trs.slice(-period)
  if (!slice.length) return 0
  return slice.reduce((sum, value) => sum + value, 0) / slice.length
}

function getTimeframeAlignment(
  candlesMap: Record<string, Candle[]>,
  side: 'long' | 'short'
) {
  let aligned = 0
  let checked = 0

  for (const tf of ['15m', '30m', '1h', '4h'] as const) {
    const candles = candlesMap[tf]
    if (!candles || candles.length < 10) continue
    checked += 1
    const recent = candles.slice(-5)
    const first = recent[0]?.close ?? 0
    const last = recent[recent.length - 1]?.close ?? 0
    if ((side === 'long' && last >= first) || (side === 'short' && last <= first)) {
      aligned += 1
    }
  }

  return checked > 0 ? aligned / checked : 0
}

function buildTradePlan(
  timeframe: Timeframe,
  candles: Candle[],
  side: 'long' | 'short',
  combinedScore: number
): FuturesTradePlan | null {
  if (candles.length < 30) return null

  const last = candles[candles.length - 1]
  const recent = candles.slice(-20)
  const fast = candles.slice(-8)
  const support = Math.min(...recent.map((candle) => candle.low))
  const resistance = Math.max(...recent.map((candle) => candle.high))
  const fastSupport = Math.min(...fast.map((candle) => candle.low))
  const fastResistance = Math.max(...fast.map((candle) => candle.high))
  const atr = calcAtrApprox(candles)
  const volatility = atr || Math.max(last.close * 0.008, 0.00000001)
  const stretched = combinedScore >= 72

  if (side === 'long') {
    const openHigh = Math.min(last.close, fastSupport + (volatility * (stretched ? 0.35 : 0.55)))
    const openLow = Math.max(support, openHigh - (volatility * (stretched ? 0.55 : 0.8)))
    const stopLoss = Math.max(support - (volatility * 0.45), openLow - (volatility * 0.95))
    const takeProfit1 = Math.max(fastResistance, openHigh + (volatility * 1.2))
    const takeProfit2 = Math.max(resistance, openHigh + (volatility * 2))
    const risk = Math.max(openHigh - stopLoss, 0.00000001)
    const reward = Math.max(takeProfit2 - openHigh, 0)
    return {
      timeframe,
      openLow: clampPrice(openLow),
      openHigh: clampPrice(Math.max(openHigh, openLow)),
      stopLoss: clampPrice(Math.min(stopLoss, openLow)),
      takeProfit1: clampPrice(Math.max(takeProfit1, openHigh)),
      takeProfit2: clampPrice(Math.max(takeProfit2, takeProfit1)),
      riskReward: Math.round((reward / risk) * 100) / 100,
      note: stretched
        ? 'Harga sudah agak naik. Lebih aman tunggu pullback ke area open.'
        : 'Harga masih relatif dekat area support untuk rencana long.',
    }
  }

  const openLow = Math.max(last.close, fastResistance - (volatility * (stretched ? 0.35 : 0.55)))
  const openHigh = Math.min(resistance, openLow + (volatility * (stretched ? 0.55 : 0.8)))
  const stopLoss = Math.min(resistance + (volatility * 0.45), openHigh + (volatility * 0.95))
  const takeProfit1 = Math.min(fastSupport, openLow - (volatility * 1.2))
  const takeProfit2 = Math.min(support, openLow - (volatility * 2))
  const risk = Math.max(stopLoss - openLow, 0.00000001)
  const reward = Math.max(openLow - takeProfit2, 0)
  return {
    timeframe,
    openLow: clampPrice(Math.min(openLow, openHigh)),
    openHigh: clampPrice(openHigh),
    stopLoss: clampPrice(Math.max(stopLoss, openHigh)),
    takeProfit1: clampPrice(Math.min(takeProfit1, openLow)),
    takeProfit2: clampPrice(Math.min(takeProfit2, takeProfit1)),
    riskReward: Math.round((reward / risk) * 100) / 100,
    note: stretched
      ? 'Tekanan turun sudah berjalan. Entry short lebih aman saat harga memantul ke area open.'
      : 'Harga masih dekat area resistance untuk rencana short.',
  }
}

function buildTradePlans(
  candlesMap: Record<string, Candle[]>,
  signal: MTFSignalResult,
  side: 'long' | 'short'
) {
  const plans: Partial<Record<Timeframe, FuturesTradePlan>> = {}

  for (const tf of ['15m', '30m', '1h', '4h'] as const) {
    const candles = candlesMap[tf]
    const tfBreakdown = signal.breakdown[tf]
    if (!candles || !tfBreakdown) continue
    const plan = buildTradePlan(tf, candles, side, tfBreakdown.combinedScore)
    if (plan) plans[tf] = plan
  }

  return plans
}

export function buildSpotRankingScore(
  bullishPct: number,
  volume: number,
  maxVolume: number
) {
  const liquidityScore = normalizeLogMetric(volume, maxVolume) * 100
  return (bullishPct * 0.85) + (liquidityScore * 0.15)
}

export function analyzeFuturesSetup(
  ticker: Ticker,
  signal: MTFSignalResult,
  candlesMap: Record<string, Candle[]>,
  maxVolume: number,
  maxOpenInterest: number
): FuturesSetupAnalysis {
  const longBias = signal.bullishPct
  const shortBias = 100 - signal.bullishPct
  const liquidityScore = normalizeLogMetric(ticker.volume, maxVolume) * 100
  const openInterestScore = normalizeLogMetric(ticker.openInterest, maxOpenInterest) * 100
  const longFundingScore = scoreFundingForLong(ticker.fundingRate) * 100
  const shortFundingScore = scoreFundingForShort(ticker.fundingRate) * 100

  const longScore =
    (longBias * 0.7) +
    (liquidityScore * 0.15) +
    (longFundingScore * 0.1) +
    (openInterestScore * 0.05)

  const shortScore =
    (shortBias * 0.7) +
    (liquidityScore * 0.15) +
    (shortFundingScore * 0.1) +
    (openInterestScore * 0.05)

  const side: 'long' | 'short' = longScore >= shortScore ? 'long' : 'short'
  const edgeScore = Math.max(longScore, shortScore)
  const alignment = getTimeframeAlignment(candlesMap, side)
  const fundingSupport = side === 'long' ? scoreFundingForLong(ticker.fundingRate) : scoreFundingForShort(ticker.fundingRate)
  const directionSupport = side === 'long'
    ? signal.trend === 'Uptrend' ? 1 : signal.trend === 'Sideways' ? 0.55 : 0.2
    : signal.trend === 'Downtrend' ? 1 : signal.trend === 'Sideways' ? 0.55 : 0.2

  const accuracyPct = Math.round(
    Math.max(35, Math.min(92,
      (edgeScore * 0.55) +
      (alignment * 100 * 0.25) +
      (fundingSupport * 100 * 0.1) +
      (directionSupport * 100 * 0.1)
    ))
  )

  const confidenceLabel =
    accuracyPct >= 78 ? 'High'
    : accuracyPct >= 63 ? 'Medium'
    : 'Low'

  const primaryFundingScore = side === 'long' ? scoreFundingForLong(ticker.fundingRate) : scoreFundingForShort(ticker.fundingRate)
  const crowdednessLabel =
    primaryFundingScore >= 0.75 ? 'Low'
    : primaryFundingScore >= 0.45 ? 'Moderate'
    : 'High'

  const summary = side === 'long'
    ? accuracyPct >= 75
      ? 'Long candidate dengan dukungan trend yang relatif rapi.'
      : 'Long candidate ada, tetapi entry sebaiknya tetap menunggu konfirmasi.'
    : accuracyPct >= 75
      ? 'Short candidate dengan tekanan turun yang cukup jelas.'
      : 'Short candidate ada, tetapi lebih aman menunggu candle konfirmasi.'

  const driver = side === 'long'
    ? ticker.fundingRate != null && ticker.fundingRate <= 0
      ? 'Funding tidak terlalu padat untuk long.'
      : 'Momentum naik lebih dominan daripada tekanan jual.'
    : ticker.fundingRate != null && ticker.fundingRate > 0.03
      ? 'Funding panas mendukung ide short yang lebih hati-hati.'
      : 'Momentum turun lebih dominan daripada rebound pendek.'

  const tradePlans = buildTradePlans(candlesMap, signal, side)
  const primaryPlan = tradePlans['1h'] ?? tradePlans['30m'] ?? tradePlans['4h'] ?? tradePlans['15m'] ?? null
  const riskLabel =
    !primaryPlan ? 'High'
    : primaryPlan.riskReward >= 1.8 ? 'Low'
    : primaryPlan.riskReward >= 1.2 ? 'Medium'
    : 'High'

  const contextLabel = side === 'long'
    ? signal.trend === 'Uptrend' && primaryPlan && primaryPlan.riskReward >= 1.8
      ? 'Trend Continuation'
      : signal.trend === 'Uptrend'
        ? 'Pullback Long'
        : 'Overextended Long'
    : signal.trend === 'Downtrend' && primaryPlan && primaryPlan.riskReward >= 1.8
      ? 'Breakdown Short'
      : signal.trend === 'Downtrend'
        ? 'Bounce Short'
        : 'Overextended Short'

  const invalidationReason = !primaryPlan
    ? 'Setup batal jika struktur timeframe besar tidak lagi mendukung.'
    : side === 'long'
      ? `Setup long batal jika harga turun dan bertahan di bawah ${primaryPlan.stopLoss.toFixed(4)}.`
      : `Setup short batal jika harga naik dan bertahan di atas ${primaryPlan.stopLoss.toFixed(4)}.`

  const oneLiner = !primaryPlan
    ? summary
    : side === 'long'
      ? `Layak long jika harga masuk area ${primaryPlan.openLow.toFixed(4)} - ${primaryPlan.openHigh.toFixed(4)} dan tidak jatuh di bawah invalidation.`
      : `Layak short jika harga masuk area ${primaryPlan.openLow.toFixed(4)} - ${primaryPlan.openHigh.toFixed(4)} dan gagal tembus invalidation.`

  return {
    side,
    longScore: Math.round(longScore * 10) / 10,
    shortScore: Math.round(shortScore * 10) / 10,
    rankingScore: Math.round(edgeScore * 10) / 10,
    accuracyPct,
    confidenceLabel,
    riskLabel,
    crowdednessLabel,
    contextLabel,
    summary,
    oneLiner,
    driver,
    invalidationReason,
    primaryPlan,
    tradePlans,
  }
}
