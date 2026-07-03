import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, TrendingUp, ShieldCheck, Mail, Lock, User, AlertCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '@/store/useAuth'
import { Logo } from '@/components/Logo'
import { GoogleLogin } from '@react-oauth/google'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  
  const login = useAuth((state) => state.login)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionExpired = searchParams.get('reason') === 'session_expired'

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setIsLoading(true)

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
      const payload = isLogin
        ? { email, password }
        : { username, email, password }

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const data = await res.json()
      
      if (!data.success) {
        setErrorMsg(data.message || 'Terjadi kesalahan')
        setIsLoading(false)
        return
      }

      // Success
      login(data.data.accessToken, data.data.refreshToken, data.data.user)
      navigate('/app', { replace: true })
      
    } catch (err) {
      setErrorMsg('Gagal terhubung ke server')
      setIsLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setErrorMsg('')
    setIsLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: credentialResponse.credential,
        })
      })
      const data = await res.json()
      if (!data.success) {
        setErrorMsg(data.message || 'Login Google gagal')
        setIsLoading(false)
        return
      }
      login(data.data.accessToken, data.data.refreshToken, data.data.user)
      navigate('/app', { replace: true })
    } catch (err) {
      setErrorMsg('Gagal terhubung ke server')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#030303] flex text-foreground overflow-hidden selection:bg-primary/30">
      {/* Left Side - Visual/Branding (Hidden on mobile) */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-black to-[#030303] z-0" />
        <div className="absolute inset-0 opacity-[0.03] z-0" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <motion.div 
          className="absolute w-[600px] h-[600px] bg-primary/20 rounded-full blur-[150px] pointer-events-none"
          animate={{ x: mousePos.x * 0.1 - 300, y: mousePos.y * 0.1 - 300 }}
          transition={{ type: 'spring', damping: 50, stiffness: 50 }}
        />
        <div className="relative z-10 p-12 max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="flex items-center gap-4 mb-8">
            <Logo variant="horizontal" className="h-16 w-auto" />
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }} className="text-4xl font-light text-muted-foreground leading-tight mb-8">
            Terminal trading institusional dengan <br />
            <span className="text-white font-semibold">analisis multi-timeframe</span> dan <span className="text-primary font-semibold">sinyal kuantitatif.</span>
          </motion.h2>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.5 }} className="flex gap-6 mt-12">
            {[
              { icon: <Activity className="w-5 h-5 text-emerald-400" />, label: 'Real-time Scanner' },
              { icon: <TrendingUp className="w-5 h-5 text-blue-400" />, label: 'Algorithmic Signals' },
              { icon: <ShieldCheck className="w-5 h-5 text-purple-400" />, label: 'Encrypted Session' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                {f.icon}
                <span className="text-xs font-medium text-white/80">{f.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="flex-1 flex items-center justify-center relative z-10 p-4 lg:p-8">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[500px] bg-primary/20 rounded-full blur-[120px] lg:hidden pointer-events-none" />

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-[420px]">
          {sessionExpired && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm px-4 py-3 rounded-2xl"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Sesi kamu sudah habis. Silakan login kembali untuk melanjutkan.</span>
            </motion.div>
          )}
          <div className="bg-black/60 backdrop-blur-2xl border border-white/10 p-8 sm:p-10 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            
            <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/5 via-transparent to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            <div className="mb-10 lg:hidden flex items-center gap-3">
              <Logo variant="horizontal" className="h-10 w-auto" />
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isLogin ? 'Enter your credentials to access the terminal.' : 'Join the elite algorithmic traders.'}
              </p>
            </div>

            {/* Toggle Login / Register */}
            <div className="flex bg-[#0a0a0a] p-1 rounded-xl mb-8 border border-white/10 relative z-10">
              <button 
                type="button"
                onClick={() => { setIsLogin(true); setErrorMsg('') }}
                className={`flex-1 text-xs font-bold py-2.5 rounded-lg transition-colors ${isLogin ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'}`}
              >
                LOGIN
              </button>
              <button 
                type="button"
                onClick={() => { setIsLogin(false); setErrorMsg('') }}
                className={`flex-1 text-xs font-bold py-2.5 rounded-lg transition-colors ${!isLogin ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white'}`}
              >
                REGISTER
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
              <AnimatePresence>
                {errorMsg && (
                  <motion.div initial={{ opacity: 0, height: 0, scale: 0.95 }} animate={{ opacity: 1, height: 'auto', scale: 1 }} exit={{ opacity: 0, height: 0, scale: 0.95 }} className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-3 overflow-hidden">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-center mb-4">
                <GoogleLogin 
                  onSuccess={handleGoogleSuccess} 
                  onError={() => setErrorMsg('Login Google dibatalkan')}
                  theme="filled_black"
                  shape="pill"
                  text={isLogin ? 'signin_with' : 'signup_with'}
                />
              </div>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-white/40 text-xs">ATAU EMAIL</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-xs font-bold tracking-wider text-muted-foreground ml-1">USERNAME</label>
                  <div className="relative group/input">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within/input:text-primary transition-colors">
                      <User className="h-4 w-4" />
                    </div>
                    <input 
                      type="text" value={username} onChange={(e) => setUsername(e.target.value)} required={!isLogin}
                      className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:border-primary/50 focus:bg-[#111] focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-white/20"
                      placeholder="Trader_One"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold tracking-wider text-muted-foreground ml-1">EMAIL</label>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within/input:text-primary transition-colors">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input 
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:border-primary/50 focus:bg-[#111] focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-white/20"
                    placeholder="trader@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold tracking-wider text-muted-foreground ml-1">PASSWORD</label>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within/input:text-primary transition-colors">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input 
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                    className="w-full bg-[#0a0a0a] border border-white/10 text-white text-sm rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:border-primary/50 focus:bg-[#111] focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-white/20"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="w-full mt-8 bg-white text-black font-bold rounded-2xl py-3.5 px-4 flex items-center justify-center gap-2 hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed group/btn">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <>
                    <span>{isLogin ? 'Secure Login' : 'Create Account'}</span>
                    <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 flex items-center justify-center gap-2 text-[11px] font-medium text-muted-foreground/60 tracking-widest uppercase relative z-10">
              <ShieldCheck className="h-3 w-3" />
              <span>AES-256 Encrypted Session</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

