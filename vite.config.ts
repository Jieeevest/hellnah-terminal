import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/dev-proxy/coindesk-rss': {
        target: 'https://www.coindesk.com',
        changeOrigin: true,
        rewrite: () => '/arc/outboundfeeds/rss/',
      },
      '/dev-proxy/cointelegraph-rss': {
        target: 'https://cointelegraph.com',
        changeOrigin: true,
        rewrite: () => '/rss',
      },
      '/dev-proxy/lunarcrush': {
        target: 'https://lunarcrush.com',
        changeOrigin: true,
        rewrite: (path) => path.replace('/dev-proxy/lunarcrush', '/api4'),
      },
      '/dev-proxy/coinglass': {
        target: 'https://open-api.coinglass.com',
        changeOrigin: true,
        rewrite: (path) => path.replace('/dev-proxy/coinglass', '/public/v2'),
      },
    },
  },
})
