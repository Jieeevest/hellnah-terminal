// TRADING_MODE=live — order execution BENERAN ke Binance Futures mainnet. Beda dari
// positionManager.ts (paper): entry & SL/TP di sini adalah order asli di exchange, bukan
// simulasi lokal. SL/TP dipasang sebagai STOP_MARKET/TAKE_PROFIT_MARKET closePosition=true
// LANGSUNG setelah entry keisi — proteksi hidup di exchange, gak bergantung server nyala.
import { HARD_LIMITS } from '../config/limits.js'
import { getFlipSymbols } from '../config/flipSymbols.js'
import { getBlacklistedSymbols } from '../config/blacklistSymbols.js'
import { CONFIG } from '../config/env.js'
import { sizePosition } from '../risk/positionSizing.js'
import { evaluateDailyGuard, rolloverIfNewDay, recordTradeResult } from '../risk/dailyGuard.js'
import { fetchMarkPrice, fetchSymbolFilters, TF_DURATION_MS } from '../marketData/binancePublic.js'
import { appendTradeLog } from '../store/tradeLog.js'
import { appendShadowShort } from '../store/shadowLog.js'
import { sendSlackMessage } from '../notify/slack.js'
import { SL_PCT, TP1_PCT } from '../../../src/lib/futuresEngine.js'
import {
  fetchUsdtEquity,
  fetchUsdtBalanceSnapshot,
  fetchMarginRatioPct,
  setLeverage,
  setMarginTypeCrossed,
  placeMarketOrder,
  placeStopMarketClose,
  placeTakeProfitMarketClose,
  placeMarketReduceOnlyClose,
  fetchOrderStatus,
  fetchAlgoOrderStatus,
  cancelAlgoOrder,
  fetchOpenPositionRisk,
  type BinanceCredentials,
  type OrderSide,
} from '../broker/binanceFutures.js'
import type { ScanCandidate } from './scanWorker.js'
import type { AppState, OpenPosition } from '../store/state.js'
import type { PositionSide } from '../risk/liquidation.js'

const TIME_STOP_BARS = 8
// Backstop mutlak — beda dari TIME_STOP di atas (yang cuma nutup kalau lagi UNTUNG),
// ini nutup APAPUN kondisinya (untung/rugi/flat) begitu udah selama ini, biar posisi
// gak bisa nyangkut tanpa batas kalau gak pernah profit dan gak pernah kena SL/TP1
// (kejadian nyata: ENAUSDT nyangkut >24 jam rugi terus, gak pernah kesentuh TIME_STOP
// karena syaratnya "harus lagi untung"). Backtest nunjukkin 24 bar gak ngaruh ke
// expectancy TEST sama sekali (gak ada trade yang kena di window itu).
const MAX_HOLD_BARS = 72

function creds(): BinanceCredentials {
  return { apiKey: CONFIG.binanceApiKey, apiSecret: CONFIG.binanceApiSecret }
}

function openSide(side: PositionSide): OrderSide {
  return side === 'long' ? 'BUY' : 'SELL'
}

function closeSide(side: PositionSide): OrderSide {
  return side === 'long' ? 'SELL' : 'BUY'
}

function rUnit(pos: OpenPosition): number {
  return Math.abs(pos.entry - pos.stopLoss)
}

function realizedPnlUsd(pos: OpenPosition, exitPrice: number): number {
  const diff = pos.side === 'long' ? exitPrice - pos.entry : pos.entry - exitPrice
  return diff * pos.qty
}

function recordCloseLive(
  state: AppState,
  pos: OpenPosition,
  exitPrice: number,
  reason: 'SL' | 'TP1' | 'TIME_STOP' | 'MAX_HOLD' | 'MANUAL',
  nowMs: number
) {
  const pnl = realizedPnlUsd(pos, exitPrice)
  const rMultiple = (pos.side === 'long' ? exitPrice - pos.entry : pos.entry - exitPrice) / rUnit(pos)
  state.dailyGuard = recordTradeResult(state.dailyGuard, pnl, nowMs)
  state.closedTrades.push({
    id: `${pos.id}-${reason}-${nowMs}`,
    symbol: pos.symbol,
    side: pos.side,
    entry: pos.entry,
    exitPrice,
    exitReason: reason,
    realizedPnlUsd: pnl,
    rMultiple,
    openedAt: pos.openedAt,
    closedAt: nowMs,
  })
  appendTradeLog({
    event: 'CLOSE',
    positionId: pos.id,
    symbol: pos.symbol,
    side: pos.side,
    timestamp: nowMs,
    exitPrice,
    exitReason: reason,
    realizedPnlUsd: pnl,
    rMultiple,
    equityAfter: state.equity,
  })
  state.symbolCooldownUntil[pos.symbol] = nowMs + HARD_LIMITS.symbolCooldownMs

  // Track SL pada posisi flip short->long (lihat tryOpenPositionsLive) -- kena TP1/exit
  // lain RESET hitungannya (thesis flip masih kebukti bener), cuma SL yang nambah.
  if (pos.flippedFromShort) {
    if (reason === 'SL') {
      state.flipLongSlCount[pos.symbol] = (state.flipLongSlCount[pos.symbol] ?? 0) + 1
    } else {
      state.flipLongSlCount[pos.symbol] = 0
    }
  }
}

// Read-only — posisi lain di akun Binance yang BUKAN dibuka bot ini (mis. posisi manual
// user). Ditulis ke state.externalPositions, SENGAJA gak masuk state.openPositions (biar
// gak kehitung limit bot & gak pernah disentuh tickPositionsLive). Dipanggil dari timer
// terpisah di tickLoop.ts, jalan terlepas dari enabled/openPositions.length.
export async function refreshExternalPositions(state: AppState): Promise<void> {
  const c = creds()
  const real = await fetchOpenPositionRisk(c)
  const botSymbols = new Set(state.openPositions.map((p) => p.symbol))
  state.externalPositions = real
    .filter((p) => !botSymbols.has(p.symbol))
    .map((p) => ({
      symbol: p.symbol,
      side: p.positionAmt > 0 ? ('long' as const) : ('short' as const),
      qty: Math.abs(p.positionAmt),
      entryPrice: p.entryPrice,
      leverage: p.leverage,
      unrealizedProfit: p.unrealizedProfit,
      liquidationPrice: p.liquidationPrice,
    }))
}

export async function tryOpenPositionsLive(state: AppState, candidates: ScanCandidate[], log: (msg: string) => void): Promise<void> {
  const nowMs = Date.now()
  const c = creds()

  // Equity & availableEquity REAL dari saldo Binance — availableEquity di sini udah
  // dihitung Binance sendiri account-wide (lihat catatan fetchUsdtBalanceSnapshot), bukan
  // dijumlah manual dari state.openPositions doang (yang bisa keliru kalau ada posisi lain
  // di akun ini yang bukan bot yang buka).
  let availableEquity: number
  try {
    const snapshot = await fetchUsdtBalanceSnapshot(c)
    state.equity = snapshot.equity
    availableEquity = snapshot.availableEquity
  } catch (e) {
    log(`gagal ambil saldo Binance, skip siklus entry ini: ${(e as Error).message}`)
    return
  }

  // Margin ratio ACCOUNT-WIDE (ikut posisi manual kayak ERAUSDT, bukan cuma posisi bot) —
  // kalau udah lewat plafon, blokir entry baru sama sekali siklus ini, apapun kondisi
  // limit lain (maxTotalMarginPct dkk cuma ngitung posisi bot, gak lihat gambar penuh akun).
  try {
    const marginRatioPct = await fetchMarginRatioPct(c)
    if (marginRatioPct >= HARD_LIMITS.maxMarginRatioPct) {
      log(`margin ratio akun ${marginRatioPct.toFixed(2)}% udah lewat plafon ${HARD_LIMITS.maxMarginRatioPct}%, blokir entry baru siklus ini`)
      return
    }
  } catch (e) {
    log(`gagal ambil margin ratio Binance, skip siklus entry ini: ${(e as Error).message}`)
    return
  }

  state.dailyGuard = rolloverIfNewDay(state.dailyGuard, state.equity, nowMs)
  const guardStatus = evaluateDailyGuard(state.dailyGuard, nowMs)
  if (!guardStatus.canOpenNewPosition) {
    log(`daily guard blokir entry baru: ${guardStatus.reason}`)
    return
  }

  // Dibaca sekali per siklus (bukan per kandidat) -- data/flip-symbols.txt bisa ditambah
  // simbol langsung via SSH tanpa redeploy, lihat flipSymbols.ts.
  const flipSymbols = getFlipSymbols()
  const blacklistedSymbols = getBlacklistedSymbols()

  for (const candidate of candidates) {
    if (state.openPositions.length >= HARD_LIMITS.maxConcurrentPositions) break

    if (blacklistedSymbols.includes(candidate.symbol)) {
      log(`${candidate.symbol} DIHINDARI -- masuk blacklist (data/blacklist-symbols.txt)`)
      continue
    }

    // Flip short->long khusus simbol di data/flip-symbols.txt -- simbol lagi tren kuat,
    // sinyal short-nya justru indikasi kontrarian yang valid buat long, BUKAN dilewatin.
    // Breaker per-simbol (flipLongSlBreaker) berhenti nge-flip kalau long-nya sendiri udah
    // kena SL beberapa kali (lihat recordCloseLive) -- tanda mungkin trennya udah berbalik.
    let effectiveSide = candidate.side
    let flippedFromShort = false
    if (candidate.side === 'short' && flipSymbols.includes(candidate.symbol)) {
      const slCount = state.flipLongSlCount[candidate.symbol] ?? 0
      if (slCount >= HARD_LIMITS.flipLongSlBreaker) {
        log(`${candidate.symbol} DIHINDARI -- flip long udah kena SL ${slCount}x (breaker ${HARD_LIMITS.flipLongSlBreaker})`)
        continue
      }
      effectiveSide = 'long'
      flippedFromShort = true
    }

    const totalMargin = state.openPositions.reduce((sum, p) => sum + p.margin, 0)
    if (state.equity > 0 && totalMargin / state.equity >= HARD_LIMITS.maxTotalMarginPct) break

    const sameDirectionCount = state.openPositions.filter((p) => p.side === effectiveSide).length
    if (sameDirectionCount >= HARD_LIMITS.maxSameDirectionPositions) continue

    const plan = candidate.analysis.primaryPlan
    if (!plan) continue

    let entryPriceEstimate: number
    let filters
    try {
      ;[entryPriceEstimate, filters] = await Promise.all([fetchMarkPrice(candidate.symbol), fetchSymbolFilters(candidate.symbol)])
    } catch (e) {
      log(`${candidate.symbol} gagal ambil harga/filter: ${(e as Error).message}`)
      continue
    }

    const isLong = effectiveSide === 'long'
    const stopLossEstimate = isLong ? entryPriceEstimate * (1 - SL_PCT) : entryPriceEstimate * (1 + SL_PCT)

    if (!flippedFromShort && candidate.side === 'short' && !HARD_LIMITS.shortEntriesEnabled) {
      // Kandidat ini LOLOS entry gate (bukan ditolak kualitas) -- dicatat ke shadow-shorts.jsonl
      // (TERPISAH dari trades.jsonl/state.json, bukan trade sungguhan) buat dianalisis nanti:
      // kalau short gak di-pause, hasilnya bakal TP1/SL/stop-hunt yang mana.
      const takeProfit1Estimate = entryPriceEstimate * (1 - TP1_PCT)
      appendShadowShort({
        symbol: candidate.symbol,
        side: 'short',
        timestamp: nowMs,
        entry: entryPriceEstimate,
        stopLoss: stopLossEstimate,
        takeProfit1: takeProfit1Estimate,
        rankingScore: candidate.analysis.rankingScore,
        accuracyPct: candidate.analysis.accuracyPct,
        confidenceLabel: candidate.analysis.confidenceLabel,
      })
      log(`${candidate.symbol} short lolos gate (rank=${candidate.analysis.rankingScore.toFixed(1)} acc=${candidate.analysis.accuracyPct}%) tapi DILEWATIN -- dicatat ke shadow watchlist`)
      continue
    }

    // Margin lebih kecil khusus short (backtest 250 hari: short "Overextended" avgR negatif
    // sementara long positif kuat, lihat catatan HARD_LIMITS.minMarginPct) — bukan matiin
    // short, cuma kurangi taruhannya sampai ada bukti lebih kuat ini pola permanen atau
    // cuma fase market bullish yang lagi berlangsung. Posisi flip pakai margin LONG (4%)
    // karena eksekusinya beneran long, walau sinyal awalnya short.
    const sizing = sizePosition({
      equity: state.equity,
      availableEquity,
      entry: entryPriceEstimate,
      stopLoss: stopLossEstimate,
      side: effectiveSide,
      marginPct: effectiveSide === 'short' ? 0.02 : 0.04,
      maintenanceMarginRate: 0.004,
      stepSize: filters.stepSize,
      minNotional: filters.minNotional,
      fixedLeverage: CONFIG.leverage,
    })
    if (!sizing.ok) {
      log(`${candidate.symbol} ditolak sizing: ${sizing.reason}`)
      continue
    }

    if (state.equity > 0 && (totalMargin + sizing.result.margin) / state.equity > HARD_LIMITS.maxTotalMarginPct) {
      log(`${candidate.symbol} ditolak: total margin bakal lewat plafon ${HARD_LIMITS.maxTotalMarginPct * 100}% saldo`)
      continue
    }

    const totalNotional = state.openPositions.reduce((sum, p) => sum + p.margin * p.leverage, 0)
    if (state.equity > 0 && (totalNotional + sizing.result.notional) / state.equity > HARD_LIMITS.maxTotalNotionalPct) {
      log(`${candidate.symbol} ditolak: total notional exposure bakal lewat plafon ${HARD_LIMITS.maxTotalNotionalPct * 100}%`)
      continue
    }

    // Set leverage & margin type SEBELUM order — kalau salah satu gagal, belum ada
    // eksposur riil sama sekali, aman buat skip candidate ini.
    try {
      await setMarginTypeCrossed(c, candidate.symbol)
      await setLeverage(c, candidate.symbol, sizing.result.leverage)
    } catch (e) {
      log(`${candidate.symbol} gagal set leverage/margin type: ${(e as Error).message}`)
      continue
    }

    let entryOrder
    try {
      entryOrder = await placeMarketOrder(c, candidate.symbol, openSide(effectiveSide), sizing.result.qty, filters.stepSize)
    } catch (e) {
      log(`${candidate.symbol} GAGAL entry order: ${(e as Error).message}`)
      continue
    }

    // Entry beneran keisi — hitung ulang SL/TP dari avgPrice REAL (bukan estimate pra-order).
    const entryPrice = entryOrder.avgPrice || entryPriceEstimate
    const stopLoss = isLong ? entryPrice * (1 - SL_PCT) : entryPrice * (1 + SL_PCT)
    const takeProfit1 = isLong ? entryPrice * (1 + TP1_PCT) : entryPrice * (1 - TP1_PCT)
    const qty = entryOrder.executedQty || sizing.result.qty

    let slOrder, tpOrder
    try {
      slOrder = await placeStopMarketClose(c, candidate.symbol, closeSide(effectiveSide), stopLoss, filters.tickSize)
      tpOrder = await placeTakeProfitMarketClose(c, candidate.symbol, closeSide(effectiveSide), takeProfit1, filters.tickSize)
    } catch (e) {
      // Posisi udah kebuka tapi bracket gagal dipasang — BAHAYA (gak ada proteksi sama
      // sekali). Prioritas: tutup paksa market SEKARANG, bukan biarkan telanjang.
      log(`${candidate.symbol} KRITIS: bracket SL/TP gagal dipasang (${(e as Error).message}), coba tutup paksa posisi...`)
      void sendSlackMessage(`:rotating_light: *${candidate.symbol}* bracket SL/TP gagal dipasang: ${(e as Error).message}`)
      try {
        await placeMarketReduceOnlyClose(c, candidate.symbol, closeSide(effectiveSide), qty, filters.stepSize)
        log(`${candidate.symbol} berhasil ditutup paksa setelah bracket gagal — cek manual di Binance buat pastikan.`)
        void sendSlackMessage(`:white_check_mark: *${candidate.symbol}* berhasil ditutup paksa setelah bracket gagal — cek manual di Binance.`)
      } catch (e2) {
        log(`${candidate.symbol} KRITIS BERAT: gagal juga tutup paksa (${(e2 as Error).message}) — POSISI TERBUKA TANPA PROTEKSI, cek & tutup manual SEKARANG di Binance.`)
        void sendSlackMessage(`:fire: *KRITIS BERAT* ${candidate.symbol}: gagal tutup paksa (${(e2 as Error).message}) — POSISI TERBUKA TANPA PROTEKSI, cek & tutup manual SEKARANG!`)
      }
      continue
    }

    const positionId = `${candidate.symbol}-${nowMs}`
    state.openPositions.push({
      id: positionId,
      symbol: candidate.symbol,
      side: effectiveSide,
      entry: entryPrice,
      qty,
      qtyRemaining: qty,
      leverage: sizing.result.leverage,
      margin: sizing.result.margin,
      stopLoss,
      takeProfit1,
      tickSize: filters.tickSize,
      stepSize: filters.stepSize,
      primaryTimeframe: plan.timeframe,
      openedAt: nowMs,
      markPrice: entryPrice,
      unrealizedPnlUsd: 0,
      unrealizedPnlPct: 0,
      entryRankingScore: candidate.analysis.rankingScore,
      entryAccuracyPct: candidate.analysis.accuracyPct,
      entryConfidenceLabel: candidate.analysis.confidenceLabel,
      entryRiskReward: plan.riskReward,
      entryContextLabel: candidate.analysis.contextLabel,
      entrySummary: candidate.analysis.summary,
      slAlgoId: slOrder.algoId,
      tpAlgoId: tpOrder.algoId,
      flippedFromShort,
    })

    appendTradeLog({
      event: 'OPEN',
      positionId,
      symbol: candidate.symbol,
      side: effectiveSide,
      timestamp: nowMs,
      entry: entryPrice,
      stopLoss,
      takeProfit1,
      leverage: sizing.result.leverage,
      qty,
      margin: sizing.result.margin,
      rankingScore: candidate.analysis.rankingScore,
      accuracyPct: candidate.analysis.accuracyPct,
      confidenceLabel: candidate.analysis.confidenceLabel,
      riskReward: plan.riskReward,
      contextLabel: candidate.analysis.contextLabel,
      summary: candidate.analysis.summary,
    })

    log(`LIVE OPEN ${effectiveSide}${flippedFromShort ? ' (FLIP dari short)' : ''} ${candidate.symbol} @ ${entryPrice} qty=${qty} lev=${sizing.result.leverage}x SL=${stopLoss} TP1=${takeProfit1}`)
    void sendSlackMessage(`:large_green_circle: *OPEN* ${effectiveSide.toUpperCase()}${flippedFromShort ? ' (FLIP)' : ''} ${candidate.symbol} @ ${entryPrice} | lev ${sizing.result.leverage}x | SL ${stopLoss} | TP1 ${takeProfit1}`)

    // Refresh snapshot buat candidate berikutnya di loop yang sama (maxConcurrentPositions
    // bisa >1) — availableEquity di atas kalau gak di-refresh bakal basi begitu posisi ini
    // udah makan sebagian margin.
    try {
      const snapshot = await fetchUsdtBalanceSnapshot(c)
      state.equity = snapshot.equity
      availableEquity = snapshot.availableEquity
    } catch (e) {
      log(`gagal refresh saldo setelah entry ${candidate.symbol}: ${(e as Error).message}`)
    }
  }
}

// Kill switch manual mode live — batalin bracket order (SL+TP) dulu, baru tutup posisi
// market reduceOnly. Dipanggil dari API control/close-all (server.ts), bukan tick loop.
export async function closeAllPositionsLive(state: AppState, log: (msg: string) => void): Promise<void> {
  const c = creds()
  const nowMs = Date.now()
  const stillOpen: OpenPosition[] = []
  for (const pos of state.openPositions) {
    try {
      if (pos.slAlgoId !== undefined) await cancelAlgoOrder(c, pos.slAlgoId)
      if (pos.tpAlgoId !== undefined) await cancelAlgoOrder(c, pos.tpAlgoId)
      const closeOrder = await placeMarketReduceOnlyClose(c, pos.symbol, closeSide(pos.side), pos.qty, pos.stepSize)
      recordCloseLive(state, pos, closeOrder.avgPrice || pos.markPrice, 'MANUAL', nowMs)
    } catch (e) {
      log(`close-all GAGAL untuk ${pos.symbol}, posisi TETAP terbuka (tidak di-drop diam-diam): ${(e as Error).message}`)
      void sendSlackMessage(`:rotating_light: close-all GAGAL untuk *${pos.symbol}* — posisi TETAP terbuka: ${(e as Error).message}`)
      stillOpen.push(pos)
    }
  }
  state.openPositions = stillOpen
}

export async function tickPositionsLive(state: AppState, log: (msg: string) => void): Promise<void> {
  const nowMs = Date.now()
  const c = creds()
  const stillOpen: OpenPosition[] = []

  try {
    state.equity = await fetchUsdtEquity(c)
  } catch (e) {
    log(`gagal ambil saldo Binance pas tick: ${(e as Error).message}`)
  }

  for (const pos of state.openPositions) {
    if (pos.slAlgoId === undefined || pos.tpAlgoId === undefined) {
      // Harusnya gak pernah kejadian (selalu diisi bareng pas open) — kalau kejadian,
      // jangan diam-diam didrop, biarin tetap muncul di list biar ketauan & dicek manual.
      log(`${pos.symbol} KRITIS: posisi live tanpa slAlgoId/tpAlgoId tercatat, cek manual di Binance.`)
      void sendSlackMessage(`:rotating_light: *${pos.symbol}* KRITIS: posisi live tanpa slAlgoId/tpAlgoId tercatat, cek manual di Binance.`)
      stillOpen.push(pos)
      continue
    }

    let slStatus, tpStatus
    try {
      ;[slStatus, tpStatus] = await Promise.all([
        fetchAlgoOrderStatus(c, pos.slAlgoId),
        fetchAlgoOrderStatus(c, pos.tpAlgoId),
      ])
    } catch (e) {
      log(`${pos.symbol} gagal cek status algo order: ${(e as Error).message}`)
      stillOpen.push(pos)
      continue
    }

    // actualOrderId keisi -> itu bukti paling andal order-nya beneran fill (spawn order
    // asli), dipakai LANGSUNG — bukan cocokin algoStatus ke string tertentu ('TRIGGERED')
    // kayak sebelumnya. Ternyata Binance balikin algoStatus="FINISHED" pas beneran fill,
    // bukan "TRIGGERED" (dokumentasi resminya gak lengkap soal ini) — ketauan dari kasus
    // nyata ZECUSDT yang nyangkut "open" di state padahal udah closed di Binance.
    if (slStatus.actualOrderId) {
      let exitPrice = pos.stopLoss
      try {
        exitPrice = (await fetchOrderStatus(c, pos.symbol, slStatus.actualOrderId)).avgPrice || exitPrice
      } catch { /* fallback ke estimasi stopLoss kalau gagal ambil harga fill asli */ }
      recordCloseLive(state, pos, exitPrice, 'SL', nowMs)
      await cancelAlgoOrder(c, pos.tpAlgoId)
      log(`SL ${pos.symbol} @ ${exitPrice}`)
      void sendSlackMessage(`:red_circle: *SL* ${pos.symbol} @ ${exitPrice} | ${realizedPnlUsd(pos, exitPrice).toFixed(2)} USD`)
      continue
    }
    if (tpStatus.actualOrderId) {
      let exitPrice = pos.takeProfit1
      try {
        exitPrice = (await fetchOrderStatus(c, pos.symbol, tpStatus.actualOrderId)).avgPrice || exitPrice
      } catch { /* fallback ke estimasi takeProfit1 kalau gagal ambil harga fill asli */ }
      recordCloseLive(state, pos, exitPrice, 'TP1', nowMs)
      await cancelAlgoOrder(c, pos.slAlgoId)
      log(`TP1 ${pos.symbol} @ ${exitPrice} — posisi selesai`)
      void sendSlackMessage(`:large_green_circle: *TP1* ${pos.symbol} @ ${exitPrice} | +${realizedPnlUsd(pos, exitPrice).toFixed(2)} USD`)
      continue
    }

    let price: number | null = null
    try {
      price = await fetchMarkPrice(pos.symbol)
    } catch {
      // Gagal ambil mark price cuma bikin floating PnL/keputusan TIME_STOP di bawah
      // sedikit basi — bukan masalah, SL/TP tetap aktif di exchange terlepas dari ini.
    }

    // TIME_STOP CUMA kalau posisi lagi UNTUNG — kalau masih rugi/flat, dibiarin jalan terus
    // ke arah SL/TP1 natural, gak dipotong pas lagi di bawah (backtest nunjukkin TIME_STOP
    // tanpa syarat ini justru bikin expectancy minus, banyak motong posisi yang kalau
    // dibiarin jalan ternyata nyampe TP1).
    const tfDurationMs = TF_DURATION_MS[pos.primaryTimeframe] ?? TF_DURATION_MS['1h']
    const barsSinceEntry = (nowMs - pos.openedAt) / tfDurationMs
    const isProfitable = price !== null && (pos.side === 'long' ? price > pos.entry : price < pos.entry)
    if (barsSinceEntry >= TIME_STOP_BARS && isProfitable) {
      try {
        await cancelAlgoOrder(c, pos.slAlgoId)
        await cancelAlgoOrder(c, pos.tpAlgoId)
        const closeOrder = await placeMarketReduceOnlyClose(c, pos.symbol, closeSide(pos.side), pos.qty, pos.stepSize)
        recordCloseLive(state, pos, closeOrder.avgPrice || pos.markPrice, 'TIME_STOP', nowMs)
        log(`TIME_STOP ${pos.symbol} @ ${closeOrder.avgPrice} — udah lewat batas waktu & lagi untung, diamankan`)
        void sendSlackMessage(`:hourglass: *TIME_STOP* ${pos.symbol} @ ${closeOrder.avgPrice} | +${realizedPnlUsd(pos, closeOrder.avgPrice || pos.markPrice).toFixed(2)} USD (diamankan, udah lewat batas waktu)`)
      } catch (e) {
        log(`${pos.symbol} gagal eksekusi TIME_STOP, coba lagi tick berikutnya: ${(e as Error).message}`)
        stillOpen.push(pos)
      }
      continue
    }

    if (barsSinceEntry >= MAX_HOLD_BARS) {
      try {
        await cancelAlgoOrder(c, pos.slAlgoId)
        await cancelAlgoOrder(c, pos.tpAlgoId)
        const closeOrder = await placeMarketReduceOnlyClose(c, pos.symbol, closeSide(pos.side), pos.qty, pos.stepSize)
        const exitPrice = closeOrder.avgPrice || pos.markPrice
        recordCloseLive(state, pos, exitPrice, 'MAX_HOLD', nowMs)
        log(`MAX_HOLD ${pos.symbol} @ ${exitPrice} — udah ${MAX_HOLD_BARS} jam nyangkut, ditutup paksa`)
        void sendSlackMessage(`:alarm_clock: *MAX_HOLD* ${pos.symbol} @ ${exitPrice} | ${realizedPnlUsd(pos, exitPrice).toFixed(2)} USD (udah ${MAX_HOLD_BARS} jam nyangkut, ditutup paksa)`)
      } catch (e) {
        log(`${pos.symbol} gagal eksekusi MAX_HOLD, coba lagi tick berikutnya: ${(e as Error).message}`)
        stillOpen.push(pos)
      }
      continue
    }

    if (price !== null) {
      pos.markPrice = price
      pos.unrealizedPnlUsd = realizedPnlUsd(pos, price)
      pos.unrealizedPnlPct = pos.margin > 0 ? (pos.unrealizedPnlUsd / pos.margin) * 100 : 0
    }
    stillOpen.push(pos)
  }

  state.openPositions = stillOpen
}
