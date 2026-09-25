// Semua endpoint di sini PUBLIC (tanpa API key) — dipakai buat paper trading (M3).
// Order execution nyata (M4+) butuh signed request terpisah dengan API key server-side.
const BASE = 'https://fapi.binance.com'

// '1m'/'5m' TAMBAHAN buat scalpScanner.ts (eksperimen shadow-only, gak dipakai strategi
// swing production) -- TIMEFRAMES const di bawah SENGAJA gak diubah, itu khusus dipakai
// generateMTFSignal (weights-nya hardcode buat 4 timeframe itu doang).
export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h'
export const TIMEFRAMES: Timeframe[] = ['15m', '30m', '1h', '4h']

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export const TF_DURATION_MS: Record<Timeframe, number> = {
  '1m': 60 * 1000,
  '3m': 3 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
}

async function getJson(pathAndQuery: string): Promise<any> {
  const res = await fetch(`${BASE}${pathAndQuery}`)
  if (!res.ok) throw new Error(`Binance ${pathAndQuery} -> HTTP ${res.status}`)
  return res.json()
}

function dropUnclosedCandle(candles: Candle[], tf: Timeframe, nowMs: number): Candle[] {
  if (candles.length === 0) return candles
  const last = candles[candles.length - 1]
  return last.time + TF_DURATION_MS[tf] > nowMs ? candles.slice(0, -1) : candles
}

export async function fetchCandles(symbol: string, tf: Timeframe, limit = 150): Promise<Candle[]> {
  const data = await getJson(`/fapi/v1/klines?symbol=${symbol}&interval=${tf}&limit=${limit}`)
  const candles: Candle[] = (data as any[]).map((d) => ({
    time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]),
    low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]),
  }))
  return dropUnclosedCandle(candles, tf, Date.now())
}

export async function fetchMultiTimeframeCandles(
  symbol: string,
  timeframes: Timeframe[]
): Promise<Record<string, Candle[]>> {
  const out: Record<string, Candle[]> = {}
  await Promise.all(timeframes.map(async (tf) => { out[tf] = await fetchCandles(symbol, tf) }))
  return out
}

export interface TickerStats {
  quoteVolume24h: number
  lastPrice: number
}

export async function fetch24hrTicker(symbol: string): Promise<TickerStats> {
  const data = await getJson(`/fapi/v1/ticker/24hr?symbol=${symbol}`)
  return { quoteVolume24h: parseFloat(data.quoteVolume), lastPrice: parseFloat(data.lastPrice) }
}

export async function fetchSpreadPct(symbol: string): Promise<number> {
  const data = await getJson(`/fapi/v1/ticker/bookTicker?symbol=${symbol}`)
  const bid = parseFloat(data.bidPrice)
  const ask = parseFloat(data.askPrice)
  if (bid <= 0 || ask <= 0) return 1
  return (ask - bid) / ((ask + bid) / 2)
}

export async function fetchMarkPrice(symbol: string): Promise<number> {
  const data = await getJson(`/fapi/v1/premiumIndex?symbol=${symbol}`)
  return parseFloat(data.markPrice)
}

// lastFundingRate dari Binance dalam desimal (mis. 0.0001 = 0.01%). futuresEngine.ts &
// signals.ts sudah dikalibrasi menerima funding dalam satuan % (0.01, bukan 0.0001).
export async function fetchFundingRatePct(symbol: string): Promise<number> {
  const data = await getJson(`/fapi/v1/premiumIndex?symbol=${symbol}`)
  return parseFloat(data.lastFundingRate) * 100
}

export async function fetchOpenInterestQuote(symbol: string, markPrice: number): Promise<number> {
  const data = await getJson(`/fapi/v1/openInterest?symbol=${symbol}`)
  return parseFloat(data.openInterest) * markPrice
}

export interface SymbolFilters {
  stepSize: number
  tickSize: number
  minNotional: number
}

const filtersCache = new Map<string, SymbolFilters>()
const onboardDateCache = new Map<string, number>()
let tradableSymbolsCache: string[] | null = null

function parseFilters(info: any): SymbolFilters {
  const lotSize = info.filters.find((f: any) => f.filterType === 'LOT_SIZE')
  const priceFilter = info.filters.find((f: any) => f.filterType === 'PRICE_FILTER')
  const minNotionalFilter = info.filters.find((f: any) => f.filterType === 'MIN_NOTIONAL')
  return {
    stepSize: parseFloat(lotSize?.stepSize ?? '0.001'),
    tickSize: parseFloat(priceFilter?.tickSize ?? '0.01'),
    minNotional: parseFloat(minNotionalFilter?.notional ?? '5'),
  }
}

// Satu call exchangeInfo dipakai buat DUA hal sekaligus: (1) daftar simbol USDT-M
// perpetual yang benar-benar tradable (bukan delisted/quarterly), (2) priming
// filtersCache semua simbol supaya sizePosition() nanti tidak perlu call lagi per simbol.
async function loadExchangeInfo(): Promise<string[]> {
  if (tradableSymbolsCache) return tradableSymbolsCache
  const data = await getJson('/fapi/v1/exchangeInfo')
  const symbols: string[] = []
  for (const info of data.symbols as any[]) {
    if (info.status !== 'TRADING' || info.contractType !== 'PERPETUAL' || info.quoteAsset !== 'USDT') continue
    symbols.push(info.symbol)
    filtersCache.set(info.symbol, parseFilters(info))
    if (typeof info.onboardDate === 'number') onboardDateCache.set(info.symbol, info.onboardDate)
  }
  tradableSymbolsCache = symbols
  return symbols
}

export async function fetchTradableUsdtPerpetualSymbols(): Promise<string[]> {
  return loadExchangeInfo()
}

// onboardDate resmi dari Binance (bukan tebak dari candle pertama) — dipakai buat filter
// umur listing minimum di scanWorker.ts (coin baru listing belum punya cukup histori buat
// dinilai polanya, lebih rawan hype/pump-dump di fase awal). Map kosong sebelum
// loadExchangeInfo() sempat dipanggil sekali (selalu dipanggil bareng
// fetchTradableUsdtPerpetualSymbols() di awal tiap scan cycle).
export async function fetchSymbolOnboardDates(): Promise<Map<string, number>> {
  await loadExchangeInfo()
  return onboardDateCache
}

export async function fetchSymbolFilters(symbol: string): Promise<SymbolFilters> {
  const cached = filtersCache.get(symbol)
  if (cached) return cached
  await loadExchangeInfo()
  const fromBulk = filtersCache.get(symbol)
  if (fromBulk) return fromBulk
  throw new Error(`Symbol filters tidak ditemukan untuk ${symbol}`)
}

// ── Bulk endpoint (satu request buat SEMUA simbol) — dipakai scanWorker supaya scan
// "semua koin" tidak butuh N request per simbol buat data ticker/spread/funding.
export async function fetchAllTickers24hr(): Promise<Record<string, TickerStats>> {
  const data = await getJson('/fapi/v1/ticker/24hr')
  const out: Record<string, TickerStats> = {}
  for (const d of data as any[]) {
    out[d.symbol] = { quoteVolume24h: parseFloat(d.quoteVolume), lastPrice: parseFloat(d.lastPrice) }
  }
  return out
}

export async function fetchAllSpreadPct(): Promise<Record<string, number>> {
  const data = await getJson('/fapi/v1/ticker/bookTicker')
  const out: Record<string, number> = {}
  for (const d of data as any[]) {
    const bid = parseFloat(d.bidPrice)
    const ask = parseFloat(d.askPrice)
    out[d.symbol] = bid > 0 && ask > 0 ? (ask - bid) / ((ask + bid) / 2) : 1
  }
  return out
}

export interface PremiumIndexEntry {
  fundingRatePct: number
  markPrice: number
}

export async function fetchAllPremiumIndex(): Promise<Record<string, PremiumIndexEntry>> {
  const data = await getJson('/fapi/v1/premiumIndex')
  const out: Record<string, PremiumIndexEntry> = {}
  for (const d of data as any[]) {
    out[d.symbol] = { fundingRatePct: parseFloat(d.lastFundingRate) * 100, markPrice: parseFloat(d.markPrice) }
  }
  return out
}
