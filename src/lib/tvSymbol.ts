import type { Exchange, MarketType } from '@/types'

export interface TVSource {
  label: string
  symbol: string
}

function extractBase(symbol: string): string {
  return symbol
    .replace(/-USDT-SWAP$/, '')
    .replace(/USDTM$/, '')
    .replace(/-USDT$/, '')
    .replace(/_USDT$/, '')
    .replace(/USDT$/, '')
    .replace(/USD-PERP$/, '')
    .replace(/PERP$/, '')
    .replace(/-USD$/, '')
    .toUpperCase()
}

export function getTVSources(
  symbol: string,
  exchange: Exchange,
  marketType: MarketType
): TVSource[] {
  const base = extractBase(symbol)
  const isFut = marketType === 'futures'
  const suffix = isFut ? '.P' : ''

  const candidates: TVSource[] = [
    { label: 'Binance',  symbol: `BINANCE:${base}USDT${suffix}` },
    { label: 'OKX',      symbol: `OKX:${base}USDT${suffix}` },
    { label: 'KuCoin',   symbol: `KUCOIN:${base}USDT${suffix}` },
    { label: 'Bybit',    symbol: `BYBIT:${base}USDT${suffix}` },
    { label: 'Coinbase', symbol: isFut ? `COINBASE:${base}USD.P` : `COINBASE:${base}USD` },
  ]

  // Put the currently selected exchange first
  const primaryLabel: Record<Exchange, string> = {
    binance: 'Binance',
    cryptocom: 'Binance',   // Crypto.com has very limited TV coverage → fallback ke Binance
    kucoin: 'KuCoin',
    okx: 'OKX',
  }

  const preferred = primaryLabel[exchange]
  const sorted = [
    ...candidates.filter((c) => c.label === preferred),
    ...candidates.filter((c) => c.label !== preferred),
  ]

  // Deduplicate by symbol
  const seen = new Set<string>()
  return sorted.filter((c) => { if (seen.has(c.symbol)) return false; seen.add(c.symbol); return true })
}
