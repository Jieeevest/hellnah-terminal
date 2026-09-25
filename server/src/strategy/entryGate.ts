import { HARD_LIMITS } from '../config/limits.js'

export type SignalLabel = 'Bullish' | 'Mild Bullish' | 'Neutral' | 'Mild Bearish' | 'Bearish'
export type ConfidenceLabel = 'High' | 'Medium' | 'Low'
export type CrowdednessLabel = 'Low' | 'Moderate' | 'High'

export interface EntryGateInput {
  label: SignalLabel
  rankingScore: number
  accuracyPct: number
  confidenceLabel: ConfidenceLabel
  timeframeAlignment: number
  riskReward: number
  crowdednessLabel: CrowdednessLabel
  quoteVolume24h: number
  spreadPct: number
  stopDistPct: number
  btcRegimeSafe: boolean
  confirmedCandleCloses: number
  symbolWhitelisted: boolean
  hasOpenPositionForSymbol: boolean
  symbolCooldownActive: boolean
}

export interface EntryGateThresholds {
  minRankingScore: number
  minAccuracyPct: number
  minTimeframeAlignment: number
  minRiskReward: number
  minQuoteVolume24h: number
  maxSpreadPct: number
  minStopDistPct: number
  maxStopDistPct: number
  minConfirmedCandleCloses: number
}

// Angka-angka ini dikalibrasi dari diagnostic empiris atas 16 simbol x 65 hari data
// historis (lihat catatan commit) — versi awal (rankingScore>=68, accuracy>=62,
// alignment>=0.75, label harus Bullish/Bearish PENUH) ternyata SECARA MATEMATIS nyaris
// tidak pernah tercapai: rankingScore max yang teramati cuma 63.6, alignment median 0.25,
// dan label full-strength (bukan Mild) nggak pernah muncul sama sekali di 858 sinyal
// non-Neutral yang diuji. Bukan cuma "pasar lagi sepi" — itu threshold yang salah
// dikalibrasi (dipilih sebagai "lebih ketat dari scanner" tanpa dicek dulu apa formula
// skornya bisa mencapai angka segitu). Selektivitas sekarang ditumpukan ke gate numerik
// (rankingScore/accuracy/alignment/confirmedCandleCloses) daripada kategori label kasar.
export const DEFAULT_ENTRY_GATE_THRESHOLDS: EntryGateThresholds = {
  minRankingScore: 60,
  minAccuracyPct: 55,
  // 0.5 sebelumnya masih di ATAS median historis (0.25, lihat diagnostic 858 sinyal di
  // komentar atas) — kelewatan yang sama kayak rankingScore/akurasi dulu sebelum
  // direkalibrasi, cuma alignment-nya sendiri kelewat gak ikut diturunkan waktu itu.
  // 0.35 kasih selektivitas di atas median tanpa mustahil dicapai.
  minTimeframeAlignment: 0.35,
  // SL/TP sekarang persentase tetap (lihat futuresEngine.ts) — SL 10%, TP1 1.5% (single
  // bracket, TP1 nutup qty PENUH, bukan staircase lagi) -> riskReward SELALU persis 0.15.
  // minRiskReward diturunkan jauh dari 0.95 (peninggalan desain TP3=SL lama) ke 0.1, kasih
  // sedikit headroom di bawah 0.15 tanpa bikin gate ini kehilangan makna sama sekali.
  minRiskReward: 0.1,
  minQuoteVolume24h: 100_000_000,
  maxSpreadPct: 0.0005,
  minStopDistPct: HARD_LIMITS.minStopDistPct,
  maxStopDistPct: HARD_LIMITS.maxStopDistPct,
  minConfirmedCandleCloses: 2,
}

export type EntryGateReason =
  | 'neutral_label'
  | 'confidence_too_low'
  | 'ranking_score_too_low'
  | 'accuracy_too_low'
  | 'alignment_too_low'
  | 'risk_reward_too_low'
  | 'crowdedness_high'
  | 'liquidity_too_low'
  | 'spread_too_wide'
  | 'stop_dist_out_of_range'
  | 'btc_regime_unsafe'
  | 'not_confirmed_across_candles'
  | 'symbol_not_whitelisted'
  | 'symbol_already_open'
  | 'symbol_cooldown_active'

export type EntryGateResult =
  | { pass: true }
  | { pass: false; reasons: EntryGateReason[] }

// Penjelasan manusiawi tiap reason code — dipakai scanWorker.ts buat nulis activity log
// yang bisa dibaca orang awam, bukan cuma snake_case buat debugging.
export const ENTRY_GATE_REASON_LABEL: Record<EntryGateReason, string> = {
  neutral_label: 'sinyal masih netral, belum ada kecenderungan arah',
  confidence_too_low: 'tingkat keyakinan sinyal terlalu rendah',
  ranking_score_too_low: 'skor kelayakan setup di bawah standar minimum',
  accuracy_too_low: 'akurasi historis sinyal ini di bawah standar minimum',
  alignment_too_low: 'timeframe kecil & besar belum searah',
  risk_reward_too_low: 'potensi untung dibanding risiko terlalu kecil',
  crowdedness_high: 'funding rate nunjukin posisi ini udah terlalu ramai',
  liquidity_too_low: 'volume trading 24 jam terlalu kecil',
  spread_too_wide: 'selisih harga beli-jual (spread) terlalu lebar',
  stop_dist_out_of_range: 'jarak stop loss ke harga masuk di luar batas aman',
  btc_regime_unsafe: 'tren Bitcoin lagi nggak mendukung arah ini',
  not_confirmed_across_candles: 'sinyal belum bertahan konsisten di scan sebelumnya',
  symbol_not_whitelisted: 'simbol belum masuk daftar yang diizinkan',
  symbol_already_open: 'sudah ada posisi terbuka di simbol ini',
  symbol_cooldown_active: 'simbol ini masih cooldown abis trade terakhir',
}

export function evaluateEntryGate(
  input: EntryGateInput,
  thresholds: EntryGateThresholds = DEFAULT_ENTRY_GATE_THRESHOLDS
): EntryGateResult {
  const reasons: EntryGateReason[] = []

  if (input.label === 'Neutral') reasons.push('neutral_label')
  if (input.confidenceLabel === 'Low') reasons.push('confidence_too_low')
  if (input.rankingScore < thresholds.minRankingScore) reasons.push('ranking_score_too_low')
  if (input.accuracyPct < thresholds.minAccuracyPct) reasons.push('accuracy_too_low')
  if (input.timeframeAlignment < thresholds.minTimeframeAlignment) reasons.push('alignment_too_low')
  if (input.riskReward < thresholds.minRiskReward) reasons.push('risk_reward_too_low')
  if (input.crowdednessLabel === 'High') reasons.push('crowdedness_high')
  if (input.quoteVolume24h < thresholds.minQuoteVolume24h) reasons.push('liquidity_too_low')
  if (input.spreadPct > thresholds.maxSpreadPct) reasons.push('spread_too_wide')
  if (input.stopDistPct < thresholds.minStopDistPct || input.stopDistPct > thresholds.maxStopDistPct) {
    reasons.push('stop_dist_out_of_range')
  }
  if (!input.btcRegimeSafe) reasons.push('btc_regime_unsafe')
  if (input.confirmedCandleCloses < thresholds.minConfirmedCandleCloses) reasons.push('not_confirmed_across_candles')
  if (!input.symbolWhitelisted) reasons.push('symbol_not_whitelisted')
  if (input.hasOpenPositionForSymbol) reasons.push('symbol_already_open')
  if (input.symbolCooldownActive) reasons.push('symbol_cooldown_active')

  return reasons.length === 0 ? { pass: true } : { pass: false, reasons }
}
