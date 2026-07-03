import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import type { Ticker, Exchange } from '@/types'
import type { Candle } from '@/lib/indicators'
import { generateMTFSignal, type Timeframe } from '@/lib/signals'
import { analyzeFuturesSetup, type FuturesTradePlan } from '@/lib/futuresEngine'
import { useFearGreed } from './useFearGreed'
import { API_URLS } from '@/constants/apiUrls'

export type { FuturesTradePlan } from '@/lib/futuresEngine'

export interface FuturesOpportunity {
  ticker: Ticker
  side: 'long' | 'short'
  score: number
  accuracyPct: number
  confidenceLabel: 'High' | 'Medium' | 'Low'
  riskLabel: 'Low' | 'Medium' | 'High'
  crowdednessLabel: 'Low' | 'Moderate' | 'High'
  contextLabel: string
  summary: string
  oneLiner: string
  driver: string
  invalidationReason: string
  primaryPlan: FuturesTradePlan
  tradePlans: Partial<Record<Timeframe, FuturesTradePlan>>
  scannedAt: number
}

export type OpportunityScanStatus = 'idle' | 'scanning' | 'done' | 'error'

const TIMEFRAMES: Timeframe[] = ['15m', '30m', '1h', '4h']
const MAX_TICKERS = 60
const BATCH_SIZE = 3
const BATCH_DELAY_MS = 450

async function fetchCandleTf(
  symbol: string,
  exchange: Exchange,
  tf: Timeframe
): Promise<Candle[]> {
  try {
    switch (exchange) {
      case 'binance': {
        const { data } = await axios.get(`${API_URLS.binance.futures}/klines`, {
          params: { symbol, interval: tf, limit: 150 },
          timeout: 8000,
        })
        return (data as any[]).map((d) => ({
          time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]),
          low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]),
        }))
      }
      case 'kucoin': {
        const granMap: Record<Timeframe, number> = { '15m': 15, '30m': 30, '1h': 60, '4h': 240 }
        const to = Date.now()
        const from = to - 60 * 1000 * granMap[tf] * 150
        const { data } = await axios.get(`${API_URLS.kucoin.futures}/kline/query`, {
          params: { symbol, granularity: granMap[tf], from, to },
          timeout: 8000,
        })
        return ((data?.data ?? []) as any[]).map((d: any) => ({
          time: d[0], open: parseFloat(d[1]), high: parseFloat(d[3]),
          low: parseFloat(d[4]), close: parseFloat(d[2]), volume: parseFloat(d[5]),
        }))
      }
      case 'okx': {
        const barMap: Record<Timeframe, string> = { '15m': '15m', '30m': '30m', '1h': '1H', '4h': '4H' }
        const { data } = await axios.get(`${API_URLS.okx.market}/candles`, {
          params: { instId: symbol, bar: barMap[tf], limit: 150 },
          timeout: 8000,
        })
        return ((data?.data ?? []) as any[]).reverse().map((d: any) => ({
          time: parseInt(d[0]), open: parseFloat(d[1]), high: parseFloat(d[2]),
          low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]),
        }))
      }
      case 'cryptocom': {
        const { data } = await axios.get(
          `${API_URLS.cryptoCom.public}/get-candlestick`,
          { params: { instrument_name: symbol, timeframe: tf, count: 150 }, timeout: 8000 }
        )
        return ((data?.result?.data ?? []) as any[]).reverse().map((d: any) => ({
          time: d.t, open: parseFloat(d.o), high: parseFloat(d.h),
          low: parseFloat(d.l), close: parseFloat(d.c), volume: parseFloat(d.v),
        }))
      }
    }
  } catch {
    return []
  }
}

async function fetchMultiTimeframeCandles(symbol: string, exchange: Exchange): Promise<Record<string, Candle[]>> {
  const map: Record<string, Candle[]> = {}
  await Promise.all(
    TIMEFRAMES.map(async (tf) => {
      map[tf] = await fetchCandleTf(symbol, exchange, tf)
    })
  )
  return map
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function buildOpportunity(
  ticker: Ticker,
  candlesMap: Record<string, Candle[]>,
  fgValue: number | null,
  maxVolume: number,
  maxOpenInterest: number
): FuturesOpportunity | null {
  const signal = generateMTFSignal(candlesMap, fgValue, ticker.fundingRate ?? null)
  if (!signal) return null

  const analysis = analyzeFuturesSetup(ticker, signal, candlesMap, maxVolume, maxOpenInterest)
  if (!analysis.primaryPlan || analysis.rankingScore < 58) return null

  return {
    ticker,
    side: analysis.side,
    score: analysis.rankingScore,
    accuracyPct: analysis.accuracyPct,
    confidenceLabel: analysis.confidenceLabel,
    riskLabel: analysis.riskLabel,
    crowdednessLabel: analysis.crowdednessLabel,
    contextLabel: analysis.contextLabel,
    summary: analysis.summary,
    oneLiner: analysis.oneLiner,
    driver: analysis.driver,
    invalidationReason: analysis.invalidationReason,
    primaryPlan: analysis.primaryPlan,
    tradePlans: analysis.tradePlans,
    scannedAt: Date.now(),
  }
}

export function useFuturesOpportunities(tickers: Ticker[], exchange: Exchange) {
  const { data: fgData } = useFearGreed()
  const [opportunities, setOpportunities] = useState<FuturesOpportunity[]>([])
  const [status, setStatus] = useState<OpportunityScanStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [scannedCount, setScannedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [lastRunAt, setLastRunAt] = useState<number | null>(null)
  const abortRef = useRef(false)
  const scanningRef = useRef(false)

  // Refs so runScan always reads latest values without recreating (keeps stable reference)
  const tickersRef = useRef(tickers)
  const exchangeRef = useRef(exchange)
  const fgDataRef = useRef(fgData)
  useEffect(() => { tickersRef.current = tickers }, [tickers])
  useEffect(() => { fgDataRef.current = fgData }, [fgData])

  // When exchange changes, clear old results and abort active scan
  useEffect(() => {
    if (exchangeRef.current !== exchange) {
      exchangeRef.current = exchange
      abortRef.current = true
      scanningRef.current = false
      setOpportunities([])
      setStatus('idle')
      setProgress(0)
      setScannedCount(0)
    }
  }, [exchange])

  const runScan = useCallback(async () => {
    const tickers = tickersRef.current
    const exchange = exchangeRef.current
    const fgData = fgDataRef.current

    if (!tickers.length || scanningRef.current) return
    abortRef.current = false
    scanningRef.current = true

    try {
      const pool = [...tickers]
        .sort((a, b) => b.volume - a.volume)
        .slice(0, MAX_TICKERS)
      const maxVolume = Math.max(...pool.map((ticker) => ticker.volume), 0)
      const maxOpenInterest = Math.max(...pool.map((ticker) => ticker.openInterest ?? 0), 0)

      setStatus('scanning')
      setProgress(0)
      setScannedCount(0)
      setTotalCount(pool.length)

      let done = 0

      for (let i = 0; i < pool.length; i += BATCH_SIZE) {
        if (abortRef.current) break
        const batch = pool.slice(i, i + BATCH_SIZE)

        const batchResults = await Promise.all(
          batch.map(async (ticker) => {
            const candlesMap = await fetchMultiTimeframeCandles(ticker.symbol, exchange)
            if (!candlesMap['1h'] || candlesMap['1h'].length < 60) return null
            return buildOpportunity(ticker, candlesMap, fgData?.value ?? null, maxVolume, maxOpenInterest)
          })
        )

        done += batch.length
        setScannedCount(done)
        setProgress(Math.round((done / pool.length) * 100))

        const batchUpdates = batchResults.filter((item): item is FuturesOpportunity => item !== null)
        if (batchUpdates.length > 0) {
          setOpportunities((prev) => {
            const map = new Map(prev.map((o) => [`${o.side}-${o.ticker.symbol}`, o]))
            for (const item of batchUpdates) {
              map.set(`${item.side}-${item.ticker.symbol}`, item)
            }
            return [...map.values()].sort((a, b) => b.accuracyPct - a.accuracyPct || b.score - a.score)
          })
        }

        if (i + BATCH_SIZE < pool.length) await delay(BATCH_DELAY_MS)
      }

      if (!abortRef.current) {
        setStatus('done')
        setLastRunAt(Date.now())
      }
    } finally {
      scanningRef.current = false
    }
  }, []) // stable — reads latest values through refs

  const cancelScan = useCallback(() => {
    abortRef.current = true
    scanningRef.current = false
    setStatus('idle')
  }, [])

  useEffect(() => {
    return () => {
      abortRef.current = true
      scanningRef.current = false
    }
  }, [])

  return { opportunities, status, progress, scannedCount, totalCount, lastRunAt, runScan, cancelScan }
}
