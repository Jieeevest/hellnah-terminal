// Satu titik integrasi ke engine sinyal FE — backend TIDAK reimplementasi logic sinyal,
// cuma import langsung. tsx (dev runtime) & vitest sama-sama esbuild-based dan otomatis
// strip `import type` di dalam signals.ts/futuresEngine.ts, jadi tidak perlu bundling
// terpisah seperti scripts/backtest-autotrade.mjs (yang jalan sebagai plain Node .mjs).
export { generateMTFSignal, generateWeightedSignal } from '../../../src/lib/signals'
export { analyzeFuturesSetup } from '../../../src/lib/futuresEngine'
export { calcStochRSI, calcEMA } from '../../../src/lib/indicators'
export type { MTFSignalResult, WeightedSignalResult, Timeframe, BullishLabel } from '../../../src/lib/signals'
export type { FuturesSetupAnalysis, FuturesTradePlan } from '../../../src/lib/futuresEngine'
