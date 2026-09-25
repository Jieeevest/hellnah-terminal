const API_DOMAIN = import.meta.env.VITE_API_DOMAIN || ''
const WS_DOMAIN  = import.meta.env.VITE_WS_DOMAIN  || 'wss://hellnah-terminal.id'
const DEV_MODE   = import.meta.env.VITE_DEV_MODE === '1'

export const API_URLS = {
  // Backend auto-trading (server/).
  trading: import.meta.env.VITE_TRADING_API_URL || 'http://localhost:3010',
  // Akun paper per strategi — masing-masing proses server sendiri (npm start / npm run start:akun-b).
  tradingAccounts: [
    { id: 'a', label: 'Akun A · Stabil', url: import.meta.env.VITE_TRADING_API_URL || 'http://localhost:3010' },
    { id: 'b', label: 'Akun B · Trailing', url: import.meta.env.VITE_TRADING_API_URL_B || 'http://localhost:3011' },
  ],

  binance: {
    spot:      DEV_MODE ? 'https://api.binance.com/api/v3'      : `${API_DOMAIN}/binance/api/v3`,
    futures:   DEV_MODE ? 'https://fapi.binance.com/fapi/v1'    : `${API_DOMAIN}/binance-futures/fapi/v1`,
    futuresData: DEV_MODE ? 'https://fapi.binance.com/futures/data' : `${API_DOMAIN}/binance-futures/futures/data`,
    ws:        DEV_MODE ? 'wss://stream.binance.com:9443/ws'     : `${WS_DOMAIN}/binance-ws`,
    wsFutures: DEV_MODE ? 'wss://fstream.binance.com/ws'         : `${WS_DOMAIN}/binance-futures-ws`,
  },

  fearGreed: DEV_MODE
    ? 'https://api.alternative.me/fng/?limit=1&format=json'
    : `${API_DOMAIN}/fear-greed/?limit=1&format=json`,

  cryptoNewsRSS: DEV_MODE
    ? ['/dev-proxy/coindesk-rss', '/dev-proxy/cointelegraph-rss']
    : ['https://www.coindesk.com/arc/outboundfeeds/rss/', 'https://cointelegraph.com/rss'],

  coinGeckoGlobal: 'https://api.coingecko.com/api/v3/global',

  tradingView: {
    script: 'https://s3.tradingview.com/tv.js',
  },
}
