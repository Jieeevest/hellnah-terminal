import axios from 'axios'
import type { Exchange } from '@/types'
import type { Candle } from '@/lib/indicators'
import type { Timeframe } from '@/lib/signals'
import { API_URLS } from '@/constants/apiUrls'

const TF_DURATION_MS: Record<Timeframe, number> = {
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
}

export interface FetchCandleOptions {
  dropUnclosed?: boolean
}

// Candle terakhir dari exchange biasanya masih berjalan (belum close) — kalau dipakai
// buat sinyal, hasilnya bisa berubah-ubah (repaint) tiap kali di-fetch ulang.
function dropUnclosedCandle(candles: Candle[], tf: Timeframe, nowMs: number): Candle[] {
  if (candles.length === 0) return candles
  const last = candles[candles.length - 1]
  const closesAt = last.time + TF_DURATION_MS[tf]
  return closesAt > nowMs ? candles.slice(0, -1) : candles
}

export async function fetchCandleTf(
  symbol: string,
  exchange: Exchange,
  tf: Timeframe,
  options: FetchCandleOptions = {}
): Promise<Candle[]> {
  let candles: Candle[]

  try {
    switch (exchange) {
      case 'binance': {
        const { data } = await axios.get(`${API_URLS.binance.futures}/klines`, {
          params: { symbol, interval: tf, limit: 150 },
          timeout: 8000,
        })
        candles = (data as any[]).map((d) => ({
          time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]),
          low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]),
        }))
        break
      }
      default:
        candles = []
    }
  } catch {
    return []
  }

  return options.dropUnclosed ? dropUnclosedCandle(candles, tf, Date.now()) : candles
}

export async function fetchMultiTimeframeCandles(
  symbol: string,
  exchange: Exchange,
  timeframes: Timeframe[],
  options: FetchCandleOptions = {}
): Promise<Record<string, Candle[]>> {
  const map: Record<string, Candle[]> = {}
  await Promise.all(
    timeframes.map(async (tf) => {
      map[tf] = await fetchCandleTf(symbol, exchange, tf, options)
    })
  )
  return map
}
