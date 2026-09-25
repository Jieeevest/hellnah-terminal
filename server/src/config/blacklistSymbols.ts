import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'blacklist-symbols.txt')

// Simbol yang DIHINDARI TOTAL -- gak boleh entry sama sekali (long/short/flip). File
// terpisah (bukan hardcode di limits.ts), SSH-editable ("echo SYMBOL >> data/blacklist-symbols.txt")
// tanpa redeploy, sama pola kayak flipSymbols.ts. Satu simbol per baris, baris kosong/
// diawali # diabaikan.
export function getBlacklistedSymbols(): string[] {
  if (!fs.existsSync(FILE)) return []
  try {
    return fs.readFileSync(FILE, 'utf-8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
  } catch {
    return []
  }
}
