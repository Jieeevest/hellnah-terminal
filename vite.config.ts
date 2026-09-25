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
    },
  },
})
