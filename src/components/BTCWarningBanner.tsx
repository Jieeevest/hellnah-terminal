import { AlertTriangle, ShieldAlert } from 'lucide-react'
import type { Ticker } from '@/types'
import { useFearGreed } from '@/hooks/useFearGreed'
import { computeBTCMarketStatus } from '@/lib/btcMarketStatus'

interface Props {
  tickers: Ticker[]
}

export function BTCWarningBanner({ tickers }: Props) {
  const { data: fgData } = useFearGreed()
  const btcTicker = tickers.find((t) => t.symbol === 'BTCUSDT')
  const btcChange = btcTicker?.priceChangePercent ?? null
  const status = computeBTCMarketStatus(btcChange, fgData?.value ?? null)

  if (status.level === 'safe') return null

  const isDanger = status.level === 'danger'

  return (
    <div
      className={`shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-xs border-b ${
        isDanger
          ? 'bg-red-950/80 border-red-800/60 text-red-300'
          : 'bg-yellow-950/80 border-yellow-800/60 text-yellow-300'
      }`}
    >
      {isDanger ? (
        <ShieldAlert className="w-5 h-5 shrink-0" />
      ) : (
        <AlertTriangle className="w-5 h-5 shrink-0" />
      )}
      <span className={`font-semibold ${isDanger ? 'text-red-200' : 'text-yellow-200'}`}>
        {status.label}:
      </span>
      <span>{status.message}</span>
    </div>
  )
}
