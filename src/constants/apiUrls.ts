const API_DOMAIN = import.meta.env.VITE_API_DOMAIN || ''
const WS_DOMAIN  = import.meta.env.VITE_WS_DOMAIN  || 'wss://hellnah-terminal.id'
const DEV_MODE   = import.meta.env.VITE_DEV_MODE === '1'

export const API_URLS = {
  internal: import.meta.env.VITE_API_URL || 'http://localhost:3001',

  binance: {
    spot:      DEV_MODE ? 'https://api.binance.com/api/v3'      : `${API_DOMAIN}/binance/api/v3`,
    futures:   DEV_MODE ? 'https://fapi.binance.com/fapi/v1'    : `${API_DOMAIN}/binance-futures/fapi/v1`,
    ws:        DEV_MODE ? 'wss://stream.binance.com:9443/ws'     : `${WS_DOMAIN}/binance-ws`,
    wsFutures: DEV_MODE ? 'wss://fstream.binance.com/ws'         : `${WS_DOMAIN}/binance-futures-ws`,
  },

  kucoin: {
    spot:    DEV_MODE ? 'https://api.kucoin.com/api/v1'          : `${API_DOMAIN}/kucoin/api/v1`,
    futures: DEV_MODE ? 'https://api-futures.kucoin.com/api/v1'  : `${API_DOMAIN}/kucoin-futures/api/v1`,
  },

  okx: {
    market: DEV_MODE ? 'https://www.okx.com/api/v5/market'      : `${API_DOMAIN}/okx/api/v5/market`,
    public: DEV_MODE ? 'https://www.okx.com/api/v5/public'      : `${API_DOMAIN}/okx/api/v5/public`,
  },

  cryptoCom: {
    public: DEV_MODE ? 'https://api.crypto.com/exchange/v1/public' : `${API_DOMAIN}/crypto-com/exchange/v1/public`,
  },

  fearGreed: DEV_MODE
    ? 'https://api.alternative.me/fng/?limit=1&format=json'
    : `${API_DOMAIN}/fear-greed/?limit=1&format=json`,

  cryptoNewsRSS: DEV_MODE
    ? ['/dev-proxy/coindesk-rss', '/dev-proxy/cointelegraph-rss']
    : ['https://www.coindesk.com/arc/outboundfeeds/rss/', 'https://cointelegraph.com/rss'],

  lunarCrush: DEV_MODE
    ? '/dev-proxy/lunarcrush'
    : 'https://lunarcrush.com/api4',

  coinGlass: DEV_MODE
    ? '/dev-proxy/coinglass'
    : 'https://open-api.coinglass.com/public/v2',

  coinGeckoGlobal: 'https://api.coingecko.com/api/v3/global',

  tradingView: {
    script: 'https://s3.tradingview.com/tv.js',
  },
}
