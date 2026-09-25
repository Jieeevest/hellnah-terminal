// Backtest lifecycle penuh strategi auto-trade: entry limit (dengan TTL), hard SL persentase
// tetap, single bracket TP1 (nutup qty PENUH, gak ada staircase TP2/TP3/breakeven lagi), dan
// time-stop — pakai persis engine yang sama dengan production (signals.ts, futuresEngine.ts,
// server/src/strategy/*) di-bundle via esbuild, bukan reimplementasi. Kalau angka di sini
// tidak menunjukkan expectancy positif di region TEST, JANGAN lanjut ke M3 (paper) apalagi
// uang riil (M4+).
import * as esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_DIR = path.join(ROOT, '.backtest-cache', 'autotrade')
fs.mkdirSync(CACHE_DIR, { recursive: true })

// Top-50 pair USDT-M perpetual by 24h volume (snapshot live dari Binance) — dekat dengan
// universe nyata yang di-scan production (top 60 dinamis), bukan 16 koin pilihan manual.
// Simbol yang baru listing (histori < HISTORY_DAYS+WARMUP_DAYS) otomatis ke-skip sendiri
// oleh guard `endIdx <= splitIdx` di main(), bukan bikin error.
const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BANKUSDT', 'HYPEUSDT', 'KOMAUSDT', 'COTIUSDT', 'BNBUSDT',
  'XRPUSDT', 'ZECUSDT', 'DOGEUSDT', 'MMTUSDT', 'UNIUSDT', 'AKEUSDT', 'ADAUSDT', 'KAITOUSDT',
  'ESPUSDT', 'UAIUSDT', 'ONUSDT', 'DEXEUSDT', 'GIGGLEUSDT', 'ONDOUSDT', '1000PEPEUSDT', 'PAXGUSDT',
  'NEARUSDT', 'SUIUSDT', 'AAVEUSDT', 'CAPUSDT', 'WLDUSDT', 'LINKUSDT', 'PUMPUSDT', 'ENAUSDT',
  'EULUSDT', 'BCHUSDT', 'ESPORTSUSDT', 'REUSDT', 'TAOUSDT', '1000SHIBUSDT', 'FILUSDT', 'AVAXUSDT',
  'LAUSDT', 'ROBOUSDT', 'EPICUSDT', 'LTCUSDT', 'RIFUSDT', 'CFXUSDT', 'XMRUSDT', 'INJUSDT',
  'BEATUSDT', 'XAUTUSDT',
]
const TIMEFRAMES = ['15m', '30m', '1h', '4h']
const TF_MINUTES = { '15m': 15, '30m': 30, '1h': 60, '4h': 240 }
const DECISION_TF = '1h'
// 45 hari sebelumnya bikin region TEST cuma nyisa ~5 hari setelah dipotong HARD_CAP_BARS
// (200 jam buffer resolusi trade) — kekecilan buat kesimpulan statistik. 120 hari bikin
// TEST punya ~27 hari usable, jauh lebih layak dipercaya.
// Dinaikkan ke 250 hari (dari 120) khusus buat laporan per-simbol (lihat printPerSymbolReport)
// -- makin panjang histori, makin banyak sampel trade per simbol buat confidence interval
// yang lebih sempit. Simbol yang listingnya lebih pendek dari 250+20 hari otomatis ke-skip
// sendiri (guard endIdx<=splitIdx di main()), gak bikin error.
const HISTORY_DAYS = 250
const WARMUP_DAYS = 20
const TRAIN_FRACTION = 0.7

const ENTRY_TTL_BARS = 2          // batal kalau harga tidak masuk zona entry dalam 2 candle 1h
const TIME_STOP_BARS = 8          // cut loose kalau belum sempat nyentuh TP1 sama sekali, TAPI cuma kalau lagi untung
const MAX_HOLD_BARS = 72          // backstop mutlak -- tutup posisi apapun kondisinya, sama dengan MAX_HOLD_BARS di positionManager.ts
const HARD_CAP_BARS = 200         // batas aman simulasi, bukan bagian dari strategi
const SYMBOL_COOLDOWN_BARS = 4
// EKSPERIMEN (belum ada di production) — begitu harga sempat bergerak sejauh
// LOCK_TRIGGER_PCT searah posisi, SL digeser ke fillPrice +/- LOCK_PROFIT_PCT (BUKAN ke
// breakeven persis, tapi ke level yang udah pasti untung). 0 = mati.
const LOCK_TRIGGER_PCT = 0
const LOCK_PROFIT_PCT = 0.01
// EKSPERIMEN (belum ada di production) — SL KHUSUS short pakai persentase ini (bukan
// SL_PCT global 4%), long TETAP pakai SL_PCT normal. Entry gate TETAP dievaluasi pakai
// plan asli (stopDistPct dari SL_PCT 4%) -- SL_PCT sekarang di short cuma ganti cara
// EXIT-nya diatur, bukan syarat MASUK. 0 = mati (pakai SL_PCT biasa buat semua sisi).
const SHORT_SL_PCT_OVERRIDE = 0
// EKSPERIMEN (belum ada di production) — generalisasi otomatis dari flip manual
// SKYAIUSDT/CYSUSDT (limits.ts shortToLongFlipSymbols): short yang entry-nya nemplok
// di tengah tren naik KUAT (trailing TREND_FLIP_LOOKBACK_BARS jam) di-flip jadi long,
// pakai fillPrice yang SAMA tapi SL/TP1 dihitung ulang dari nol pakai formula long.
// 0 = mati (gak ada flip berbasis tren).
const TREND_FLIP_THRESHOLD_PCT = 0
const TREND_FLIP_LOOKBACK_BARS = 72 // 72 jam di DECISION_TF (1h) = 3 hari

// TIDAK ADA duplikasi angka threshold di sini lagi — evaluateEntryGate() dipanggil tanpa
// argumen kedua supaya SELALU pakai DEFAULT_ENTRY_GATE_THRESHOLDS langsung dari
// server/src/strategy/entryGate.ts (satu sumber kebenaran). Ini sengaja diperbaiki setelah
// versi sebelumnya diam-diam drift dari production (lihat riwayat commit) dan bikin hasil
// backtest kelihatan lebih optimis dari kenyataan.
// maxSpreadPct tetap satu-satunya gate yang TIDAK tervalidasi — data bid-ask spread historis
// tidak ada di candle OHLCV (lihat catatan output di akhir).

// ── Fetch & cache candle historis multi-timeframe (Binance USDS-M futures, tanpa API key) ─
async function fetchKlinesPage(symbol, interval, endTime) {
  const params = new URLSearchParams({ symbol, interval, limit: '1000' })
  if (endTime) params.set('endTime', String(endTime))
  const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?${params}`)
  if (!res.ok) throw new Error(`${symbol} ${interval} HTTP ${res.status}`)
  return res.json()
}

async function fetchKlines(symbol, interval, totalBars) {
  let all = []
  let endTime
  while (all.length < totalBars) {
    const batch = await fetchKlinesPage(symbol, interval, endTime)
    if (!batch.length) break
    all = batch.concat(all)
    endTime = batch[0][0] - 1
    if (batch.length < 1000) break
  }
  return all.slice(-totalBars).map((d) => ({
    time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]),
    low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]),
  }))
}

async function getCandles(symbol, interval, totalBars) {
  const file = path.join(CACHE_DIR, `${symbol}-${interval}.json`)
  if (fs.existsSync(file)) {
    const cached = JSON.parse(fs.readFileSync(file, 'utf-8'))
    if (cached.length >= totalBars) return cached.slice(-totalBars)
  }
  const candles = await fetchKlines(symbol, interval, totalBars)
  fs.writeFileSync(file, JSON.stringify(candles))
  return candles
}

async function getMultiTfCandles(symbol) {
  const totalMinutes = (HISTORY_DAYS + WARMUP_DAYS) * 24 * 60
  const out = {}
  for (const tf of TIMEFRAMES) {
    const bars = Math.ceil(totalMinutes / TF_MINUTES[tf])
    out[tf] = await getCandles(symbol, tf, bars)
  }
  return out
}

// Cari slice candle tf lain sampai timestamp <= waktu candle keputusan (tanpa lookahead bias),
// dibatasi LOOKBACK_BARS candle terakhir — sama kayak production (fetchCandles limit=150),
// bukan seluruh histori dari awal. Selain lebih akurat (production emang cuma pernah "lihat"
// window segini), ini juga fix bug performa: slice(0, t) tanpa batas atas jadi O(n) makin
// lama makin gede tiap iterasi -> loop utama jadi O(n^2). Dengan window tetap, tiap slice O(1).
const LOOKBACK_BARS = 150

function sliceUpTo(candles, timestamp) {
  let lo = 0, hi = candles.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (candles[mid].time <= timestamp) lo = mid + 1
    else hi = mid
  }
  return candles.slice(Math.max(0, lo - LOOKBACK_BARS), lo)
}

// ── Bundle signal + strategy engine production via esbuild (satu sumber, bukan reimplementasi) ─
function bundleEngine() {
  const sig = path.join(ROOT, 'src/lib/signals.ts').replace(/\\/g, '/')
  const fut = path.join(ROOT, 'src/lib/futuresEngine.ts').replace(/\\/g, '/')
  const entryGate = path.join(ROOT, 'server/src/strategy/entryGate.ts').replace(/\\/g, '/')

  const entryContents = [
    `export * from '${sig}'`,
    `export * from '${fut}'`,
    `export * as entryGate from '${entryGate}'`,
  ].join('\n')

  const result = esbuild.buildSync({
    stdin: { contents: entryContents, resolveDir: ROOT, loader: 'ts' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  })
  const outFile = path.join(CACHE_DIR, 'bundle-engine.mjs')
  fs.writeFileSync(outFile, result.outputFiles[0].text)
  return outFile
}

function summarize(trades) {
  if (!trades.length) return { n: 0, winRate: null, avgR: null, expectancyR: null }
  const wins = trades.filter((t) => t.rMultiple > 0).length
  const totalR = trades.reduce((s, t) => s + t.rMultiple, 0)
  return {
    n: trades.length,
    winRate: Math.round((wins / trades.length) * 1000) / 10,
    avgR: Math.round((totalR / trades.length) * 1000) / 1000,
    expectancyR: Math.round((totalR / trades.length) * 1000) / 1000,
  }
}

// Wilson score interval (95%) -- lebih tahan di sampel kecil daripada normal approximation
// biasa (gak bisa hasilin batas di luar [0,1], gak collapse ke 0 lebar pas n kecil/p ekstrem).
// Dipakai buat ngukur SEBERAPA YAKIN kita boleh percaya win rate tiap simbol, bukan cuma
// angka win rate mentahnya -- biar gak salah nyimpulkan "simbol X jelek" dari 2-3 sampel doang.
function wilsonInterval(wins, n, z = 1.96) {
  if (n === 0) return { lower: 0, upper: 1 }
  const p = wins / n
  const denom = 1 + (z * z) / n
  const center = p + (z * z) / (2 * n)
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return { lower: Math.max(0, (center - margin) / denom), upper: Math.min(1, (center + margin) / denom) }
}

// EKSPERIMEN (opsi C) -- laporan per-simbol pakai SEMUA trade (TRAIN+TEST digabung, bukan
// out-of-sample) supaya sampel per-simbol semaksimal mungkin -- tujuannya BEDA dari laporan
// TRAIN/TEST utama (itu validasi edge strategi keseluruhan), ini validasi APAKAH ada simbol
// spesifik yang perlu di-flag/exclude berdasarkan histori yang cukup panjang, bukan cuma
// 2-3 kejadian kebetulan kayak kasus BTWUSDT (lihat limits.ts minListingAgeDays).
// breakevenWinRate = SL/(SL+TP1) -- winRate MINIMUM biar gak rugi di rasio R sekarang.
function printPerSymbolReport(allTradesBySymbol, breakevenWinRate) {
  console.log('\n=== OPSI C: Laporan per-simbol (TRAIN+TEST digabung, 95% confidence interval) ===')
  console.log(`Breakeven win rate di rasio R sekarang: ${(breakevenWinRate * 100).toFixed(1)}%`)
  console.log('Simbol dengan n<5 SENGAJA gak di-flag apa pun -- sampel kekecilan buat disimpulkan.\n')

  const rows = []
  for (const [symbol, trades] of Object.entries(allTradesBySymbol)) {
    if (!trades.length) continue
    const wins = trades.filter((t) => t.rMultiple > 0).length
    const { lower, upper } = wilsonInterval(wins, trades.length)
    const avgR = trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length
    let flag = '-'
    if (trades.length >= 5) {
      if (upper < breakevenWinRate) flag = 'WEAK (CI atas < breakeven)'
      else if (lower > breakevenWinRate) flag = 'STRONG (CI bawah > breakeven)'
      else flag = 'inconclusive'
    }
    rows.push({
      symbol,
      n: trades.length,
      winRate: `${((wins / trades.length) * 100).toFixed(1)}%`,
      'CI95 (lower-upper)': `${(lower * 100).toFixed(0)}%-${(upper * 100).toFixed(0)}%`,
      avgR: Math.round(avgR * 1000) / 1000,
      flag,
    })
  }
  rows.sort((a, b) => a.n === b.n ? a.avgR - b.avgR : b.n - a.n)
  console.table(rows)
}

function buildFakeTicker(symbol, recentVolume) {
  return { symbol, volume: recentVolume, fundingRate: undefined, openInterest: undefined }
}

// ── Simulasi satu titik keputusan: cek gate, simulasikan lifecycle kalau lolos ──
function simulateSymbol(engine, candlesByTf, decisionIndices, btcLabelAt) {
  const decisionCandles = candlesByTf[DECISION_TF]
  const trades = []
  let cooldownUntilIndex = -1
  let prevLabel = null

  for (const t of decisionIndices) {
    if (t <= cooldownUntilIndex) continue

    const historySlice = {}
    const decisionTime = decisionCandles[t].time
    for (const tf of TIMEFRAMES) {
      historySlice[tf] = tf === DECISION_TF
        ? decisionCandles.slice(Math.max(0, t + 1 - LOOKBACK_BARS), t + 1)
        : sliceUpTo(candlesByTf[tf], decisionTime)
    }
    if (Object.values(historySlice).some((c) => c.length < 60)) continue

    const signal = engine.generateMTFSignal(historySlice, null, null)
    if (!signal || signal.label === 'Neutral') { prevLabel = signal?.label ?? null; continue }

    // Proxy quote volume 24h: sum(close*volume) 24 bar terakhir di DECISION_TF ('1h' -> 24 bar = 24 jam).
    const last24h = historySlice[DECISION_TF].slice(-24)
    const quoteVolume24h = last24h.reduce((s, c) => s + c.close * c.volume, 0)
    const ticker = buildFakeTicker('SIM', quoteVolume24h)
    const analysis = engine.analyzeFuturesSetup(ticker, signal, historySlice, quoteVolume24h, 0)
    if (!analysis || !analysis.primaryPlan) { prevLabel = signal.label; continue }

    const side = analysis.side
    const btcSafe = side === 'long' ? btcLabelAt(t) !== 'Bearish' : btcLabelAt(t) !== 'Bullish'
    const confirmed = prevLabel === signal.label ? 2 : 1
    prevLabel = signal.label

    // Tanpa argumen kedua -> pakai DEFAULT_ENTRY_GATE_THRESHOLDS asli dari production.
    // spreadPct dikasih 0 (bukan sebagai threshold longgar, tapi sebagai INPUT "spread
    // terbaik mungkin") karena data bid-ask historis tidak ada — otomatis lolos gate itu
    // tanpa perlu override threshold-nya sendiri.
    const gateResult = engine.entryGate.evaluateEntryGate({
      label: signal.label,
      rankingScore: analysis.rankingScore,
      accuracyPct: analysis.accuracyPct,
      confidenceLabel: analysis.confidenceLabel,
      timeframeAlignment: analysis.alignment,
      riskReward: analysis.primaryPlan.riskReward,
      crowdednessLabel: analysis.crowdednessLabel,
      quoteVolume24h,
      spreadPct: 0,
      // SL_PCT konstanta tetap -- sama kayak scanWorker.ts production, bukan dihitung dari
      // openHigh/stopLoss zona teknikal (yang nyampur openHigh dengan stopLoss versi long
      // yang asalnya dari openLow, jadi ngukur lebar zona bukan jarak SL beneran).
      stopDistPct: engine.SL_PCT,
      btcRegimeSafe: btcSafe,
      confirmedCandleCloses: confirmed,
      symbolWhitelisted: true,
      hasOpenPositionForSymbol: false,               // dijamin oleh cooldown/skip di loop ini
      symbolCooldownActive: false,
    })
    if (!gateResult.pass) continue

    const plan = analysis.primaryPlan
    const isLong = side === 'long'
    const fillIndex = findFillIndex(decisionCandles, t, plan, isLong)
    if (fillIndex === null) continue

    // openLow (long) / openHigh (short) = ujung zona yang PALING DALAM pullback-nya —
    // konfirmasi lebih kuat bahwa harga beneran mantul, bukan cuma nyentuh zona sekilas.
    // Sebelumnya pakai ujung yang berlawanan (paling dangkal/paling nggak sabar), yang
    // kemungkinan bikin entry kejadian SEBELUM harga beneran mantul dari support/resistance.
    const fillPrice = isLong ? plan.openLow : plan.openHigh

    // EKSPERIMEN: flip short->long berbasis tren -- entry gate di atas TETAP dievaluasi
    // pakai plan asli (short), fillIndex/fillPrice juga TETAP dari logika fill short asli
    // (itu yang nentuin KAPAN & DI HARGA BERAPA sinyal ini beneran trigger). Flip cuma ganti
    // ISI EKSEKUSINYA jadi long begitu tau kapan/di mana entry-nya, SL/TP1 dihitung ULANG
    // dari nol pakai formula long (BUKAN plan.stopLoss/takeProfit1 short asli).
    let isLongSim = isLong
    let flippedByTrend = false
    if (!isLong && TREND_FLIP_THRESHOLD_PCT > 0) {
      const lookbackIdx = t - TREND_FLIP_LOOKBACK_BARS
      if (lookbackIdx >= 0) {
        const trailingChangePct = (decisionCandles[t].close - decisionCandles[lookbackIdx].close) / decisionCandles[lookbackIdx].close
        if (trailingChangePct >= TREND_FLIP_THRESHOLD_PCT) {
          isLongSim = true
          flippedByTrend = true
        }
      }
    }

    // SHORT_SL_PCT_OVERRIDE cuma ganti SL short (long tetap plan.stopLoss asli/SL_PCT 4%) --
    // entry gate di atas TETAP pakai plan asli (stopDistPct dari SL_PCT), jadi trade yang
    // masuk simulasi ini SAMA PERSIS kayak yang lolos gate production, cuma exit-nya beda.
    const effectiveStopLoss = flippedByTrend
      ? fillPrice * (1 - engine.SL_PCT)
      : (!isLong && SHORT_SL_PCT_OVERRIDE > 0)
        ? fillPrice * (1 + SHORT_SL_PCT_OVERRIDE)
        : plan.stopLoss
    const effectiveTakeProfit1 = flippedByTrend
      ? fillPrice * (1 + engine.TP1_PCT)
      : plan.takeProfit1
    const rUnit = Math.abs(fillPrice - effectiveStopLoss)
    if (rUnit <= 0) continue

    // Single bracket TP1/SL — sama kayak production: TP1 nutup qty PENUH begitu kena
    // (TP1_PORTION=1 di futuresEngine.ts), SL statis, gak ada staircase/trailing lagi.
    let exitReason = null
    let realizedR = 0
    let exitCount = 0 // buat estimasi fee round-trip
    let stopPrice = effectiveStopLoss
    let lockArmed = false

    // Candle tempat limit terisi juga dicek SL-nya — sebelumnya loop mulai dari fillIndex+1,
    // jadi gerakan melawan di sisa candle fill diabaikan dan hasil backtest terlalu optimis
    // (terutama untuk SL sempit). Konservatif: TP tidak dihitung di candle fill.
    const fillBar = decisionCandles[fillIndex]
    if (isLongSim ? fillBar.low <= stopPrice : fillBar.high >= stopPrice) {
      realizedR = (isLongSim ? stopPrice - fillPrice : fillPrice - stopPrice) / rUnit
      exitReason = 'SL'
      exitCount += 1
      cooldownUntilIndex = fillIndex + SYMBOL_COOLDOWN_BARS
    }

    const capIndex = Math.min(fillIndex + HARD_CAP_BARS, decisionCandles.length - 1)
    for (let i = fillIndex + 1; !exitReason && i <= capIndex; i++) {
      const bar = decisionCandles[i]
      const barsSinceEntry = i - fillIndex

      const slHit = isLongSim ? bar.low <= stopPrice : bar.high >= stopPrice
      if (slHit) {
        realizedR = (isLongSim ? stopPrice - fillPrice : fillPrice - stopPrice) / rUnit
        exitReason = lockArmed ? 'LOCK' : 'SL'
        exitCount += 1
        cooldownUntilIndex = i + SYMBOL_COOLDOWN_BARS
        break
      }

      const tp1Hit = isLongSim ? bar.high >= effectiveTakeProfit1 : bar.low <= effectiveTakeProfit1
      if (tp1Hit) {
        realizedR = (isLongSim ? effectiveTakeProfit1 - fillPrice : fillPrice - effectiveTakeProfit1) / rUnit
        exitReason = 'TP1'
        exitCount += 1
        cooldownUntilIndex = i + SYMBOL_COOLDOWN_BARS
        break
      }

      // Lock-profit: cek pakai high/low bar ini, tapi BARU diterapkan mulai bar berikutnya
      // (bukan bar yang sama) -- hindari paradoks intra-bar, sama kayak eksperimen breakeven
      // sebelumnya.
      if (LOCK_TRIGGER_PCT > 0 && !lockArmed) {
        const favorableExtreme = isLongSim ? bar.high : bar.low
        const movePct = isLongSim ? (favorableExtreme - fillPrice) / fillPrice : (fillPrice - favorableExtreme) / fillPrice
        if (movePct >= LOCK_TRIGGER_PCT) {
          stopPrice = isLongSim ? fillPrice * (1 + LOCK_PROFIT_PCT) : fillPrice * (1 - LOCK_PROFIT_PCT)
          lockArmed = true
        }
      }

      // TIME_STOP CUMA kalau posisi lagi UNTUNG (harga close saat ini udah di sisi profit
      // dibanding entry), dicek TIAP bar sejak bar ke-8 -- kalau masih rugi/flat pas bar 8,
      // terus dipantau bar berikutnya, exit begitu PERTAMA KALI closeR>0. Kalau gak pernah
      // untung sampai HARD_CAP_BARS, jalan terus ke arah SL/TP1/CAP natural.
      if (barsSinceEntry >= TIME_STOP_BARS) {
        const closeR = (isLongSim ? bar.close - fillPrice : fillPrice - bar.close) / rUnit
        if (closeR > 0) {
          realizedR = closeR
          exitReason = 'TIME_STOP'
          exitCount += 1
            cooldownUntilIndex = i + SYMBOL_COOLDOWN_BARS
          break
        }
      }

      // MAX_HOLD: backstop mutlak, tutup APAPUN kondisinya (untung/rugi/flat) begitu udah
      // selama ini -- beda dari TIME_STOP di atas yang cuma nutup kalau lagi untung.
      if (barsSinceEntry >= MAX_HOLD_BARS) {
        realizedR = (isLongSim ? bar.close - fillPrice : fillPrice - bar.close) / rUnit
        exitReason = 'MAX_HOLD'
        exitCount += 1
        cooldownUntilIndex = i + SYMBOL_COOLDOWN_BARS
        break
      }

      if (i === capIndex) {
        const exitPrice = bar.close
        realizedR = (isLongSim ? exitPrice - fillPrice : fillPrice - exitPrice) / rUnit
        exitReason = 'CAP'
        exitCount += 1
        cooldownUntilIndex = i + SYMBOL_COOLDOWN_BARS
      }
    }

    if (exitReason) {
      // Estimasi biaya round-trip dalam satuan R (single fill + single exit = 1 eksekusi).
      const stopDistPct = rUnit / fillPrice
      const roundTripPct = 0.0004 * 2 + 0.0003 + 0.0002
      const feeR = (roundTripPct / stopDistPct) * Math.max(exitCount, 1)
      realizedR -= feeR
      trades.push({ symbol: 'SIM', side: flippedByTrend ? 'long (flip)' : side, entryIndex: fillIndex, exitReason, rMultiple: realizedR, contextLabel: analysis.contextLabel })
    }
  }

  return trades
}

// Limit order beneran nempel di fillPrice (openLow buat long, openHigh buat short) — cuma
// terisi kalau harga BENERAN nyampe situ, bukan cuma nyentuh bagian mana pun dari zona.
function findFillIndex(decisionCandles, decisionIndex, plan, isLong) {
  const fillLevel = isLong ? plan.openLow : plan.openHigh
  for (let i = decisionIndex + 1; i <= Math.min(decisionIndex + ENTRY_TTL_BARS, decisionCandles.length - 1); i++) {
    const bar = decisionCandles[i]
    const reached = isLong ? bar.low <= fillLevel : bar.high >= fillLevel
    if (reached) return i
  }
  return null
}

async function main() {
  console.log(`Loading ${SYMBOLS.length} simbol x ${TIMEFRAMES.length} timeframe (cached kalau sudah ada)...`)
  const candlesBySymbol = {}
  for (const symbol of SYMBOLS) {
    try {
      candlesBySymbol[symbol] = await getMultiTfCandles(symbol)
    } catch (e) {
      console.error(`  skip ${symbol}: ${e.message}`)
    }
  }

  const engineBundle = bundleEngine()
  const engine = await import(`${engineBundle}?t=${Date.now()}`)

  const btcCandles = candlesBySymbol['BTCUSDT']
  function makeBtcLabelAt() {
    return (t) => {
      const decisionTime = btcCandles[DECISION_TF][t]?.time
      if (!decisionTime) return 'Neutral'
      const slice = {}
      for (const tf of TIMEFRAMES) {
        slice[tf] = tf === DECISION_TF ? btcCandles[tf].slice(0, t + 1) : sliceUpTo(btcCandles[tf], decisionTime)
      }
      if (Object.values(slice).some((c) => c.length < 60)) return 'Neutral'
      const s = engine.generateMTFSignal(slice, null, null)
      return s?.label ?? 'Neutral'
    }
  }
  const btcLabelAt = makeBtcLabelAt()

  const perSymbol = []
  const trainAll = []
  const testAll = []
  const allTradesBySymbol = {}

  for (const [symbol, candlesByTf] of Object.entries(candlesBySymbol)) {
    const decisionCandles = candlesByTf[DECISION_TF]
    const warmupBars = Math.ceil((WARMUP_DAYS * 24 * 60) / TF_MINUTES[DECISION_TF])
    const splitIdx = warmupBars + Math.floor((decisionCandles.length - warmupBars) * TRAIN_FRACTION)
    const endIdx = decisionCandles.length - HARD_CAP_BARS - 1
    if (endIdx <= splitIdx) continue

    const trainIndices = range(warmupBars, splitIdx)
    const testIndices = range(splitIdx + 1, endIdx)

    const trainTrades = simulateSymbol(engine, candlesByTf, trainIndices, btcLabelAt)
    const testTrades = simulateSymbol(engine, candlesByTf, testIndices, btcLabelAt)

    trainAll.push(...trainTrades)
    testAll.push(...testTrades)
    allTradesBySymbol[symbol] = [...trainTrades, ...testTrades]

    perSymbol.push({
      symbol,
      'TRAIN n': trainTrades.length, 'TRAIN winRate%': summarize(trainTrades).winRate, 'TRAIN avgR': summarize(trainTrades).avgR,
      'TEST n': testTrades.length, 'TEST winRate%': summarize(testTrades).winRate, 'TEST avgR': summarize(testTrades).avgR,
    })
  }

  console.log('\n=== Per-symbol (TRAIN = fit window, TEST = held-out out-of-sample) ===\n')
  console.table(perSymbol)

  console.log('=== AGGREGATE TRAIN ===', summarize(trainAll))
  console.log('=== AGGREGATE TEST (out-of-sample) ===', summarize(testAll))

  const exitBreakdown = {}
  for (const t of testAll) exitBreakdown[t.exitReason] = (exitBreakdown[t.exitReason] ?? 0) + 1
  console.log('\n=== Distribusi exit reason (TEST) ===', exitBreakdown)

  // EKSPERIMEN: breakdown TEST per contextLabel -- Overextended (counter-trend/mean-
  // reversion) vs Trend Continuation/Pullback/Breakdown/Bounce (searah trend besar).
  const byContext = {}
  for (const t of testAll) {
    const key = t.contextLabel ?? 'unknown'
    if (!byContext[key]) byContext[key] = []
    byContext[key].push(t)
  }
  console.log('\n=== TEST breakdown per contextLabel ===')
  for (const [label, trades] of Object.entries(byContext)) {
    console.log(`  ${label.padEnd(20)}`, summarize(trades))
  }

  // EKSPERIMEN: breakdown TEST per side -- 'long (flip)' = short yang di-flip jadi long
  // gara-gara TREND_FLIP_THRESHOLD_PCT, dibandingkan langsung sama short/long biasa.
  const bySide = {}
  for (const t of testAll) {
    const key = t.side
    if (!bySide[key]) bySide[key] = []
    bySide[key].push(t)
  }
  console.log('\n=== TEST breakdown per side (termasuk long (flip) kalau TREND_FLIP aktif) ===')
  for (const [label, trades] of Object.entries(bySide)) {
    console.log(`  ${label.padEnd(20)}`, summarize(trades))
  }

  const engineForBreakeven = engine
  const breakevenWinRate = engineForBreakeven.SL_PCT / (engineForBreakeven.SL_PCT + engineForBreakeven.TP1_PCT)
  printPerSymbolReport(allTradesBySymbol, breakevenWinRate)

  console.log(
    '\nCatatan: expectancyR = rata-rata R per trade dikurangi estimasi fee round-trip.',
    '\nKalau expectancyR TEST <= 0, JANGAN lanjut ke M3/paper trading — strategi belum ada edge setelah biaya.',
    '\nGate di backtest ini SAMA PERSIS dengan production KECUALI maxSpreadPct (bid-ask spread',
    'historis tidak ada di data candle OHLCV) — jadi frekuensi trade riil di production bisa sedikit',
    'lebih rendah dari angka "n" di atas kalau banyak simbol yang lolos gate lain tapi spread-nya lebar.'
  )
}

function range(start, end) {
  const out = []
  for (let i = start; i <= end; i++) out.push(i)
  return out
}

main()
