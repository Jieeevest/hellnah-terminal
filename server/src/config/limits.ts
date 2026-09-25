// Plafon keras auto-trade. Tidak boleh dilewati dari input caller manapun (termasuk FE) —
// nilai di sini yang jadi batas akhir, request di luar range ini diclamp atau ditolak.
export const HARD_LIMITS = {
  // Margin 4% (naik dari 1%) buat kompensasi leverage max yang jauh lebih rendah sekarang
  // (5x, bukan 20x, lihat minLeverage/maxLeverage di bawah) — notional yang dihasilkan
  // (margin x leverage) tetap di order besaran yang mirip: 1%x20x=20% equity notional vs
  // 4%x5x=20% equity notional.
  // minMarginPct diturunkan ke 0.02 (dari 0.04) SUPAYA rentangnya cukup lebar buat margin
  // short 2% (lihat livePositionManager.ts/positionManager.ts — marginPct sekarang beda per
  // arah: long tetap 4%, short 2%). Backtest 250 hari nunjukkin short "Overextended" avgR
  // NEGATIF (-0.038) sementara long kuat positif (+0.130), dan 9 dari 10 SL live minggu ini
  // di posisi short — bukan mainin ukuran SL/TP1 lagi, tapi kecilin taruhan di sisi yang
  // sekarang kurang meyakinkan, TANPA matiin short total (belum cukup bukti buat permanen).
  minMarginPct: 0.02,
  maxMarginPct: 0.04,
  // maxLeverage=5 — batas akun beneran (sub-account Binance user, dikonfirmasi user, BUKAN
  // pilihan strategi). setLeverage() ke Binance bakal gagal/ke-cap diam-diam kalau kode di
  // sini masih ngasumsikan leverage bisa sampai 20x, jadi WAJIB disamakan ke batas riil ini.
  minLeverage: 1,
  maxLeverage: 5,

  // Dilonggarin dari 3/13%/60%/2 biar sinyal bagus gak ke-skip cuma karena slot penuh
  // (user: jangan dibatasin, takut kehilangan momentum) — tetap ada plafon (bukan
  // unlimited) buat jaga-jaga anomali sinyal beruntun searah.
  // Margin ratio ACCOUNT-WIDE dari Binance (maintenance margin / margin balance, sama kayak
  // di UI Binance) — beda dari maxTotalMarginPct di bawah (itu cuma ngitung posisi bot).
  // Ini ngitung SEMUA posisi termasuk yang manual (mis. ERAUSDT), jadi jaring pengaman
  // terakhir kalau eksposur akun keseluruhan (bukan cuma bot) udah mepet ke likuidasi.
  maxMarginRatioPct: 1.5,

  // Margin ratio account-wide (di atas) tetap jadi rem kapasitas utama, TAPI
  // maxSameDirectionPositions diketatin lagi setelah kejadian nyata 05 Agustus: 4-5 posisi
  // SHORT dibuka bersamaan (00:30-04:00 WIB), semuanya kena SL bareng pas market berbalik
  // arah — trade jadi berkorelasi (menang/kalah bareng), bukan lagi independen kayak
  // asumsi backtest (yang expectancy positifnya dihitung per-trade independen).
  maxConcurrentPositions: 50,
  // 15% saldo (user, 25 Sep 2026) — dengan SL 20% & leverage 5x, market anjlok serentak
  // cuma bisa makan ~15% saldo, bukan seluruh akun cross margin.
  maxTotalMarginPct: 0.15,
  // Rem BTC (user, 25 Sep 2026): entry baru dijeda kalau BTC turun >= 10% dari harga
  // tertinggi 30 hari (bukan turun harian — penurunan pelan berminggu-minggu tetap kena).
  // Baru dilepas lagi di bawah 7% supaya gak nyala-mati bolak-balik di sekitar 10%.
  btcBrakeDrawdownPct: 0.1,
  btcBrakeResumePct: 0.07,
  maxTotalNotionalPct: 3.0,
  maxSameDirectionPositions: 3,

  // Dimatikan (user minta gak usah dibatesin, biar jalan terus) — -1 = -100%, praktis gak
  // pernah kesentuh dalam 1 hari. Cooldown 3-loss-beruntun di bawah tetap jadi satu-satunya
  // rem otomatis yang aktif sekarang.
  dailyStopLossPct: -1,
  consecutiveLossBreaker: 3,
  consecutiveLossCooldownMs: 1 * 60 * 60 * 1000,
  // Balikin ke 4 jam (dari 30 menit) — kejadian nyata CYSUSDT di-short ULANG 4x dalam <3
  // jam (00:30-03:22 WIB 05 Agustus), abis tiap kena SL langsung dicoba lagi ke thesis yang
  // sama tanpa jeda market settle. 30 menit kebukti kekecilan buat kasus kayak gini.
  symbolCooldownMs: 4 * 60 * 60 * 1000,

  // SL sekarang persentase tetap 4% (SL_PCT di futuresEngine.ts, TP1 jual semua) — batas
  // ini dikencangin di sekitar angka itu buat jaga-jaga pembulatan harga, bukan rentang
  // lebar buat stop-loss variabel. Diturunkan dari 10% setelah backtest nunjukkin 4% kasih
  // avgR TEST jauh lebih tinggi (+0.069 vs +0.019) DAN TRAIN/TEST paling konsisten
  // dibanding 10%/6%/5%/3%/2% — bukan cuma angka TEST tertinggi (itu di 3%, tapi TRAIN-nya
  // gak sinkron, indikasi overfit sampel kecil).
  // Update 25 Sep 2026: SL_PCT jadi 20% (lihat futuresEngine.ts), batas ikut digeser.
  minStopDistPct: 0.19,
  maxStopDistPct: 0.21,

  // Coin yang baru listing (< 90 hari) belum punya cukup histori buat dinilai apa polanya
  // konsisten atau enggak, dan fase awal listing sering hype/pump-dump yang gak cocok sama
  // strategi mean-reversion kita. Ketauan dari kasus nyata BTWUSDT (onboardDate 04 Jun
  // 2026, baru ~61 hari) — 2x di-short "Overextended" ngelawan tren naik kuat, 2x kena SL.
  minListingAgeDays: 90,

  // Di-PAUSE lagi 06 Agustus (user) -- begitu di-unpause tadi, ketauan pola short kalah
  // BUKAN cuma di 1-2 simbol (kayak SKYAIUSDT), tapi market secara luas lagi bullish kuat
  // (SKYAIUSDT +124%, CYSUSDT +182%, BTWUSDT +54%, BLESSUSDT +16% dalam 3 hari) --
  // whack-a-mole per-simbol (flip-symbols.txt) gak nyusul cukup cepat. Pause total sambil
  // dibangun filter tren otomatis (per-simbol, bukan manual) buat gantiin pendekatan reaktif
  // ini. CATATAN: shortToLongFlipSymbols (data/flip-symbols.txt) TETAP jalan walau pause
  // ini aktif -- itu bukan short beneran, itu LONG yang dipicu sinyal short (lihat kode).
  shortEntriesEnabled: false,

  // EKSPERIMEN per-simbol (06 Agustus, user) -- daftar simbolnya sendiri ada di
  // data/flip-symbols.txt (lihat flipSymbols.ts), BUKAN di sini, biar bisa ditambah/dikurangi
  // via SSH tanpa redeploy. Contoh kasus SKYAIUSDT (simbol pertama): naik +124% dalam 3 hari,
  // short di simbol ini 5/7 kena SL (win rate 28.6%, Wilson CI95 [8.2%,64.1%] SELURUHNYA di
  // bawah breakeven 72.7%), tapi 4/4 entry short historis yang di-flip jadi long semuanya
  // kena TP1. flipLongSlBreaker = kalau versi long-nya sendiri udah kena SL sebanyak ini,
  // STOP (simbol dihindari total, gak di-flip lagi) -- sinyal tren mungkin udah berbalik.
  flipLongSlBreaker: 3,
} as const
