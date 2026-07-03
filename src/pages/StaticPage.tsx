import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText, ChevronRight, ShieldCheck, Scale, HelpCircle, Activity, Map, ListChecks, ReceiptText } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { SEOHead } from '@/components/SEOHead'

// Icon mapping for sidebar
const ICON_MAP: Record<string, any> = {
  changelog: ListChecks,
  roadmap: Map,
  dokumentasi: FileText,
  faq: HelpCircle,
  status: Activity,
  terms: Scale,
  privacy: ShieldCheck,
  disclaimer: FileText,
  refund: ReceiptText
}

const PAGE_CONTENT: Record<string, { title: string; category: string; date: string; content: string }> = {
  changelog: {
    title: 'Changelog',
    category: 'Produk',
    date: 'Diperbarui: 12 Mei 2026',
    content: `### Versi 1.2.0 (Terbaru)
- **Fitur Baru:** Penambahan fitur Grid Charts (Khusus Pro)
- **Optimasi:** Rendering Engine pada Order Book 3x lebih cepat
- **UI/UX:** Fitur tema gelap/terang adaptif dengan sistem perangkat

### Versi 1.1.0
- **Integrasi:** Dukungan Bursa KuCoin dan Crypto.com
- **Perbaikan:** Bug sinkronisasi harga saat koneksi internet tidak stabil
- **Pembaruan:** Peningkatan akurasi sinyal Bullish Scanner MTF

### Versi 1.0.0
- **Rilis:** Peluncuran awal Hellnah Terminal ke publik
- **Fitur Dasar:** Dukungan Binance & OKX, Trading Terminal Dasar`
  },
  roadmap: {
    title: 'Roadmap Pengembangan',
    category: 'Produk',
    date: 'Diperbarui: 1 Mei 2026',
    content: `### Q3 2026 (Sedang Berjalan)
- Peluncuran Fitur Copy Trading Institusional
- AI Auto-Trading Bots dengan integrasi LLM
- Penambahan 5 indikator premium kustom

### Q4 2026
- Aplikasi Mobile Native (iOS & Android)
- Dukungan Decentralized Exchange (DEX) seperti Uniswap & PancakeSwap
- Program Afiliasi Global

### Q1 2027
- Lisensi Regulasi Kripto di berbagai wilayah
- Peluncuran Token Ekosistem Hellnah Terminal
- Fitur Staking dan Yield Farming langsung dari Terminal`
  },
  dokumentasi: {
    title: 'Pusat Dokumentasi',
    category: 'Support',
    date: 'Diperbarui: 10 Mei 2026',
    content: `Selamat datang di Pusat Dokumentasi Hellnah Terminal. Panduan komprehensif untuk memaksimalkan pengalaman trading Anda.

### 1. Memulai Trading
Buat akun, lalu masuk ke halaman Dashboard Terminal. Anda dapat melihat chart, daftar koin, dan indikator tanpa perlu koneksi API. Cukup navigasikan melalui sidebar untuk menjelajahi pasar.

### 2. Menghubungkan Bursa (Exchange API)
Jika Anda ingin melakukan eksekusi Buy/Sell langsung dari terminal kami:
- Buka pengaturan API Management di profil Anda.
- Masukkan API Key dan Secret Key dari Binance atau OKX.
- **Penting:** Selalu nonaktifkan izin penarikan (Withdrawal) pada API Key Anda.

### 3. Menggunakan Bullish Scanner
Bullish Scanner memindai pasar 24/7 di 4 Timeframe berbeda secara bersamaan.
- **Sinyal STRONG BUY:** Muncul jika 4 TF terkonfirmasi naik. Probabilitas historis mencapai 82%.
- Harap selalu kombinasikan dengan analisis teknikal pribadi Anda.`
  },
  faq: {
    title: 'Frequently Asked Questions (FAQ)',
    category: 'Support',
    date: 'Diperbarui: 5 Mei 2026',
    content: `### Apa itu Hellnah Terminal?
Hellnah Terminal adalah terminal trading kripto profesional yang mengumpulkan likuiditas, chart, dan indikator premium dari berbagai bursa ke dalam satu antarmuka yang mulus.

### Apakah layanan ini gratis?
Ya. Kami menyediakan paket "Mulai Gratis" selamanya dengan fitur dasar (Single Chart, Market Data, Basic Scanner). Jika Anda butuh fitur ahli, Anda dapat berlangganan Paket Pro.

### Apakah uang saya aman?
Hellnah Terminal **BUKAN** dompet (wallet) atau bursa. Kami tidak pernah memegang aset Anda. Anda tetap menyimpan dana Anda di Binance/OKX, dan hanya menghubungkan API Key untuk membaca data atau mengirim instruksi eksekusi pesanan.`
  },
  status: {
    title: 'Status Sistem',
    category: 'Support',
    date: 'Real-time',
    content: `### Status Infrastruktur Inti
- **Server Utama (Frontend):** 🟢 OPERATIONAL
- **Database Engine:** 🟢 OPERATIONAL
- **WebSocket API (Market Data):** 🟢 OPERATIONAL

### Status Koneksi Bursa
- **Binance API:** 🟢 OPERATIONAL (Ping: 42ms)
- **OKX API:** 🟢 OPERATIONAL (Ping: 38ms)
- **KuCoin API:** 🟢 OPERATIONAL (Ping: 45ms)
- **Crypto.com API:** 🟢 OPERATIONAL (Ping: 50ms)

Semua sistem Hellnah Terminal berjalan normal. Tidak ada gangguan atau latensi tinggi yang dilaporkan saat ini.`
  },
  terms: {
    title: 'Syarat & Ketentuan',
    category: 'Legal',
    date: 'Berlaku Sejak: 1 Januari 2026',
    content: `Dengan mengakses dan menggunakan platform Hellnah Terminal, Anda setuju untuk terikat oleh Syarat dan Ketentuan berikut. Harap baca dengan saksama.

### 1. Risiko Trading
Trading aset kripto memiliki tingkat risiko yang sangat tinggi dan dapat mengakibatkan hilangnya sebagian atau seluruh modal Anda. Anda sepenuhnya bertanggung jawab atas setiap keputusan investasi yang Anda buat.

### 2. Penggunaan Layanan
Anda setuju untuk tidak menggunakan platform ini untuk kegiatan ilegal, pencucian uang, manipulasi pasar, atau aktivitas penipuan lainnya. Hellnah Terminal berhak secara sepihak untuk membekukan akun Anda jika terdeteksi aktivitas mencurigakan.

### 3. Ketersediaan Sistem
Meskipun kami berusaha keras untuk memastikan uptime 99.9%, Hellnah Terminal tidak menjamin bahwa platform akan selalu bebas dari gangguan, bug, atau downtime akibat masalah server eksternal (seperti pemeliharaan bursa).

### 4. Modifikasi
Kami berhak untuk memperbarui syarat dan ketentuan ini kapan saja. Perubahan akan segera berlaku setelah diunggah ke halaman ini.`
  },
  privacy: {
    title: 'Kebijakan Privasi',
    category: 'Legal',
    date: 'Berlaku Sejak: 1 Januari 2026',
    content: `Hellnah Terminal ("kami") sangat menghargai dan berkomitmen untuk melindungi privasi data Anda di ekosistem Web3 ini.

### 1. Pengumpulan Data
Kami hanya mengumpulkan data yang mutlak diperlukan: alamat email, nama pengguna, dan log aktivitas dasar demi menjaga keamanan akun dan meningkatkan kualitas layanan.

### 2. Keamanan API Key
Setiap API Key yang Anda hubungkan ke platform kami dienkripsi menggunakan standar perbankan (AES-256) di level database. Karyawan kami tidak memiliki akses untuk melihat API Key Anda secara mentah.

### 3. Pembagian Data
Kami memegang teguh prinsip desentralisasi privasi. Kami tidak pernah menjual atau membagikan data pribadi Anda ke perusahaan iklan, pialang data, atau pihak ketiga yang tidak berkepentingan.

### 4. Hak Penghapusan Akun
Anda memiliki kontrol penuh. Anda berhak untuk menghapus akun dan seluruh jejak data Anda dari server kami secara permanen kapan saja melalui halaman Pengaturan.`
  },
  disclaimer: {
    title: 'Disclaimer Peringatan Risiko',
    category: 'Legal',
    date: 'Berlaku Sejak: 1 Januari 2026',
    content: `### PERINGATAN RISIKO TINGGI

Semua informasi, analisis, sinyal, chart, dan indikator yang disediakan di platform Hellnah Terminal murni didesain untuk tujuan edukasi dan referensi data informasional. 

**HELLNAH TERMINAL BUKAN PENASIHAT KEUANGAN.** 

Semua konten yang ada di situs ini tidak boleh ditafsirkan sebagai ajakan, rekomendasi, nasihat investasi, atau panduan mutlak untuk membeli atau menjual aset kripto tertentu.

Kinerja historis dari sinyal atau indikator algoritma kami sama sekali tidak menjamin hasil serupa di masa depan. Anda menyadari sepenuhnya bahwa pasar mata uang kripto beroperasi 24/7 dan sangat fluktuatif. Anda bersedia menanggung 100% segala risiko kerugian finansial dari transaksi yang Anda eksekusi.`
  },
  refund: {
    title: 'Kebijakan Pengembalian Dana',
    category: 'Legal',
    date: 'Berlaku Sejak: 1 Januari 2026',
    content: `Hellnah Terminal berkomitmen untuk memberikan layanan terbaik kepada seluruh pengguna. Kebijakan ini menjelaskan kondisi dan prosedur pengembalian dana (refund) atas pembelian paket berlangganan.

### 1. Syarat Umum Pengembalian Dana

Pengembalian dana hanya dapat diajukan apabila memenuhi **salah satu** kondisi berikut:

- Terjadi kesalahan penagihan ganda (double charge) yang dapat dibuktikan dengan bukti transaksi.
- Layanan Hellnah Terminal mengalami gangguan (downtime) total lebih dari **72 jam berturut-turut** dalam satu periode langganan aktif Anda.
- Akun berhasil di-upgrade ke status PRO namun fitur-fitur Pro tidak dapat diakses sama sekali setelah lebih dari 24 jam sejak pembayaran dikonfirmasi.

### 2. Kondisi yang Tidak Mendapat Refund

Pengembalian dana **tidak dapat diproses** dalam kondisi berikut:

- Pengguna sudah mengakses dan menggunakan fitur-fitur paket Pro setelah pembayaran dikonfirmasi.
- Pengajuan dilakukan lebih dari **7 hari kalender** sejak tanggal transaksi berhasil.
- Pengguna lupa membatalkan langganan sebelum periode perpanjangan otomatis.
- Kerugian finansial akibat keputusan trading yang diambil berdasarkan data dari platform kami.
- Ketidakpuasan terhadap sinyal atau indikator teknikal (karena sinyal bukan merupakan jaminan profit).

### 3. Prosedur Pengajuan Refund

Untuk mengajukan pengembalian dana, ikuti langkah berikut:

- Kirimkan email ke **support@hellnah-terminal.id** dengan subjek: **[REFUND] Nomor Transaksi Anda**.
- Sertakan bukti pembayaran (screenshot atau PDF dari iPaymu/bank), alamat email akun Hellnah Terminal Anda, dan alasan pengajuan refund secara jelas.
- Tim kami akan memverifikasi dan merespons pengajuan Anda dalam **3-5 hari kerja**.

### 4. Proses Pengembalian Dana

Jika pengajuan refund disetujui:

- Dana akan dikembalikan ke metode pembayaran asal (rekening bank / e-wallet / kartu).
- Proses transfer memerlukan **5-14 hari kerja** tergantung kebijakan penyedia pembayaran.
- Setelah refund diproses, akun Anda akan otomatis dikembalikan ke paket Gratis.

### 5. Pembatasan Tanggung Jawab

Hellnah Terminal tidak bertanggung jawab atas kerugian, kehilangan keuntungan, atau kerusakan tidak langsung yang timbul dari penggunaan atau ketidakmampuan menggunakan layanan ini. Nilai maksimum kompensasi yang dapat diberikan tidak melebihi jumlah yang telah dibayarkan oleh pengguna dalam periode langganan terakhir.

### 6. Hubungi Kami

Jika Anda memiliki pertanyaan terkait kebijakan refund ini, silakan hubungi tim dukungan kami:

- **Email:** support@hellnah-terminal.id
- **Telepon/WhatsApp:** 0878-8339-1664
- **Alamat:** Jl. H. Sarmili Rt 004/02 No.1 (Kost Babussalam), Kel. Jurang Mangu Timur, Kec. Pondok Aren, Tangerang Selatan 15222`
  }
}

// Simple markdown parser for basic formatting without external libs
const SimpleMarkdown = ({ content }: { content: string }) => {
  const blocks = content.split('\n\n')
  
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        if (block.startsWith('### ')) {
          return <h3 key={i} className="text-xl md:text-2xl font-bold text-white mt-8 mb-4 tracking-tight">{block.replace('### ', '')}</h3>
        }
        
        // Check if block is a list
        if (block.includes('\n- ') || block.startsWith('- ')) {
          const lines = block.split('\n')
          // If first line isn't a list item, it's a paragraph before the list
          const hasIntro = !lines[0].startsWith('- ')
          
          return (
            <div key={i} className="space-y-3">
              {hasIntro && <p className="text-slate-300 leading-relaxed">{lines[0]}</p>}
              <ul className="space-y-3 pl-2">
                {lines.filter(l => l.startsWith('- ')).map((line, j) => {
                  // Basic bold parsing `**text**`
                  const parts = line.replace('- ', '').split(/(\*\*.*?\*\*)/)
                  return (
                    <li key={j} className="flex items-start gap-3 text-slate-300 leading-relaxed">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                      <div>
                        {parts.map((part, k) => 
                          part.startsWith('**') && part.endsWith('**') 
                            ? <strong key={k} className="text-white font-semibold">{part.slice(2, -2)}</strong>
                            : part
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        }

        // Regular paragraph with bold support
        const parts = block.split(/(\*\*.*?\*\*)/)
        return (
          <p key={i} className="text-slate-300 leading-relaxed md:text-lg">
            {parts.map((part, k) => 
              part.startsWith('**') && part.endsWith('**') 
                ? <strong key={k} className="text-white font-semibold">{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        )
      })}
    </div>
  )
}

export default function StaticPage() {
  const { slug } = useParams<{ slug: string }>()

  // Scroll to top on slug change
  useMemo(() => {
    window.scrollTo(0, 0)
  }, [slug])

  const page = PAGE_CONTENT[slug || ''] || {
    title: 'Halaman Tidak Ditemukan',
    category: 'Error',
    date: '',
    content: 'Halaman yang Anda cari tidak tersedia atau sedang dalam perbaikan.'
  }

  // Group pages by category for sidebar
  const sidebarGroups = useMemo(() => {
    const groups: Record<string, { slug: string; title: string }[]> = {}
    Object.entries(PAGE_CONTENT).forEach(([key, val]) => {
      if (!groups[val.category]) groups[val.category] = []
      groups[val.category].push({ slug: key, title: val.title })
    })
    return groups
  }, [])

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans selection:bg-primary/30 selection:text-white">
      <SEOHead
        title={page.title}
        canonical={`/page/${slug}`}
        noindex={['changelog', 'status'].includes(slug || '')}
      />

      <Navbar />

      {/* ── HEADER BREADCRUMB ── */}
      <div className="pt-24 pb-6 border-b border-white/5 bg-black/20">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-3 text-sm font-semibold">
          <Link to="/" className="text-slate-400 hover:text-white transition-colors flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Beranda
          </Link>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <span className="text-slate-500">{page.category}</span>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <span className="text-primary truncate">{page.title}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row gap-12 py-12">
        
        {/* ── SIDEBAR NAVIGATION ── */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="sticky top-28 space-y-8">
            {Object.entries(sidebarGroups).map(([cat, items]) => (
              <div key={cat}>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 px-2">{cat}</h4>
                <ul className="space-y-1">
                  {items.map(item => {
                    const isActive = slug === item.slug
                    const Icon = ICON_MAP[item.slug] || FileText
                    return (
                      <li key={item.slug}>
                        <Link 
                          to={`/page/${item.slug}`}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                            isActive 
                              ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(56,189,248,0.1)]' 
                              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-slate-500'}`} />
                          {item.title}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 max-w-3xl min-h-[60vh]">
          <motion.div 
            key={slug} 
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          >
            {/* Header Content */}
            <div className="mb-10 pb-8 border-b border-white/10 relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[60px] pointer-events-none" />
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 relative z-10">{page.title}</h1>
              {page.date && (
                <p className="text-slate-500 font-semibold uppercase tracking-widest text-xs flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" /> {page.date}
                </p>
              )}
            </div>

            {/* Markdown Body */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-[32px] p-6 md:p-10 shadow-xl">
              <SimpleMarkdown content={page.content} />
            </div>

            {/* Footer Content */}
            <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6">
              <p className="text-sm text-slate-500 text-center sm:text-left max-w-sm">
                Tidak menemukan jawaban yang Anda cari? Tim support kami siap membantu 24/7.
              </p>
              <Link to="/support" className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white hover:bg-white/10 transition-colors whitespace-nowrap">
                Hubungi Support CS
              </Link>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  )
}
