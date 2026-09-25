import * as esbuild from 'esbuild'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_DIR = path.join(ROOT, '.backtest-cache')
fs.mkdirSync(CACHE_DIR, { recursive: true })

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT',
  'AVAXUSDT', 'DOTUSDT', 'LTCUSDT', 'MATICUSDT', 'ATOMUSDT', 'NEARUSDT', 'APTUSDT',
  'ARBUSDT', 'OPUSDT', 'INJUSDT', 'FILUSDT', 'SUIUSDT',
]
const INTERVAL = '4h'
const TOTAL_BARS = 1100          // ~183 hari candle 4h
const FORWARD_BARS = 3           // evaluasi ~12 jam ke depan
const STEP = 3
const MIN_HISTORY = 210          // cukup untuk EMA200
const TRAIN_FRACTION = 0.7       // 70% awal = fit/analisis, 30% akhir = held-out test

// ── Fetch & cache candle historis (Binance public API, tanpa API key) ─────
async function fetchKlinesPage(symbol, endTime) {
  const params = new URLSearchParams({ symbol, interval: INTERVAL, limit: '1000' })
  if (endTime) params.set('endTime', String(endTime))
  const res = await fetch(`https://api.binance.com/api/v3/klines?${params}`)
  if (!res.ok) throw new Error(`${symbol} HTTP ${res.status}`)
  return res.json()
}

async function fetchKlines(symbol) {
  let all = []
  let endTime
  while (all.length < TOTAL_BARS) {
    const batch = await fetchKlinesPage(symbol, endTime)
    if (!batch.length) break
    all = batch.concat(all)
    endTime = batch[0][0] - 1
    if (batch.length < 1000) break
  }
  return all.slice(-TOTAL_BARS).map((d) => ({
    time: d[0], open: parseFloat(d[1]), high: parseFloat(d[2]),
    low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]),
  }))
}

async function getCandles(symbol) {
  const file = path.join(CACHE_DIR, `${symbol}-${INTERVAL}.json`)
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'))
  const candles = await fetchKlines(symbol)
  fs.writeFileSync(file, JSON.stringify(candles))
  return candles
}

// ── Bundle src/lib/signals.ts (working tree ATAU snapshot HEAD) via esbuild ─
function bundleSignals(entryFile, tag) {
  const result = esbuild.buildSync({
    entryPoints: [entryFile],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  })
  const outFile = path.join(CACHE_DIR, `bundle-${tag}.mjs`)
  fs.writeFileSync(outFile, result.outputFiles[0].text)
  return outFile
}

function snapshotHeadSignals() {
  const dir = path.join(CACHE_DIR, 'baseline-src')
  fs.mkdirSync(dir, { recursive: true })
  for (const f of ['signals.ts', 'indicators.ts']) {
    const content = execSync(`git show HEAD:src/lib/${f}`, { cwd: ROOT, encoding: 'utf-8' })
    fs.writeFileSync(path.join(dir, f), content)
  }
  return path.join(dir, 'signals.ts')
}

// ── Backtest core ───────────────────────────────────────────────────────
function summarize(arr) {
  if (!arr.length) return { n: 0, hitRate: null }
  const hits = arr.filter(Boolean).length
  return { n: arr.length, hitRate: Math.round((hits / arr.length) * 1000) / 10 }
}

const DIRECTION_SCORE_100 = {
  STRONG_BUY: 100, BUY: 75, NEUTRAL: 50, SELL: 25, STRONG_SELL: 0,
}

function evalRegion(engine, candles, tStart, tEnd) {
  const overall = []
  const raw = []
  const components = { rsi: [], bb: [], macd: [], ema: [], volume: [], obv: [] }
  const classicComponents = { ema: [], rsi: [], macd: [], stochRsi: [], supertrend: [], volume: [], pattern: [] }
  const classicOverall = []
  const blendRaw = []   // { classicScore100, weightedPct, actualUp } — buat sweep rasio blend

  for (let t = tStart; t <= tEnd; t += STEP) {
    const history = candles.slice(0, t + 1)
    const weighted = engine.generateWeightedSignal(history)
    const classic = engine.generateSignal(history)
    if (!weighted || !classic) continue

    const priceNow = candles[t].close
    const priceFuture = candles[t + FORWARD_BARS].close
    const actualUp = priceFuture > priceNow
    raw.push({ bullishPct: weighted.bullishPct, actualUp })

    const pred = weighted.bullishPct >= 55 ? true : weighted.bullishPct <= 45 ? false : null
    if (pred !== null) overall.push(pred === actualUp)

    const b = weighted
    const push = (key, score) => {
      if (score > 0) components[key].push(actualUp)
      else if (score < 0) components[key].push(!actualUp)
    }
    push('rsi', b.price.breakdown.rsi)
    push('bb', b.price.breakdown.bb)
    push('macd', b.technical.breakdown.macd)
    push('ema', b.technical.breakdown.ema)
    push('volume', b.volume.breakdown.volume)
    push('obv', b.volume.breakdown.obv)

    const classicScore100 = DIRECTION_SCORE_100[classic.direction]
    const classicPred = classicScore100 > 50 ? true : classicScore100 < 50 ? false : null
    if (classicPred !== null) classicOverall.push(classicPred === actualUp)
    blendRaw.push({ classicScore100, weightedPct: weighted.bullishPct, actualUp })

    const pushClassic = (key, ind) => {
      if (ind.signal > 0) classicComponents[key].push(actualUp)
      else if (ind.signal < 0) classicComponents[key].push(!actualUp)
    }
    pushClassic('ema', classic.indicators.ema)
    pushClassic('rsi', classic.indicators.rsi)
    pushClassic('macd', classic.indicators.macd)
    pushClassic('stochRsi', classic.indicators.stochRsi)
    pushClassic('supertrend', classic.indicators.supertrend)
    pushClassic('volume', classic.indicators.volume)
    if (classic.pattern.signal > 0) classicComponents.pattern.push(actualUp)
    else if (classic.pattern.signal < 0) classicComponents.pattern.push(!actualUp)
  }

  return { overall, components, raw, classicOverall, classicComponents, blendRaw }
}

// Simulasi "hasil scan": di tiap titik waktu t, hitung sinyal SEMUA simbol,
// ranking berdasarkan confidence (jarak bullishPct dari 50), ambil top-K yang
// beneran muncul di puncak list — itu yang user lihat & klik, bukan rata-rata
// semua sinyal yang lolos gate di semua coin.
function simulateScanTopK(engine, candlesBySymbol, tStart, tEnd, k) {
  const symbols = Object.keys(candlesBySymbol)
  const results = []

  for (let t = tStart; t <= tEnd; t += STEP) {
    const candidates = []
    for (const symbol of symbols) {
      const candles = candlesBySymbol[symbol]
      if (!candles || t + FORWARD_BARS >= candles.length) continue
      const history = candles.slice(0, t + 1)
      const weighted = engine.generateWeightedSignal(history)
      if (!weighted) continue
      if (weighted.bullishPct > 45 && weighted.bullishPct < 55) continue   // gate: skip Neutral

      const priceNow = candles[t].close
      const priceFuture = candles[t + FORWARD_BARS].close
      const actualUp = priceFuture > priceNow
      candidates.push({
        symbol,
        bullishPct: weighted.bullishPct,
        confidence: Math.abs(weighted.bullishPct - 50),
        predUp: weighted.bullishPct >= 55,
        actualUp,
      })
    }
    if (!candidates.length) continue
    candidates.sort((a, b) => b.confidence - a.confidence)
    const top = candidates.slice(0, k)
    for (const c of top) results.push(c.predUp === c.actualUp)
  }

  return results
}

function sweepBlendRatio(blendSamples, weightedRatios) {
  return weightedRatios.map((wr) => {
    const hits = []
    for (const { classicScore100, weightedPct, actualUp } of blendSamples) {
      const combined = classicScore100 * (1 - wr) + weightedPct * wr
      const pred = combined >= 55 ? true : combined <= 45 ? false : null
      if (pred !== null) hits.push(pred === actualUp)
    }
    return { weightedRatio: wr, ...summarize(hits) }
  })
}

function sweepThresholds(rawSamples, thresholds) {
  return thresholds.map((band) => {
    const hits = []
    for (const { bullishPct, actualUp } of rawSamples) {
      const dist = bullishPct - 50
      if (dist >= band) hits.push(actualUp === true)
      else if (dist <= -band) hits.push(actualUp === false)
    }
    return { band, ...summarize(hits) }
  })
}

async function main() {
  const compareBaseline = process.argv.includes('--compare')

  console.log(`Loading ${SYMBOLS.length} symbol candle (cached kalau sudah ada)...`)
  const candlesBySymbol = {}
  for (const symbol of SYMBOLS) {
    try { candlesBySymbol[symbol] = await getCandles(symbol) }
    catch (e) { console.error(`  skip ${symbol}: ${e.message}`) }
  }

  const currentBundle = bundleSignals(path.join(ROOT, 'src/lib/signals.ts'), 'current')
  const currentEngine = await import(`${currentBundle}?t=${Date.now()}`)

  const trainAgg = []
  const testAgg = []
  const trainRaw = []
  const testRaw = []
  const compAgg = { rsi: [], bb: [], macd: [], ema: [], volume: [], obv: [] }
  const classicCompAgg = { ema: [], rsi: [], macd: [], stochRsi: [], supertrend: [], volume: [], pattern: [] }
  const classicTrainAgg = []
  const classicTestAgg = []
  const blendTrainRaw = []
  const blendTestRaw = []
  const perSymbol = []

  for (const [symbol, candles] of Object.entries(candlesBySymbol)) {
    const splitIdx = Math.floor(candles.length * TRAIN_FRACTION)
    const train = evalRegion(currentEngine, candles, MIN_HISTORY, splitIdx)
    const test = evalRegion(currentEngine, candles, splitIdx + 1, candles.length - FORWARD_BARS - 1)

    trainAgg.push(...train.overall)
    testAgg.push(...test.overall)
    trainRaw.push(...train.raw)
    testRaw.push(...test.raw)
    for (const k of Object.keys(compAgg)) compAgg[k].push(...train.components[k])

    classicTrainAgg.push(...train.classicOverall)
    classicTestAgg.push(...test.classicOverall)
    for (const k of Object.keys(classicCompAgg)) classicCompAgg[k].push(...train.classicComponents[k])
    blendTrainRaw.push(...train.blendRaw)
    blendTestRaw.push(...test.blendRaw)

    perSymbol.push({
      symbol,
      'TRAIN n': summarize(train.overall).n, 'TRAIN %': summarize(train.overall).hitRate,
      'TEST n': summarize(test.overall).n, 'TEST %': summarize(test.overall).hitRate,
    })
  }

  console.log('\n=== Per-symbol hit-rate (TRAIN = fit window, TEST = held-out out-of-sample) ===\n')
  console.table(perSymbol)

  console.log('=== AGGREGATE — engine saat ini (working tree) ===')
  console.log('TRAIN:', summarize(trainAgg))
  console.log('TEST (out-of-sample):', summarize(testAgg))

  console.log('\n=== Kontribusi per komponen indikator (TRAIN window, semua simbol) ===')
  for (const [k, arr] of Object.entries(compAgg)) {
    console.log(`  ${k.padEnd(8)}:`, summarize(arr))
  }

  const thresholds = [0, 5, 10, 15, 20, 25, 30]
  console.log('\n=== Threshold sweep — TRAIN (band = jarak bullishPct dari 50) ===')
  console.table(sweepThresholds(trainRaw, thresholds))
  console.log('=== Threshold sweep — TEST / out-of-sample ===')
  console.table(sweepThresholds(testRaw, thresholds))

  console.log('\n=== Classic engine (generateSignal) — overall & per-komponen (TRAIN) ===')
  console.log('Classic overall TRAIN:', summarize(classicTrainAgg))
  console.log('Classic overall TEST :', summarize(classicTestAgg))
  for (const [k, arr] of Object.entries(classicCompAgg)) {
    console.log(`  ${k.padEnd(10)}:`, summarize(arr))
  }

  const ratios = [0, 0.2, 0.4, 0.6, 0.8, 1.0]
  console.log('\n=== Sweep rasio blend Classic/Weighted — TRAIN (weightedRatio=1 → 100% weighted) ===')
  console.table(sweepBlendRatio(blendTrainRaw, ratios))
  console.log('=== Sweep rasio blend Classic/Weighted — TEST / out-of-sample ===')
  console.table(sweepBlendRatio(blendTestRaw, ratios))

  const anySymbol = Object.values(candlesBySymbol)[0]
  const globalSplitIdx = Math.floor(anySymbol.length * TRAIN_FRACTION)
  const scanTestEnd = anySymbol.length - FORWARD_BARS - 1
  console.log(`\n=== Simulasi hasil scan (top-K per titik waktu, TEST region, ${Object.keys(candlesBySymbol).length} coin) ===`)
  console.table([1, 3, 5, 10].map((k) => {
    const hits = simulateScanTopK(currentEngine, candlesBySymbol, globalSplitIdx + 1, scanTestEnd, k)
    return { topK: k, ...summarize(hits) }
  }))

  if (compareBaseline) {
    console.log('\n=== Bandingkan dengan baseline git HEAD (sebelum redesign) ===')
    const baselineEntry = snapshotHeadSignals()
    const baselineBundle = bundleSignals(baselineEntry, 'baseline')
    const baselineEngine = await import(`${baselineBundle}?t=${Date.now()}`)

    const baselineTestAgg = []
    for (const candles of Object.values(candlesBySymbol)) {
      const splitIdx = Math.floor(candles.length * TRAIN_FRACTION)
      const test = evalRegion(baselineEngine, candles, splitIdx + 1, candles.length - FORWARD_BARS - 1)
      baselineTestAgg.push(...test.overall)
    }
    console.log('TEST (baseline / HEAD):', summarize(baselineTestAgg))
    console.log('TEST (current / working tree):', summarize(testAgg))
  }
}

main()
