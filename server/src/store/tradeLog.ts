import fs from 'node:fs'
import path from 'node:path'
import { CONFIG } from '../config/env.js'

const DATA_DIR = CONFIG.dataDir
const LOG_FILE = path.join(DATA_DIR, 'trades.jsonl')

export interface TradeLogEntry {
  event: 'OPEN' | 'CLOSE'
  positionId: string
  symbol: string
  side: 'long' | 'short'
  timestamp: number
  // OPEN — kenapa bot masuk
  entry?: number
  stopLoss?: number
  takeProfit1?: number
  leverage?: number
  qty?: number
  margin?: number
  rankingScore?: number
  accuracyPct?: number
  confidenceLabel?: string
  riskReward?: number
  contextLabel?: string
  summary?: string
  // CLOSE — hasilnya
  exitPrice?: number
  exitReason?: string
  realizedPnlUsd?: number
  rMultiple?: number
  equityAfter?: number
}

// Append-only, terpisah dari state.json — riwayat buat dipelajari tetap utuh walau
// state.json suatu saat di-reset/rusak. Satu baris JSON per event (JSONL), gampang
// dibuka pakai jq / pandas / Excel Power Query tanpa parsing khusus.
export function appendTradeLog(entry: TradeLogEntry): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n')
}
