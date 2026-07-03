import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ChevronRight, ChevronLeft, BarChart2, Scan,
  LayoutGrid, TrendingUp, User, BookOpen, Zap, Coins,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  id: string
  title: string
  description: string
  target: string | null
  position: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'bottom-left'
  icon: React.ReactNode
  badge?: string
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Selamat Datang di Hellnah Terminal Terminal!',
    description:
      'Kami siapkan tur singkat untuk mengenalkan semua fitur terminal trading ini. Ikuti langkah-langkahnya atau skip kapan saja.',
    target: null,
    position: 'center',
    icon: <Zap className="h-5 w-5 text-yellow-400" />,
  },
  {
    id: 'exchange',
    title: 'Pilih Exchange',
    description:
      'Switch antara 4 bursa kripto terbesar: Binance, Crypto.com, KuCoin, dan OKX — semua dengan data real-time langsung dari websocket exchange-nya.',
    target: '[data-tutorial="exchange-tabs"]',
    position: 'bottom',
    icon: <Coins className="h-5 w-5 text-blue-400" />,
  },
  {
    id: 'market-type',
    title: 'Spot vs Futures',
    description:
      'Toggle antara pasar Spot (beli/jual aset langsung) dan Futures Perpetual (kontrak dengan leverage). Keduanya tersedia di semua 4 exchange beserta data funding rate real-time.',
    target: '[data-tutorial="market-type"]',
    position: 'bottom',
    icon: <TrendingUp className="h-5 w-5 text-emerald-400" />,
  },
  {
    id: 'coin-list',
    title: 'Daftar Koin',
    description:
      'Cari dan pilih dari ratusan pasangan trading. Harga, volume 24 jam, dan persentase perubahan diperbarui secara real-time. Klik koin mana saja untuk langsung melihat chartnya.',
    target: '[data-tutorial="coin-list"]',
    position: 'right',
    icon: <Scan className="h-5 w-5 text-purple-400" />,
  },
  {
    id: 'trading-chart',
    title: 'Chart TradingView',
    description:
      'Chart interaktif powered by TradingView. Gunakan 100+ indikator teknikal bawaan: RSI, MACD, Bollinger Bands, EMA, dan banyak lagi. Kamu juga bisa switch sumber chart sesuai exchange yang aktif.',
    target: '[data-tutorial="symbol-bar"]',
    position: 'bottom',
    icon: <BarChart2 className="h-5 w-5 text-blue-400" />,
  },
  {
    id: 'orderbook',
    title: 'Order Book & Trade History',
    description:
      'Tab Book: pantau bids (hijau) dan asks (merah) real-time untuk membaca depth pasar. Tab Trades: lihat histori transaksi terbaru yang sudah tereksekusi.',
    target: '[data-tutorial="right-tabs"]',
    position: 'left',
    icon: <BookOpen className="h-5 w-5 text-green-400" />,
  },
  {
    id: 'signal',
    title: 'Panel Analisa (PRO)',
    description:
      'Sinyal algoritmik berbasis multi-indikator teknikal. Mode Spot: sinyal entry/exit berdasarkan RSI, MACD, EMA. Mode Futures: deteksi peluang Long/Short dengan scoring otomatis.',
    target: '[data-tutorial="right-tabs"]',
    position: 'left',
    icon: <BarChart2 className="h-5 w-5 text-primary" />,
    badge: 'PRO',
  },
  {
    id: 'scanner',
    title: 'Bullish Scanner (PRO)',
    description:
      'Scanner otomatis yang men-scan seluruh pasar dan mendeteksi setup bullish secara real-time. Hemat waktu — tidak perlu analisa coin satu per satu.',
    target: '[data-tutorial="right-tabs"]',
    position: 'left',
    icon: <Scan className="h-5 w-5 text-orange-400" />,
    badge: 'PRO',
  },
  {
    id: 'chart-mode',
    title: 'Grid Mode (PRO)',
    description:
      'Monitor beberapa aset sekaligus dalam satu tampilan grid. Tambahkan koin ke grid via tombol "+ Grid" di symbol bar, dan pantau gerakannya secara bersamaan.',
    target: '[data-tutorial="chart-mode"]',
    position: 'bottom',
    icon: <LayoutGrid className="h-5 w-5 text-yellow-400" />,
    badge: 'PRO',
  },
  {
    id: 'profile',
    title: 'Profil & Subscription',
    description:
      'Klik avatar untuk mengelola akun, cek info subscription, dan upgrade ke PRO untuk unlock semua fitur premium: Sinyal Algoritmik, Bullish Scanner, dan Grid Mode.',
    target: '[data-tutorial="user-profile"]',
    position: 'bottom-left',
    icon: <User className="h-5 w-5 text-violet-400" />,
  },
]

const TOOLTIP_W = 368
const SPOTLIGHT_PAD = 10

interface Rect { x: number; y: number; width: number; height: number }

function calcTooltipPos(rect: Rect, pos: Step['position'], ww: number, wh: number) {
  const gap = 16
  const th = 260

  const clampX = (x: number) => Math.max(16, Math.min(x, ww - TOOLTIP_W - 16))
  const clampY = (y: number) => Math.max(16, Math.min(y, wh - th - 16))

  switch (pos) {
    case 'bottom':
      return { left: clampX(rect.x + rect.width / 2 - TOOLTIP_W / 2), top: rect.y + rect.height + gap }
    case 'top':
      return { left: clampX(rect.x + rect.width / 2 - TOOLTIP_W / 2), top: rect.y - th - gap }
    case 'right':
      return { left: Math.min(rect.x + rect.width + gap, ww - TOOLTIP_W - 16), top: clampY(rect.y + rect.height / 2 - th / 2) }
    case 'left':
      return { left: Math.max(16, rect.x - TOOLTIP_W - gap), top: clampY(rect.y + rect.height / 2 - th / 2) }
    case 'bottom-left':
      return { left: clampX(rect.x + rect.width - TOOLTIP_W), top: rect.y + rect.height + gap }
    case 'center':
    default:
      return { left: ww / 2 - TOOLTIP_W / 2, top: wh / 2 - th / 2 }
  }
}

interface Props {
  isActive: boolean
  currentStep: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}

export function TutorialStepper({ isActive, currentStep, onNext, onPrev, onSkip }: Props) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [win, setWin] = useState({ w: window.innerWidth, h: window.innerHeight })
  const isMobile = win.w < 1024

  const step = STEPS[currentStep]
  const total = STEPS.length
  const isLast = currentStep === total - 1
  const isFirst = currentStep === 0

  useEffect(() => {
    const onResize = () => setWin({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!isActive || !step.target || isMobile) {
      setTargetRect(null)
      return
    }
    const update = () => {
      const el = document.querySelector(step.target!)
      if (!el) return
      const r = el.getBoundingClientRect()
      setTargetRect({
        x: r.x - SPOTLIGHT_PAD,
        y: r.y - SPOTLIGHT_PAD,
        width: r.width + SPOTLIGHT_PAD * 2,
        height: r.height + SPOTLIGHT_PAD * 2,
      })
    }
    update()
    const t = setTimeout(update, 120)
    return () => clearTimeout(t)
  }, [isActive, step, currentStep, isMobile])

  if (!isActive) return null

  const spotRect = targetRect ?? { x: win.w / 2 - 200, y: win.h / 2 - 80, width: 400, height: 160 }
  const tooltipPos = isMobile || !targetRect
    ? { left: win.w / 2 - TOOLTIP_W / 2, top: win.h / 2 - 130 }
    : calcTooltipPos(spotRect, step.position, win.w, win.h)

  const tooltipLeftClamped = Math.max(12, Math.min(tooltipPos.left, win.w - TOOLTIP_W - 12))
  const tooltipTopClamped = Math.max(12, tooltipPos.top)

  return createPortal(
    <AnimatePresence>
      {isActive && (
        <>
          {/* Dark overlay with spotlight cutout via SVG mask */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ position: 'fixed', inset: 0, zIndex: 9990, pointerEvents: 'none' }}
          >
            <svg
              width={win.w}
              height={win.h}
              style={{ position: 'absolute', inset: 0, display: 'block' }}
            >
              <defs>
                <mask id="cx-tutorial-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {!isMobile && targetRect && (
                    <motion.rect
                      key={currentStep}
                      initial={{ x: spotRect.x + spotRect.width / 2, y: spotRect.y + spotRect.height / 2, width: 0, height: 0 }}
                      animate={{ x: spotRect.x, y: spotRect.y, width: spotRect.width, height: spotRect.height }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      rx={10}
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.80)"
                mask="url(#cx-tutorial-mask)"
              />
            </svg>

            {/* Pulsing spotlight border */}
            {!isMobile && targetRect && (
              <motion.div
                key={`border-${currentStep}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'absolute',
                  left: spotRect.x,
                  top: spotRect.y,
                  width: spotRect.width,
                  height: spotRect.height,
                  borderRadius: 10,
                  border: '2px solid hsl(var(--primary))',
                  boxShadow: '0 0 0 4px hsl(var(--primary) / 0.15), 0 0 24px hsl(var(--primary) / 0.25)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </motion.div>

          {/* Click blocker */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 9991, cursor: 'default' }} />

          {/* Tooltip card */}
          <motion.div
            key={`tip-${currentStep}`}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              left: tooltipLeftClamped,
              top: tooltipTopClamped,
              width: TOOLTIP_W,
              zIndex: 9992,
            }}
            className="bg-[#0d0d0f] border border-white/12 rounded-2xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)] overflow-hidden"
          >
            {/* Step number strip */}
            <div className="h-0.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" style={{ width: `${((currentStep + 1) / total) * 100}%`, transition: 'width 0.3s ease' }} />

            {/* Header */}
            <div className="p-5 pb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white/6 border border-white/8">
                    {step.icon}
                  </div>
                  {step.badge && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 tracking-widest">
                      {step.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-white/25 tabular-nums">
                    {currentStep + 1}/{total}
                  </span>
                  <button
                    onClick={onSkip}
                    className="p-1 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/6 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-white text-[15px] leading-snug mb-2">{step.title}</h3>
              <p className="text-[13px] text-white/55 leading-relaxed">{step.description}</p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/6 bg-white/[0.02]">
              {/* Progress dots */}
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-full transition-all duration-300',
                      i === currentStep
                        ? 'w-5 h-1.5 bg-primary'
                        : i < currentStep
                        ? 'w-1.5 h-1.5 bg-white/35'
                        : 'w-1.5 h-1.5 bg-white/12'
                    )}
                  />
                ))}
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-1.5">
                {!isFirst && (
                  <button
                    onClick={onPrev}
                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-white/40 hover:text-white/70 hover:bg-white/6 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Kembali
                  </button>
                )}
                {isFirst && (
                  <button
                    onClick={onSkip}
                    className="px-3 py-1.5 text-[11px] font-semibold text-white/30 hover:text-white/55 hover:bg-white/6 rounded-lg transition-colors"
                  >
                    Skip Tour
                  </button>
                )}
                <button
                  onClick={() => onNext()}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-bold bg-white text-black rounded-lg hover:bg-white/90 active:scale-[0.97] transition-all"
                >
                  {isLast ? 'Mulai Trading!' : 'Lanjut'}
                  {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

export { STEPS }
