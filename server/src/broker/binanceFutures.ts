// Endpoint SIGNED Binance Futures (perlu API key+secret) — dipakai TRADING_MODE=live buat
// order execution beneran. Beda dari marketData/binancePublic.ts yang cuma baca data publik.
import { createHmac } from 'node:crypto'

const BASE = 'https://fapi.binance.com'

export interface BinanceCredentials {
  apiKey: string
  apiSecret: string
}

// Pure — gampang di-test tanpa network beneran.
export function signQuery(query: string, apiSecret: string): string {
  return createHmac('sha256', apiSecret).update(query).digest('hex')
}

function decimalPlaces(step: number): number {
  const s = step.toString()
  if (s.includes('e-')) return parseInt(s.split('e-')[1], 10)
  const dot = s.indexOf('.')
  return dot === -1 ? 0 : s.length - dot - 1
}

// String, bukan number — hindari serialisasi float JS (mis. 0.1+0.2 -> "0.30000000000000004")
// yang bakal ditolak Binance karena presisi gak cocok sama stepSize/tickSize simbolnya.
export function formatQuantity(qty: number, stepSize: number): string {
  return qty.toFixed(decimalPlaces(stepSize))
}

export function formatOrderPrice(price: number, tickSize: number): string {
  return price.toFixed(decimalPlaces(tickSize))
}

type ParamValue = string | number | boolean

async function signedRequest(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, ParamValue>,
  creds: BinanceCredentials
): Promise<any> {
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp: String(Date.now()),
    recvWindow: '5000',
  }).toString()
  const signature = signQuery(query, creds.apiSecret)

  const res = await fetch(`${BASE}${path}?${query}&signature=${signature}`, {
    method,
    headers: { 'X-MBX-APIKEY': creds.apiKey },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Binance ${method} ${path} -> HTTP ${res.status} ${JSON.stringify(body)}`)
  }
  return body
}

export interface AccountBalance {
  asset: string
  balance: number
  availableBalance: number
}

export async function fetchAccountBalances(creds: BinanceCredentials): Promise<AccountBalance[]> {
  const data = await signedRequest('GET', '/fapi/v2/balance', {}, creds)
  return (data as any[]).map((d) => ({
    asset: d.asset,
    balance: parseFloat(d.balance),
    availableBalance: parseFloat(d.availableBalance),
  }))
}

// USDT wallet balance — dipakai sebagai "equity" real, gantiin state.equity simulasi di paper mode.
export async function fetchUsdtEquity(creds: BinanceCredentials): Promise<number> {
  const balances = await fetchAccountBalances(creds)
  return balances.find((b) => b.asset === 'USDT')?.balance ?? 0
}

export interface UsdtBalanceSnapshot {
  equity: number
  availableEquity: number
}

// balance = total wallet. availableBalance = SUDAH dihitung Binance sendiri, otomatis
// memperhitungkan margin SEMUA posisi/order yang ada di akun (termasuk yang bukan dibuka
// bot ini) — dipakai sebagai availableEquity, jangan hitung manual dari state.openPositions
// doang (bisa keliru kalau ada posisi lain di akun yang gak bot ini yang buka).
export async function fetchUsdtBalanceSnapshot(creds: BinanceCredentials): Promise<UsdtBalanceSnapshot> {
  const balances = await fetchAccountBalances(creds)
  const usdt = balances.find((b) => b.asset === 'USDT')
  return { equity: usdt?.balance ?? 0, availableEquity: usdt?.availableBalance ?? 0 }
}

// Margin ratio ACCOUNT-WIDE (maintenance margin / margin balance) — sama kayak yang
// ditampilkan Binance UI, ikut menghitung SEMUA posisi di akun (termasuk yang bukan
// dibuka bot ini, mis. posisi manual user) — beda dari maxTotalMarginPct/maxTotalNotionalPct
// di limits.ts yang cuma ngitung dari state.openPositions bot doang.
export async function fetchMarginRatioPct(creds: BinanceCredentials): Promise<number> {
  const data = (await signedRequest('GET', '/fapi/v2/account', {}, creds)) as any
  const maintMargin = parseFloat(data.totalMaintMargin)
  const marginBalance = parseFloat(data.totalMarginBalance)
  return marginBalance > 0 ? (maintMargin / marginBalance) * 100 : 0
}

export interface PositionRisk {
  symbol: string
  positionAmt: number
  entryPrice: number
  leverage: number
  unrealizedProfit: number
  liquidationPrice: number
}

// Cuma balikin posisi yang beneran open (positionAmt != 0) — dipakai buat rekonsiliasi
// state kalau server restart, jangan asumsi state.json paper selalu benar buat mode live.
export async function fetchOpenPositionRisk(creds: BinanceCredentials, symbol?: string): Promise<PositionRisk[]> {
  const data = await signedRequest('GET', '/fapi/v2/positionRisk', symbol ? { symbol } : {}, creds)
  return (data as any[])
    .map((d) => ({
      symbol: d.symbol,
      positionAmt: parseFloat(d.positionAmt),
      entryPrice: parseFloat(d.entryPrice),
      leverage: parseFloat(d.leverage),
      unrealizedProfit: parseFloat(d.unRealizedProfit),
      liquidationPrice: parseFloat(d.liquidationPrice),
    }))
    .filter((p) => p.positionAmt !== 0)
}

export async function setLeverage(creds: BinanceCredentials, symbol: string, leverage: number): Promise<void> {
  await signedRequest('POST', '/fapi/v1/leverage', { symbol, leverage }, creds)
}

// Binance balikin error -4046 "No need to change margin type" kalau udah CROSSED — itu
// bukan kegagalan, cuma informasi state udah sesuai, jadi di-swallow di sini.
export async function setMarginTypeCrossed(creds: BinanceCredentials, symbol: string): Promise<void> {
  try {
    await signedRequest('POST', '/fapi/v1/marginType', { symbol, marginType: 'CROSSED' }, creds)
  } catch (e) {
    if (!(e as Error).message.includes('-4046')) throw e
  }
}

export type OrderSide = 'BUY' | 'SELL'

export interface OrderResult {
  orderId: number
  status: string
  avgPrice: number
  executedQty: number
}

function parseOrderResult(data: any): OrderResult {
  return {
    orderId: data.orderId,
    status: data.status,
    avgPrice: parseFloat(data.avgPrice ?? '0'),
    executedQty: parseFloat(data.executedQty ?? '0'),
  }
}

export async function placeMarketOrder(
  creds: BinanceCredentials,
  symbol: string,
  side: OrderSide,
  quantity: number,
  stepSize: number
): Promise<OrderResult> {
  const data = await signedRequest(
    'POST',
    '/fapi/v1/order',
    { symbol, side, type: 'MARKET', quantity: formatQuantity(quantity, stepSize) },
    creds
  )
  return parseOrderResult(data)
}

// Binance migrasi WAJIB (efektif 2025-12-09) — order kondisional (STOP_MARKET,
// TAKE_PROFIT_MARKET, dst) gak bisa lagi lewat /fapi/v1/order (ditolak -4120
// STOP_ORDER_SWITCH_ALGO), harus lewat /fapi/v1/algoOrder. Signing SAMA (HMAC-SHA256 +
// X-MBX-APIKEY), cuma path & 1 param tambahan (algoType=CONDITIONAL) yang beda.
export interface AlgoOrderResult {
  algoId: number
}

function parseAlgoOrderResult(data: any): AlgoOrderResult {
  return { algoId: data.algoId }
}

// closePosition=true -> nutup SELURUH posisi begitu triggerPrice kesentuh, gak butuh
// quantity (Binance nolak quantity dikirim bareng closePosition=true). Pas buat
// single-bracket TP1/SL kita (TP1_PORTION=1 di futuresEngine.ts) — gak ada partial qty
// yang perlu dijaga terpisah. CATATAN: param-nya "triggerPrice", BUKAN "stopPrice" seperti
// di endpoint /fapi/v1/order klasik — beda nama param ini yang bikin -1102 kalau salah kirim.
export async function placeStopMarketClose(
  creds: BinanceCredentials,
  symbol: string,
  side: OrderSide,
  triggerPrice: number,
  tickSize: number
): Promise<AlgoOrderResult> {
  const data = await signedRequest(
    'POST',
    '/fapi/v1/algoOrder',
    {
      algoType: 'CONDITIONAL',
      symbol,
      side,
      type: 'STOP_MARKET',
      triggerPrice: formatOrderPrice(triggerPrice, tickSize),
      closePosition: true,
      workingType: 'MARK_PRICE',
    },
    creds
  )
  return parseAlgoOrderResult(data)
}

export async function placeTakeProfitMarketClose(
  creds: BinanceCredentials,
  symbol: string,
  side: OrderSide,
  triggerPrice: number,
  tickSize: number
): Promise<AlgoOrderResult> {
  const data = await signedRequest(
    'POST',
    '/fapi/v1/algoOrder',
    {
      algoType: 'CONDITIONAL',
      symbol,
      side,
      type: 'TAKE_PROFIT_MARKET',
      triggerPrice: formatOrderPrice(triggerPrice, tickSize),
      closePosition: true,
      workingType: 'MARK_PRICE',
    },
    creds
  )
  return parseAlgoOrderResult(data)
}

export interface OrderStatus {
  orderId: number
  status: string
  avgPrice: number
}

export async function fetchOrderStatus(creds: BinanceCredentials, symbol: string, orderId: number): Promise<OrderStatus> {
  const data = await signedRequest('GET', '/fapi/v1/order', { symbol, orderId }, creds)
  return { orderId: data.orderId, status: data.status, avgPrice: parseFloat(data.avgPrice ?? '0') }
}

export interface AlgoOrderStatus {
  algoId: number
  algoStatus: string // 'NEW' | 'TRIGGERED' | 'CANCELED' | 'EXPIRED'
  actualOrderId: number | null // keisi begitu algoStatus='TRIGGERED' -> order asli yang di-spawn
}

// GET /fapi/v1/algoOrder SENGAJA gak butuh symbol (beda dari GET /fapi/v1/order) — cukup
// algoId. Begitu TRIGGERED, actualOrderId itulah order asli yang beneran fill — harga fill
// akurat diambil dari situ (fetchOrderStatus), bukan dari field algo order ini (dokumentasi
// avgPrice/actualQty di endpoint algo lebih tipis daripada endpoint order klasik).
export async function fetchAlgoOrderStatus(creds: BinanceCredentials, algoId: number): Promise<AlgoOrderStatus> {
  const data = await signedRequest('GET', '/fapi/v1/algoOrder', { algoId }, creds)
  return {
    algoId: data.algoId,
    algoStatus: data.algoStatus,
    actualOrderId: data.actualOrderId ? Number(data.actualOrderId) : null,
  }
}

// -2011 "Unknown order sent" -> order itu udah kefill/kecancel duluan (mis. bracket
// lawannya kena duluan) — bukan error fatal, aman diabaikan.
export async function cancelOrder(creds: BinanceCredentials, symbol: string, orderId: number): Promise<void> {
  try {
    await signedRequest('DELETE', '/fapi/v1/order', { symbol, orderId }, creds)
  } catch (e) {
    if (!(e as Error).message.includes('-2011')) throw e
  }
}

// Kode error spesifik buat "algo order udah triggered, gak ada yang dibatalkan" belum
// dikonfirmasi di dokumentasi Binance — di-treat generik: gagal cancel di sini gak fatal,
// paling buruk algo order itu emang udah gak aktif lagi (which is fine, itu tujuannya).
export async function cancelAlgoOrder(creds: BinanceCredentials, algoId: number): Promise<void> {
  try {
    await signedRequest('DELETE', '/fapi/v1/algoOrder', { algoId }, creds)
  } catch {
    // sengaja diabaikan — lihat catatan di atas
  }
}

// Market order reduceOnly — dipakai TIME_STOP di live mode (cancel 2 bracket order duluan,
// baru ini, biar posisi ditutup paksa di harga pasar).
export async function placeMarketReduceOnlyClose(
  creds: BinanceCredentials,
  symbol: string,
  side: OrderSide,
  quantity: number,
  stepSize: number
): Promise<OrderResult> {
  const data = await signedRequest(
    'POST',
    '/fapi/v1/order',
    { symbol, side, type: 'MARKET', quantity: formatQuantity(quantity, stepSize), reduceOnly: true },
    creds
  )
  return parseOrderResult(data)
}
