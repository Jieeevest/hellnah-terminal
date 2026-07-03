import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, Shield, Activity, BarChart2, ArrowRight,
  ChevronRight, Check, Star, Globe, Cpu,
  Twitter, Github, Send, Menu, X, Clock, Eye,
  AlertTriangle, Users, Zap, Lock, MapPin, Mail, Phone
} from 'lucide-react'
import { useAuth } from '@/store/useAuth'
import { Logo } from '@/components/Logo'
import { SEOHead } from '@/components/SEOHead'

// ── Counter animation hook ────────────────────────────────────────────────
function useCounter(target: number, duration: number = 2000) {
  const [count, setCount] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  const start = (fromZero = true) => {
    if (fromZero) setCount(0)
    const step = target / (duration / 16)
    ref.current = setInterval(() => {
      setCount(prev => {
        const next = prev + step
        if (next >= target) { clearInterval(ref.current!); return target }
        return next
      })
    }, 16)
  }
  useEffect(() => () => { if (ref.current) clearInterval(ref.current) }, [])
  return { count: Math.floor(count), start }
}

// ── Stat Counter ─────────────────────────────────────────────────────────
function StatCounter({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const { count, start } = useCounter(value, 2200)
  useEffect(() => { if (inView) start() }, [inView])
  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl md:text-5xl font-black text-white tabular-nums">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-sm text-slate-400 mt-2 font-medium">{label}</div>
    </div>
  )
}

// ── Feature Card ─────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, delay }: { icon: React.ReactNode; title: string; desc: string; delay: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 hover:bg-white/[0.06] hover:border-amber-500/30 transition-all duration-300 overflow-hidden flex flex-col min-h-[200px]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/8 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10 flex flex-col h-full">
        <div className="w-12 h-12 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:border-amber-500/40 transition-all duration-300">
          {icon}
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed flex-1">{desc}</p>
      </div>
    </motion.div>
  )
}

// ── Marquee Ticker ────────────────────────────────────────────────────────
const TICKERS = [
  { sym: 'BTC', pct: '+4.21', bull: true }, { sym: 'ETH', pct: '+2.87', bull: true },
  { sym: 'SOL', pct: '+7.54', bull: true }, { sym: 'BNB', pct: '-1.12', bull: false },
  { sym: 'ARB', pct: '+12.3', bull: true }, { sym: 'OP', pct: '+9.8', bull: true },
  { sym: 'AVAX', pct: '+3.4', bull: true }, { sym: 'INJ', pct: '-0.6', bull: false },
  { sym: 'SUI', pct: '+18.2', bull: true }, { sym: 'PEPE', pct: '+31.7', bull: true },
]

function TickerBar() {
  return (
    <div className="relative flex overflow-hidden border-y border-white/[0.06] bg-black/40 py-3">
      <div className="flex gap-8 animate-[marquee_25s_linear_infinite] whitespace-nowrap pr-8">
        {[...TICKERS, ...TICKERS].map((t, i) => (
          <span key={i} className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">{t.sym}/USDT</span>
            <span className={t.bull ? 'text-emerald-400' : 'text-red-400'}>{t.pct}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Risk Disclaimer Banner ─────────────────────────────────────────────────
function DisclaimerBanner() {
  return (
    <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3 text-xs text-amber-200/70 leading-relaxed">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
      <span>
        <strong className="text-amber-400">Disclaimer Risiko:</strong> Trading aset kripto mengandung risiko tinggi kehilangan modal.
        Sinyal yang disediakan <strong>bukan merupakan rekomendasi investasi</strong>.
        Hasil masa lalu tidak menjamin hasil masa depan. Gunakan dengan bijak.
      </span>
    </div>
  )
}

// ── Main Landing Page ─────────────────────────────────────────────────────
export default function Landing() {
  const { isAuthenticated } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { scrollY } = useScroll()
  const navBg = useTransform(scrollY, [0, 80], ['rgba(0,0,0,0)', 'rgba(5,5,5,0.95)'])
  const navBorder = useTransform(scrollY, [0, 80], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.06)'])

  return (
    <div className="min-h-screen bg-[#030303] text-white overflow-x-hidden">
      <SEOHead
        title="Terminal Trading Kripto Berbasis AI | Multi-Timeframe Scanner"
        description="Platform trading kripto institusional dengan sinyal multi-timeframe (MTF), bullish scanner real-time, dan analisis teknikal berbasis algoritma. Dapatkan edge di pasar crypto dengan Hellnah Terminal."
        canonical="/"
        ogType="website"
      />
      <style>{`
        @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes pulse-glow{0%,100%{opacity:0.4}50%{opacity:0.8}}
        .float-anim{animation:float 6s ease-in-out infinite}
        .float-anim-slow{animation:float 8s ease-in-out infinite}
      `}</style>

      {/* ── NAVBAR ── */}
      <motion.nav
        style={{ backgroundColor: navBg, borderColor: navBorder, top: 'var(--snackbar-h, 0px)' }}
        className="fixed left-0 right-0 z-50 backdrop-blur-xl border-b transition-all"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center shrink-0">
              <Logo variant="horizontal" className="h-9 w-auto" />
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#fitur" className="text-sm text-slate-400 hover:text-white transition-colors">Fitur</a>
              <a href="#cara-kerja" className="text-sm text-slate-400 hover:text-white transition-colors">Cara Kerja</a>
              <Link to="/articles" className="text-sm text-slate-400 hover:text-white transition-colors">Artikel</Link>
              <Link to="/support" className="text-sm text-slate-400 hover:text-white transition-colors">Support</Link>
            </div>

            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated ? (
                <Link
                  to="/app"
                  className="flex items-center gap-2 text-sm font-bold bg-gold-gradient text-black px-5 py-2.5 rounded-xl hover:opacity-90 transition-all active:scale-95"
                >
                  Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link to="/login" className="text-sm text-slate-300 hover:text-white px-4 py-2 transition-colors">
                    Masuk
                  </Link>
                  <Link
                    to="/login"
                    className="text-sm font-bold bg-gold-gradient text-black px-5 py-2.5 rounded-xl hover:opacity-90 transition-all active:scale-95"
                  >
                    Coba Gratis
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu btn */}
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              className="md:hidden text-slate-400 hover:text-white p-2"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-white/[0.06] bg-black/95 backdrop-blur-xl overflow-hidden"
            >
              <div className="px-6 py-4 space-y-3">
                <a href="#fitur" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-slate-300 py-2">Fitur</a>
                <a href="#cara-kerja" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-slate-300 py-2">Cara Kerja</a>
                <Link to="/articles" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-slate-300 py-2">Artikel</Link>
                <Link to="/support" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-slate-300 py-2">Support</Link>
                {isAuthenticated ? (
                  <Link to="/app" onClick={() => setMobileMenuOpen(false)}
                    className="block w-full text-center bg-gold-gradient text-black text-sm font-bold py-3 rounded-xl mt-2">
                    Dashboard
                  </Link>
                ) : (
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}
                    className="block w-full text-center bg-gold-gradient text-black text-sm font-bold py-3 rounded-xl mt-2">
                    Mulai Gratis
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-16 overflow-hidden">

        {/* Background elements */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,rgba(180,120,30,0.18),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '44px 44px' }}
        />
        {/* Floating orbs */}
        <div className="absolute top-1/4 left-[8%] w-80 h-80 bg-amber-600/15 rounded-full blur-[120px] float-anim" />
        <div className="absolute bottom-1/3 right-[8%] w-80 h-80 bg-yellow-600/15 rounded-full blur-[120px] float-anim-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-900/10 rounded-full blur-[150px]" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center pt-20 pb-10">

          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 bg-white/[0.06] border border-amber-500/20 px-4 py-1.5 rounded-full text-xs font-medium text-slate-300 mb-8"
          >
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Live — Binance · KuCoin · OKX · Crypto.com
            <ChevronRight className="w-3 h-3 text-slate-500" />
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6"
          >
            <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              Scanner Sinyal MTF
            </span>
            <br />
            <span className="text-gold-gradient">
              untuk Trader Kripto
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            Temukan koin berpotensi naik lebih cepat — dengan <strong className="text-white font-semibold">Bullish Scanner MTF</strong> yang menggabungkan sinyal classic & weighted dari 4 timeframe secara simultan, langsung dari 4 exchange terbesar.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4"
          >
            <Link
              to={isAuthenticated ? "/app" : "/login"}
              className="group w-full sm:w-auto bg-gold-gradient text-black font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-[0_0_30px_rgba(212,166,58,0.3)] text-base"
            >
              {isAuthenticated ? 'Buka Dashboard' : 'Mulai Gratis — Tanpa Kartu Kredit'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#cara-kerja"
              className="w-full sm:w-auto bg-white/[0.06] border border-white/[0.12] text-white font-semibold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/[0.1] hover:border-white/20 transition-all text-base"
            >
              <Eye className="w-4 h-4" /> Lihat Demo Live
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-xs text-slate-600 mb-8"
          >
            Tidak perlu kartu kredit · Setup dalam 2 menit · Gratis selamanya untuk akun Starter
          </motion.p>

          {/* Disclaimer mini */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="max-w-2xl mx-auto"
          >
            <DisclaimerBanner />
          </motion.div>
        </div>

        {/* Hero Dashboard Preview — BIGGER */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-6xl mx-auto px-4 pb-20"
        >
          <div className="relative rounded-2xl border border-amber-500/20 overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9),0_0_80px_rgba(180,120,30,0.08)] bg-[#080808]">
            {/* Fake titlebar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#111] border-b border-white/[0.07]">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="text-xs text-slate-600 ml-2 font-mono">hellnah-terminal.id/terminal</span>
              <div className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                LIVE
              </div>
            </div>
            {/* Mock terminal UI */}
            <div className="grid grid-cols-12 min-h-[420px] text-xs font-mono">
              {/* Sidebar */}
              <div className="col-span-2 bg-[#0a0a0a] border-r border-white/[0.06] p-3 hidden md:block">
                <div className="text-slate-600 text-[10px] font-bold uppercase mb-3 tracking-wider">Top Coins</div>
                {['BTC','ETH','SOL','ARB','OP','INJ','SUI'].map((s, i) => (
                  <div key={s} className={`py-1.5 px-2 rounded text-[10px] mb-0.5 flex justify-between items-center ${i === 0 ? 'bg-amber-500/10 text-white border border-amber-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
                    <span>{s}</span>
                    <span className={i % 3 !== 1 ? 'text-emerald-400' : 'text-red-400'}>{i % 3 !== 1 ? '▲' : '▼'}</span>
                  </div>
                ))}
              </div>
              {/* Chart area */}
              <div className="col-span-12 md:col-span-7 p-5 relative">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-white font-bold text-sm">BTC/USDT</span>
                  <span className="text-emerald-400 text-xs bg-emerald-400/10 px-2 py-0.5 rounded">+4.21%</span>
                  <span className="text-slate-500 text-xs">1H</span>
                  {['15m','30m','1H','4H'].map(tf => (
                    <span key={tf} className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer ${tf === '1H' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}>{tf}</span>
                  ))}
                </div>
                {/* Fake candlestick chart */}
                <div className="flex items-end gap-[3px] h-56 px-2 mb-3">
                  {[60,45,70,55,80,65,90,75,85,95,72,88,65,78,92,68,82,95,74,86,96,70,83,97,75,89,68,82,93,77,85,91,88,94,79,96,84,90,87,92].map((h, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 gap-[1px]">
                      <div className="w-[1px] bg-slate-700" style={{ height: `${Math.abs(Math.sin(i)) * 10 + 3}%` }} />
                      <div
                        className={`w-full rounded-[1px] ${i % 3 !== 1 ? 'bg-emerald-500/80' : 'bg-red-500/70'}`}
                        style={{ height: `${h * 0.45 + 8}%` }}
                      />
                      <div className="w-[1px] bg-slate-700" style={{ height: `${Math.abs(Math.cos(i)) * 8 + 2}%` }} />
                    </div>
                  ))}
                </div>
                {/* Indicator row */}
                <div className="flex gap-4 text-[9px] text-slate-600">
                  <span>EMA20 <span className="text-amber-400">65,240</span></span>
                  <span>RSI <span className="text-emerald-400">58.4</span></span>
                  <span>MACD <span className="text-emerald-400">▲ 124</span></span>
                  <span>Vol <span className="text-blue-400">2.4B</span></span>
                </div>
              </div>
              {/* Scanner panel */}
              <div className="col-span-3 bg-[#0a0a0a] border-l border-white/[0.06] p-4 hidden md:flex flex-col">
                <div className="text-slate-600 text-[10px] font-bold uppercase mb-3 tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  Bullish Scanner MTF
                </div>
                {[
                  { sym: 'SUI', pct: '91.2', tf: '4H+1H+30m+15m' },
                  { sym: 'SOL', pct: '84.7', tf: '4H+1H+30m' },
                  { sym: 'ARB', pct: '77.3', tf: '1H+30m+15m' },
                  { sym: 'ETH', pct: '72.1', tf: '4H+1H' },
                  { sym: 'BTC', pct: '68.9', tf: '1H+4H' },
                  { sym: 'INJ', pct: '61.4', tf: '30m+15m' },
                ].map((r, i) => (
                  <div key={i} className={`mb-3 p-2 rounded-lg ${i === 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : ''}`}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-200 font-bold">{r.sym}</span>
                      <span className="text-emerald-400 font-bold">{r.pct}%</span>
                    </div>
                    <div className="w-full bg-white/[0.05] rounded-full h-[4px] mb-1">
                      <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all" style={{ width: `${r.pct}%` }} />
                    </div>
                    <div className="text-[8px] text-slate-600">{r.tf}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Glow under preview */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-amber-500/15 blur-[60px] rounded-full" />
        </motion.div>
      </section>

      {/* ── TICKER BAR ── */}
      <TickerBar />

      {/* ── PARTNER EXCHANGES ── */}
      <section className="py-16 border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4">
          <p className="text-center text-xs font-bold tracking-widest uppercase text-slate-600 mb-10">Terhubung Langsung ke Exchange Terbesar</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'Binance', color: 'text-yellow-400', bg: 'bg-yellow-400/8 border-yellow-400/20', symbol: 'B' },
              { name: 'KuCoin', color: 'text-emerald-400', bg: 'bg-emerald-400/8 border-emerald-400/20', symbol: 'K' },
              { name: 'OKX', color: 'text-blue-400', bg: 'bg-blue-400/8 border-blue-400/20', symbol: 'O' },
              { name: 'Crypto.com', color: 'text-indigo-400', bg: 'bg-indigo-400/8 border-indigo-400/20', symbol: 'C' },
            ].map((ex) => (
              <div key={ex.name} className={`flex flex-col items-center gap-3 p-6 rounded-2xl border ${ex.bg} group hover:scale-105 transition-transform duration-300`}>
                <div className={`w-14 h-14 rounded-2xl ${ex.bg} border ${ex.bg.split(' ')[1]} flex items-center justify-center`}>
                  <span className={`text-2xl font-black ${ex.color}`}>{ex.symbol}</span>
                </div>
                <span className="text-white font-bold text-sm">{ex.name}</span>
                <span className="text-slate-500 text-xs">Spot & Futures</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-24 border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-12">
          <StatCounter value={850} suffix="K+" label="Sinyal Dianalisis" />
          <StatCounter value={4} label="Timeframe Simultan (15m–4H)" />
          <StatCounter value={80} suffix="+" label="Koin Dianalisis Sekaligus" />
          <StatCounter value={1200} suffix="+" label="Trader Aktif" />
        </div>
        <p className="text-center text-xs text-slate-700 mt-8 max-w-lg mx-auto">
          * Statistik berdasarkan data penggunaan platform sejak Januari 2024. Sinyal merupakan output analisis teknikal, bukan prediksi harga.
        </p>
      </section>

      {/* ── FEATURES ── */}
      <section id="fitur" className="py-28 max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-amber-400 mb-4"
          >
            <Zap className="w-3.5 h-3.5" /> Fitur Platform
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-black text-white"
          >
            Semua Alat yang Anda Butuhkan<br />
            <span className="text-slate-500">dalam Satu Platform</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 mt-4 max-w-xl mx-auto text-sm leading-relaxed"
          >
            Dari scanner sinyal hingga analisis mendalam — dirancang untuk membantu Anda membuat keputusan trading yang lebih terstruktur.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: <Activity className="w-5 h-5 text-emerald-400" />, title: 'Bullish Scanner MTF', desc: 'Scan hingga 80+ koin sekaligus menggunakan 4 timeframe (15m, 30m, 1H, 4H). Gabungan sinyal classic & weighted memberikan konfirmasi lebih komprehensif sebelum entry.', delay: 0 },
            { icon: <BarChart2 className="w-5 h-5 text-amber-400" />, title: 'Chart Real-Time', desc: 'Tampilan candlestick profesional dengan overlay indikator EMA, MACD, RSI, dan Bollinger Bands — data langsung dari exchange tanpa delay tambahan.', delay: 0.08 },
            { icon: <TrendingUp className="w-5 h-5 text-yellow-400" />, title: 'Sinyal Kuantitatif', desc: 'Algoritma pembobotan: Harga (30%) + Volume (20%) + Teknikal (35%) + Sentimen (15%). Metodologi transparan yang telah melalui proses backtesting historis.', delay: 0.16 },
            { icon: <Globe className="w-5 h-5 text-orange-400" />, title: 'Multi-Exchange', desc: 'Terhubung langsung ke Binance, KuCoin, OKX, dan Crypto.com — pasar spot maupun futures perpetual — tanpa perlu memasukkan API key pribadi Anda.', delay: 0.24 },
            { icon: <Cpu className="w-5 h-5 text-pink-400" />, title: 'Fear & Greed Index', desc: 'Integrasikan sentimen pasar dari Fear & Greed Index dan data Funding Rate real-time sebagai faktor konteks tambahan dalam interpretasi sinyal scanner.', delay: 0.32 },
            { icon: <Lock className="w-5 h-5 text-blue-400" />, title: 'Session Terenkripsi', desc: 'Sesi trading Anda terproteksi penuh. Tidak ada data akun atau API key sensitif yang tersimpan di server kami — kalkulasi sinyal berjalan secara lokal.', delay: 0.40 },
          ].map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="cara-kerja" className="py-28 border-y border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-amber-400 mb-4">
              <Clock className="w-3.5 h-3.5" /> Cara Kerja
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white">
              Dari Data ke Insight<br />
              <span className="text-slate-500">dalam Hitungan Detik</span>
            </h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto text-sm">
              Proses analisis yang kompleks disederhanakan menjadi 3 langkah yang dapat langsung Anda gunakan.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-12 left-[calc(33%-2rem)] right-[calc(33%-2rem)] h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
            {[
              { n: '01', title: 'Pilih Exchange & Market', desc: 'Pilih salah satu dari Binance, KuCoin, OKX, atau Crypto.com. Tentukan pasar spot atau futures perpetual sesuai strategi Anda. Tidak perlu koneksi API key.', icon: <Globe className="w-7 h-7 text-amber-400" /> },
              { n: '02', title: 'Scanner Menganalisis Otomatis', desc: 'Hellnah Terminal menarik data 4 timeframe untuk tiap koin, menjalankan 20+ indikator teknikal secara bersamaan, dan menghitung skor gabungan berdasarkan bobot yang terukur.', icon: <Cpu className="w-7 h-7 text-yellow-400" /> },
              { n: '03', title: 'Baca Hasil & Buat Keputusan', desc: 'Lihat ranking koin dari skor tertinggi. Klik untuk membuka chart lengkap dengan semua indikator. Gunakan analisis ini sebagai salah satu referensi sebelum mengambil keputusan.', icon: <TrendingUp className="w-7 h-7 text-emerald-400" /> },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.18 }}
                className="relative text-center group"
              >
                {/* Step number badge */}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center z-10">
                  <span className="text-[10px] font-black text-amber-400">{s.n}</span>
                </div>
                <div className="w-20 h-20 mx-auto rounded-2xl bg-white/[0.04] border border-white/[0.1] group-hover:border-amber-500/30 flex items-center justify-center mb-5 mt-2 transition-all duration-300 group-hover:bg-amber-500/5">
                  {s.icon}
                </div>
                <h3 className="text-white font-bold text-lg mb-3">{s.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 border-y border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-amber-400 mb-4">
              <Users className="w-3.5 h-3.5" /> Ulasan Trader
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white">Dipercaya Trader Indonesia</h2>
            <p className="text-slate-400 mt-4 text-sm max-w-lg mx-auto">Pengalaman nyata dari trader yang menggunakan Hellnah Terminal dalam rutinitas analisis mereka sehari-hari.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { name: 'Rizky Aditya', role: 'Day Trader', city: 'Jakarta', initials: 'RA', color: 'from-amber-600 to-yellow-500', text: 'Scanner MTF ini menghemat waktu saya luar biasa. Dulu butuh 2–3 jam cek chart manual, sekarang cukup 10 menit dengan Hellnah Terminal untuk dapat watchlist yang layak diperhatikan.' },
              { name: 'Fadhil Nugraha', role: 'Swing Trader', city: 'Bandung', initials: 'FN', color: 'from-emerald-600 to-teal-500', text: 'Sinyal 4 timeframe sekaligus itu benar-benar bantu saya dapat konfirmasi lebih solid sebelum entry. Saya tidak bergantung 100% di sini, tapi ini jadi referensi utama watchlist saya.' },
              { name: 'Siti Maulida', role: 'Crypto Analyst', city: 'Surabaya', initials: 'SM', color: 'from-pink-600 to-rose-500', text: 'Platform yang bersih, cepat, dan tidak berisik. Datanya relevan dan presentasinya jelas. Saya bisa langsung tahu koin mana yang layak untuk riset lebih lanjut.' },
              { name: 'Bagas Pratama', role: 'Position Trader', city: 'Yogyakarta', initials: 'BP', color: 'from-blue-600 to-indigo-500', text: 'Fitur futures scanner-nya yang bikin saya upgrade ke Pro. Bisa lihat sinyal di pasar perp sekaligus spot — sangat membantu untuk hedging posisi dengan lebih terencana.' },
              { name: 'Dinda Rahayu', role: 'Trader & Content Creator', city: 'Bali', initials: 'DR', color: 'from-violet-600 to-purple-500', text: 'Saya sering pakai hasil scanner ini sebagai bahan konten edukasi. Metodologinya transparan dan bisa dijelaskan ke follower — bukan black box seperti tools lain.' },
              { name: 'Hendra Wijaya', role: 'Portfolio Manager', city: 'Medan', initials: 'HW', color: 'from-orange-600 to-amber-500', text: 'Untuk manage portofolio kripto klien, Hellnah Terminal membantu screening awal yang jauh lebih efisien. Tentu tetap dikombinasi dengan analisis fundamental dan manajemen risiko sendiri.' },
            ].map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 3) * 0.1 }}
                className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 hover:border-amber-500/20 hover:bg-white/[0.05] transition-all duration-300"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center font-bold text-sm text-white shrink-0`}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">{t.name}</div>
                    <div className="text-slate-500 text-xs">{t.role} · {t.city}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIM ── */}
      {/* <section className="py-24 border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-amber-400 mb-4">
              <Users className="w-3.5 h-3.5" /> Tim Kami
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white">Dibangun oleh Praktisi</h2>
            <p className="text-slate-400 mt-4 text-sm max-w-md mx-auto">Tim gabungan dari engineer berpengalaman dan trader aktif yang memahami kebutuhan nyata di pasar kripto.</p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'Arif S.', role: 'CEO & Co-Founder', initials: 'AS', color: 'from-amber-600 to-yellow-500', desc: '8+ tahun di fintech & crypto trading' },
              { name: 'Bima R.', role: 'Lead Engineer', initials: 'BR', color: 'from-blue-600 to-indigo-500', desc: 'Spesialis data pipeline & real-time systems' },
              { name: 'Citra N.', role: 'Head of Product', initials: 'CN', color: 'from-emerald-600 to-teal-500', desc: 'UX specialist dengan background trading' },
              { name: 'Dimas K.', role: 'Quant Analyst', initials: 'DK', color: 'from-violet-600 to-purple-500', desc: 'Pengembang model sinyal & backtesting' },
            ].map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center group"
              >
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${m.color} flex items-center justify-center text-2xl font-black text-white mx-auto mb-4 group-hover:scale-105 transition-transform duration-300`}>
                  {m.initials}
                </div>
                <div className="text-white font-bold text-sm">{m.name}</div>
                <div className="text-amber-400/80 text-xs font-medium mt-1">{m.role}</div>
                <div className="text-slate-500 text-xs mt-1.5 leading-relaxed">{m.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section> */}

      {/* ── FINAL CTA ── */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(180,120,30,0.12),transparent)]" />
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-amber-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-yellow-600/10 rounded-full blur-[100px]" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 max-w-3xl mx-auto px-4 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-4 py-1.5 rounded-full mb-8">
            <Zap className="w-3 h-3" /> Mulai Sekarang — Gratis
          </div>
          <h2 className="text-5xl md:text-6xl font-black text-white leading-tight mb-6">
            Analisis Lebih Terstruktur,<br />
            <span className="text-gold-gradient">Keputusan Lebih Terinformasi</span>
          </h2>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            Bergabunglah dengan 1.200+ trader yang menggunakan Hellnah Terminal sebagai alat bantu analisis mereka. Mulai dengan akun Starter — gratis selamanya.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            {isAuthenticated ? (
              <Link
                to="/app"
                className="group bg-gold-gradient text-black font-bold px-10 py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-[0_0_40px_rgba(212,166,58,0.25)] text-base"
              >
                Buka Dashboard <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="group bg-gold-gradient text-black font-bold px-10 py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-[0_0_40px_rgba(212,166,58,0.25)] text-base"
                >
                  Buat Akun Gratis <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/login"
                  className="bg-white/[0.06] border border-white/[0.12] text-white font-semibold px-10 py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/[0.1] transition-all text-base"
                >
                  <Shield className="w-4 h-4" /> Masuk ke Terminal
                </Link>
              </>
            )}
          </div>

          <p className="text-xs text-slate-600 mb-8">Tidak perlu kartu kredit · Setup 2 menit · Upgrade kapan saja</p>

          {/* Disclaimer wajib di bawah CTA */}
          <DisclaimerBanner />
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] py-16">
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

          {/* Full legal disclaimer in footer */}
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
