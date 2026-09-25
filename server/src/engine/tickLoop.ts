import { CONFIG } from '../config/env.js'
import { runScanCycle } from './scanWorker.js'
import { tryOpenPositions, tickPositions } from './positionManager.js'
import { tryOpenPositionsLive, tickPositionsLive, refreshExternalPositions } from './livePositionManager.js'
import { runScalpScan } from './scalpScanner.js'
import { runFundingShadow } from './fundingShadow.js'
import { saveState, type AppState } from '../store/state.js'
import { sendPeriodicSummary } from '../notify/periodicSummary.js'

type LogFn = (msg: string) => void

const FUNDING_SHADOW_INTERVAL_MS = 5 * 60_000

export function startTickLoop(state: AppState, log: LogFn, onUpdate: () => void): () => void {
  const isLive = CONFIG.tradingMode === 'live'

  async function scanOnce() {
    if (!state.enabled) return // scan cuma relevan buat entry baru — posisi terbuka tetap dikelola tickOnce
    try {
      const candidates = await runScanCycle(state, log)
      if (candidates.length) {
        if (isLive) await tryOpenPositionsLive(state, candidates, log)
        else await tryOpenPositions(state, candidates, log)
      }
    } catch (e) {
      log(`scan cycle error: ${(e as Error).message}`)
    }
    state.updatedAt = Date.now()
    saveState(state)
    onUpdate()
  }

  async function tickOnce() {
    if (!state.openPositions.length) return
    try {
      if (isLive) await tickPositionsLive(state, log)
      else await tickPositions(state, log)
    } catch (e) {
      log(`tick cycle error: ${(e as Error).message}`)
    }
    state.updatedAt = Date.now()
    saveState(state)
    onUpdate()
  }

  // Read-only, terpisah dari scanOnce/tickOnce di atas — jalan terlepas dari
  // enabled/openPositions.length, biar "posisi lain di akun" tetap ke-update walau bot
  // lagi nonaktif atau belum punya posisi sendiri sama sekali.
  async function externalPositionsOnce() {
    if (!isLive) return
    try {
      await refreshExternalPositions(state)
      onUpdate()
    } catch (e) {
      log(`gagal refresh posisi eksternal: ${(e as Error).message}`)
    }
  }

  // Jalan terlepas dari enabled/openPositions.length — equity & PnL harian/bulanan tetap
  // relevan dipantau walau bot lagi nonaktif atau lagi flat (0 posisi terbuka).
  async function summaryOnce() {
    try {
      await sendPeriodicSummary(state, Date.now())
    } catch (e) {
      log(`gagal kirim ringkasan periodik: ${(e as Error).message}`)
    }
  }

  // EKSPERIMEN shadow-only (lihat scalpScanner.ts) -- gak nyentuh state.json/saveState,
  // gak ada order beneran, cuma nyatet ke data/scalp-longs.jsonl. Digate ke state.enabled
  // sama kayak scanOnce, biar konsisten "bot lagi aktif" = kedua scanner jalan bareng.
  async function scalpScanOnce() {
    if (!state.enabled) return
    try {
      await runScalpScan(log)
    } catch (e) {
      log(`scalp scan error: ${(e as Error).message}`)
    }
  }

  // Forward-test F3 shadow-only (lihat fundingShadow.ts) — sengaja TIDAK digate ke state.enabled:
  // tujuannya ngumpulin bukti strategi di data baru, gak buka posisi apa pun.
  async function fundingShadowOnce() {
    try {
      await runFundingShadow(log)
    } catch (e) {
      log(`F3 forward-test error: ${(e as Error).message}`)
    }
  }

  const scanTimer = setInterval(scanOnce, CONFIG.scanIntervalMs)
  const tickTimer = setInterval(tickOnce, CONFIG.tickIntervalMs)
  const externalTimer = isLive ? setInterval(externalPositionsOnce, CONFIG.tickIntervalMs) : null
  const summaryTimer = setInterval(summaryOnce, CONFIG.summaryIntervalMs)
  const scalpScanTimer = setInterval(scalpScanOnce, CONFIG.scalpScanIntervalMs)
  const fundingShadowTimer = setInterval(fundingShadowOnce, FUNDING_SHADOW_INTERVAL_MS)
  fundingShadowOnce()
  if (isLive) externalPositionsOnce()

  return () => {
    clearInterval(scanTimer)
    clearInterval(tickTimer)
    if (externalTimer) clearInterval(externalTimer)
    clearInterval(summaryTimer)
    clearInterval(scalpScanTimer)
    clearInterval(fundingShadowTimer)
  }
}
