import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.join(process.cwd(), 'data')
const OPEN_FILE = path.join(DATA_DIR, 'scalp-open.json')
const CLOSED_FILE = path.join(DATA_DIR, 'scalp-closed.jsonl')

// Scalping shadow-only (06 Agustus, user) -- logic: golden cross (%K motong %D ke atas,
// abis oversold K<30) di 5m = buka trial long. Dead cross (%K motong %D ke bawah, abis
// overbought K>70) = tutup trial itu (BUKAN buka short baru -- exit doang). SL/TP persentase
// tetap ada sebagai BACKSTOP kalau dead cross gak kunjung muncul, bukan exit utama.
// SEPENUHNYA shadow -- gak pernah eksekusi order beneran, gak nyentuh state.json/trades.jsonl.
export interface ScalpOpenPosition {
  symbol: string
  entry: number
  // null = belum ada SL sama sekali (posisi masih di bawah trigger profit-lock). Begitu
  // profit nyentuh PROFIT_LOCK_TRIGGER_PCT, dikunci ke harga entry+trigger itu (breakeven+buffer).
  stopLoss: number | null
  takeProfit: number
  openedAt: number
  entryCandleTime: number
}

export interface ScalpClosedTrade {
  symbol: string
  entry: number
  exitPrice: number
  exitReason: 'DEAD_CROSS' | 'SL' | 'TP'
  pnlPct: number
  openedAt: number
  closedAt: number
}

// scalp-open.json = state kecil (overwrite tiap siklus, mirip state.json) -- posisi trial
// yang lagi "jalan", perlu persist biar gak ilang tiap restart/redeploy.
export function loadScalpOpen(): ScalpOpenPosition[] {
  if (!fs.existsSync(OPEN_FILE)) return []
  try {
    const parsed: ScalpOpenPosition[] = JSON.parse(fs.readFileSync(OPEN_FILE, 'utf-8'))
    // Posisi lama (sebelum entryCandleTime ditambahin) -- default 0 biar SL/TP langsung
    // valid dicek lagi di scan berikutnya, bukan nyangkut nunggu dead cross doang.
    return parsed.map((p) => ({ ...p, entryCandleTime: p.entryCandleTime ?? 0 }))
  } catch {
    return []
  }
}

export function saveScalpOpen(positions: ScalpOpenPosition[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(OPEN_FILE, JSON.stringify(positions, null, 2))
}

// scalp-closed.jsonl = append-only, riwayat trial yang udah resolve (mirip trades.jsonl).
export function appendScalpClosed(trade: ScalpClosedTrade): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.appendFileSync(CLOSED_FILE, JSON.stringify(trade) + '\n')
}
