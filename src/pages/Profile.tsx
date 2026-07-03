import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, User, Lock, Check, AlertCircle } from 'lucide-react'
import { useAuth } from '@/store/useAuth'
import { useSessionGuard } from '@/hooks/useSessionGuard'
import { fetchWithAuth } from '@/lib/api'

export default function Profile() {
  const { user, accessToken, login, refreshToken } = useAuth()
  const navigate = useNavigate()
  useSessionGuard()

  // Profile form
  const [username, setUsername]     = useState(user?.username || '')
  const [email, setEmail]           = useState(user?.email || '')
  const [phone, setPhone]           = useState(user?.phone || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI state
  const [profileMsg, setProfileMsg]   = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingProfile(true)
    setProfileMsg(null)
    try {
      const res = await fetchWithAuth('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, phone: phone || undefined })
      })
      const data = await res.json()
      if (data.success) {
        setProfileMsg({ type: 'success', text: 'Profil berhasil diperbarui!' })
        login(accessToken!, refreshToken!, { ...user!, username: data.data.username, email: data.data.email, phone: data.data.phone })
      } else {
        setProfileMsg({ type: 'error', text: data.message })
      }
    } catch {
      setProfileMsg({ type: 'error', text: 'Terjadi kesalahan. Coba lagi.' })
    } finally {
      setLoadingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Password baru tidak cocok.' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password minimal 8 karakter.' })
      return
    }
    setLoadingPassword(true)
    setPasswordMsg(null)
    try {
      const res = await fetchWithAuth('/api/auth/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword })
      })
      const data = await res.json()
      if (data.success) {
        setPasswordMsg({ type: 'success', text: 'Password berhasil diubah!' })
        setOldPassword(''); setNewPassword(''); setConfirmPassword('')
      } else {
        setPasswordMsg({ type: 'error', text: data.message })
      }
    } catch {
      setPasswordMsg({ type: 'error', text: 'Terjadi kesalahan. Coba lagi.' })
    } finally {
      setLoadingPassword(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-black/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/app')} className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Terminal
          </button>
          <div className="w-px h-4 bg-white/10" />
          <span className="font-bold text-white">Profil</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gold-gradient flex items-center justify-center text-2xl font-black text-white shadow-xl">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-black">{user?.username}</h1>
            <p className="text-slate-400 text-sm">{user?.email}</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

          {/* Profile Form */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
            <h2 className="text-base font-bold mb-5 flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Informasi Akun</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Username</label>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Nomor HP</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <AnimatePresence>
                {profileMsg && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl ${profileMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {profileMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {profileMsg.text}
                  </motion.div>
                )}
              </AnimatePresence>
              <button type="submit" disabled={loadingProfile} className="px-5 py-2.5 bg-primary text-black font-bold rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                {loadingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </form>
          </div>

          {/* Password Form */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
            <h2 className="text-base font-bold mb-5 flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Ubah Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {[
                { label: 'Password Lama', val: oldPassword, set: setOldPassword },
                { label: 'Password Baru', val: newPassword, set: setNewPassword },
                { label: 'Konfirmasi Password Baru', val: confirmPassword, set: setConfirmPassword },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">{label}</label>
                  <input
                    type="password"
                    value={val}
                    onChange={e => set(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              ))}
              <AnimatePresence>
                {passwordMsg && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl ${passwordMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {passwordMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {passwordMsg.text}
                  </motion.div>
                )}
              </AnimatePresence>
              <button type="submit" disabled={loadingPassword} className="px-5 py-2.5 bg-white/10 border border-white/20 text-white font-bold rounded-xl text-sm hover:bg-white/15 transition-colors disabled:opacity-50">
                {loadingPassword ? 'Menyimpan...' : 'Ubah Password'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
