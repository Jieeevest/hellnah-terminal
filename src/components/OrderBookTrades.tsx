import type { MarketType } from '@/types'
import { OrderBook } from '@/components/OrderBook'
import { TradeHistory } from '@/components/TradeHistory'
import { useBinanceOrderBook, useBinanceTrades } from '@/hooks/useBinance'
import { useBinanceFutureOrderBook, useBinanceFutureTrades } from '@/hooks/useBinanceFutures'

interface Props {
  symbol: string
  marketType: MarketType
  currentPrice: number
}

// Stream order book & transaksi sengaja dipegang di sini, bukan di Dashboard: update-nya
// sampai ~8x/detik, dan kalau state-nya di Dashboard seluruh halaman (termasuk daftar
// ratusan koin) ikut render ulang tiap update → lag. Stream juga otomatis tertutup saat
// tab ini gak ditampilkan karena komponennya di-unmount.
export function OrderBookTrades({ symbol, marketType, currentPrice }: Props) {
  const isFutures = marketType === 'futures'
  const spotBook = useBinanceOrderBook(isFutures ? '' : symbol)
  const spotTrades = useBinanceTrades(isFutures ? '' : symbol)
  const futBook = useBinanceFutureOrderBook(isFutures ? symbol : '')
  const futTrades = useBinanceFutureTrades(isFutures ? symbol : '')

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-[3] min-h-0">
        <OrderBook orderBook={isFutures ? futBook : spotBook} currentPrice={currentPrice} />
      </div>
      <div className="flex-[2] min-h-0 border-t-4 border-border/60">
        <TradeHistory trades={isFutures ? futTrades : spotTrades} />
      </div>
    </div>
  )
}
