import { useMemo, useState } from 'react'
import { RefreshCw, ExternalLink, Newspaper, TrendingUp, Filter } from 'lucide-react'
import { useCryptoNews, type NewsSentiment, type NewsArticle } from '@/hooks/useCryptoNews'
import { cn } from '@/lib/utils'

const SENTIMENT_CFG: Record<NewsSentiment, { color: string; bg: string; dot: string }> = {
  Positif: { color: 'text-green-400',  bg: 'bg-green-500/15',  dot: 'bg-green-400' },
  Netral:  { color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: 'bg-yellow-400' },
  Negatif: { color: 'text-red-400',    bg: 'bg-red-500/15',    dot: 'bg-red-400' },
}

// Coin mention detection for trending
const TRACKED_COINS: { symbol: string; terms: string[] }[] = [
  { symbol: 'BTC',  terms: ['bitcoin', 'btc'] },
  { symbol: 'ETH',  terms: ['ethereum', 'eth'] },
  { symbol: 'BNB',  terms: ['binance coin', ' bnb '] },
  { symbol: 'SOL',  terms: ['solana', ' sol '] },
  { symbol: 'XRP',  terms: [' xrp ', 'ripple'] },
  { symbol: 'DOGE', terms: ['dogecoin', 'doge'] },
  { symbol: 'ADA',  terms: ['cardano', ' ada '] },
  { symbol: 'AVAX', terms: ['avalanche', 'avax'] },
  { symbol: 'DOT',  terms: ['polkadot', ' dot '] },
  { symbol: 'LINK', terms: ['chainlink', ' link '] },
  { symbol: 'MATIC',terms: ['polygon', 'matic'] },
  { symbol: 'UNI',  terms: ['uniswap', ' uni '] },
  { symbol: 'LTC',  terms: ['litecoin', ' ltc '] },
  { symbol: 'ATOM', terms: ['cosmos', ' atom '] },
  { symbol: 'XLM',  terms: ['stellar', ' xlm '] },
  { symbol: 'TRX',  terms: ['tron', ' trx '] },
  { symbol: 'TON',  terms: [' ton ', 'toncoin'] },
  { symbol: 'SUI',  terms: [' sui '] },
  { symbol: 'APT',  terms: [' apt ', 'aptos'] },
  { symbol: 'INJ',  terms: [' inj ', 'injective'] },
]

function getTrendingCoins(articles: NewsArticle[]): { symbol: string; count: number; sentiment: NewsSentiment }[] {
  const counts: Record<string, { count: number; pos: number; neg: number }> = {}

  for (const article of articles) {
    const lower = (' ' + article.title + ' ' + (article.categories ?? '') + ' ').toLowerCase()
    for (const coin of TRACKED_COINS) {
      if (coin.terms.some((t) => lower.includes(t))) {
        if (!counts[coin.symbol]) counts[coin.symbol] = { count: 0, pos: 0, neg: 0 }
        counts[coin.symbol].count++
        if (article.sentiment === 'Positif') counts[coin.symbol].pos++
        if (article.sentiment === 'Negatif') counts[coin.symbol].neg++
      }
    }
  }

  return Object.entries(counts)
    .map(([symbol, { count, pos, neg }]) => ({
      symbol,
      count,
      sentiment: (pos > neg ? 'Positif' : neg > pos ? 'Negatif' : 'Netral') as NewsSentiment,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}j lalu`
  return `${Math.floor(hours / 24)}h lalu`
}

function ArticleRow({ article }: { article: NewsArticle }) {
  const cfg = SENTIMENT_CFG[article.sentiment]
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-2 px-3 py-2.5 border-b border-border/50 hover:bg-muted/30 transition-colors group"
    >
      <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {article.title}
          </p>
          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('text-[9px] font-semibold px-1 py-0.5 rounded', cfg.color, cfg.bg)}>
            {article.sentiment}
          </span>
          <span className="text-[9px] text-muted-foreground truncate max-w-[80px]">{article.source}</span>
          <span className="text-[9px] text-muted-foreground ml-auto shrink-0">{timeAgo(article.publishedAt)}</span>
        </div>
      </div>
    </a>
  )
}

type NewsTab = 'all' | 'coin' | 'trending'

interface Props {
  selectedCoin?: string | null
}

export function CryptoNewsPanel({ selectedCoin }: Props) {
  const [activeTab, setActiveTab] = useState<NewsTab>('all')

  const activeCategory = activeTab === 'coin' && selectedCoin ? selectedCoin : null
  const { articles, loading, error, lastFetch, refresh } = useCryptoNews(activeCategory)

  const { positif, negatif, netral, overallSentiment } = useMemo(() => {
    const p = articles.filter((a) => a.sentiment === 'Positif').length
    const n = articles.filter((a) => a.sentiment === 'Negatif').length
    const nt = articles.filter((a) => a.sentiment === 'Netral').length
    const overall: NewsSentiment = p > n ? 'Positif' : n > p ? 'Negatif' : 'Netral'
    return { positif: p, negatif: n, netral: nt, overallSentiment: overall }
  }, [articles])

  const trendingCoins = useMemo(
    () => (activeTab === 'trending' ? getTrendingCoins(articles) : []),
    [articles, activeTab],
  )

  // Use "all" articles for trending tab (always fetch all)
  const { articles: allArticles } = useCryptoNews(null)
  const trendingFromAll = useMemo(
    () => (activeTab === 'trending' ? getTrendingCoins(allArticles) : []),
    [allArticles, activeTab],
  )

  const tabs: { id: NewsTab; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { id: 'all',      label: 'Semua',    icon: <Newspaper className="h-3 w-3" /> },
    { id: 'coin',     label: selectedCoin ?? 'Koin',  icon: <Filter className="h-3 w-3" />, disabled: !selectedCoin },
    { id: 'trending', label: 'Trending', icon: <TrendingUp className="h-3 w-3" /> },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tabs */}
      <div className="flex border-b border-border shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => !t.disabled && setActiveTab(t.id)}
            disabled={t.disabled}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors',
              activeTab === t.id
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground',
              t.disabled && 'opacity-30 cursor-not-allowed'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          {articles.length > 0 && activeTab !== 'trending' && (
            <>
              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', SENTIMENT_CFG[overallSentiment].color, SENTIMENT_CFG[overallSentiment].bg)}>
                {overallSentiment}
              </span>
              <div className="flex items-center gap-1.5 text-[9px]">
                <span className="text-green-400">{positif}↑</span>
                <span className="text-yellow-400">{netral}→</span>
                <span className="text-red-400">{negatif}↓</span>
              </div>
            </>
          )}
          {activeTab === 'trending' && (
            <span className="text-[9px] text-muted-foreground">Koin paling banyak disebut</span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'trending' ? (
          /* Trending coins */
          trendingFromAll.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Menganalisis berita...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-0">
              {trendingFromAll.map((coin, i) => {
                const cfg = SENTIMENT_CFG[coin.sentiment]
                return (
                  <div
                    key={coin.symbol}
                    className="flex items-center gap-3 px-3 py-2 border-b border-border/50"
                  >
                    <span className="text-[9px] text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                    <span className="text-[10px] font-bold text-foreground flex-1">{coin.symbol}</span>
                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded', cfg.color, cfg.bg)}>
                      {coin.sentiment}
                    </span>
                    <span className="text-[9px] text-muted-foreground shrink-0">{coin.count} berita</span>
                  </div>
                )
              })}
              <p className="text-[9px] text-muted-foreground text-center py-3 px-3">
                Berdasarkan {allArticles.length} berita terbaru
              </p>
            </div>
          )
        ) : loading && articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Memuat berita...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
            <span className="text-[10px] text-red-400">Gagal memuat: {error}</span>
            <button onClick={refresh} className="text-[10px] text-primary hover:underline">Coba lagi</button>
          </div>
        ) : articles.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-[10px] text-muted-foreground">
            {activeTab === 'coin' ? `Tidak ada berita untuk ${selectedCoin}` : 'Belum ada berita'}
          </div>
        ) : (
          articles.map((a) => <ArticleRow key={a.id} article={a} />)
        )}
      </div>

      {/* Footer */}
      {lastFetch > 0 && !loading && activeTab !== 'trending' && (
        <div className="px-3 py-1.5 border-t border-border shrink-0">
          <span className="text-[9px] text-muted-foreground">
            Diperbarui {timeAgo(lastFetch)} · CryptoCompare · Cache 30m
          </span>
        </div>
      )}
    </div>
  )
}
