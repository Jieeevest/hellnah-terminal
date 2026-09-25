import { useState, useEffect, useRef, useCallback } from 'react'
import type { Ticker, Exchange } from '@/types'
import type { Candle } from '@/lib/indicators'
import { generateMTFSignal, type Timeframe } from '@/lib/signals'
import { analyzeFuturesSetup, type FuturesTradePlan } from '@/lib/futuresEngine'
import { fetchMultiTimeframeCandles } from '@/lib/candleFetch'
import { useFearGreed } from './useFearGreed'
import { calcFibRetracement, nearestFibLevel, type FibLevel } from '@/lib/fibonacci'

export type { FuturesTradePlan } from '@/lib/futuresEngine'

export interface FuturesOpportunity {
  ticker: Ticker
  side: 'long' | 'short'
  score: number
  accuracyPct: number
  alignment: number
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
  // Level fib (grafik 1 jam, 3 hari) yang dekat titik masuk rencana — konfirmasi tambahan.
  fibLevel: FibLevel | null
  scannedAt: number
}

export type OpportunityScanStatus = 'idle' | 'scanning' | 'done' | 'error'

export const TIMEFRAMES: Timeframe[] = ['15m', '30m', '1h', '4h']
export const MAX_TICKERS = 60
const BATCH_SIZE = 3
const BATCH_DELAY_MS = 450

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function buildOpportunity(
  ticker: Ticker,
  candlesMap: Record<string, Candle[]>,
  fgValue: number | null,
  maxVolume: number,
  maxOpenInterest: number
): FuturesOpportunity | null {
  const signal = generateMTFSignal(candlesMap, fgValue, ticker.fundingRate ?? null)
  if (!signal) return null

  const analysis = analyzeFuturesSetup(ticker, signal, candlesMap, maxVolume, maxOpenInterest)
  if (!analysis || !analysis.primaryPlan || analysis.rankingScore < 58) return null

  const fib = calcFibRetracement(candlesMap['1h'] ?? [])
  const entryRef = analysis.side === 'long' ? analysis.primaryPlan.openLow : analysis.primaryPlan.openHigh

  return {
    ticker,
    side: analysis.side,
    score: analysis.rankingScore,
    accuracyPct: analysis.accuracyPct,
    alignment: analysis.alignment,
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
    fibLevel: fib ? nearestFibLevel(fib, entryRef) : null,
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
            const candlesMap = await fetchMultiTimeframeCandles(ticker.symbol, exchange, TIMEFRAMES, { dropUnclosed: true })
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

export type CoinSetupStatus = 'loading' | 'ready' | 'unavailable'

// Analisa satu koin pakai mesin yang sama persis dengan scanner & bot (generateMTFSignal +
// analyzeFuturesSetup), supaya ringkasan koin gak pernah beda kesimpulan dengan scanner.
export function useFuturesSetup(symbol: string | null, futuresTickers: Ticker[]) {
  const { data: fgData } = useFearGreed()
  const [setup, setSetup] = useState<FuturesOpportunity | null>(null)
  const [status, setStatus] = useState<CoinSetupStatus>('loading')
  const tickersRef = useRef(futuresTickers)
  const fgRef = useRef(fgData)
  useEffect(() => { tickersRef.current = futuresTickers }, [futuresTickers])
  useEffect(() => { fgRef.current = fgData }, [fgData])
  const hasTickers = futuresTickers.length > 0

  useEffect(() => {
    if (!symbol || !hasTickers) return
    let cancelled = false
    setSetup(null)
    setStatus('loading')

    const run = async () => {
      const all = tickersRef.current
      const ticker = all.find((t) => t.symbol === symbol)
      if (!ticker) { if (!cancelled) setStatus('unavailable'); return }
      // Normalisasi volume/OI dihitung dari pool yang sama dengan scanner (top 60 by volume).
      const pool = [...all].sort((a, b) => b.volume - a.volume).slice(0, MAX_TICKERS)
      const maxVolume = Math.max(...pool.map((t) => t.volume), 0)
      const maxOpenInterest = Math.max(...pool.map((t) => t.openInterest ?? 0), 0)
      const candlesMap = await fetchMultiTimeframeCandles(symbol, 'binance', TIMEFRAMES, { dropUnclosed: true })
      if (cancelled) return
      if (!candlesMap['1h'] || candlesMap['1h'].length < 60) { setStatus('unavailable'); return }
      setSetup(buildOpportunity(ticker, candlesMap, fgRef.current?.value ?? null, maxVolume, maxOpenInterest))
      setStatus('ready')
    }

    run()
    const id = setInterval(run, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [symbol, hasTickers])

  return { setup, status }
}
