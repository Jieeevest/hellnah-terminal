// EKSPERIMEN shadow-only (06 Agustus, user: "testing aja kayak short tadi") -- scalping
// 3m murni pakai Stoch RSI: golden cross (%K motong %D ke atas) abis oversold (K<30) = buka
// trial long. Dead cross (%K motong %D ke bawah, TANPA syarat overbought lagi -- lihat
// catatan di bawah) = tutup trial itu (EXIT doang, BUKAN buka short baru). SL/TP persentase
// SEKARANG jaring pengaman ekstrem doang (jarang kepakai), BUKAN exit utama. TIDAK PERNAH
// eksekusi order beneran, TIDAK nyentuh state.json/trades.jsonl. SEPENUHNYA independen dari
// scanWorker.ts (strategi swing production) -- gak ada shared state/logic sama sekali.
//
// REVISI (06 Agustus, user): versi awal syaratin dead cross HARUS abis K>70 dulu -- ternyata
// 0 dari 41 trial pertama keluar lewat situ (semua lewat SL/TP backstop). Penyebabnya: kalau
// abis entry harga malah anjlok terus, K gak pernah sempat naik ke 70+, jadi syaratnya gak
// PERNAH kepenuhi -- posisi nyangkut selamanya. Syarat overbought dihapus (cross turun aja
// udah cukup), SL/TP dilebarin jadi jaring pengaman ekstrem doang.
//
// REVISI 2 (06 Agustus, user): abis syarat overbought dihapus, dead cross malah dominan
// (8/9 trial) dan motong winner sebelum sempat ke TP -- avg pnl/trade jadi lebih jelek dari
// logic lama (-0.054% vs -0.009%). Root cause: dead cross nutup posisi walau masih rugi tipis
// (noise cross), padahal dulu (logic lama) 25% trial masih sempat nyampe TP yang nutupin SL
// kecil-kecil. Fix: dead cross cuma dieksekusi kalau posisi LAGI PROFIT (currentPrice >
// entry). Kalau masih di bawah entry pas dead cross muncul, biarin -- serahin ke SL 2%
// backstop, jangan cut rugi tipis di tiap noise cross.
//
// REVISI 3 (06 Agustus, user): setelah 2 bug exit di atas dibenerin, SL yang kena sekarang
// VALID (bukan bug) tapi win rate masih rendah (~38%, avg -1.26%/trade) -- golden cross abis
// oversold sering nangkep falling knife (harga masih lanjut turun abis oversold, bukan
// mantul). Fix: trend filter EMA50 di 15m -- entry cuma valid kalau harga 3m di atas EMA50
// 15m (tren gak lagi turun kuat). Pola baku "Multi-Timeframe Stoch RSI Cross Confirmation" --
// sinyal tetep di 3m, cuma DIKONFIRMASI arahnya pakai timeframe lebih besar.
//
// REVISI 4 (07 Agustus, user, eksperimen sadar-risiko): GAK ADA SL sama sekali sebelum
// posisi profit -- posisi cuma keluar lewat dead cross (yang emang cuma nyala pas profit,
// lihat REVISI 2) atau TP. Begitu profit nyentuh PROFIT_LOCK_TRIGGER_PCT (0.5%), SL BARU
// dikunci di harga entry+0.5% (breakeven+buffer) -- abis itu kalau reverse, keluar minimal
// +0.5%, bukan rugi. TP tetap 3%. RISIKO YANG DIAKUI: posisi yang gak pernah profit/dead-cross
// bisa nyangkut tanpa batas bawah (gak ada backstop kerugian) -- diterima sengaja karena ini
// eksperimen shadow-only (gak ada uang beneran), bukan buat production.
import fs from 'node:fs'
import path from 'node:path'
import { fetchTradableUsdtPerpetualSymbols, fetchAllTickers24hr, fetchMultiTimeframeCandles } from '../marketData/binancePublic.js'
import { calcStochRSI, calcEMA } from './signalEngine.js'
import { loadScalpOpen, saveScalpOpen, appendScalpClosed, type ScalpOpenPosition } from '../store/scalpLog.js'
import { sendSlackMessage } from '../notify/slack.js'

// Marker file (SSH-editable, "touch data/scalp-entries-paused.txt") -- kalau ada, entry
// baru DIHENTIKAN tapi posisi trial yang lagi open TETAP dipantau/di-exit normal. Buat
// user pause sementara pas mau analisis data tanpa entry baru terus masuk.
const ENTRIES_PAUSED_FILE = path.join(process.cwd(), 'data', 'scalp-entries-paused.txt')

const SCALP_TP_PCT = 0.03
const PROFIT_LOCK_TRIGGER_PCT = 0.005   // begitu profit nyentuh ini, SL dikunci di level yang sama (breakeven+buffer)
const STOCH_OVERSOLD = 30
const WATCHLIST_SIZE = 30

async function resolveScalpWatchlist(): Promise<string[]> {
  const [symbols, tickers] = await Promise.all([fetchTradableUsdtPerpetualSymbols(), fetchAllTickers24hr()])
  return symbols
    .sort((a, b) => (tickers[b]?.quoteVolume24h ?? 0) - (tickers[a]?.quoteVolume24h ?? 0))
    .slice(0, WATCHLIST_SIZE)
}

export async function runScalpScan(log: (msg: string) => void): Promise<void> {
  const entriesPaused = fs.existsSync(ENTRIES_PAUSED_FILE)
  let watchlist: string[]
  try {
    watchlist = await resolveScalpWatchlist()
  } catch (e) {
    log(`scalp scan gagal ambil watchlist: ${(e as Error).message}`)
    return
  }

  const openPositions = loadScalpOpen()
  // Union watchlist (kandidat entry baru) + simbol yang lagi open (WAJIB tetap dicek biar
  // gak "nyangkut selamanya" walau simbolnya udah gak masuk top-30 volume lagi).
  const symbolsToCheck = new Set([...watchlist, ...openPositions.map((p) => p.symbol)])
  const stillOpen: ScalpOpenPosition[] = []

  for (const symbol of symbolsToCheck) {
    const existing = openPositions.find((p) => p.symbol === symbol)
    try {
      const candlesMap = await fetchMultiTimeframeCandles(symbol, ['3m'])
      const c3m = candlesMap['3m']
      if (!c3m || c3m.length < 30) {
        if (existing) stillOpen.push(existing)
        continue
      }

      const closes = c3m.map((c) => c.close)
      const { k, d } = calcStochRSI(closes)
      if (k.length < 2 || d.length < 2) {
        if (existing) stillOpen.push(existing)
        continue
      }

      const sk = k[k.length - 1]
      const sd = d[d.length - 1]
      const prevSk = k[k.length - 2]
      const prevSd = d[d.length - 2]
      const crossUp = sk > sd && prevSk <= prevSd
      const crossDown = sk < sd && prevSk >= prevSd
      const lastCandle = c3m[c3m.length - 1]
      const currentPrice = lastCandle.close

      if (existing) {
        const pnlPositive = currentPrice > existing.entry
        const deadCrossExit = crossDown && pnlPositive

        // WAJIB skip di candle yang sama dengan candle entry -- low/high candle itu bisa
        // kejadian SEBELUM entry (candle belum ganti karena scan 30s < durasi candle 3m),
        // jadi bukan pergerakan harga baru. Baru valid mulai candle berikutnya.
        const isNewCandle = lastCandle.time > existing.entryCandleTime

        // Kunci SL begitu profit nyentuh PROFIT_LOCK_TRIGGER_PCT -- sebelum itu stopLoss
        // tetap null (gak ada SL sama sekali, lihat REVISI 4).
        let stopLoss = existing.stopLoss
        if (stopLoss === null && isNewCandle) {
          const lockPrice = existing.entry * (1 + PROFIT_LOCK_TRIGGER_PCT)
          if (lastCandle.high >= lockPrice) stopLoss = lockPrice
        }

        const slHit = isNewCandle && stopLoss !== null && lastCandle.low <= stopLoss
        const tpHit = isNewCandle && lastCandle.high >= existing.takeProfit
        if (deadCrossExit || slHit || tpHit) {
          const exitReason = deadCrossExit ? 'DEAD_CROSS' : slHit ? 'SL' : 'TP'
          const exitPrice = exitReason === 'SL' ? (stopLoss as number) : exitReason === 'TP' ? existing.takeProfit : currentPrice
          const pnlPct = ((exitPrice - existing.entry) / existing.entry) * 100
          appendScalpClosed({
            symbol,
            entry: existing.entry,
            exitPrice,
            exitReason,
            pnlPct,
            openedAt: existing.openedAt,
            closedAt: Date.now(),
          })
          log(`${symbol} scalp (trial) CLOSE ${exitReason} @ ${exitPrice} pnl=${pnlPct.toFixed(2)}%`)
          const emoji = pnlPct >= 0 ? ':large_green_circle:' : ':red_circle:'
          void sendSlackMessage(`${emoji} *[TESTING] Scalp CLOSE* ${exitReason} ${symbol} @ ${exitPrice} | ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`)
          continue // resolve -- gak dimasukin lagi ke stillOpen
        }
        stillOpen.push({ ...existing, stopLoss })
        continue
      }

      // Belum ada trial di simbol ini -- cek entry (golden cross abis oversold + tren 15m gak turun).
      if (!entriesPaused && crossUp && prevSk < STOCH_OVERSOLD) {
        const c15m = (await fetchMultiTimeframeCandles(symbol, ['15m']))['15m']
        if (!c15m || c15m.length < 50) continue
        const ema50 = calcEMA(c15m.map((c) => c.close), 50)
        const trendOk = ema50.length > 0 && currentPrice > ema50[ema50.length - 1]
        if (!trendOk) continue

        const entry = currentPrice
        const newPos: ScalpOpenPosition = {
          symbol,
          entry,
          stopLoss: null,   // gak ada SL sampai profit nyentuh PROFIT_LOCK_TRIGGER_PCT
          takeProfit: entry * (1 + SCALP_TP_PCT),
          openedAt: Date.now(),
          entryCandleTime: lastCandle.time,
        }
        stillOpen.push(newPos)
        log(`${symbol} scalp (trial) OPEN long K=${sk.toFixed(1)} D=${sd.toFixed(1)} entry=${entry}`)
        void sendSlackMessage(`:large_blue_circle: *[TESTING] Scalp OPEN* long ${symbol} @ ${entry} | K=${sk.toFixed(1)} D=${sd.toFixed(1)}`)
      }
    } catch {
      // Simbol yang lagi open TAPI gagal fetch siklus ini WAJIB tetap dipertahanin (jangan
      // ilang diam-diam) -- simbol yang belum open dan gagal fetch aman di-skip aja.
      if (existing) stillOpen.push(existing)
    }
  }

  saveScalpOpen(stillOpen)
}
