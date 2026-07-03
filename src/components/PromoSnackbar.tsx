import { useState, useEffect, useRef } from 'react'
import { X, ArrowRight, Flame } from 'lucide-react'

export function PromoSnackbar() {
  const [isVisible, setIsVisible] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dismissed = localStorage.getItem('promo_founder_dismissed')
    if (!dismissed) setIsVisible(true)
  }, [])

  useEffect(() => {
    const el = barRef.current
    if (!el || !isVisible) {
      document.documentElement.style.setProperty('--snackbar-h', '0px')
      return
    }

    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--snackbar-h', `${el.offsetHeight}px`)
    })
    ro.observe(el)
    document.documentElement.style.setProperty('--snackbar-h', `${el.offsetHeight}px`)

    return () => {
      ro.disconnect()
      document.documentElement.style.setProperty('--snackbar-h', '0px')
    }
  }, [isVisible])

  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem('promo_founder_dismissed', 'true')
  }

  if (!isVisible) return null

  return (
    <div
      ref={barRef}
      className="fixed top-0 left-0 right-0 z-[70] w-full overflow-hidden"
      style={{ background: 'linear-gradient(90deg, #92400e 0%, #b45309 30%, #d97706 60%, #b45309 100%)' }}
    >
      {/* Shimmer overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(90deg, transparent 0px, rgba(255,255,255,0.04) 1px, transparent 2px, transparent 40px)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-5">

        {/* Badges + text */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="flex items-center gap-1 bg-white/15 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/20">
            <Flame className="w-3 h-3 text-amber-200" />
            Slot Terbatas
          </span>

          <span className="bg-white text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
            50% OFF
          </span>

          <span className="text-white font-medium leading-snug">
            <span className="font-bold text-amber-100">Founder Price</span>
            {' '}— hanya untuk{' '}
            <span className="font-black text-white underline underline-offset-2 decoration-amber-300/60">50 orang pertama</span>
          </span>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://discord.gg/frKUwSfEdN"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold bg-white text-amber-800 hover:bg-amber-50 active:scale-95 px-3.5 py-1.5 rounded-full transition-all shadow-sm"
          >
            Join Discord <ArrowRight className="w-3 h-3" />
          </a>
          <a
            href="https://t.me/+1XGvKcuX8p4zN2E1"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-bold bg-[#2AABEE] hover:bg-[#229ED9] text-white active:scale-95 px-3.5 py-1.5 rounded-full transition-all shadow-sm"
          >
            Join Telegram <ArrowRight className="w-3 h-3" />
          </a>
        </div>

        {/* Close */}
        <button
          onClick={handleDismiss}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white hover:bg-white/15 rounded-full p-1.5 transition-colors"
          aria-label="Tutup"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
