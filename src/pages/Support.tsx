import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Plus, Clock, CheckCircle2,
  XCircle, Send, ChevronRight, Ticket, RefreshCw, MessageSquare
} from 'lucide-react'
import { useAuth } from '@/store/useAuth'
import { Navbar } from '@/components/Navbar'
import { useSessionGuard } from '@/hooks/useSessionGuard'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const CATEGORIES = [
  { value: 'general',   label: 'Umum' },
  { value: 'billing',   label: 'Pembayaran' },
  { value: 'technical', label: 'Teknis' },
  { value: 'feature',   label: 'Permintaan Fitur' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  open:        { label: 'Menunggu Balasan', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Clock },
  in_progress: { label: 'Sedang Diproses', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: RefreshCw },
  resolved:    { label: 'Selesai', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
  closed:      { label: 'Ditutup', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: XCircle },
}

export default function Support() {
  const { isAuthenticated, accessToken } = useAuth()
  const navigate = useNavigate()
  useSessionGuard()
  
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list')
  const [tickets, setTickets] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [replyMsg, setReplyMsg] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  // Create form
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('general')
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)

  const headers = { Authorization: `Bearer ${accessToken}` }

  useEffect(() => { 
    if (isAuthenticated) fetchTickets() 
    else navigate('/login')
  }, [isAuthenticated, navigate])

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/tickets`, { headers })
      const data = await res.json()
      if (data.success) setTickets(data.data)
    } catch {} finally { setLoading(false) }
  }

  const fetchTicket = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tickets/${id}`, { headers })
      const data = await res.json()
      if (data.success) { setSelected(data.data); setView('detail') }
    } catch {}
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch(`${API_URL}/api/tickets`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, category, message })
      })
      const data = await res.json()
      if (data.success) {
        await fetchTickets()
        setSubject(''); setCategory('general'); setMessage('')
        setView('list')
      }
    } catch {} finally { setCreating(false) }
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyMsg.trim() || !selected) return
    setSendingReply(true)
    try {
      const res = await fetch(`${API_URL}/api/tickets/${selected.id}/reply`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyMsg })
      })
      const data = await res.json()
      if (data.success) {
        setReplyMsg('')
        await fetchTicket(selected.id)
      }
    } catch {} finally { setSendingReply(false) }
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans selection:bg-primary/30 selection:text-white">
      
      <Navbar />

      {/* ── MAIN CONTENT ── */}
      <div className="pt-24 pb-20 px-4 min-h-screen relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-amber-600/15 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto relative z-10">
          
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <button 
              onClick={() => view !== 'list' ? setView('list') : navigate('/app')}
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-semibold bg-white/5 border border-white/10 px-4 py-2 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" />
              {view !== 'list' ? 'Kembali ke Daftar Tiket' : 'Kembali ke Terminal'}
            </button>
            
            {view === 'list' && (
              <button 
                onClick={() => setView('create')}
                className="flex items-center gap-2 px-6 py-2.5 bg-gold-gradient text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(245,166,35,0.2)]"
              >
                <Plus className="w-4 h-4" /> Buat Laporan Baru
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">

            {/* ── VIEW: LIST ── */}
            {view === 'list' && (
              <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                <div className="mb-10">
                  <h1 className="text-4xl md:text-5xl font-black mb-3">Customer Support</h1>
                  <p className="text-slate-400 text-lg">Kelola laporan kendala dan pertanyaan Anda langsung dengan tim kami.</p>
                </div>

                {loading ? (
                  <div className="py-20 flex justify-center">
                    <div className="w-10 h-10 border-4 border-white/10 border-t-amber-500 rounded-full animate-spin" />
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="py-24 text-center border border-white/5 rounded-[32px] bg-[#0a0a0a]">
                    <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <Ticket className="w-10 h-10 text-slate-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Belum ada tiket aktif</h3>
                    <p className="text-slate-500 max-w-sm mx-auto mb-8">Apakah Anda mengalami kendala? Buat tiket laporan pertama Anda sekarang.</p>
                    <button onClick={() => setView('create')} className="px-8 py-3 bg-white/10 border border-white/20 text-white rounded-xl text-sm font-bold hover:bg-white/20 transition-colors">
                      Mulai Laporan Baru
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {tickets.map(t => {
                      const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.open
                      const Icon = cfg.icon
                      return (
                        <motion.div key={t.id} whileHover={{ scale: 1.01 }} className="group">
                          <button 
                            onClick={() => fetchTicket(t.id)}
                            className={`w-full text-left bg-[#0a0a0a] border border-white/10 hover:border-amber-500/50 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-5 transition-all duration-300 shadow-lg ${
                              t.status === 'resolved' ? 'opacity-70 hover:opacity-100' : ''
                            }`}
                          >
                            <div className={`p-4 rounded-2xl border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                              <Icon className="w-6 h-6" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                                  {cfg.label}
                                </span>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                  {CATEGORIES.find(c => c.value === t.category)?.label}
                                </span>
                              </div>
                              <h3 className="text-lg font-bold text-white truncate mb-1 group-hover:text-amber-400 transition-colors">
                                {t.subject}
                              </h3>
                              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> {parseInt(t.reply_count)} balasan</span>
                                <span>&bull;</span>
                                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Diperbarui {new Date(t.updated_at).toLocaleDateString('id-ID')}</span>
                              </div>
                            </div>
                            
                            <div className="hidden md:flex w-10 h-10 rounded-full bg-white/5 items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition-colors" />
                            </div>
                          </button>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── VIEW: CREATE ── */}
            {view === 'create' && (
              <motion.div key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="max-w-2xl mx-auto">
                  <div className="mb-10 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <MessageSquare className="w-8 h-8 text-amber-400" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black mb-3">Buat Laporan Baru</h1>
                    <p className="text-slate-400 text-lg">Ceritakan kendala Anda dengan jelas agar tim kami dapat membantu dengan cepat.</p>
                  </div>

                  <form onSubmit={handleCreate} className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px]" />
                    
                    <div className="space-y-6 relative z-10">
                      <div>
                        <label className="text-sm font-bold text-slate-300 block mb-2">Pilih Kategori Topik</label>
                        <select 
                          value={category} onChange={e => setCategory(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-white cursor-pointer"
                        >
                          {CATEGORIES.map(c => <option key={c.value} value={c.value} className="bg-[#0a0a0a]">{c.label}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-bold text-slate-300 block mb-2">Subjek Laporan</label>
                        <input 
                          required value={subject} onChange={e => setSubject(e.target.value)} 
                          placeholder="Misal: Deposit via QRIS belum masuk..."
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-white placeholder:text-slate-600" 
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm font-bold text-slate-300 block mb-2">Detail Kendala</label>
                        <textarea 
                          required rows={6} value={message} onChange={e => setMessage(e.target.value)} 
                          placeholder="Jelaskan secara detail masalah yang Anda alami..."
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-white placeholder:text-slate-600 resize-none font-sans" 
                        />
                      </div>

                      <div className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
                        <button type="button" onClick={() => setView('list')} className="px-6 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-colors sm:w-1/3">
                          Batal
                        </button>
                        <button type="submit" disabled={creating} className="px-6 py-3.5 bg-gold-gradient text-black font-bold rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 sm:w-2/3 shadow-[0_0_20px_rgba(245,166,35,0.2)]">
                          <Send className="w-4 h-4" />{creating ? 'Memproses Laporan...' : 'Kirim Laporan Sekarang'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {/* ── VIEW: DETAIL (CHAT) ── */}
            {view === 'detail' && selected && (
              <motion.div key="detail" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-4xl mx-auto flex flex-col h-[80vh] md:h-[70vh] bg-[#0a0a0a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl relative">
                
                {/* Chat Header */}
                <div className="px-6 py-5 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
                  <div className="flex-1 min-w-0 pr-4">
                    <h2 className="text-xl font-black text-white truncate">{selected.subject}</h2>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">
                      {CATEGORIES.find(c => c.value === selected.category)?.label} &bull; TIKET #{selected.id.split('-')[0].toUpperCase()}
                    </p>
                  </div>
                  {(() => { 
                    const cfg = STATUS_CONFIG[selected.status]
                    const Icon = cfg?.icon
                    return (
                    <div className={`hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${cfg?.bg} ${cfg?.border} ${cfg?.color}`}>
                      {Icon && <Icon className="w-3.5 h-3.5" />} {cfg?.label}
                    </div>
                  )})()}
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(255,255,255,0.02),transparent)] pointer-events-none" />
                  
                  {/* Initial Ticket Message as Chat Bubble */}
                  <div className="flex items-center justify-center mb-8">
                    <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Percakapan Dimulai &bull; {new Date(selected.created_at).toLocaleDateString('id-ID')}
                    </div>
                  </div>

                  {(selected.replies || []).map((r: any) => (
                    <div key={r.id} className={`flex gap-3 max-w-[85%] ${r.is_admin ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 border ${r.is_admin ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/10 text-white border-white/20'}`}>
                        {r.is_admin ? 'CS' : r.username[0].toUpperCase()}
                      </div>
                      <div className={`rounded-3xl px-5 py-4 text-[15px] ${r.is_admin ? 'bg-white/5 border border-white/10 rounded-tl-sm' : 'bg-primary text-black font-medium rounded-tr-sm shadow-[0_5px_15px_rgba(56,189,248,0.2)]'}`}>
                        <div className={`text-xs font-black mb-1.5 uppercase tracking-widest ${r.is_admin ? 'text-primary' : 'text-black/60'}`}>
                          {r.is_admin ? 'Tim Support Hellnah Terminal' : r.username}
                        </div>
                        <p className={`whitespace-pre-wrap leading-relaxed ${r.is_admin ? 'text-slate-300' : 'text-black/90'}`}>{r.message}</p>
                        <div className={`text-[10px] font-bold mt-2 text-right ${r.is_admin ? 'text-slate-600' : 'text-black/50'}`}>
                          {new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-white/10 bg-black/40 backdrop-blur-md shrink-0">
                  {selected.status !== 'closed' ? (
                    <form onSubmit={handleReply} className="relative flex items-end gap-3 bg-[#030303] border border-white/10 rounded-2xl p-2 focus-within:border-primary/50 transition-colors">
                      <textarea 
                        rows={1}
                        value={replyMsg} 
                        onChange={e => setReplyMsg(e.target.value)} 
                        placeholder="Ketik balasan Anda disini..."
                        className="flex-1 bg-transparent text-[15px] p-3 focus:outline-none resize-none placeholder:text-slate-600 max-h-32 min-h-[44px]" 
                      />
                      <button 
                        type="submit" 
                        disabled={sendingReply || !replyMsg.trim()}
                        className="w-11 h-11 bg-primary text-black rounded-xl flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:hover:bg-primary transition-all shrink-0"
                      >
                        <Send className="w-5 h-5 -ml-0.5" />
                      </button>
                    </form>
                  ) : (
                    <div className="text-center py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-bold">
                      Tiket ini telah ditutup. Anda tidak dapat membalas lagi.
                    </div>
                  )}
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
