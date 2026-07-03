import { useState } from 'react'
import { Zap, TrendingUp, DollarSign } from 'lucide-react'
import type { Ticker, Exchange, MarketType } from '@/types'
import { BullishWatchlist } from '@/components/BullishWatchlist'
import { VolumeAnomalyPanel } from '@/components/VolumeAnomalyPanel'
import { FundingRateDashboard } from '@/components/FundingRateDashboard'
import { cn } from '@/lib/utils'

type ScannerTab = 'bullish' | 'volume' | 'funding'

interface Props {
  tickers: Ticker[]
  exchange: Exchange
  marketType: MarketType
  isFutures: boolean
  onSelectCoin: (ticker: Ticker) => void
}

export function ScannerPanel({ tickers, exchange, marketType, isFutures, onSelectCoin }: Props) {
  const [tab, setTab] = useState<ScannerTab>('bullish')

  const tabs: { id: ScannerTab; label: string; icon: React.ReactNode; futuresOnly?: boolean }[] = [
    { id: 'bullish', label: 'Bullish',  icon: <TrendingUp className="h-3 w-3" /> },
    { id: 'volume',  label: 'Volume',   icon: <Zap className="h-3 w-3" /> },
    { id: 'funding', label: 'Funding',  icon: <DollarSign className="h-3 w-3" />, futuresOnly: true },
  ]

  const visibleTabs = tabs.filter((t) => !t.futuresOnly || isFutures)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tabs */}
      <div className="flex border-b border-border shrink-0">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors',
              tab === t.id
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'bullish' && (
          <BullishWatchlist
            tickers={tickers}
            exchange={exchange}
            marketType={marketType}
            onSelectCoin={onSelectCoin}
          />
        )}
        {tab === 'volume' && (
          <VolumeAnomalyPanel
            tickers={tickers}
            exchange={exchange}
            marketType={marketType}
            onSelectCoin={onSelectCoin}
          />
        )}
        {tab === 'funding' && (
          <FundingRateDashboard
            tickers={tickers}
            exchange={exchange}
            onSelectCoin={onSelectCoin}
          />
        )}
      </div>
    </div>
  )
}
