import { Link } from 'react-router-dom'
import { Crown, Lock, RefreshCw } from 'lucide-react'
import { useAuth, isProActive } from '@/store/useAuth'
import { motion } from 'framer-motion'

const DEV_MODE = import.meta.env.VITE_DEV_MODE === '1'

interface ProGateProps {
  children: React.ReactNode
  feature?: string
}

export function ProGate({ children, feature = 'fitur ini' }: ProGateProps) {
  const { user } = useAuth()
  const active = isProActive(user)
  const expired = user?.subscription_tier === 'pro' && !active

  if (DEV_MODE || active) return <>{children}</>

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg">
      {/* Blurred preview */}
      <div className="w-full h-full blur-sm pointer-events-none select-none opacity-40 overflow-hidden">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="flex flex-col items-center gap-4 text-center px-6"
        >
          {expired ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-orange-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base mb-1">Subscription Habis</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Akses ke <span className="text-white font-medium">{feature}</span> telah berakhir. Perbarui subscription untuk lanjut.
                </p>
              </div>
              <Link
                to="/profile"
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity shadow-lg shadow-orange-500/20"
              >
                <RefreshCw className="w-4 h-4" />
                Perbarui Sekarang
              </Link>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-purple-500/20 border border-yellow-500/30 flex items-center justify-center">
                <Crown className="w-8 h-8 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base mb-1">Fitur PRO</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Upgrade ke PRO untuk mengakses <span className="text-white font-medium">{feature}</span> dan semua fitur eksklusif lainnya.
                </p>
              </div>
              <Link
                to="/profile"
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold rounded-xl text-sm hover:opacity-90 transition-opacity shadow-lg shadow-yellow-500/20"
              >
                <Crown className="w-4 h-4" />
                Upgrade ke PRO — Rp 89K/bln
              </Link>
            </>
          )}

          <p className="text-slate-600 text-xs">
            <Lock className="w-3 h-3 inline mr-1" />
            {expired
              ? `Subscription ${user?.username || 'Anda'} sudah berakhir`
              : `Akun ${user?.username || 'Anda'} saat ini dalam paket STARTER`}
          </p>
        </motion.div>
      </div>
    </div>
  )
}
