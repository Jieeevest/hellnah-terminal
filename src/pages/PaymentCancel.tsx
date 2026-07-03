import { Link } from 'react-router-dom'
import { XCircle } from 'lucide-react'
import { Logo } from '@/components/Logo'

export default function PaymentCancel() {
  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center p-4">
      <div className="mb-10">
        <Logo variant="horizontal" className="w-auto h-16" />
      </div>

      <div className="bg-[#0a0a0a] border border-white/[0.06] rounded-3xl p-8 md:p-12 max-w-md w-full text-center shadow-2xl">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-white">Pembayaran Dibatalkan</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Proses pembayaran Anda telah dibatalkan. Jika Anda memiliki pertanyaan atau kendala, silakan hubungi tim dukungan kami.
          </p>
          
          <div className="flex flex-col gap-3 w-full">
            <Link 
              to="/app"
              className="w-full bg-gold-gradient text-black font-semibold py-3.5 rounded-xl hover:opacity-90 transition-opacity"
            >
              Kembali ke Dashboard
            </Link>
            <Link 
              to="/support"
              className="w-full flex justify-center items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm py-2"
            >
              Hubungi Customer Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
