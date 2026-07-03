import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { Menu, X, LayoutGrid, ArrowRight } from 'lucide-react'
import { useAuth } from '@/store/useAuth'
import { Logo } from '@/components/Logo'

export function Navbar() {
  const { isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const isLanding = location.pathname === '/'

  const { scrollY } = useScroll()
  const bg = useTransform(scrollY, [0, 80], [
    isLanding ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.75)',
    'rgba(0,0,0,0.92)',
  ])

  const isActive = (path: string) =>
    path === '/articles'
      ? location.pathname.startsWith('/articles')
      : location.pathname === path

  const linkClass = (path: string) =>
    `text-sm transition-colors font-medium ${
      isActive(path)
        ? 'text-white'
        : 'text-slate-400 hover:text-white'
    }`

  const mobileLinkClass = (path: string) =>
    `block text-sm py-2.5 font-semibold transition-colors ${
      isActive(path) ? 'text-primary' : 'text-slate-300 hover:text-white'
    }`

  const navLinks = [
    { to: '/',         label: 'Beranda' },
    { to: '/articles', label: 'Artikel & Berita' },
    { to: '/support',  label: 'Support CS' },
  ]

  return (
    <motion.nav
      style={{ backgroundColor: bg, top: 'var(--snackbar-h, 0px)' }}
      className="fixed left-0 right-0 z-50 backdrop-blur-xl border-b border-white/[0.06]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <Logo variant="horizontal" className="h-8 w-auto" />
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(l => (
              <div key={l.to} className="relative group">
                <Link to={l.to} className={linkClass(l.to)}>{l.label}</Link>
                {/* Active underline */}
                {isActive(l.to) && (
                  <motion.div
                    layoutId="navbar-underline"
                    className="absolute -bottom-[21px] left-0 right-0 h-[2px] bg-gold-gradient rounded-full"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/app"
                className="flex items-center gap-2 text-sm font-bold bg-white text-black px-5 py-2 rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-[0_0_24px_rgba(255,255,255,0.12)]"
              >
                <LayoutGrid className="w-4 h-4" /> Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-slate-300 hover:text-white px-3 py-2 transition-colors font-medium">
                  Login
                </Link>
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 text-sm font-bold bg-white text-black px-5 py-2 rounded-xl hover:bg-white/90 active:scale-95 transition-all"
                >
                  Mulai Gratis <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(v => !v)}
            className="md:hidden text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-white/[0.06] bg-black/95 backdrop-blur-2xl overflow-hidden"
          >
            <div className="px-6 py-5 space-y-1">
              {navLinks.map(l => (
                <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className={mobileLinkClass(l.to)}>
                  {l.label}
                </Link>
              ))}
              <div className="pt-4 border-t border-white/[0.08] mt-4">
                {isAuthenticated ? (
                  <Link
                    to="/app"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center gap-2 w-full bg-white text-black text-sm font-bold py-3 rounded-xl hover:bg-white/90 transition-colors"
                  >
                    <LayoutGrid className="w-4 h-4" /> Dashboard
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center gap-2 w-full bg-white text-black text-sm font-bold py-3 rounded-xl hover:bg-white/90 transition-colors"
                  >
                    Mulai Gratis <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
