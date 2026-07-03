import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Copy, CheckCircle2, Ticket, TrendingUp, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/store/useAuth';
import { useSessionGuard } from '@/hooks/useSessionGuard';
import { Logo } from '@/components/Logo';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Referral() {
  useSessionGuard();
  const { accessToken } = useAuth();
  
  const [code, setCode] = useState('');
  const [stats, setStats] = useState({ total_referees: 0, total_converted: 0, total_commission: 0 });
  const [list, setList] = useState<any[]>([]);
  const [affiliateStatus, setAffiliateStatus] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accessToken) {
      fetchData();
    }
  }, [accessToken]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [codeRes, statsRes, listRes, affRes] = await Promise.all([
        fetch(`${API_URL}/api/referral/my-code`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`${API_URL}/api/referral/stats`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`${API_URL}/api/referral/list`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`${API_URL}/api/affiliate/stats`, { headers: { Authorization: `Bearer ${accessToken}` } })
      ]);

      const codeData = await codeRes.json();
      const statsData = await statsRes.json();
      const listData = await listRes.json();
      const affData = await affRes.json();

      if (codeData.success) setCode(codeData.data.referral_code);
      if (statsData.success) setStats(statsData.data);
      if (listData.success) setList(listData.data);
      if (affData.success) setAffiliateStatus(affData.data);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyAffiliate = async () => {
    try {
      const res = await fetch(`${API_URL}/api/affiliate/apply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.success) {
        alert('Aplikasi afiliasi berhasil dikirim!');
        fetchData();
      } else {
        alert(data.message || 'Gagal mendaftar afiliasi.');
      }
    } catch (err) {
      alert('Terjadi kesalahan jaringan.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center text-white">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] text-foreground pb-20 selection:bg-primary/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Logo variant="icon" className="h-8 w-8" />
          <span className="font-semibold text-lg text-white">Referral & Afiliasi</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 mt-8 space-y-8">
        
        {/* Affiliate Application Banner */}
        {!affiliateStatus && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-400"/> Daftar Program Afiliasi</h3>
              <p className="text-sm text-muted-foreground">Dapatkan komisi uang tunai dari setiap teman yang mendaftar dan berlangganan Hellnah Terminal PRO menggunakan kode Anda.</p>
            </div>
            <button onClick={applyAffiliate} className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-xl font-medium shrink-0">
              Daftar Sekarang
            </button>
          </motion.div>
        )}

        {affiliateStatus && affiliateStatus.status === 'pending' && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl text-yellow-400 flex items-center gap-3 text-sm">
            <AlertCircle className="h-5 w-5" />
            Aplikasi afiliasi Anda sedang direview oleh admin.
          </div>
        )}

        {/* Code Section */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <h2 className="text-sm font-bold tracking-widest text-muted-foreground mb-4">KODE REFERRAL ANDA</h2>
          <div className="flex items-center justify-center gap-4">
            <div className="bg-black border border-white/20 px-8 py-4 rounded-2xl text-4xl font-black text-white tracking-widest font-mono">
              {code}
            </div>
            <button onClick={handleCopy} className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors text-white">
              {copied ? <CheckCircle2 className="h-6 w-6 text-green-400" /> : <Copy className="h-6 w-6" />}
            </button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Bagikan kode ini. Teman Anda akan mendapat diskon 10% untuk langganan pertama.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 text-muted-foreground mb-2">
              <Users className="h-5 w-5" />
              <span className="text-sm font-medium">Total Teman</span>
            </div>
            <div className="text-3xl font-bold text-white">{stats.total_referees}</div>
          </div>
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 text-muted-foreground mb-2">
              <Ticket className="h-5 w-5 text-purple-400" />
              <span className="text-sm font-medium">Berlangganan PRO</span>
            </div>
            <div className="text-3xl font-bold text-white">{stats.total_converted}</div>
          </div>
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <TrendingUp className="h-20 w-20 text-green-500" />
            </div>
            <div className="flex items-center gap-3 text-muted-foreground mb-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <span className="text-sm font-medium">Total Komisi</span>
            </div>
            <div className="text-3xl font-bold text-green-400 relative z-10">
              Rp {affiliateStatus ? parseFloat(affiliateStatus.total_earned).toLocaleString('id-ID') : '0'}
            </div>
          </div>
        </div>

        {/* List */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Riwayat Penggunaan Kode</h3>
          {list.length === 0 ? (
            <div className="text-center p-12 bg-white/5 rounded-2xl border border-white/10 border-dashed text-muted-foreground">
              Belum ada teman yang menggunakan kode Anda.
            </div>
          ) : (
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-muted-foreground">
                  <thead className="text-xs uppercase bg-black/40 text-white/60">
                    <tr>
                      <th className="px-6 py-4">Username</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Komisi Diterima</th>
                      <th className="px-6 py-4">Tanggal Bergabung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {list.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02]">
                        <td className="px-6 py-4 text-white font-medium">{item.username}</td>
                        <td className="px-6 py-4">
                          {item.converted ? (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium border border-green-500/20">PRO</span>
                          ) : (
                            <span className="px-2 py-1 bg-white/10 text-white/70 rounded text-xs font-medium border border-white/10">Free</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-green-400">
                          {item.commission_earned > 0 ? `+Rp ${parseFloat(item.commission_earned).toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="px-6 py-4">{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
