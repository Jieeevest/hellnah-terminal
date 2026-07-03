import { useEffect, useRef, memo } from 'react'

interface Props {
  tvSymbol: string
}

declare global {
  interface Window {
    TradingView: { widget: new (config: object) => { remove?: () => void } }
  }
}

let tvReady = false
const pendingCbs: (() => void)[] = []

function loadTvJs(cb: () => void) {
  if (tvReady) { cb(); return }
  pendingCbs.push(cb)
  if (pendingCbs.length > 1) return
  const s = document.createElement('script')
  s.src = 'https://s3.tradingview.com/tv.js'
  s.onload = () => { tvReady = true; pendingCbs.splice(0).forEach((fn) => fn()) }
  document.head.appendChild(s)
}

let _counter = 0

export const TradingChart = memo(function TradingChart({ tvSymbol }: Props) {
  const divId = useRef(`tv_${++_counter}`).current
  const widgetRef = useRef<{ remove?: () => void } | null>(null)

  useEffect(() => {
    loadTvJs(() => {
      try { widgetRef.current?.remove?.() } catch (e) {}
      widgetRef.current = new window.TradingView.widget({
        container_id: divId,
        autosize: true,
        symbol: tvSymbol,
        interval: '15',
        timezone: 'Asia/Jakarta',
        theme: 'dark',
        style: '1',
        locale: 'id',
        toolbar_bg: '#0d111c',
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        save_image: false,
        studies: [
          { id: 'MAExp@tv-basicstudies', inputs: { length: 9 },  overrides: { 'Plot.color': '#f59e0b', 'Plot.linewidth': 1 } },
          { id: 'MAExp@tv-basicstudies', inputs: { length: 21 }, overrides: { 'Plot.color': '#3b82f6', 'Plot.linewidth': 1 } },
          { id: 'MAExp@tv-basicstudies', inputs: { length: 50 }, overrides: { 'Plot.color': '#a855f7', 'Plot.linewidth': 2 } },
          { id: 'MACD@tv-basicstudies',  inputs: { fast_length: 12, slow_length: 26, signal_length: 9 },
            overrides: { 'MACD.color': '#3b82f6', 'Signal.color': '#f59e0b', 'Histogram.color': '#22c55e' } },
          { id: 'StochRSI@tv-basicstudies', inputs: { lengthRSI: 14, lengthStoch: 14, smoothK: 3, smoothD: 3 } },
          { id: 'Supertrend@tv-basicstudies', inputs: { period: 10, Factor: 3 },
            overrides: { 'Supertrend.linewidth': 2 } },
        ],
      })
    })
    return () => { 
      try { widgetRef.current?.remove?.() } catch (e) {}
      widgetRef.current = null 
    }
  }, [tvSymbol])

  return <div id={divId} className="h-full w-full" />
})
