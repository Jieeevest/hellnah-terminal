import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, BookOpen, AlertTriangle, Twitter, Github, Send, MapPin, Mail, Phone } from 'lucide-react'
import DOMPurify from 'dompurify'
import { Navbar } from '@/components/Navbar'
import { Logo } from '@/components/Logo'
import { useSessionGuard } from '@/hooks/useSessionGuard'
import { SEOHead } from '@/components/SEOHead'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const CAT_COLORS: Record<string, string> = {
  news:     'text-blue-400 bg-blue-500/10 border-blue-500/20',
  tutorial: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  analysis: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  update:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
}
const CAT_LABELS: Record<string, string> = {
  news: 'Berita', tutorial: 'Tutorial', analysis: 'Analisis', update: 'Update'
}

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>()
  useSessionGuard()

  const [article, setArticle] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_URL}/api/articles/${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setArticle(data.data)
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-white/10 border-t-amber-500 rounded-full animate-spin" />
    </div>
  )

  if (notFound || !article) return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-4">
        <BookOpen className="w-10 h-10 text-slate-600" />
      </div>
      <h1 className="text-4xl font-black tracking-tight">Artikel Tidak Ditemukan</h1>
      <p className="text-slate-500 max-w-sm">Mungkin artikel ini telah dihapus atau URL yang Anda masukkan salah.</p>
      <Link to="/articles" className="bg-gold-gradient text-black font-bold px-8 py-3 rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(245,166,35,0.2)]">
        Kembali ke Daftar Riset
      </Link>
    </div>
  )

  const publishedDate = article.published_at || article.created_at

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans selection:bg-amber-500/30 selection:text-white">
      <SEOHead
        title={article.meta_title || article.title}
        description={article.meta_description || article.excerpt || `${article.title} — Baca artikel lengkap di Hellnah Terminal, platform trading kripto Indonesia.`}
        keywords={article.meta_keywords || undefined}
        canonical={`/articles/${slug}`}
        ogImage={article.og_image || article.cover_url || undefined}
        ogType="article"
        publishedAt={publishedDate}
        author={article.author}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.meta_title || article.title,
          description: article.meta_description || article.excerpt || article.title,
          image: article.og_image || article.cover_url || 'https://hellnah-terminal.id/og-image.png',
          datePublished: publishedDate,
          dateModified: article.updated_at || publishedDate,
          keywords: article.meta_keywords || undefined,
          author: { '@type': 'Person', name: article.author },
          publisher: {
            '@type': 'Organization',
            name: 'Hellnah Terminal',
            logo: { '@type': 'ImageObject', url: 'https://hellnah-terminal.id/favicon.png' },
          },
          mainEntityOfPage: { '@type': 'WebPage', '@id': `https://hellnah-terminal.id/articles/${slug}` },
        }}
      />

      <Navbar />

      {/* ── BREADCRUMB ── */}
      <div className="pt-24 pb-6 border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 flex items-center gap-4 text-sm font-semibold">
          <Link to="/articles" className="text-slate-400 hover:text-white transition-colors flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Link>
          <div className="w-1 h-1 rounded-full bg-white/20" />
          <span className="text-slate-500 truncate">{article.title}</span>
        </div>
      </div>

      {/* ── ARTICLE CONTENT ── */}
      <motion.article
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto px-6 py-12 lg:py-20"
      >
        <header className="mb-12">
          {/* Category Badge */}
          <div className="flex items-center gap-3 mb-6">
            <span className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${CAT_COLORS[article.category] || 'bg-white/10 border-white/20 text-white'}`}>
              {CAT_LABELS[article.category] || article.category}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight mb-8">
            {article.title}
          </h1>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
              <div className="w-6 h-6 rounded-full bg-gold-gradient flex items-center justify-center text-black font-bold text-[10px]">
                {article.author[0].toUpperCase()}
              </div>
              <span className="font-bold text-white">{article.author}</span>
            </div>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              {new Date(article.published_at || article.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Cover Image */}
        {article.cover_url && (
          <div className="relative mb-16 rounded-[32px] overflow-hidden border border-white/10 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#030303]/50 pointer-events-none" />
            <img src={article.cover_url} alt={article.title} className="w-full aspect-video object-cover" />
          </div>
        )}

        {/* Excerpt Summary */}
        {article.excerpt && (
          <div className="bg-gradient-to-r from-amber-500/10 to-transparent border-l-4 border-amber-500 p-6 md:p-8 rounded-r-3xl mb-12">
            <p className="text-lg md:text-xl text-white font-medium leading-relaxed">{article.excerpt}</p>
          </div>
        )}

        {/* Content Body */}
        <div
          className="article-content prose prose-invert prose-lg md:prose-xl max-w-none selection:bg-amber-500/30 selection:text-white"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
        />

        {/* Footer */}
        <div className="mt-20 pt-10 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-6">
          <Link to="/articles" className="flex items-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 px-6 py-3 rounded-xl font-semibold transition-colors w-full sm:w-auto justify-center">
            <ArrowLeft className="w-4 h-4" /> Baca Riset Lainnya
          </Link>
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl w-full sm:w-auto text-center sm:text-left">
            <p className="text-sm text-slate-300 mb-1">Ada pertanyaan mengenai analisis ini?</p>
            <Link to="/support" className="text-amber-400 font-bold hover:underline">Hubungi Tim Institusional Kami →</Link>
          </div>
        </div>
      </motion.article>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] py-16 bg-[#030303]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
            <div className="col-span-2">
              <Link to="/" className="flex items-center gap-3 mb-5">
                <Logo variant="horizontal" className="h-9 w-auto" />
              </Link>
              <p className="text-slate-500 text-sm leading-relaxed mb-5 max-w-xs">
                Platform scanner sinyal kripto multi-timeframe untuk trader Indonesia. Analisis lebih terstruktur, bukan prediksi harga.
              </p>
              {/* Contact Info */}
              <div className="space-y-2.5 mb-5">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Jl. H. Sarmili Rt 004/02 No.1,<br />
                    Kel. Jurang Mangu Timur, Kec. Pondok Aren,<br />
                    Tangerang Selatan 15222
                  </p>
                </div>
                <a href="mailto:support@hellnah-terminal.id" className="flex items-center gap-2.5 group">
                  <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-slate-500 text-xs group-hover:text-amber-400 transition-colors">support@hellnah-terminal.id</span>
                </a>
                <a href="tel:+62087883391664" className="flex items-center gap-2.5 group">
                  <Phone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-slate-500 text-xs group-hover:text-amber-400 transition-colors">0878-8339-1664</span>
                </a>
              </div>
              <div className="flex gap-3">
                {[Twitter, Github, Send].map((Icon, i) => (
                  <a key={i} href="#" className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-slate-400 hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all">
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
            {[
              { title: 'Produk', links: [
                { name: 'Fitur', url: '/#fitur' },
                { name: 'Cara Kerja', url: '/#cara-kerja' },
                { name: 'Harga', url: '/#harga' },
                { name: 'Roadmap', url: '/page/roadmap' }
              ]},
              { title: 'Support', links: [
                { name: 'Dokumentasi', url: '/page/dokumentasi' },
                { name: 'FAQ', url: '/page/faq' },
                { name: 'Status', url: '/page/status' },
                { name: 'Kontak CS', url: '/support' }
              ]},
              { title: 'Legal', links: [
                { name: 'Syarat & Ketentuan', url: '/page/terms' },
                { name: 'Kebijakan Privasi', url: '/page/privacy' },
                { name: 'Disclaimer Risiko', url: '/page/disclaimer' },
                { name: 'Kebijakan Refund', url: '/page/refund' },
              ]},
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-xs font-bold tracking-widest uppercase text-slate-500 mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map(l => (
                    <li key={l.name}>
                      {l.url.startsWith('/#') ? (
                        <a href={l.url} className="text-sm text-slate-400 hover:text-white transition-colors">{l.name}</a>
                      ) : (
                        <Link to={l.url} className="text-sm text-slate-400 hover:text-white transition-colors">{l.name}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border border-amber-900/40 bg-amber-950/20 rounded-xl p-5 mb-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 font-bold text-xs mb-1.5">Disclaimer Risiko Investasi Penting</p>
                <p className="text-amber-200/60 text-xs leading-relaxed">
                  Trading aset kripto mengandung risiko tinggi kehilangan seluruh modal yang diinvestasikan. Sinyal, skor, dan analisis yang disediakan oleh Hellnah Terminal merupakan output analisis teknikal otomatis dan <strong>bukan merupakan rekomendasi investasi, saran keuangan, atau ajakan membeli/menjual aset</strong>. Seluruh keputusan trading sepenuhnya merupakan tanggung jawab pengguna. Hasil masa lalu tidak menjamin hasil masa depan. Pastikan Anda memahami risiko sebelum berdagang.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">© 2025 Hellnah Terminal. Seluruh hak cipta dilindungi undang-undang.</p>
            <div className="flex gap-4">
              <Link to="/page/terms" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Terms of Service</Link>
              <Link to="/page/privacy" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Privacy Policy</Link>
              <Link to="/page/disclaimer" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Disclaimer</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
