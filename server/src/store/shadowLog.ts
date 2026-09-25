import fs from 'node:fs'
import path from 'node:path'
import { CONFIG } from '../config/env.js'

const DATA_DIR = CONFIG.dataDir
const LOG_FILE = path.join(DATA_DIR, 'shadow-shorts.jsonl')

// Daftar pantau short yang LOLOS entry gate tapi gak dieksekusi beneran (short lagi
// di-pause, lihat HARD_LIMITS.shortEntriesEnabled) -- SENGAJA terpisah dari
// trades.jsonl/state.json (bukan trade sungguhan, gak boleh nyampur sama data real).
// Dipakai buat analisis "kalau short gak di-pause, hasilnya bakal gimana" tanpa modal.
export interface ShadowShortEntry {
  symbol: string
  side: 'short'
  timestamp: number
  entry: number
  stopLoss: number
  takeProfit1: number
  rankingScore: number
  accuracyPct: number
  confidenceLabel: string
}

export function appendShadowShort(entry: ShadowShortEntry): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n')
}
