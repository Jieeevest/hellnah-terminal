import 'dotenv/config'
import path from 'node:path'

function num(name: string, fallback: number): number {
  const v = process.env[name]
  return v ? Number(v) : fallback
}

export const CONFIG = {
  port: num('PORT', 3010),
  // Default loopback: API kontrol bot gak boleh kebuka ke jaringan (WiFi dst) tanpa sengaja.
  // Di Docker di-override ke 0.0.0.0 lewat docker-compose.yml biar container fe bisa nyambung.
  host: process.env.HOST || '127.0.0.1',
  tradingMode: process.env.TRADING_MODE ?? 'paper',
  controlApiToken: process.env.CONTROL_API_TOKEN ?? '',
  allowedOrigin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
  startingEquity: num('STARTING_EQUITY', 1000),
  scanIntervalMs: num('SCAN_INTERVAL_MS', 60_000),
  tickIntervalMs: num('TICK_INTERVAL_MS', 15_000),
  // Ringkasan periodik ke Slack (equity, margin terpakai, PnL harian/bulanan, floating
  // position) — terpisah dari notifikasi per-event (OPEN/SL/TP1/dst). Default 6 jam biar
  // gak spam tapi tetap dapet pulse check rutin tanpa buka dashboard.
  summaryIntervalMs: num('SUMMARY_INTERVAL_MS', 6 * 60 * 60 * 1000),
  // EKSPERIMEN shadow-only (scalpScanner.ts) -- scan Stoch RSI, gak ada order beneran.
  // 06 Agustus (user, revisi): pindah candle ke 3m (dari 5m), scan tiap 30 detik (lebih
  // cepat dari candle-nya sendiri) biar dead cross/golden cross kecatet SEGERA begitu
  // candle 3m baru kebentuk, bukan nunggu sampai siklus scan berikutnya.
  scalpScanIntervalMs: num('SCALP_SCAN_INTERVAL_MS', 30 * 1000),
  // 'all' — scan seluruh pair USDT-M perpetual di Binance Futures, diranking live tiap
  // siklus scan berdasarkan quote volume 24h, ambil top N (maxWatchlistSize).
  // 'fixed' — cuma scan simbol di WATCHLIST, tidak peduli volume.
  watchlistMode: (process.env.WATCHLIST_MODE ?? 'all') as 'all' | 'fixed',
  maxWatchlistSize: num('MAX_WATCHLIST_SIZE', 60), // sejalan MAX_TICKERS di useFuturesOpportunities.ts (FE)
  watchlist: (process.env.WATCHLIST ?? 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Kosong (default) -> leverage tetap auto-pick dari pickLeverage (dibatasi formula
  // isolated-margin di liquidation.ts). Diisi (mis. 20) -> leverage dipakai langsung,
  // lepas dari formula itu — akun beneran jalan cross margin (equity total jadi bantalan,
  // bukan cuma margin per-posisi), jadi buffer riil ke liquidation jauh lebih lebar dari
  // yang isolated formula itu hitung. Tetap di-clamp ke [minLeverage..maxLeverage].
  leverage: process.env.LEVERAGE ? Number(process.env.LEVERAGE) : undefined,
  // Cuma dipakai kalau TRADING_MODE=live — order execution beneran (server/src/broker/binanceFutures.ts).
  // JANGAN commit nilai asli ke mana pun, isi langsung di server/.env di VPS.
  binanceApiKey: process.env.BINANCE_API_KEY ?? '',
  binanceApiSecret: process.env.BINANCE_API_SECRET ?? '',
  // Kosong -> notifikasi Slack dimatikan (no-op), gak ada error. Lihat server/src/notify/slack.ts.
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL ?? '',
  // Strategi exit (lihat positionManager.ts): 'stable' = TP 3% + tahan 72 jam, 'trailing' =
  // trailing stop tanpa TP tetap, tahan 2 minggu. Trailing cuma didukung di paper mode.
  strategy: (process.env.STRATEGY ?? 'stable') as 'stable' | 'trailing',
  // Akun paper kedua jalan sebagai proses terpisah dengan DATA_DIR & PORT sendiri
  // (lihat script start:akun-b di package.json).
  dataDir: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), 'data'),
  // Scalp scanner & forward-test F3 cukup jalan di satu akun, gak perlu dobel request.
  shadowExperiments: process.env.SHADOW_EXPERIMENTS !== '0',
}

// 'paper' = simulasi lokal (M3). 'live' = order execution beneran ke Binance Futures
// mainnet lewat server/src/broker/binanceFutures.ts (M4) — butuh API key+secret valid.
// Nilai lain sengaja di-hard-fail, bukan sekadar default, supaya gak ada jalan tidak
// sengaja nyerempet ke mode yang belum diimplementasikan.
if (CONFIG.tradingMode !== 'paper' && CONFIG.tradingMode !== 'live') {
  throw new Error(
    `TRADING_MODE='${CONFIG.tradingMode}' belum didukung. Cuma 'paper' atau 'live' yang diimplementasikan.`
  )
}
if (CONFIG.strategy !== 'stable' && CONFIG.strategy !== 'trailing') {
  throw new Error(`STRATEGY='${CONFIG.strategy}' tidak dikenal. Pilih 'stable' atau 'trailing'.`)
}
// Trailing di live butuh geser order STOP_MARKET di Binance tiap tick — belum dibuat.
if (CONFIG.tradingMode === 'live' && CONFIG.strategy === 'trailing') {
  throw new Error('STRATEGY=trailing baru didukung di TRADING_MODE=paper.')
}
if (CONFIG.tradingMode === 'live' && (!CONFIG.binanceApiKey || !CONFIG.binanceApiSecret)) {
  throw new Error('TRADING_MODE=live butuh BINANCE_API_KEY dan BINANCE_API_SECRET di server/.env')
}
