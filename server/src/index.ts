import { CONFIG } from './config/env.js'
import { loadState, saveState, pushActivity } from './store/state.js'
import { startTickLoop } from './engine/tickLoop.js'
import { createApiServer } from './api/server.js'
import { fetchOpenPositionRisk, fetchUsdtEquity } from './broker/binanceFutures.js'
import { sendSlackMessage } from './notify/slack.js'

const state = loadState(CONFIG.startingEquity, Date.now())
state.tradingMode = CONFIG.tradingMode
saveState(state)

// log() dipakai di seluruh engine (scanWorker, positionManager, dst) — selain nulis ke
// console server, tiap pesan juga masuk state.activityLog supaya ke-broadcast ke FE
// lewat SSE (dibarengi broadcast(state) yang sudah jalan tiap akhir siklus scan/tick).
function log(msg: string) {
  const nowMs = Date.now()
  console.log(`[${new Date(nowMs).toISOString()}] ${msg}`)
  pushActivity(state, msg, nowMs)
}

const watchlistDesc = CONFIG.watchlistMode === 'all'
  ? `all (top ${CONFIG.maxWatchlistSize} pair USDT-M by volume, live-ranked tiap scan)`
  : CONFIG.watchlist.join(',')
log(`TRADING_MODE=${CONFIG.tradingMode} | watchlist=${watchlistDesc} | equity=${state.equity}`)
if (!CONFIG.controlApiToken) {
  log('PERINGATAN: CONTROL_API_TOKEN kosong — API server tidak dilindungi auth. Cuma aman untuk localhost.')
}

const { app, broadcast, closeAllStreams } = createApiServer(state, log)
const stopTickLoop = startTickLoop(state, log, () => broadcast(state))

// Startup-only buat mode live — jalan SEKALI terlepas dari `enabled` (scan/tick loop
// normal cuma jalan kalau enabled=true / ada posisi open), biar equity di dashboard gak
// nunjukkin sisa angka paper lama sebelum bot sempat ngapa-ngapain.
if (CONFIG.tradingMode === 'live') {
  const binanceCreds = { apiKey: CONFIG.binanceApiKey, apiSecret: CONFIG.binanceApiSecret }

  fetchUsdtEquity(binanceCreds)
    .then((equity) => {
      state.equity = equity
      saveState(state)
      broadcast(state)
      log(`Equity real dari Binance: $${equity}`)
    })
    .catch((e) => log(`gagal ambil equity awal dari Binance: ${(e as Error).message}`))

  // Rekonsiliasi ringan (bukan auto-repair) — bandingkan posisi yang state.json kira
  // masih open vs yang BENERAN ada di Binance. Selisih cuma di-log keras (bukan
  // didiamkan), biar ketauan & dicek manual, bukan ditutup/dibuka otomatis dari kode ini.
  // Slack CUMA buat arah "state kira open, Binance bilang closed" (indikasi bug kayak
  // kasus ZECUSDT) — arah sebaliknya ("Binance punya posisi extra") sengaja gak dikirim
  // Slack karena itu bisa posisi manual user yang emang gak dikelola bot (mis. ERAUSDT),
  // bakal notif tiap restart kalau ikut dikirim. Tetap kelihatan di dashboard/externalPositions.
  fetchOpenPositionRisk(binanceCreds)
    .then((realPositions) => {
      const realSymbols = new Set(realPositions.map((p) => p.symbol))
      const stateSymbols = new Set(state.openPositions.map((p) => p.symbol))
      for (const sym of realSymbols) {
        if (!stateSymbols.has(sym)) log(`REKONSILIASI: Binance punya posisi ${sym} yang gak tercatat di state — cek manual.`)
      }
      for (const sym of stateSymbols) {
        if (!realSymbols.has(sym)) {
          log(`REKONSILIASI: state.json kira ${sym} masih open, Binance bilang udah closed — cek manual.`)
          void sendSlackMessage(`:warning: *REKONSILIASI*: state.json kira *${sym}* masih open, Binance bilang udah closed — cek manual, kemungkinan bug tracking.`)
        }
      }
      if (realSymbols.size === stateSymbols.size && [...realSymbols].every((s) => stateSymbols.has(s))) {
        log('REKONSILIASI: posisi live vs state.json cocok.')
      }
    })
    .catch((e) => log(`REKONSILIASI gagal ngecek posisi Binance: ${(e as Error).message}`))
}

const httpServer = app.listen(CONFIG.port, CONFIG.host, () => {
  log(`Trading server (${CONFIG.tradingMode.toUpperCase()} MODE) listening on ${CONFIG.host}:${CONFIG.port}`)
})

function shutdown() {
  log('shutting down...')
  stopTickLoop()
  saveState(state)
  closeAllStreams()
  httpServer.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
