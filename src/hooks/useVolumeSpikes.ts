import { useState, useEffect, useRef } from 'react'
import type { MarketType, Ticker } from '@/types'
import { API_URLS } from '@/constants/apiUrls'

export interface VolumeSpike {
  ticker: Ticker
  avgDailyVolume: number
  ratio: number
}

const POOL_SIZE = 100
const BATCH_SIZE = 10
const BATCH_DELAY_MS = 250
const REFRESH_MS = 5 * 60_000
const MIN_RATIO = 1.8

// Stablecoin volumenya besar tapi bukan "anomali" yang berarti buat trading.
const isStablecoin = (asset: string) => /^USD|USD$|^EUR|^DAI$/.test(asset)

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchAvgDailyQuoteVolume(symbol: string, marketType: MarketType): Promise<number | null> {
  const base = marketType === 'futures' ? API_URLS.binance.futures : API_URLS.binance.spot
  try {
    const res = await fetch(`${base}/klines?symbol=${symbol}&interval=1d&limit=8`)
    if (!res.ok) return null
    const rows = (await res.json()) as unknown[][]
    // Candle terakhir = hari ini (belum close) — dibuang, sisanya 7 hari penuh.
    const closed = rows.slice(0, -1).map((r) => parseFloat(r[7] as string))
    if (closed.length < 3) return null
    return closed.reduce((a, b) => a + b, 0) / closed.length
  } catch {
    return null
  }
}

export function useVolumeSpikes(tickers: Ticker[], marketType: MarketType) {
  const [spikes, setSpikes] = useState<VolumeSpike[]>([])
  const [progress, setProgress] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [lastRunAt, setLastRunAt] = useState<number | null>(null)
  const tickersRef = useRef(tickers)
  useEffect(() => { tickersRef.current = tickers }, [tickers])
  const hasTickers = tickers.length > 0

  useEffect(() => {
    if (!hasTickers) return
    let cancelled = false
    setSpikes([])

    const run = async () => {
      const pool = tickersRef.current
        .filter((t) => !isStablecoin(t.baseAsset))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, POOL_SIZE)
      setScanning(true)
      setProgress(0)
      const found: VolumeSpike[] = []

      for (let i = 0; i < pool.length; i += BATCH_SIZE) {
        if (cancelled) return
        const batch = pool.slice(i, i + BATCH_SIZE)
        const avgs = await Promise.all(batch.map((t) => fetchAvgDailyQuoteVolume(t.symbol, marketType)))
        batch.forEach((t, j) => {
          const avg = avgs[j]
          if (avg && avg > 0 && t.volume / avg >= MIN_RATIO) found.push({ ticker: t, avgDailyVolume: avg, ratio: t.volume / avg })
        })
        setProgress(Math.round(((i + batch.length) / pool.length) * 100))
        if (i + BATCH_SIZE < pool.length) await delay(BATCH_DELAY_MS)
      }

      if (cancelled) return
      setSpikes(found.sort((a, b) => b.ratio - a.ratio))
      setScanning(false)
      setLastRunAt(Date.now())
    }

    run()
    const id = setInterval(run, REFRESH_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [hasTickers, marketType])

  // Harga & volume 24j di baris ikut update live dari ticker terbaru, rasio tetap dari scan.
  const live = spikes.map((s) => {
    const t = tickers.find((x) => x.symbol === s.ticker.symbol) ?? s.ticker
    return { ...s, ticker: t, ratio: t.volume / s.avgDailyVolume }
  })

  return { spikes: live, progress, scanning, lastRunAt }
}
