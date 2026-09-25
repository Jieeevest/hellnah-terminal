import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { BookOpen, BarChart2, Plus, Scan, HelpCircle, Minus, EyeOff, Newspaper, Bell, Bot, type LucideIcon } from 'lucide-react'

import { CoinList } from '@/components/CoinList'
import { TradingChart } from '@/components/TradingChart'
import { PlanChart } from '@/components/PlanChart'
import { OrderBookTrades } from '@/components/OrderBookTrades'
import { BacktestResultsPanel } from '@/components/BacktestResultsPanel'
import { VolumeAnomalyPanel } from '@/components/VolumeAnomalyPanel'
import { FundingRateDashboard } from '@/components/FundingRateDashboard'
import { HeatmapPanel } from '@/components/HeatmapPanel'


// Spot hooks
import { useBinanceTickers, useBinancePrice } from '@/hooks/useBinance'

// Futures hooks
import { useBinanceFutureTickers, useBinanceFuturePrice } from '@/hooks/useBinanceFutures'

import { FuturesOpportunitiesPanel } from '@/components/FuturesOpportunitiesPanel'
import { BTCWarningBanner } from '@/components/BTCWarningBanner'
import { CryptoNewsPanel } from '@/components/CryptoNewsPanel'
import { BullishWatchlist } from '@/components/BullishWatchlist'
import { PriceAlertPanel } from '@/components/PriceAlertPanel'
import { OpenInterestPanel } from '@/components/OpenInterestPanel'
import { FundingSqueezePanel } from '@/components/FundingSqueezePanel'
import { AutoTradePanel } from '@/components/AutoTradePanel'
import { BotStatusBadge } from '@/components/BotStatusBadge'
import { CoinIcon } from '@/components/CoinIcon'
import { CoinSummary } from '@/components/CoinSummary'
import { useAutoTrader } from '@/hooks/useAutoTrader'
import { useFontScale } from '@/hooks/useFontScale'
import { usePriceAlerts } from '@/hooks/usePriceAlerts'
import { useTechnicalAlerts, useTechnicalAlertChecker } from '@/hooks/useTechnicalAlerts'
import { useBTCDominance } from '@/hooks/useBTCDominance'

type RightTab = 'orderbook' | 'trades' | 'signal' | 'backtest' | 'scanner' | 'opportunities' | 'news' | 'alert' | 'volume' | 'funding' | 'heatmap' | 'coinglass' | 'autotrade' | 'squeeze'
const RIGHT_TABS: RightTab[] = ['orderbook', 'trades', 'signal', 'backtest', 'scanner', 'opportunities', 'news', 'alert', 'volume', 'funding', 'heatmap', 'coinglass', 'autotrade', 'squeeze']
type MobileView = 'coins' | 'chart' | 'panel'

const LAST_MARKET_KEY = 'hellnah-last-market'
const LAST_SYMBOL_KEY = 'hellnah-last-symbol'
const LAST_TAB_KEY = 'hellnah-last-tab'
const SHOW_CHART_KEY = 'hellnah-show-chart'
const CHART_KIND_KEY = 'hellnah-chart-kind'
type ChartKind = 'plan' | 'tv'

const TAB_GROUPS: { id: string; label: string; icon: LucideIcon; tabs: { id: RightTab; label: string; futuresOnly?: boolean }[] }[] = [
  { id: 'market', label: 'Pasar', icon: BookOpen, tabs: [
    { id: 'orderbook', label: 'Order Book & Transaksi' },
    { id: 'heatmap', label: 'Heatmap' },
    { id: 'funding', label: 'Funding', futuresOnly: true },
    { id: 'coinglass', label: 'Open Interest' },
  ] },
  { id: 'analysis', label: 'Analisa', icon: BarChart2, tabs: [
    { id: 'scanner', label: 'Scanner' },
    { id: 'squeeze', label: 'Funding Squeeze', futuresOnly: true },
    { id: 'volume', label: 'Anomali Volume' },
    { id: 'backtest', label: 'Hasil Backtest' },
  ] },
  { id: 'news', label: 'Berita', icon: Newspaper, tabs: [
    { id: 'news', label: 'Berita' },
  ] },
  { id: 'alert', label: 'Alert', icon: Bell, tabs: [
    { id: 'alert', label: 'Alert Harga' },
  ] },
  { id: 'bot', label: 'Bot', icon: Bot, tabs: [
    { id: 'autotrade', label: 'Auto-Trade' },
  ] },
]

function ChartKindToggle({ value, onChange }: { value: ChartKind; onChange: (kind: ChartKind) => void }) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
      {([
        { id: 'plan', label: 'Chart Rencana', title: 'Candle Binance + garis masuk/batas rugi/target, Fibonacci & EMA otomatis' },
        { id: 'tv', label: 'TradingView', title: 'Chart TradingView lengkap dengan alat gambar & ratusan indikator' },
      ] as const).map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          title={opt.title}
          className={cn('min-h-8 px-3 text-sm font-semibold transition-colors whitespace-nowrap', value === opt.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function FontScaleControl({ fontScale }: { fontScale: ReturnType<typeof useFontScale> }) {
  return (
    <div className="flex items-center rounded-lg border border-border overflow-hidden" title="Ukuran huruf">
      <button
        onClick={fontScale.decrease}
        disabled={!fontScale.canDecrease}
        aria-label="Perkecil huruf"
        className="min-h-9 px-3 flex items-center gap-0.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Minus className="h-4 w-4" /><span className="text-sm font-bold">A</span>
      </button>
      <span className="px-2 text-sm font-mono text-muted-foreground border-x border-border min-h-9 flex items-center">{fontScale.scale}%</span>
      <button
        onClick={fontScale.increase}
        disabled={!fontScale.canIncrease}
        aria-label="Perbesar huruf"
        className="min-h-9 px-3 flex items-center gap-0.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Plus className="h-4 w-4" /><span className="text-lg font-bold">A</span>
      </button>
    </div>
  )
}

function RightTabNav({ rightTab, onChange, isFutures }: { rightTab: RightTab; onChange: (tab: RightTab) => void; isFutures: boolean }) {
  const activeGroup = TAB_GROUPS.find((g) => g.tabs.some((t) => t.id === rightTab)) ?? TAB_GROUPS[0]
  const visibleTabs = activeGroup.tabs.filter((t) => isFutures || !t.futuresOnly)
  return (
    <div className="shrink-0 border-b border-border bg-card">
      <div className="grid grid-cols-5 gap-1 p-1.5">
        {TAB_GROUPS.map((group) => {
          const Icon = group.icon
          const isActive = group.id === activeGroup.id
          return (
            <button
              key={group.id}
              onClick={() => onChange(group.tabs[0].id)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-h-12 px-1 rounded-lg text-xs font-semibold transition-colors',
                isActive ? 'bg-primary/20 text-primary ring-1 ring-primary/50' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-tight text-center">{group.label}</span>
            </button>
          )
        })}
      </div>
      {visibleTabs.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-2 pb-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'min-h-8 px-3 rounded-full text-xs font-medium border transition-colors',
                rightTab === tab.id ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

import type { Ticker, Exchange, MarketType } from '@/types'
import { cn } from '@/lib/utils'
import { getTVSources } from '@/lib/tvSymbol'
import { Logo } from '@/components/Logo'
import { TutorialStepper, STEPS } from '@/components/TutorialStepper'
import { useTutorial } from '@/hooks/useTutorial'


const EXCHANGES: { id: Exchange; label: string; color: string }[] = [
  { id: 'binance', label: 'Binance', color: '#F0B90B' },
]

const DEFAULT_SYMBOL = 'BTCUSDT'

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [exchange] = useState<Exchange>('binance')
  // URL (?market=) didahulukan: localStorage dipakai bareng semua tab browser, jadi tab lain
  // yang masih di Spot bisa nimpa pilihan Futures di tab ini.
  const [marketType, setMarketType] = useState<MarketType>(() =>
    (searchParams.get('market') ?? localStorage.getItem(LAST_MARKET_KEY)) === 'futures' ? 'futures' : 'spot'
  )
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null)
  const [symbol, setSymbol] = useState(() => localStorage.getItem(LAST_SYMBOL_KEY) ?? DEFAULT_SYMBOL)
  const [currentPrice, setCurrentPrice] = useState(0)
  const tabFromUrl = (searchParams.get('tab') ?? localStorage.getItem(LAST_TAB_KEY)) as RightTab | null
  const [rightTab, setRightTabState] = useState<RightTab>(
    tabFromUrl === 'signal' ? 'scanner' : tabFromUrl && RIGHT_TABS.includes(tabFromUrl) ? tabFromUrl : 'orderbook'
  )
  // Sinkron ke URL (?tab=...) supaya refresh gak balik ke tab default — replace, bukan push,
  // biar tiap klik tab gak numpuk history back-button.
  const setRightTab = (tab: RightTab) => {
    setRightTabState(tab)
    localStorage.setItem(LAST_TAB_KEY, tab)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', tab)
        return next
      },
      { replace: true }
    )
  }
  const [tvSourceIdx, setTvSourceIdx] = useState(0)

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
  const fontScale = useFontScale()
  const autoTrader = useAutoTrader(true)
  const [showChart, setShowChartState] = useState(() => localStorage.getItem(SHOW_CHART_KEY) === '1')
  const setShowChart = (show: boolean) => {
    setShowChartState(show)
    localStorage.setItem(SHOW_CHART_KEY, show ? '1' : '0')
  }
  const [chartKind, setChartKindState] = useState<ChartKind>(() => (localStorage.getItem(CHART_KIND_KEY) === 'tv' ? 'tv' : 'plan'))
  const setChartKind = (kind: ChartKind) => {
    setChartKindState(kind)
    localStorage.setItem(CHART_KIND_KEY, kind)
  }
  const openBotPanel = () => { setRightTab('autotrade'); setMobileView('panel') }

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (currentPrice > 0 && symbol) checkAlerts(symbol, currentPrice)
  }, [currentPrice, symbol, checkAlerts])

  // ── Spot data ──────────────────────────────────────────────────────────
  const { tickers: binanceSpotTickers, loading: binanceSpotLoading } = useBinanceTickers()
  useBinancePrice(marketType === 'spot' ? symbol : '', setCurrentPrice)

  // ── Futures data ───────────────────────────────────────────────────────
  const { tickers: binanceFutTickers, loading: binanceFutLoading } = useBinanceFutureTickers()
  useBinanceFuturePrice(marketType === 'futures' ? symbol : '', setCurrentPrice)

  // ── Active data selectors ──────────────────────────────────────────────
  const activeTickers = marketType === 'spot' ? binanceSpotTickers : binanceFutTickers
  const activeLoading = marketType === 'spot' ? binanceSpotLoading : binanceFutLoading

  // Tanpa ini harga besar di symbol bar & ringkasan koin kosong sampai user klik koin manual.
  useEffect(() => {
    if (selectedTicker) return
    const t = activeTickers.find((tk) => tk.symbol === symbol)
    if (t) {
      setSelectedTicker(t)
      setCurrentPrice(t.price)
    }
  }, [activeTickers, symbol, selectedTicker])

  useEffect(() => {
    localStorage.setItem(LAST_MARKET_KEY, marketType)
    localStorage.setItem(LAST_SYMBOL_KEY, symbol)
    setSearchParams(
      (prev) => {
        if (prev.get('market') === marketType) return prev
        const next = new URLSearchParams(prev)
        next.set('market', marketType)
        return next
      },
      { replace: true }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketType, symbol])

  // Sync price from ticker list for non-WS exchanges
  useEffect(() => {
    if ((exchange !== 'binance' || marketType !== 'spot') && selectedTicker) {
      const updated = activeTickers.find((t) => t.symbol === selectedTicker.symbol)
      if (updated) setCurrentPrice(updated.price)
    }
  }, [activeTickers, exchange, marketType, selectedTicker])

const handleMarketTypeChange = (mt: MarketType) => {
  setMarketType(mt)
  setSymbol(DEFAULT_SYMBOL)
  setSelectedTicker(null)
  setCurrentPrice(0)
  setTvSourceIdx(0)
}
  const handleSelectCoin = (ticker: Ticker) => {
    setSelectedTicker(ticker)
    setSymbol(ticker.symbol)
    setCurrentPrice(ticker.price)
    setTvSourceIdx(0)
  }


  const activeExchangeInfo = EXCHANGES.find((e) => e.id === exchange)!
  const isFutures = marketType === 'futures'

  useEffect(() => {
    if (!isFutures && (rightTab === 'funding' || rightTab === 'squeeze')) setRightTab('orderbook')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFutures, rightTab])

  const tvSources = getTVSources(symbol, exchange, marketType)
  const activeTvSource = tvSources[tvSourceIdx % tvSources.length]

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background overflow-hidden">
        <BTCWarningBanner tickers={binanceSpotTickers} />
        <header className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
          <Logo className="h-7 w-auto" variant='horizontal'/>
          <div className="flex-1" />
          <BotStatusBadge state={autoTrader.state} status={autoTrader.status} compact onClick={openBotPanel} />
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(['spot', 'futures'] as MarketType[]).map((mt) => (
              <button
                key={mt}
                onClick={() => handleMarketTypeChange(mt)}
                className={cn('min-h-9 px-2.5 text-sm font-bold', marketType === mt ? (mt === 'spot' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400') : 'text-muted-foreground hover:bg-muted/50')}
              >
                {mt === 'spot' ? 'Spot' : 'Futures'}
              </button>
            ))}
          </div>
        </header>

        <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-card shrink-0">
          <FontScaleControl fontScale={fontScale} />
          <div className="flex-1" />
          <button
            onClick={tutorialRestart}
            className="flex items-center gap-2 min-h-9 px-3 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <HelpCircle className="w-5 h-5" /> Panduan
          </button>
        </div>

        {/* Main Content Area - Using CSS hidden instead of unmounting to preserve Chart iframe */}
        <div className="flex-1 overflow-hidden min-h-0 relative">
          
          {/* COINS */}
          <div className={cn("absolute inset-0 flex flex-col bg-background", mobileView === 'coins' ? 'z-10' : 'hidden')}>
            <div className="px-4 py-2 text-sm font-semibold border-b border-border flex items-center justify-between">
              <span style={{ color: activeExchangeInfo.color }}>{activeExchangeInfo.label}</span>
              <span className={cn('text-sm px-2 py-0.5 rounded', isFutures ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400')}>
                {isFutures ? 'Futures' : 'Spot'} · {activeTickers.length}
              </span>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              <CoinList tickers={activeTickers} loading={activeLoading} selectedSymbol={symbol} exchange={exchange} marketType={marketType} onSelect={(ticker) => { handleSelectCoin(ticker); setMobileView('chart') }} />
            </div>
          </div>

          {/* CHART */}
          <div className={cn("absolute inset-0 flex flex-col bg-background", mobileView === 'chart' ? 'z-10' : 'hidden')}>
            {!showChart ? (
              <div className="flex-1 overflow-hidden min-h-0">
                <CoinSummary
                  ticker={selectedTicker}
                  currentPrice={currentPrice}
                  exchange={exchange}
                  marketType={marketType}
                  botState={autoTrader.state}
                  futuresTickers={binanceFutTickers}
                  onShowChart={() => setShowChart(true)}
                  onOpenAnalysis={() => { setRightTab('scanner'); setMobileView('panel') }}
                  onOpenBot={openBotPanel}
                />
              </div>
            ) : (
            <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0 flex-wrap">
              <CoinIcon asset={selectedTicker?.baseAsset ?? 'BTC'} size={32} />
              <span className="font-bold text-foreground text-lg">{selectedTicker?.baseAsset ?? 'BTC'}/{isFutures ? 'PERP' : 'USDT'}</span>
              {selectedTicker && (
                <>
                  <span className={cn('text-xl font-bold font-mono', selectedTicker.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                  </span>
                  <span className={cn('text-base font-semibold', selectedTicker.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {selectedTicker.priceChangePercent >= 0 ? '+' : ''}{selectedTicker.priceChangePercent.toFixed(2)}%
                  </span>
                </>
              )}
              <button onClick={() => setShowChart(false)} className="ml-auto min-h-9 px-3 border border-border text-muted-foreground text-sm font-semibold rounded-md flex items-center gap-1.5">
                <EyeOff className="h-4 w-4" /> Sembunyikan
              </button>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 shrink-0 overflow-x-auto">
              <ChartKindToggle value={chartKind} onChange={setChartKind} />
              {chartKind === 'tv' && tvSources.map((src, i) => (
                <button key={src.symbol} onClick={() => setTvSourceIdx(i)} className={cn('min-h-8 px-3 text-sm rounded-md transition-colors whitespace-nowrap', i === tvSourceIdx % tvSources.length ? 'bg-primary/20 text-primary font-medium' : 'text-muted-foreground hover:bg-muted')}>{src.label}</button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden min-h-0 relative">
              {chartKind === 'plan'
                ? <PlanChart symbol={symbol} marketType={marketType} currentPrice={currentPrice} futuresTickers={binanceFutTickers} />
                : <TradingChart tvSymbol={activeTvSource.symbol} />}
            </div>
            </>
            )}
          </div>

          {/* PANEL */}
          <div className={cn("absolute inset-0 flex flex-col bg-background", mobileView === 'panel' ? 'z-10' : 'hidden')}>
            <RightTabNav rightTab={rightTab} onChange={setRightTab} isFutures={isFutures} />

            <div className="flex-1 overflow-hidden min-h-0">
              {/* FuturesOpportunitiesPanel — always mounted when isFutures to preserve scan state */}
              <div className={cn('h-full', !(rightTab === 'scanner' && isFutures) && 'hidden')}>
                <FuturesOpportunitiesPanel
                  tickers={activeTickers}
                  exchange={exchange}
                  active={rightTab === 'scanner'}
                  onSelectCoin={(ticker) => { handleSelectCoin(ticker); setMobileView('chart') }}
                />
              </div>

              {rightTab === 'scanner' && isFutures ? null : rightTab === 'scanner' ? (
                <BullishWatchlist tickers={activeTickers} exchange={exchange} marketType={marketType} onSelectCoin={(ticker) => { handleSelectCoin(ticker); setMobileView('chart') }} />
              ) : rightTab === 'squeeze' ? (
                <FundingSqueezePanel futuresTickers={binanceFutTickers} onSelectCoin={(t) => { handleSelectCoin(t); setMobileView('chart') }} />
              ) : rightTab === 'news' ? (
                <CryptoNewsPanel selectedCoin={selectedTicker?.baseAsset ?? null} />
              ) : rightTab === 'autotrade' ? (
                <AutoTradePanel active={rightTab === 'autotrade'} />
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
              ) : rightTab === 'heatmap' ? (
                <HeatmapPanel tickers={activeTickers} onSelectCoin={(t) => { handleSelectCoin(t); setMobileView('chart') }} />
              ) : rightTab === 'coinglass' ? (
                <OpenInterestPanel symbol={selectedTicker?.symbol ?? null} baseAsset={selectedTicker?.baseAsset ?? null} priceChangePercent={selectedTicker?.priceChangePercent ?? null} />
              ) : rightTab === 'volume' ? (
                <VolumeAnomalyPanel tickers={activeTickers} exchange={exchange} marketType={marketType} onSelectCoin={(t) => { handleSelectCoin(t); setMobileView('chart') }} />
              ) : rightTab === 'funding' ? (
                <FundingRateDashboard tickers={activeTickers} exchange={exchange} onSelectCoin={(t) => { handleSelectCoin(t); setMobileView('chart') }} />
              ) : rightTab === 'backtest' ? (
                <BacktestResultsPanel />
              ) : rightTab !== 'signal' ? (
                <OrderBookTrades symbol={symbol} marketType={marketType} currentPrice={currentPrice} />
              ) : null}
            </div>
          </div>
        </div>

        {/* Bottom Nav */}
        <div className="flex border-t border-border bg-card shrink-0 pb-safe">
          {[
            { id: 'coins' as const, icon: <Scan className="w-7 h-7" />, label: 'Daftar Koin' },
            { id: 'chart' as const, icon: <BarChart2 className="w-7 h-7" />, label: 'Ringkasan' },
            { id: 'panel' as const, icon: <BookOpen className="w-7 h-7" />, label: 'Menu' }
          ].map((item) => (
            <button key={item.id} onClick={() => setMobileView(item.id)} className={cn('flex-1 flex flex-col items-center justify-center gap-1 py-3 text-sm font-semibold transition-colors', mobileView === item.id ? 'text-primary bg-primary/10' : 'text-muted-foreground')}>
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
      <BTCWarningBanner tickers={binanceSpotTickers} />
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
        <Logo className="h-8 w-auto mr-1" variant='horizontal'/>

        <div className="flex rounded-lg overflow-hidden border border-border" data-tutorial="market-type">
          {(['spot', 'futures'] as MarketType[]).map((mt) => (
            <motion.button
              key={mt}
              onClick={() => handleMarketTypeChange(mt)}
              className={cn(
                'min-h-9 px-4 text-sm font-semibold transition-colors',
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

        <div className="flex-1" />

        <BotStatusBadge state={autoTrader.state} status={autoTrader.status} onClick={openBotPanel} />

        {btcDominance != null && (
          <div className="hidden xl:flex items-center gap-1.5 min-h-9 text-sm text-muted-foreground bg-muted/40 px-2.5 rounded-lg border border-border/50" title="Dominasi BTC terhadap total market cap kripto">
            <CoinIcon asset="BTC" size={20} />
            <span>BTC.D</span>
            <span className="font-mono font-semibold text-foreground">{btcDominance.toFixed(1)}%</span>
          </div>
        )}

        <FontScaleControl fontScale={fontScale} />

        <button
          onClick={tutorialRestart}
          title="Lihat tour fitur"
          className="flex items-center gap-2 min-h-9 px-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors rounded-lg border border-border"
        >
          <HelpCircle className="w-5 h-5" /> Panduan
        </button>
      </header>

      {/* Main layout */}
      <PanelGroup orientation="horizontal" className="flex-1 overflow-hidden">

        {/* LEFT — Coin list */}
        <Panel defaultSize="22" minSize="16" maxSize="32" className="flex flex-col" data-tutorial="coin-list">
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
              className="px-4 py-2.5 text-sm font-semibold border-b border-border flex items-center justify-between"
            >
              <span style={{ color: activeExchangeInfo.color }}>
                {activeExchangeInfo.label}
              </span>
              <span className={cn(
                'text-sm px-2 py-0.5 rounded',
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

        <PanelResizeHandle className="w-3 mx-[-1px] z-10 flex items-center justify-center cursor-col-resize group bg-transparent">
          <div className="w-[2px] h-full bg-border group-hover:bg-primary transition-colors" />
        </PanelResizeHandle>

        {/* CENTER — Ringkasan / Chart */}
        <Panel defaultSize="40" minSize="25" className="flex flex-col overflow-hidden">
          {!showChart ? (
            <CoinSummary
              ticker={selectedTicker}
              currentPrice={currentPrice}
              exchange={exchange}
              marketType={marketType}
              botState={autoTrader.state}
                  futuresTickers={binanceFutTickers}
              onShowChart={() => setShowChart(true)}
              onOpenAnalysis={() => setRightTab('scanner')}
              onOpenBot={openBotPanel}
            />
          ) : (
            <>
              {/* Symbol bar */}
              <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-card shrink-0 flex-wrap" data-tutorial="symbol-bar">
                <div className="flex items-center gap-3">
                  <CoinIcon asset={selectedTicker?.baseAsset ?? 'BTC'} size={40} className="mr-1" />
                  <span className="font-bold text-foreground text-xl">
                    {selectedTicker?.baseAsset ?? 'BTC'}/{isFutures ? 'PERP' : 'USDT'}
                  </span>
                  {isFutures && (
                    <span className="text-sm bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-mono">
                      PERP
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">{activeExchangeInfo.label}</span>
                </div>
                {selectedTicker && (
                  <>
                    <span className={cn(
                      'text-2xl font-bold font-mono',
                      selectedTicker.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
                    )}>
                      {currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                    </span>
                    <span className={cn('text-lg font-semibold', selectedTicker.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {selectedTicker.priceChangePercent >= 0 ? '+' : ''}{selectedTicker.priceChangePercent.toFixed(2)}%
                    </span>
                    
                    <button
                      onClick={() => setShowChart(false)}
                      className="min-h-9 px-3 border border-border text-muted-foreground text-sm font-semibold rounded-md hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                    >
                      <EyeOff className="h-4 w-4" />
                      Sembunyikan Chart
                    </button>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground ml-auto">
                      {isFutures && selectedTicker.markPrice && (
                        <span>Mark: {selectedTicker.markPrice.toFixed(4)}</span>
                      )}
                      <span>Tertinggi: {selectedTicker.high24h.toFixed(4)}</span>
                      <span>Terendah: {selectedTicker.low24h.toFixed(4)}</span>
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

              <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 shrink-0">
                <ChartKindToggle value={chartKind} onChange={setChartKind} />
                {chartKind === 'tv' && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground whitespace-nowrap mr-1">Sumber:</span>
                    {tvSources.map((src, i) => (
                      <button
                        key={src.symbol}
                        onClick={() => setTvSourceIdx(i)}
                        className={cn(
                          'min-h-8 px-3 text-sm rounded-md transition-colors',
                          i === tvSourceIdx % tvSources.length
                            ? 'bg-primary/20 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        {src.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-hidden min-h-0">
                {chartKind === 'plan'
                  ? <PlanChart symbol={symbol} marketType={marketType} currentPrice={currentPrice} futuresTickers={binanceFutTickers} />
                  : <TradingChart tvSymbol={activeTvSource.symbol} />}
              </div>
            </>
          )}
        </Panel>

        <PanelResizeHandle className="w-3 mx-[-1px] z-10 flex items-center justify-center cursor-col-resize group bg-transparent">
          <div className="w-[2px] h-full bg-border group-hover:bg-primary transition-colors" />
        </PanelResizeHandle>

        {/* RIGHT — Tabs + panels */}
        <Panel defaultSize="38" minSize="28" maxSize="50" className="flex flex-col overflow-hidden">
          {/* Tabs */}
          <div data-tutorial="right-tabs">
            <RightTabNav rightTab={rightTab} onChange={setRightTab} isFutures={isFutures} />
          </div>

          {/* FuturesOpportunitiesPanel — always mounted when isFutures to preserve scan state across tab switches */}
          <div className={cn('flex-1 overflow-hidden', !(rightTab === 'scanner' && isFutures) && 'hidden')}>
            <FuturesOpportunitiesPanel
              tickers={activeTickers}
              exchange={exchange}
              active={rightTab === 'scanner'}
              onSelectCoin={handleSelectCoin}
            />
          </div>

          {rightTab === 'scanner' && isFutures ? null : rightTab === 'scanner' ? (
            <div className="flex-1 overflow-hidden">
              <BullishWatchlist
                tickers={activeTickers}
                exchange={exchange}
                marketType={marketType}
                onSelectCoin={handleSelectCoin}
              />
            </div>
          ) : rightTab === 'squeeze' ? (
            <div className="flex-1 overflow-hidden">
              <FundingSqueezePanel futuresTickers={binanceFutTickers} onSelectCoin={handleSelectCoin} />
            </div>
          ) : rightTab === 'news' ? (
            <div className="flex-1 overflow-hidden">
              <CryptoNewsPanel selectedCoin={selectedTicker?.baseAsset ?? null} />
            </div>
          ) : rightTab === 'autotrade' ? (
            <div className="flex-1 overflow-hidden">
              <AutoTradePanel active={rightTab === 'autotrade'} />
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
          ) : rightTab === 'heatmap' ? (
            <div className="flex-1 overflow-hidden">
              <HeatmapPanel tickers={activeTickers} onSelectCoin={handleSelectCoin} />
            </div>
          ) : rightTab === 'coinglass' ? (
            <div className="flex-1 overflow-hidden">
              <OpenInterestPanel symbol={selectedTicker?.symbol ?? null} baseAsset={selectedTicker?.baseAsset ?? null} priceChangePercent={selectedTicker?.priceChangePercent ?? null} />
            </div>
          ) : rightTab === 'volume' ? (
            <div className="flex-1 overflow-hidden">
              <VolumeAnomalyPanel tickers={activeTickers} exchange={exchange} marketType={marketType} onSelectCoin={handleSelectCoin} />
            </div>
          ) : rightTab === 'funding' ? (
            <div className="flex-1 overflow-hidden">
              <FundingRateDashboard tickers={activeTickers} exchange={exchange} onSelectCoin={handleSelectCoin} />
            </div>
          ) : rightTab === 'backtest' ? (
            <div className="flex-1 overflow-hidden">
              <BacktestResultsPanel />
            </div>
          ) : rightTab !== 'signal' ? (
            <div className="flex-1 overflow-hidden">
              <OrderBookTrades symbol={symbol} marketType={marketType} currentPrice={currentPrice} />
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
