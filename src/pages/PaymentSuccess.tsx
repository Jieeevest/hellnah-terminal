import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { useAuth } from '@/store/useAuth'
import { Logo } from '@/components/Logo'
import { fetchWithAuth } from '@/lib/api'

export default function PaymentSuccess() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { accessToken, updateUser } = useAuth()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Memverifikasi pembayaran Anda...')
  const retryCount = useRef(0)
  const MAX_RETRIES = 15 // 30 seconds total

  const ipaymuStatus = searchParams.get('status')
  const isPaidByIpaymu = ipaymuStatus === 'berhasil' || ipaymuStatus === 'success'

  useEffect(() => {
    if (!accessToken) {
      navigate('/login')
      return
    }

    const checkStatus = async () => {
      try {
        const res = await fetchWithAuth('/api/auth/me')
        const data = await res.json()

        if (data.success) {
          if (data.data.subscription_tier === 'pro') {
            updateUser(data.data)
            setStatus('success')
            setMessage('Pembayaran berhasil! Akun Anda kini berstatus PRO.')
            setTimeout(() => navigate('/app'), 3000)
            return
          }

          if (retryCount.current < MAX_RETRIES) {
            retryCount.current += 1
            const seconds = MAX_RETRIES - retryCount.current
            setMessage(
              isPaidByIpaymu
                ? `Pembayaran dikonfirmasi, menunggu aktivasi akun... (${seconds}s)`
                : 'Menunggu konfirmasi dari iPaymu...'
            )
            setTimeout(checkStatus, 2000)
          } else {
            setStatus('error')
            setMessage(
              isPaidByIpaymu
                ? 'Pembayaran berhasil di iPaymu namun aktivasi akun tertunda. Silakan hubungi CS dengan bukti pembayaran.'
                : 'Pembayaran mungkin sedang diproses. Silakan cek kembali beberapa saat lagi.'
            )
          }
        } else {
          setStatus('error')
          setMessage('Gagal memverifikasi status akun.')
        }
      } catch {
        setStatus('error')
        setMessage('Terjadi kesalahan sistem saat memverifikasi pembayaran.')
      }
    }

    checkStatus()
  }, [accessToken, navigate, updateUser, isPaidByIpaymu])

  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center p-4">
      <div className="mb-10">
        <Logo variant="horizontal" className="w-auto h-16" />
      </div>

      <div className="bg-[#0a0a0a] border border-white/[0.06] rounded-3xl p-8 md:p-12 max-w-md w-full text-center shadow-2xl">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <Loader2 className="w-16 h-16 text-amber-500 animate-spin mb-6" />
            <h2 className="text-xl font-bold mb-2">Memproses Pembayaran</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">Sukses!</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">{message}</p>
            <p className="text-xs text-slate-500">Mengalihkan ke Dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-white">Menunggu Proses</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">{message}</p>
            <div className="flex gap-4 w-full">
              <button
                onClick={() => navigate('/app')}
                className="flex-1 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white font-semibold py-3 rounded-xl transition-all"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/support')}
                className="flex-1 bg-gold-gradient text-black font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity"
              >
                Hubungi CS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
