import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { BookOpen, Clock, BarChart2, LayoutGrid, Square, Plus, Scan, LogOut, ShieldAlert, User, Crown, Ticket, HelpCircle, Newspaper, Bell, Radio, Zap, Play, TrendingUp, Scale } from 'lucide-react'

import { useAuth } from '@/store/useAuth'
import { ProGate } from '@/components/ProGate'
import { CoinList } from '@/components/CoinList'
import { TradingChart } from '@/components/TradingChart'
import { DashboardGrid } from '@/components/DashboardGrid'
import { OrderBook } from '@/components/OrderBook'
import { TradeHistory } from '@/components/TradeHistory'
import { SignalPanel } from '@/components/SignalPanel'
import { BacktestPanel } from '@/components/BacktestPanel'
import { VolumeAnomalyPanel } from '@/components/VolumeAnomalyPanel'
import { FundingRateDashboard } from '@/components/FundingRateDashboard'
import { HeatmapPanel } from '@/components/HeatmapPanel'


// Spot hooks
import { useBinanceTickers, useBinanceOrderBook, useBinanceTrades, useBinancePrice } from '@/hooks/useBinance'
import { useCryptoComTickers, useCryptoComOrderBook, useCryptoComTrades } from '@/hooks/useCryptoCom'
import { useKuCoinTickers, useKuCoinOrderBook, useKuCoinTrades } from '@/hooks/useKuCoin'
import { useOKXTickers, useOKXOrderBook, useOKXTrades } from '@/hooks/useOKX'

// Futures hooks
import { useBinanceFutureTickers, useBinanceFutureOrderBook, useBinanceFutureTrades, useBinanceFuturePrice } from '@/hooks/useBinanceFutures'
import { useCryptoComFutureTickers, useCryptoComFutureOrderBook, useCryptoComFutureTrades } from '@/hooks/useCryptoComFutures'
import { useKuCoinFutureTickers, useKuCoinFutureOrderBook, useKuCoinFutureTrades } from '@/hooks/useKuCoinFutures'
import { useOKXFutureTickers, useOKXFutureOrderBook, useOKXFutureTrades } from '@/hooks/useOKXFutures'

import { FuturesOpportunitiesPanel } from '@/components/FuturesOpportunitiesPanel'
import { BTCWarningBanner } from '@/components/BTCWarningBanner'
import { CryptoNewsPanel } from '@/components/CryptoNewsPanel'
import { ScannerPanel } from '@/components/ScannerPanel'
import { PriceAlertPanel } from '@/components/PriceAlertPanel'
import { LunarCrushPanel } from '@/components/LunarCrushPanel'
import { CoinGlassPanel } from '@/components/CoinGlassPanel'
import { usePriceAlerts } from '@/hooks/usePriceAlerts'
import { useTechnicalAlerts, useTechnicalAlertChecker } from '@/hooks/useTechnicalAlerts'
import { useBTCDominance } from '@/hooks/useBTCDominance'

type RightTab = 'orderbook' | 'trades' | 'signal' | 'backtest' | 'scanner' | 'opportunities' | 'news' | 'alert' | 'social' | 'volume' | 'funding' | 'heatmap' | 'coinglass'
type MobileView = 'coins' | 'chart' | 'panel'

import type { Ticker, Exchange, MarketType } from '@/types'
import { cn } from '@/lib/utils'
import { getTVSources } from '@/lib/tvSymbol'
import { useSessionGuard } from '@/hooks/useSessionGuard'
import { useSubscriptionSync } from '@/hooks/useSubscriptionSync'
import { Logo } from '@/components/Logo'
import { TutorialStepper, STEPS } from '@/components/TutorialStepper'
import { useTutorial } from '@/hooks/useTutorial'


const EXCHANGES: { id: Exchange; label: string; color: string }[] = [
  { id: 'binance', label: 'Binance', color: '#F0B90B' },
  { id: 'cryptocom', label: 'Crypto.com', color: '#1199FA' },
  { id: 'kucoin', label: 'KuCoin', color: '#23AF91' },
  { id: 'okx', label: 'OKX', color: '#A0A0A0' },
]

const DEFAULT_SPOT_SYMBOLS: Record<Exchange, string> = {
  binance: 'BTCUSDT',
  cryptocom: 'BTC_USDT',
  kucoin: 'BTC-USDT',
  okx: 'BTC-USDT',
}

const DEFAULT_FUTURES_SYMBOLS: Record<Exchange, string> = {
  binance: 'BTCUSDT',
  cryptocom: 'BTCUSD-PERP',
  kucoin: 'XBTUSDTM',
  okx: 'BTC-USDT-SWAP',
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  useSessionGuard()
  const { subscriptionExpired } = useSubscriptionSync()

  const [exchange, setExchange] = useState<Exchange>('binance')
  const [marketType, setMarketType] = useState<MarketType>('spot')
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null)
  const [symbol, setSymbol] = useState(DEFAULT_SPOT_SYMBOLS.binance)
  const [currentPrice, setCurrentPrice] = useState(0)
  const [rightTab, setRightTab] = useState<RightTab>('orderbook')
  const [tvSourceIdx, setTvSourceIdx] = useState(0)
  const [chartMode, setChartMode] = useState<'single' | 'grid'>('single')
  const [gridSymbols, setGridSymbols] = useState<{ symbol: string; tvSymbol: string }[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const [mobileView, setMobileView] = useState<MobileView>('chart')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)

  const { isActive: tutorialActive, currentStep: tutorialStep, nextStep: tutorialNext, prevStep: tutorialPrev, skip: tutorialSkip, restart: tutorialRestart } = useTutorial()
  const { alerts, addAlert, removeAlert, clearTriggered, checkAlerts, requestPermission } = usePriceAlerts()
  const { alerts: techAlerts, addAlert: addTechAlert, removeAlert: removeTechAlert, markTriggered: markTechTriggered, clearTriggered: clearTechTriggered } = useTechnicalAlerts()
  useTechnicalAlertChecker(techAlerts, (id, msg) => {
    markTechTriggered(id)
    if (Notification.permission === 'granted') new Notification('Hellnah Terminal Alert', { body: msg })
  })
  const btcDominance = useBTCDominance()

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (currentPrice > 0 && symbol) checkAlerts(symbol, currentPrice)
  }, [currentPrice, symbol, checkAlerts])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    logout()
    navigate('/login')
  }

  // ── Spot data ──────────────────────────────────────────────────────────
  const { tickers: binanceSpotTickers, loading: binanceSpotLoading } = useBinanceTickers()
  const binanceSpotOB = useBinanceOrderBook(exchange === 'binance' && marketType === 'spot' ? symbol : '')
  const binanceSpotTrades = useBinanceTrades(exchange === 'binance' && marketType === 'spot' ? symbol : '')
  useBinancePrice(exchange === 'binance' && marketType === 'spot' ? symbol : '', setCurrentPrice)

  const { tickers: cryptoComSpotTickers, loading: cryptoComSpotLoading } = useCryptoComTickers()
  const cryptoComSpotOB = useCryptoComOrderBook(exchange === 'cryptocom' && marketType === 'spot' ? symbol : '')
  const cryptoComSpotTrades = useCryptoComTrades(exchange === 'cryptocom' && marketType === 'spot' ? symbol : '')

  const { tickers: kucoinSpotTickers, loading: kucoinSpotLoading } = useKuCoinTickers()
  const kucoinSpotOB = useKuCoinOrderBook(exchange === 'kucoin' && marketType === 'spot' ? symbol : '')
  const kucoinSpotTrades = useKuCoinTrades(exchange === 'kucoin' && marketType === 'spot' ? symbol : '')

  const { tickers: okxSpotTickers, loading: okxSpotLoading } = useOKXTickers()
  const okxSpotOB = useOKXOrderBook(exchange === 'okx' && marketType === 'spot' ? symbol : '')
  const okxSpotTrades = useOKXTrades(exchange === 'okx' && marketType === 'spot' ? symbol : '')

  // ── Futures data ───────────────────────────────────────────────────────
  const { tickers: binanceFutTickers, loading: binanceFutLoading } = useBinanceFutureTickers()
  const binanceFutOB = useBinanceFutureOrderBook(exchange === 'binance' && marketType === 'futures' ? symbol : '')
  const binanceFutTrades = useBinanceFutureTrades(exchange === 'binance' && marketType === 'futures' ? symbol : '')
  useBinanceFuturePrice(exchange === 'binance' && marketType === 'futures' ? symbol : '', setCurrentPrice)

  const { tickers: cryptoComFutTickers, loading: cryptoComFutLoading } = useCryptoComFutureTickers()
  const cryptoComFutOB = useCryptoComFutureOrderBook(exchange === 'cryptocom' && marketType === 'futures' ? symbol : '')
  const cryptoComFutTrades = useCryptoComFutureTrades(exchange === 'cryptocom' && marketType === 'futures' ? symbol : '')

  const { tickers: kucoinFutTickers, loading: kucoinFutLoading } = useKuCoinFutureTickers()
  const kucoinFutOB = useKuCoinFutureOrderBook(exchange === 'kucoin' && marketType === 'futures' ? symbol : '')
  const kucoinFutTrades = useKuCoinFutureTrades(exchange === 'kucoin' && marketType === 'futures' ? symbol : '')

  const { tickers: okxFutTickers, loading: okxFutLoading } = useOKXFutureTickers()
  const okxFutOB = useOKXFutureOrderBook(exchange === 'okx' && marketType === 'futures' ? symbol : '')
  const okxFutTrades = useOKXFutureTrades(exchange === 'okx' && marketType === 'futures' ? symbol : '')

  // ── Active data selectors ──────────────────────────────────────────────
  const activeTickers = marketType === 'spot'
    ? { binance: binanceSpotTickers, cryptocom: cryptoComSpotTickers, kucoin: kucoinSpotTickers, okx: okxSpotTickers }[exchange]
    : { binance: binanceFutTickers, cryptocom: cryptoComFutTickers, kucoin: kucoinFutTickers, okx: okxFutTickers }[exchange]

  const activeLoading = marketType === 'spot'
    ? { binance: binanceSpotLoading, cryptocom: cryptoComSpotLoading, kucoin: kucoinSpotLoading, okx: okxSpotLoading }[exchange]
    : { binance: binanceFutLoading, cryptocom: cryptoComFutLoading, kucoin: kucoinFutLoading, okx: okxFutLoading }[exchange]

  const activeOrderBook = marketType === 'spot'
    ? { binance: binanceSpotOB, cryptocom: cryptoComSpotOB, kucoin: kucoinSpotOB, okx: okxSpotOB }[exchange]
    : { binance: binanceFutOB, cryptocom: cryptoComFutOB, kucoin: kucoinFutOB, okx: okxFutOB }[exchange]

  const activeTrades = marketType === 'spot'
    ? { binance: binanceSpotTrades, cryptocom: cryptoComSpotTrades, kucoin: kucoinSpotTrades, okx: okxSpotTrades }[exchange]
    : { binance: binanceFutTrades, cryptocom: cryptoComFutTrades, kucoin: kucoinFutTrades, okx: okxFutTrades }[exchange]

  // Sync price from ticker list for non-WS exchanges
  useEffect(() => {
    if ((exchange !== 'binance' || marketType !== 'spot') && selectedTicker) {
      const updated = activeTickers.find((t) => t.symbol === selectedTicker.symbol)
      if (updated) setCurrentPrice(updated.price)
    }
  }, [activeTickers, exchange, marketType, selectedTicker])

  const handleExchangeChange = (ex: Exchange) => {
    setExchange(ex)
    const sym = marketType === 'spot' ? DEFAULT_SPOT_SYMBOLS[ex] : DEFAULT_FUTURES_SYMBOLS[ex]
    setSymbol(sym)
    setSelectedTicker(null)
    setCurrentPrice(0)
    setTvSourceIdx(0)
  }

const handleMarketTypeChange = (mt: MarketType) => {
  setMarketType(mt)
  const sym = mt === 'spot' ? DEFAULT_SPOT_SYMBOLS[exchange] : DEFAULT_FUTURES_SYMBOLS[exchange]
  setSymbol(sym)
  setSelectedTicker(null)
  setCurrentPrice(0)
  setTvSourceIdx(0)
}
  const handleSelectCoin = (ticker: Ticker) => {
    setSelectedTicker(ticker)
    setSymbol(ticker.symbol)
    setCurrentPrice(ticker.price)
    setTvSourceIdx(0)
    setChartMode('single')
  }


  const activeExchangeInfo = EXCHANGES.find((e) => e.id === exchange)!
  const isFutures = marketType === 'futures'

  const tvSources = getTVSources(symbol, exchange, marketType)
  const activeTvSource = tvSources[tvSourceIdx % tvSources.length]

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background overflow-hidden">
        {/* Subscription expired banner */}
        {subscriptionExpired && (
          <div className="shrink-0 flex items-center justify-center gap-2 bg-red-950/80 border-b border-red-800/60 px-4 py-2 text-xs text-red-300">
            <span className="font-semibold text-red-200">Subscription PRO kamu sudah habis.</span>
            <a href="/profile" className="underline underline-offset-2 font-bold text-orange-300 hover:text-orange-200">Perbarui sekarang</a>
          </div>
        )}
        <BTCWarningBanner tickers={binanceSpotTickers} />
        {/* Header Minimal */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
          <Logo className="h-6 w-auto" variant='horizontal'/>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md overflow-hidden border border-border">
              {(['spot', 'futures'] as MarketType[]).map((mt) => (
                <button
                  key={mt}
                  onClick={() => handleMarketTypeChange(mt)}
                  className={cn('px-2 py-1 text-[10px] font-bold', marketType === mt ? (mt === 'spot' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400') : 'text-muted-foreground hover:bg-muted/50')}
                >
                  {mt === 'spot' ? 'Spot' : 'Futures'}
                </button>
              ))}
            </div>
            <button
              onClick={tutorialRestart}
              className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Lihat tour fitur"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-full bg-gold-gradient flex items-center justify-center text-xs font-bold text-white shadow-inner">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Exchange Bar */}
        <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-card shrink-0 overflow-x-auto">
          {EXCHANGES.map((ex) => (
            <button key={ex.id} onClick={() => handleExchangeChange(ex.id)} className={cn('px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap', exchange === ex.id ? 'bg-muted text-foreground' : 'text-muted-foreground')}>
              <span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5" style={{ backgroundColor: ex.color }} />
              {ex.label}
            </button>
          ))}
          <div className="flex-1" />
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0', isFutures ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400')}>
            {isFutures ? 'PERPETUAL' : 'SPOT'}
          </span>
        </div>

        {/* Main Content Area - Using CSS hidden instead of unmounting to preserve Chart iframe */}
        <div className="flex-1 overflow-hidden min-h-0 relative">
          
          {/* COINS */}
          <div className={cn("absolute inset-0 flex flex-col bg-background", mobileView === 'coins' ? 'z-10' : 'hidden')}>
            <div className="px-3 py-1.5 text-[10px] font-semibold border-b border-border flex items-center justify-between">
              <span style={{ color: activeExchangeInfo.color }}>{activeExchangeInfo.label}</span>
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded', isFutures ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400')}>
                {isFutures ? 'Futures' : 'Spot'} · {activeTickers.length}
              </span>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              <CoinList tickers={activeTickers} loading={activeLoading} selectedSymbol={symbol} exchange={exchange} marketType={marketType} onSelect={(ticker) => { handleSelectCoin(ticker); setMobileView('chart') }} />
            </div>
          </div>

          {/* CHART */}
          <div className={cn("absolute inset-0 flex flex-col bg-background", mobileView === 'chart' ? 'z-10' : 'hidden')}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0 flex-wrap">
              <span className="font-bold text-foreground text-sm">{selectedTicker?.baseAsset ?? 'BTC'}/{isFutures ? 'PERP' : 'USDT'}</span>
              {selectedTicker && (
                <>
                  <span className={cn('text-sm font-bold font-mono', selectedTicker.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                  </span>
                  <span className={cn('text-xs', selectedTicker.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {selectedTicker.priceChangePercent >= 0 ? '+' : ''}{selectedTicker.priceChangePercent.toFixed(2)}%
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-muted/30 shrink-0 overflow-x-auto">
              <span className="text-[10px] text-muted-foreground mr-1">Sumber:</span>
              {tvSources.map((src, i) => (
                <button key={src.symbol} onClick={() => setTvSourceIdx(i)} className={cn('px-2 py-0.5 text-[10px] rounded transition-colors whitespace-nowrap', i === tvSourceIdx % tvSources.length ? 'bg-primary/20 text-primary font-medium' : 'text-muted-foreground hover:bg-muted')}>{src.label}</button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden min-h-0 relative">
              <TradingChart tvSymbol={activeTvSource.symbol} />
            </div>
          </div>

          {/* PANEL */}
          <div className={cn("absolute inset-0 flex flex-col bg-background", mobileView === 'panel' ? 'z-10' : 'hidden')}>
            <div className="flex overflow-x-auto scrollbar-none border-b border-border shrink-0">
              {([
                { id: 'orderbook', icon: <BookOpen className="h-3 w-3" />, label: 'Book',    pro: false },
                { id: 'trades',    icon: <Clock className="h-3 w-3" />,    label: 'Trade',   pro: false },
                { id: 'signal',    icon: <BarChart2 className="h-3 w-3" />,label: 'Analisa', pro: true },
                { id: 'scanner',   icon: <Scan className="h-3 w-3" />,     label: 'Scan',    pro: true },
                { id: 'heatmap',   icon: <LayoutGrid className="h-3 w-3" />,label: 'Map',    pro: false },
                { id: 'volume',    icon: <Zap className="h-3 w-3" />,      label: 'Anomali', pro: false },
                { id: 'funding',   icon: <TrendingUp className="h-3 w-3" />,label: 'Fund',   pro: true },
                { id: 'coinglass', icon: <Scale className="h-3 w-3" />,    label: 'OI',      pro: false },
                { id: 'news',      icon: <Newspaper className="h-3 w-3" />,label: 'Berita',  pro: false },
                { id: 'alert',     icon: <Bell className="h-3 w-3" />,     label: 'Alert',   pro: false },
                { id: 'social',    icon: <Radio className="h-3 w-3" />,    label: 'Sosial',  pro: false },
                { id: 'backtest',  icon: <Play className="h-3 w-3" />,     label: 'Backtest',pro: true },
              ] as { id: RightTab; icon: React.ReactNode; label: string; pro: boolean }[]).map((tab) => (
                <button key={tab.id} onClick={() => setRightTab(tab.id)} className={cn('shrink-0 px-2.5 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors relative', rightTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground')}>
                  {tab.icon}
                  {tab.label}
                  {tab.pro && user?.subscription_tier !== 'pro' && <Crown className="h-2 w-2 text-yellow-500 absolute top-1 right-1" />}
                </button>
              ))}
            </div>

            {/* Coin info bar — shown on Analisa tab when a coin is selected */}
            {rightTab === 'signal' && selectedTicker && (
              <div className="flex flex-col px-3 py-2 border-b border-border bg-card/50 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground text-sm">
                      {selectedTicker.baseAsset}/{isFutures ? 'PERP' : 'USDT'}
                    </span>
                    <span className={cn('text-sm font-bold font-mono', selectedTicker.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                    </span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', selectedTicker.priceChangePercent >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400')}>
                      {selectedTicker.priceChangePercent >= 0 ? '+' : ''}{selectedTicker.priceChangePercent.toFixed(2)}%
                    </span>
                  </div>
                  <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0', isFutures ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400')}>
                    {isFutures ? 'PERP' : 'SPOT'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span>H: <span className="text-foreground/70">{selectedTicker.high24h.toFixed(4)}</span></span>
                  <span>L: <span className="text-foreground/70">{selectedTicker.low24h.toFixed(4)}</span></span>
                  {isFutures && selectedTicker.fundingRate !== undefined ? (
                    <span className={selectedTicker.fundingRate >= 0 ? 'text-green-400' : 'text-red-400'}>
                      Fund: {selectedTicker.fundingRate >= 0 ? '+' : ''}{selectedTicker.fundingRate.toFixed(4)}%
                    </span>
                  ) : (
                    <span>Vol: <span className="text-foreground/70">{(selectedTicker.volume / 1_000_000).toFixed(2)}M</span></span>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-hidden min-h-0">
              {/* FuturesOpportunitiesPanel — always mounted when isFutures to preserve scan state */}
              <div className={cn('h-full', !(rightTab === 'signal' && isFutures) && 'hidden')}>
                <ProGate feature="Futures Long/Short Opportunities">
                  <FuturesOpportunitiesPanel
                    tickers={activeTickers}
                    exchange={exchange}
                    active={rightTab === 'signal'}
                    onSelectCoin={(ticker) => { handleSelectCoin(ticker); setMobileView('chart') }}
                  />
                </ProGate>
              </div>

              {rightTab === 'signal' && !isFutures ? (
                <ProGate feature="Panel Sinyal Trading">
                  <SignalPanel ticker={selectedTicker} exchange={exchange} marketType={marketType} currentPrice={currentPrice} btcChangePercent={binanceSpotTickers.find(t => t.symbol === 'BTCUSDT')?.priceChangePercent ?? null} />
                </ProGate>
              ) : rightTab === 'scanner' ? (
                <ProGate feature="Scanner">
                  <ScannerPanel tickers={activeTickers} exchange={exchange} marketType={marketType} isFutures={isFutures} onSelectCoin={(ticker) => { handleSelectCoin(ticker); setMobileView('chart') }} />
                </ProGate>
              ) : rightTab === 'news' ? (
                <CryptoNewsPanel selectedCoin={selectedTicker?.baseAsset ?? null} />
              ) : rightTab === 'alert' ? (
                <PriceAlertPanel
                  ticker={selectedTicker}
                  currentPrice={currentPrice}
                  exchange={exchange}
                  marketType={marketType}
                  alerts={alerts}
                  onAdd={addAlert}
                  onRemove={removeAlert}
                  onClearTriggered={clearTriggered}
                  onRequestPermission={requestPermission}
                  technicalAlerts={techAlerts}
                  onAddTechnical={addTechAlert}
                  onRemoveTechnical={removeTechAlert}
                  onClearTriggeredTechnical={clearTechTriggered}
                />
              ) : rightTab === 'social' ? (
                <LunarCrushPanel
                  selectedCoin={selectedTicker?.baseAsset ?? null}
                  tickers={activeTickers}
                  onSelectCoin={(baseAsset) => {
                    const t = activeTickers.find((tk) => tk.baseAsset === baseAsset)
                    if (t) { handleSelectCoin(t); setMobileView('chart') }
                  }}
                />
              ) : rightTab === 'heatmap' ? (
                <HeatmapPanel tickers={activeTickers} onSelectCoin={(t) => { handleSelectCoin(t); setMobileView('chart') }} />
              ) : rightTab === 'coinglass' ? (
                <CoinGlassPanel baseAsset={selectedTicker?.baseAsset ?? null} />
              ) : rightTab === 'volume' ? (
                <VolumeAnomalyPanel tickers={activeTickers} exchange={exchange} marketType={marketType} onSelectCoin={(t) => { handleSelectCoin(t); setMobileView('chart') }} />
              ) : rightTab === 'funding' ? (
                <ProGate feature="Funding Rate Dashboard">
                  <FundingRateDashboard tickers={activeTickers} exchange={exchange} onSelectCoin={(t) => { handleSelectCoin(t); setMobileView('chart') }} />
                </ProGate>
              ) : rightTab === 'backtest' ? (
                <ProGate feature="Backtest">
                  <BacktestPanel ticker={selectedTicker} exchange={exchange} marketType={marketType} />
                </ProGate>
              ) : rightTab === 'orderbook' ? (
                <OrderBook orderBook={activeOrderBook} currentPrice={currentPrice} onPriceClick={() => {}} />
              ) : rightTab !== 'signal' ? (
                <TradeHistory trades={activeTrades} />
              ) : null}
            </div>
          </div>
        </div>

        {/* Bottom Nav */}
        <div className="flex border-t border-border bg-card shrink-0 pb-safe">
          {[
            { id: 'coins' as const, icon: <Scan className="w-5 h-5" />, label: 'Koin' },
            { id: 'chart' as const, icon: <BarChart2 className="w-5 h-5" />, label: 'Chart' },
            { id: 'panel' as const, icon: <BookOpen className="w-5 h-5" />, label: 'Panel' }
          ].map((item) => (
            <button key={item.id} onClick={() => setMobileView(item.id)} className={cn('flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors', mobileView === item.id ? 'text-primary' : 'text-muted-foreground')}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <TutorialStepper
          isActive={tutorialActive}
          currentStep={tutorialStep}
          onNext={() => tutorialNext(STEPS.length)}
          onPrev={tutorialPrev}
          onSkip={tutorialSkip}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Subscription expired banner */}
      {subscriptionExpired && (
        <div className="shrink-0 flex items-center justify-center gap-3 bg-red-950/80 border-b border-red-800/60 px-4 py-2 text-sm text-red-300">
          <span className="font-semibold text-red-200">Subscription PRO kamu sudah habis.</span>
          <a href="/profile" className="underline underline-offset-2 font-bold text-orange-300 hover:text-orange-200">Perbarui sekarang →</a>
        </div>
      )}
      <BTCWarningBanner tickers={binanceSpotTickers} />
      {/* Navbar */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2 mr-1">
          <Logo className="h-8 w-auto" variant='horizontal'/>
          {/* <span className="font-bold text-foreground text-sm">Hellnah Terminal</span> */}
        </div>

        {/* Spot / Futures toggle */}
        <div className="flex rounded-md overflow-hidden border border-border" data-tutorial="market-type">
          {(['spot', 'futures'] as MarketType[]).map((mt) => (
            <motion.button
              key={mt}
              onClick={() => handleMarketTypeChange(mt)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold transition-colors',
                marketType === mt
                  ? mt === 'spot'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              whileTap={{ scale: 0.96 }}
            >
              {mt === 'spot' ? 'Spot' : 'Futures'}
            </motion.button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Chart Mode toggle */}
        <div className="flex rounded-md overflow-hidden border border-border" data-tutorial="chart-mode">
          <motion.button
            onClick={() => setChartMode('single')}
            className={cn(
              'px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-semibold transition-colors',
              chartMode === 'single'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            whileTap={{ scale: 0.96 }}
          >
            <Square className="h-3.5 w-3.5" />
            Single
          </motion.button>
          <motion.button
            onClick={() => user?.subscription_tier === 'pro' ? setChartMode('grid') : null}
            className={cn(
              'px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-semibold transition-colors',
              chartMode === 'grid'
                ? 'bg-primary/20 text-primary'
                : user?.subscription_tier === 'pro'
                  ? 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  : 'text-muted-foreground/40 cursor-not-allowed'
            )}
            whileTap={{ scale: user?.subscription_tier === 'pro' ? 0.96 : 1 }}
            title={user?.subscription_tier !== 'pro' ? 'Fitur PRO — Upgrade untuk Grid Mode' : undefined}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
            {user?.subscription_tier !== 'pro' && <Crown className="h-2.5 w-2.5 text-yellow-500" />}
          </motion.button>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Exchange tabs */}
        <div className="flex gap-1" data-tutorial="exchange-tabs">
          {EXCHANGES.map((ex) => (
            <motion.button
              key={ex.id}
              onClick={() => handleExchangeChange(ex.id)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                exchange === ex.id
                  ? 'bg-muted text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              whileTap={{ scale: 0.96 }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: ex.color, opacity: exchange === ex.id ? 1 : 0.5 }}
              />
              {ex.label}
            </motion.button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Market type badge */}
        <div className={cn(
          'text-[10px] px-2 py-0.5 rounded font-semibold hidden md:block',
          isFutures ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
        )}>
          {isFutures ? 'PERPETUAL' : 'SPOT'}
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground mr-4">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live
        </div>

        {btcDominance != null && (
          <div className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 px-2 py-1 rounded mr-2 border border-border/50">
            <span className="font-semibold text-orange-400">BTC</span>
            <span className="font-mono">{btcDominance.toFixed(1)}%</span>
            <span className="text-muted-foreground/60">dom</span>
          </div>
        )}

        <button
          onClick={tutorialRestart}
          title="Lihat tour fitur"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors rounded-md border border-border mr-1"
        >
          <HelpCircle className="w-3.5 h-3.5" /> Tour
        </button>

        <button
          onClick={() => navigate('/support')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors rounded-md border border-primary/20 mr-2"
        >
          <Ticket className="w-3.5 h-3.5" /> Support CS
        </button>

        <div className="w-px h-4 bg-border mr-2" />

        {/* User Profile */}
        <div className="relative" ref={profileRef} data-tutorial="user-profile">
          <button 
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 hover:bg-white/5 p-1 pr-3 rounded-full transition-colors border border-transparent hover:border-white/10"
          >
            <div className="w-7 h-7 rounded-full bg-gold-gradient flex items-center justify-center text-xs font-bold text-white shadow-inner">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hidden md:flex flex-col items-start leading-none">
              <span className="text-xs font-bold text-white mb-0.5">{user?.username || 'Trader'}</span>
              <span className={cn(
                "text-[9px] font-bold tracking-wider uppercase",
                user?.subscription_tier === 'pro' ? 'text-purple-400' : 'text-slate-500'
              )}>
                {user?.subscription_tier || 'STARTER'}
              </span>
            </div>
          </button>

          {/* Dropdown menu */}
          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-48 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl py-2 z-50 overflow-hidden"
              >
                <div className="px-4 py-2 border-b border-white/5 mb-1">
                  <div className="text-sm font-semibold text-white truncate">{user?.username}</div>
                  <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                </div>

                {user?.role === 'admin' && (
                  <button onClick={() => navigate('/admin')} className="w-full text-left px-4 py-2 text-sm text-yellow-400 hover:bg-white/5 flex items-center gap-2 transition-colors">
                    <ShieldAlert className="w-4 h-4" /> Admin Panel
                  </button>
                )}
                
                <button onClick={() => navigate('/articles')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors">
                  <BookOpen className="w-4 h-4" /> Artikel & Berita
                </button>

                <button onClick={() => navigate('/support')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors">
                  <Ticket className="w-4 h-4" /> Support Tickets
                </button>
                
                <button onClick={() => navigate('/profile')} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors">
                  <User className="w-4 h-4" /> Subscription Info
                </button>
                
                <div className="h-px bg-white/5 my-1" />
                
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main layout */}
      <PanelGroup orientation="horizontal" className="flex-1 overflow-hidden">

        {/* LEFT — Coin list */}
        <Panel defaultSize="20" minSize="15" maxSize="30" className="flex flex-col" data-tutorial="coin-list">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${exchange}-${marketType}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
              className="w-full h-full flex flex-col overflow-hidden"
            >
            <div
              className="px-3 py-1.5 text-[10px] font-semibold border-b border-border flex items-center justify-between"
            >
              <span style={{ color: activeExchangeInfo.color }}>
                {activeExchangeInfo.label}
              </span>
              <span className={cn(
                'text-[9px] px-1.5 py-0.5 rounded',
                isFutures ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
              )}>
                {isFutures ? 'Futures' : 'Spot'} · {activeTickers.length}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <CoinList
                tickers={activeTickers}
                loading={activeLoading}
                selectedSymbol={symbol}
                exchange={exchange}
                marketType={marketType}
                onSelect={handleSelectCoin}
              />
            </div>
          </motion.div>
          </AnimatePresence>
        </Panel>

        <PanelResizeHandle className="w-2 mx-[-1px] z-10 flex items-center justify-center cursor-col-resize group bg-transparent">
          <div className="w-[1px] h-full bg-border group-hover:bg-primary transition-colors" />
        </PanelResizeHandle>

        {/* CENTER — Chart / Grid */}
        <Panel defaultSize="55" minSize="30" className="flex flex-col overflow-hidden">
          {chartMode === 'grid' ? (
            <DashboardGrid 
              items={gridSymbols} 
              onRemove={(sym) => setGridSymbols(prev => prev.filter(p => p.symbol !== sym))} 
            />
          ) : (
            <>
              {/* Symbol bar */}
              <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-card shrink-0" data-tutorial="symbol-bar">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground text-sm">
                    {selectedTicker?.baseAsset ?? 'BTC'}/{isFutures ? 'PERP' : 'USDT'}
                  </span>
                  {isFutures && (
                    <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-mono">
                      {exchange === 'binance' ? 'PERP' : exchange === 'okx' ? 'SWAP' : 'PERP'}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{activeExchangeInfo.label}</span>
                </div>
                {selectedTicker && (
                  <>
                    <span className={cn(
                      'text-sm font-bold font-mono',
                      selectedTicker.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      {currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                    </span>
                    <span className={cn('text-xs', selectedTicker.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {selectedTicker.priceChangePercent >= 0 ? '+' : ''}{selectedTicker.priceChangePercent.toFixed(2)}%
                    </span>
                    
                    <button
                      onClick={() => {
                        if (!gridSymbols.find(g => g.symbol === selectedTicker.symbol) && gridSymbols.length < 9) {
                          setGridSymbols(prev => [...prev, { symbol: selectedTicker.symbol, tvSymbol: activeTvSource.symbol }])
                        }
                        setChartMode('grid')
                      }}
                      className="ml-2 px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded hover:bg-primary/20 transition-colors flex items-center gap-1"
                      title="Tambahkan ke Dashboard Grid"
                    >
                      <Plus className="h-3 w-3" />
                      Grid
                    </button>

                    <div className="flex gap-4 text-[10px] text-muted-foreground ml-auto">
                      {isFutures && selectedTicker.markPrice && (
                        <span>Mark: {selectedTicker.markPrice.toFixed(4)}</span>
                      )}
                      <span>H: {selectedTicker.high24h.toFixed(4)}</span>
                      <span>L: {selectedTicker.low24h.toFixed(4)}</span>
                      {isFutures && selectedTicker.fundingRate !== undefined ? (
                        <span className={selectedTicker.fundingRate >= 0 ? 'text-green-400' : 'text-red-400'}>
                          Fund: {selectedTicker.fundingRate >= 0 ? '+' : ''}{selectedTicker.fundingRate.toFixed(4)}%
                        </span>
                      ) : (
                        <span>Vol: {(selectedTicker.volume / 1_000_000).toFixed(2)}M</span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* TradingView source selector */}
              <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-muted/30 shrink-0">
                <span className="text-[10px] text-muted-foreground">Chart sumber:</span>
                <div className="flex gap-1">
                  {tvSources.map((src, i) => (
                    <button
                      key={src.symbol}
                      onClick={() => setTvSourceIdx(i)}
                      className={cn(
                        'px-2 py-0.5 text-[10px] rounded transition-colors',
                        i === tvSourceIdx % tvSources.length
                          ? 'bg-primary/20 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      {src.label}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground ml-auto font-mono opacity-60">
                  {activeTvSource.symbol}
                </span>
              </div>

              {/* TradingView chart */}
              <div className="flex-1 overflow-hidden">
                <TradingChart tvSymbol={activeTvSource.symbol} />
              </div>
            </>
          )}
        </Panel>

        <PanelResizeHandle className="w-2 mx-[-1px] z-10 flex items-center justify-center cursor-col-resize group bg-transparent">
          <div className="w-[1px] h-full bg-border group-hover:bg-primary transition-colors" />
        </PanelResizeHandle>

        {/* RIGHT — Tabs + panels */}
        <Panel defaultSize="25" minSize="20" maxSize="40" className="flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex overflow-x-auto scrollbar-none border-b border-border" data-tutorial="right-tabs">
           {([
  { id: 'orderbook', icon: <BookOpen className="h-3 w-3" />,        label: 'Book',    pro: false },
  { id: 'trades',    icon: <Clock className="h-3 w-3" />,           label: 'Trades',  pro: false },
  { id: 'signal',    icon: <BarChart2 className="h-3 w-3" />,       label: 'Analisa', pro: true },
  { id: 'scanner',   icon: <Scan className="h-3 w-3" />,            label: 'Scanner', pro: true },
  { id: 'heatmap',   icon: <LayoutGrid className="h-3 w-3" />,      label: 'Heatmap', pro: false },
  { id: 'volume',    icon: <Zap className="h-3 w-3" />,             label: 'Anomali', pro: false },
  { id: 'funding',   icon: <TrendingUp className="h-3 w-3" />,      label: 'Funding', pro: true },
  { id: 'coinglass', icon: <Scale className="h-3 w-3" />,           label: 'OI',      pro: false },
  { id: 'news',      icon: <Newspaper className="h-3 w-3" />,       label: 'Berita',  pro: false },
  { id: 'alert',     icon: <Bell className="h-3 w-3" />,            label: 'Alert',   pro: false },
  { id: 'social',    icon: <Radio className="h-3 w-3" />,           label: 'Sosial',  pro: false },
  { id: 'backtest',  icon: <Play className="h-3 w-3" />,            label: 'Backtest',pro: true },
] as { id: RightTab; icon: React.ReactNode; label: string; pro: boolean }[])
  .map((tab) => (
    <button
      key={tab.id}
      onClick={() => setRightTab(tab.id)}
      className={cn(
        'shrink-0 px-2.5 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors relative',
        rightTab === tab.id
          ? 'text-primary border-b-2 border-primary'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {tab.icon}
      {tab.label}
      {tab.pro && user?.subscription_tier !== 'pro' && (
        <Crown className="h-2 w-2 text-yellow-500 absolute top-1 right-1" />
      )}
    </button>
  ))}
          </div>

          {/* FuturesOpportunitiesPanel — always mounted when isFutures to preserve scan state across tab switches */}
          <div className={cn('flex-1 overflow-hidden', !(rightTab === 'signal' && isFutures) && 'hidden')}>
            <ProGate feature="Futures Long/Short Opportunities">
              <FuturesOpportunitiesPanel
                tickers={activeTickers}
                exchange={exchange}
                active={rightTab === 'signal'}
                onSelectCoin={handleSelectCoin}
              />
            </ProGate>
          </div>

          {rightTab === 'signal' && !isFutures ? (
            <div className="flex-1 overflow-hidden">
              <ProGate feature="Panel Sinyal Trading">
                <SignalPanel
                  ticker={selectedTicker}
                  exchange={exchange}
                  marketType={marketType}
                  currentPrice={currentPrice}
                  btcChangePercent={binanceSpotTickers.find(t => t.symbol === 'BTCUSDT')?.priceChangePercent ?? null}
                />
              </ProGate>
            </div>
          ) : rightTab === 'scanner' ? (
            <div className="flex-1 overflow-hidden">
              <ProGate feature="Scanner">
                <ScannerPanel
                  tickers={activeTickers}
                  exchange={exchange}
                  marketType={marketType}
                  isFutures={isFutures}
                  onSelectCoin={handleSelectCoin}
                />
              </ProGate>
            </div>
          ) : rightTab === 'news' ? (
            <div className="flex-1 overflow-hidden">
              <CryptoNewsPanel selectedCoin={selectedTicker?.baseAsset ?? null} />
            </div>
          ) : rightTab === 'alert' ? (
            <div className="flex-1 overflow-hidden">
              <PriceAlertPanel
                ticker={selectedTicker}
                currentPrice={currentPrice}
                exchange={exchange}
                marketType={marketType}
                alerts={alerts}
                onAdd={addAlert}
                onRemove={removeAlert}
                onClearTriggered={clearTriggered}
                onRequestPermission={requestPermission}
                technicalAlerts={techAlerts}
                onAddTechnical={addTechAlert}
                onRemoveTechnical={removeTechAlert}
                onClearTriggeredTechnical={clearTechTriggered}
              />
            </div>
          ) : rightTab === 'social' ? (
            <div className="flex-1 overflow-hidden">
              <LunarCrushPanel
                selectedCoin={selectedTicker?.baseAsset ?? null}
                tickers={activeTickers}
                onSelectCoin={(baseAsset) => {
                  const t = activeTickers.find((tk) => tk.baseAsset === baseAsset)
                  if (t) handleSelectCoin(t)
                }}
              />
            </div>
          ) : rightTab === 'heatmap' ? (
            <div className="flex-1 overflow-hidden">
              <HeatmapPanel tickers={activeTickers} onSelectCoin={handleSelectCoin} />
            </div>
          ) : rightTab === 'coinglass' ? (
            <div className="flex-1 overflow-hidden">
              <CoinGlassPanel baseAsset={selectedTicker?.baseAsset ?? null} />
            </div>
          ) : rightTab === 'volume' ? (
            <div className="flex-1 overflow-hidden">
              <VolumeAnomalyPanel tickers={activeTickers} exchange={exchange} marketType={marketType} onSelectCoin={handleSelectCoin} />
            </div>
          ) : rightTab === 'funding' ? (
            <div className="flex-1 overflow-hidden">
              <ProGate feature="Funding Rate Dashboard">
                <FundingRateDashboard tickers={activeTickers} exchange={exchange} onSelectCoin={handleSelectCoin} />
              </ProGate>
            </div>
          ) : rightTab === 'backtest' ? (
            <div className="flex-1 overflow-hidden">
              <ProGate feature="Backtest">
                <BacktestPanel ticker={selectedTicker} exchange={exchange} marketType={marketType} />
              </ProGate>
            </div>
          ) : rightTab !== 'signal' ? (
            <div className="flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {rightTab === 'orderbook' ? (
                  <motion.div key="ob" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                    <OrderBook
                      orderBook={activeOrderBook}
                      currentPrice={currentPrice}
                      onPriceClick={() => {}}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="trades" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                    <TradeHistory trades={activeTrades} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : null}
        </Panel>
      </PanelGroup>

      <TutorialStepper
        isActive={tutorialActive}
        currentStep={tutorialStep}
        onNext={() => tutorialNext(STEPS.length)}
        onPrev={tutorialPrev}
        onSkip={tutorialSkip}
      />
    </div>
  )
}
