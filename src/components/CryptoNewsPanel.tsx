import { useMemo, useState } from 'react'
import { AlertTriangle, RefreshCw, ExternalLink, Newspaper } from 'lucide-react'
import { useCryptoNews, type NewsSentiment, type NewsArticle } from '@/hooks/useCryptoNews'
import { cn } from '@/lib/utils'
import { CoinIcon } from '@/components/CoinIcon'
import { PanelHeader } from '@/components/ui/PanelHeader'
import { PillTabs } from '@/components/ui/PillTabs'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

const SENTIMENT_TONE: Record<NewsSentiment, BadgeTone> = { Positif: 'green', Negatif: 'red', Netral: 'yellow' }

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
          <p className="text-sm text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
            {article.title}
          </p>
          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge tone={SENTIMENT_TONE[article.sentiment]}>{article.sentiment}</Badge>
          <span className="text-xs text-muted-foreground truncate max-w-[80px]">{article.source}</span>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">{timeAgo(article.publishedAt)}</span>
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

  // activeCategory sudah null untuk tab 'all' maupun 'trending', jadi `articles`
  // di sini sekaligus berfungsi sebagai daftar "semua berita" untuk trending.
  const trendingCoins = useMemo(
    () => (activeTab === 'trending' ? getTrendingCoins(articles) : []),
    [articles, activeTab],
  )

  const tabs: { id: NewsTab; label: string }[] = [
    { id: 'all', label: 'Semua' },
    ...(selectedCoin ? [{ id: 'coin' as NewsTab, label: selectedCoin }] : []),
    { id: 'trending', label: 'Trending' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader
        icon={Newspaper}
        title="Berita Kripto"
        right={
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1 min-h-7 px-2.5 rounded-full border border-border text-xs hover:text-foreground hover:bg-muted disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
          </button>
        }
        subtitle={
          activeTab === 'trending'
            ? 'Koin yang paling banyak disebut di berita terbaru'
            : lastFetch > 0 ? `Diperbarui ${timeAgo(lastFetch)} · sumber CryptoCompare` : 'Berita terbaru dari CryptoCompare'
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <PillTabs value={activeTab} onChange={setActiveTab} options={tabs} />
          {articles.length > 0 && activeTab !== 'trending' && (
            <span className="ml-auto flex items-center gap-1.5 text-xs">
              <Badge tone={SENTIMENT_TONE[overallSentiment]}>{overallSentiment}</Badge>
              <span className="text-green-400">{positif}↑</span>
              <span className="text-yellow-400">{netral}→</span>
              <span className="text-red-400">{negatif}↓</span>
            </span>
          )}
        </div>
      </PanelHeader>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'trending' ? (
          trendingCoins.length === 0 ? (
            <EmptyState loading title="Menganalisis berita…" />
          ) : (
            <>
              {trendingCoins.map((coin, i) => (
                <div key={coin.symbol} className="flex items-center gap-2.5 px-3 py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                  <CoinIcon asset={coin.symbol} size={22} />
                  <span className="text-sm font-bold text-foreground flex-1">{coin.symbol}</span>
                  <Badge tone={SENTIMENT_TONE[coin.sentiment]}>{coin.sentiment}</Badge>
                  <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">{coin.count} berita</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground text-center py-3 px-3">Berdasarkan {articles.length} berita terbaru</p>
            </>
          )
        ) : loading && articles.length === 0 ? (
          <EmptyState loading title="Memuat berita…" />
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Gagal memuat berita"
            description={error}
            action={<button onClick={refresh} className="text-xs text-primary hover:underline">Coba lagi</button>}
          />
        ) : articles.length === 0 ? (
          <EmptyState icon={Newspaper} title={activeTab === 'coin' ? `Tidak ada berita untuk ${selectedCoin}` : 'Belum ada berita'} />
        ) : (
          articles.map((a) => <ArticleRow key={a.id} article={a} />)
        )}
      </div>
    </div>
  )
}
