import { HARD_LIMITS } from '../config/limits.js'
import { getFlipSymbols } from '../config/flipSymbols.js'
import { getBlacklistedSymbols } from '../config/blacklistSymbols.js'
import { CONFIG } from '../config/env.js'
import { sizePosition } from '../risk/positionSizing.js'
import { evaluateDailyGuard, rolloverIfNewDay, recordTradeResult } from '../risk/dailyGuard.js'
import { fetchMarkPrice, fetchSymbolFilters, TF_DURATION_MS } from '../marketData/binancePublic.js'
import { appendTradeLog } from '../store/tradeLog.js'
import { appendShadowShort } from '../store/shadowLog.js'
import { SL_PCT, TP1_PCT } from '../../../src/lib/futuresEngine.js'
import type { ScanCandidate } from './scanWorker.js'
import type { AppState, OpenPosition } from '../store/state.js'

const TIME_STOP_BARS = 8 // kalau belum sempat nyentuh TP1 sama sekali setelah N bar entry timeframe, cut loose
// Backstop mutlak — beda dari TIME_STOP (cuma nutup kalau lagi UNTUNG), ini nutup APAPUN
// kondisinya begitu udah selama ini, biar posisi gak nyangkut tanpa batas kalau gak pernah
// profit dan gak pernah kena SL/TP1. Lihat livePositionManager.ts buat detail alasannya.
const MAX_HOLD_BARS = 72
// Strategi 'trailing' (CONFIG.strategy): tanpa TP tetap & tanpa TIME_STOP — begitu harga
// jalan >= TRAIL_TRIGGER_PCT searah posisi, SL ikut harga terbaik sejauh TRAIL_PCT.
// Backtest 6 bulan (68 koin): win 85%, +1.34%/trade vs stable +0.51%, tapi lebih rugi
// saat pasar turun (1 tahun, 21 koin: -0.35% vs -0.10%).
const TRAIL_TRIGGER_PCT = 0.03
const TRAIL_PCT = 0.03
const TRAILING_MAX_HOLD_BARS = 336
const MAINTENANCE_MARGIN_RATE = 0.004 // estimasi konservatif — per-tier real dari leverageBracket baru masuk M4

// Pakai jarak SL AWAL (SL_PCT), bukan pos.stopLoss — trailing stop menggeser stopLoss.
function rUnit(pos: OpenPosition): number {
  return pos.entry * SL_PCT
}

function realizedPnlUsd(pos: OpenPosition, exitPrice: number, qty: number): number {
  const diff = pos.side === 'long' ? exitPrice - pos.entry : pos.entry - exitPrice
  return diff * qty
}

function recordClose(
  state: AppState,
  pos: OpenPosition,
  exitPrice: number,
  qtyClosed: number,
  reason: 'SL' | 'TP1' | 'TIME_STOP' | 'MAX_HOLD' | 'TRAIL' | 'MANUAL',
  nowMs: number
) {
  const pnl = realizedPnlUsd(pos, exitPrice, qtyClosed)
  const rMultiple = ((pos.side === 'long' ? exitPrice - pos.entry : pos.entry - exitPrice) / rUnit(pos)) * (qtyClosed / pos.qty)
  state.equity += pnl
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
    strategy: pos.strategy ?? 'stable',
  })

  // Dicatat baik untung maupun rugi — kerugian (SL) justru data paling berguna buat
  // dipelajari nanti (gate mana yang perlu diperketat, dst), bukan cuma yang profit.
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
}

function closeFully(state: AppState, pos: OpenPosition, exitPrice: number, reason: 'SL' | 'TP1' | 'TIME_STOP' | 'MAX_HOLD' | 'TRAIL', nowMs: number) {
  recordClose(state, pos, exitPrice, pos.qtyRemaining, reason, nowMs)
  state.symbolCooldownUntil[pos.symbol] = nowMs + HARD_LIMITS.symbolCooldownMs

  // Track SL pada posisi flip short->long (lihat tryOpenPositions) -- kena TP1/exit lain
  // RESET hitungannya (thesis flip masih kebukti bener), cuma SL yang nambah.
  if (pos.flippedFromShort) {
    if (reason === 'SL') {
      state.flipLongSlCount[pos.symbol] = (state.flipLongSlCount[pos.symbol] ?? 0) + 1
    } else {
      state.flipLongSlCount[pos.symbol] = 0
    }
  }
}

// Kill switch manual — tutup semua posisi di harga mark price saat ini. Dipanggil dari
// API control/close-all, bukan dari tick loop otomatis.
export async function closeAllPositions(state: AppState, log: (msg: string) => void): Promise<void> {
  const nowMs = Date.now()
  const stillOpen: OpenPosition[] = []
  for (const pos of state.openPositions) {
    try {
      const price = await fetchMarkPrice(pos.symbol)
      recordClose(state, pos, price, pos.qtyRemaining, 'MANUAL', nowMs)
    } catch (e) {
      log(`close-all GAGAL untuk ${pos.symbol}, posisi TETAP terbuka (tidak di-drop diam-diam): ${(e as Error).message}`)
      stillOpen.push(pos)
    }
  }
  state.openPositions = stillOpen
}

// Sengaja fill entry LANGSUNG di harga pasar saat ini (bukan resting limit order di
// openLow/openHigh seperti desain production M4) — untuk paper trading lokal, yang mau
// dilihat adalah perilaku TP bertahap/SL, bukan realisme fill limit order.
export async function tryOpenPositions(state: AppState, candidates: ScanCandidate[], log: (msg: string) => void): Promise<void> {
  const nowMs = Date.now()
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

    // Flip short->long khusus simbol di data/flip-symbols.txt -- lihat livePositionManager.ts
    // buat penjelasan lengkap kenapa (SKYAIUSDT dkk, tren kuat, sinyal short jadi kontrarian
    // valid buat long). Breaker per-simbol berhenti nge-flip kalau long-nya sendiri udah
    // kena SL beberapa kali (lihat closeFully).
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

    let entryPrice: number
    let filters
    try {
      ;[entryPrice, filters] = await Promise.all([fetchMarkPrice(candidate.symbol), fetchSymbolFilters(candidate.symbol)])
    } catch (e) {
      log(`${candidate.symbol} gagal ambil harga/filter: ${(e as Error).message}`)
      continue
    }

    // SL/TP dihitung ulang dari entryPrice BENERAN (harga live saat ini), bukan dari
    // plan.stopLoss/takeProfit* yang buildTradePlan hitung dari titik zona (openLow/openHigh).
    // Kalau dua harga itu beda dikit aja (wajar, karena buildTradePlan jalan sesaat sebelum
    // fetchMarkPrice), stopDistPct yang diukur sizePosition bisa nyimpang dari 5% pas dan
    // ketolak stop_dist_out_of_range walau seharusnya valid.
    const isLong = effectiveSide === 'long'
    const stopLoss = isLong ? entryPrice * (1 - SL_PCT) : entryPrice * (1 + SL_PCT)
    // Trailing: takeProfit1 diisi harga aktivasi trailing (bukan target jual) supaya tetap
    // informatif di UI.
    const exitPct = CONFIG.strategy === 'trailing' ? TRAIL_TRIGGER_PCT : TP1_PCT
    const takeProfit1 = isLong ? entryPrice * (1 + exitPct) : entryPrice * (1 - exitPct)

    if (!flippedFromShort && candidate.side === 'short' && !HARD_LIMITS.shortEntriesEnabled) {
      // Kandidat ini LOLOS entry gate (bukan ditolak kualitas) -- dicatat ke shadow-shorts.jsonl
      // (TERPISAH dari trades.jsonl/state.json, bukan trade sungguhan) buat dianalisis nanti.
      appendShadowShort({
        symbol: candidate.symbol,
        side: 'short',
        timestamp: nowMs,
        entry: entryPrice,
        stopLoss,
        takeProfit1,
        rankingScore: candidate.analysis.rankingScore,
        accuracyPct: candidate.analysis.accuracyPct,
        confidenceLabel: candidate.analysis.confidenceLabel,
      })
      log(`${candidate.symbol} short lolos gate (rank=${candidate.analysis.rankingScore.toFixed(1)} acc=${candidate.analysis.accuracyPct}%) tapi DILEWATIN -- dicatat ke shadow watchlist`)
      continue
    }

    // Margin lebih kecil khusus short — lihat catatan HARD_LIMITS.minMarginPct. Posisi flip
    // pakai margin LONG (4%) karena eksekusinya beneran long.
    const sizing = sizePosition({
      equity: state.equity,
      // Bantalan cross margin buat posisi INI = equity dikurangi margin yang udah
      // dipegang posisi lain yang masih open (dihitung ulang tiap iterasi, ikut totalMargin
      // di atas) — bukan equity penuh, supaya posisi ke-2/ke-3 gak dianggap sendirian
      // pegang seluruh equity padahal udah dishare.
      availableEquity: Math.max(state.equity - totalMargin, 0),
      entry: entryPrice,
      stopLoss,
      side: effectiveSide,
      marginPct: effectiveSide === 'short' ? 0.02 : 0.04,
      maintenanceMarginRate: MAINTENANCE_MARGIN_RATE,
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

    // maxTotalNotionalPct — plafon eksposur notional total across posisi (beda dari
    // maxTotalMarginPct di atas yang cuma batasi margin terpakai). Relevan khusus buat
    // cross margin: leverage tinggi bikin notional per-posisi bisa jauh lebih besar dari
    // margin-nya, jadi eksposur riil ke market perlu dibatasi terpisah dari margin.
    const totalNotional = state.openPositions.reduce((sum, p) => sum + p.margin * p.leverage, 0)
    if (state.equity > 0 && (totalNotional + sizing.result.notional) / state.equity > HARD_LIMITS.maxTotalNotionalPct) {
      log(`${candidate.symbol} ditolak: total notional exposure bakal lewat plafon ${HARD_LIMITS.maxTotalNotionalPct * 100}%`)
      continue
    }

    const positionId = `${candidate.symbol}-${nowMs}`

    state.openPositions.push({
      id: positionId,
      symbol: candidate.symbol,
      side: effectiveSide,
      entry: entryPrice,
      qty: sizing.result.qty,
      qtyRemaining: sizing.result.qty,
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
      flippedFromShort,
      strategy: CONFIG.strategy,
      peakPrice: entryPrice,
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
      qty: sizing.result.qty,
      margin: sizing.result.margin,
      rankingScore: candidate.analysis.rankingScore,
      accuracyPct: candidate.analysis.accuracyPct,
      confidenceLabel: candidate.analysis.confidenceLabel,
      riskReward: plan.riskReward,
      contextLabel: candidate.analysis.contextLabel,
      summary: candidate.analysis.summary,
    })

    log(`OPEN ${effectiveSide}${flippedFromShort ? ' (FLIP dari short)' : ''} ${candidate.symbol} @ ${entryPrice} qty=${sizing.result.qty} lev=${sizing.result.leverage}x SL=${stopLoss}`)
  }
}

export async function tickPositions(state: AppState, log: (msg: string) => void): Promise<void> {
  const nowMs = Date.now()
  const stillOpen: OpenPosition[] = []

  for (const pos of state.openPositions) {
    let price: number
    try {
      price = await fetchMarkPrice(pos.symbol)
    } catch (e) {
      log(`${pos.symbol} gagal ambil mark price: ${(e as Error).message}`)
      stillOpen.push(pos)
      continue
    }

    const isLong = pos.side === 'long'

    // Single bracket TP1/SL — SL statis (gak ada staircase/breakeven lagi), TP1 nutup
    // qty PENUH begitu kena (TP1_PORTION=1 di futuresEngine.ts), posisi langsung selesai.
    const isTrailing = pos.strategy === 'trailing'
    const slHit = isLong ? price <= pos.stopLoss : price >= pos.stopLoss
    if (slHit) {
      const trailLocked = isTrailing && (isLong ? pos.stopLoss > pos.entry : pos.stopLoss < pos.entry)
      closeFully(state, pos, pos.stopLoss, trailLocked ? 'TRAIL' : 'SL', nowMs)
      log(trailLocked ? `TRAIL ${pos.symbol} @ ${pos.stopLoss} — trailing stop kena, untung dikunci` : `SL ${pos.symbol} @ ${pos.stopLoss}`)
      continue
    }

    const tfDurationMs = TF_DURATION_MS[pos.primaryTimeframe] ?? TF_DURATION_MS['1h']
    const barsSinceEntry = (nowMs - pos.openedAt) / tfDurationMs

    if (isTrailing) {
      const peak = isLong ? Math.max(pos.peakPrice ?? pos.entry, price) : Math.min(pos.peakPrice ?? pos.entry, price)
      pos.peakPrice = peak
      const movePct = isLong ? (peak - pos.entry) / pos.entry : (pos.entry - peak) / pos.entry
      if (movePct >= TRAIL_TRIGGER_PCT) {
        const trailStop = isLong ? peak * (1 - TRAIL_PCT) : peak * (1 + TRAIL_PCT)
        if (isLong ? trailStop > pos.stopLoss : trailStop < pos.stopLoss) pos.stopLoss = trailStop
      }
      if (barsSinceEntry >= TRAILING_MAX_HOLD_BARS) {
        closeFully(state, pos, price, 'MAX_HOLD', nowMs)
        log(`MAX_HOLD ${pos.symbol} @ ${price} — udah ${TRAILING_MAX_HOLD_BARS} jam nyangkut, ditutup paksa`)
        continue
      }
      pos.markPrice = price
      pos.unrealizedPnlUsd = realizedPnlUsd(pos, price, pos.qtyRemaining)
      pos.unrealizedPnlPct = pos.margin > 0 ? (pos.unrealizedPnlUsd / pos.margin) * 100 : 0
      stillOpen.push(pos)
      continue
    }

    const tp1Hit = isLong ? price >= pos.takeProfit1 : price <= pos.takeProfit1
    if (tp1Hit) {
      closeFully(state, pos, pos.takeProfit1, 'TP1', nowMs)
      log(`TP1 ${pos.symbol} @ ${pos.takeProfit1} — posisi selesai`)
      continue
    }

    // TIME_STOP CUMA kalau posisi lagi UNTUNG (dicek tiap tick sejak bar ke-8) — kalau
    // masih rugi/flat, dibiarin jalan terus ke arah SL/TP1 natural, gak dipotong pas lagi
    // di bawah (backtest nunjukkin TIME_STOP tanpa syarat ini justru bikin expectancy minus,
    // banyak motong posisi yang kalau dibiarin jalan ternyata nyampe TP1).
    if (barsSinceEntry >= TIME_STOP_BARS) {
      const isProfitable = isLong ? price > pos.entry : price < pos.entry
      if (isProfitable) {
        closeFully(state, pos, price, 'TIME_STOP', nowMs)
        log(`TIME_STOP ${pos.symbol} @ ${price} — udah lewat batas waktu & lagi untung, diamankan`)
        continue
      }
    }

    if (barsSinceEntry >= MAX_HOLD_BARS) {
      closeFully(state, pos, price, 'MAX_HOLD', nowMs)
      log(`MAX_HOLD ${pos.symbol} @ ${price} — udah ${MAX_HOLD_BARS} jam nyangkut, ditutup paksa`)
      continue
    }

    pos.markPrice = price
    pos.unrealizedPnlUsd = realizedPnlUsd(pos, price, pos.qtyRemaining)
    pos.unrealizedPnlPct = pos.margin > 0 ? (pos.unrealizedPnlUsd / pos.margin) * 100 : 0
    stillOpen.push(pos)
  }

  state.openPositions = stillOpen
}
