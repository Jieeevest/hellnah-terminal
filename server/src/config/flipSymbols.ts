import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'flip-symbols.txt')

// Daftar simbol yang sinyal SHORT-nya dibalik jadi LONG (lihat livePositionManager.ts/
// positionManager.ts) -- SENGAJA file terpisah (bukan hardcode di limits.ts) biar bisa
// ditambah/dikurangi langsung via SSH ("echo SYMBOL >> data/flip-symbols.txt") tanpa perlu
// redeploy kode. Satu simbol per baris, baris kosong/diawali # diabaikan. File ada di
// data/ (Docker volume trading-data) -- SELAMAT dari rsync deploy (server/data di-exclude),
// jadi gak ke-reset tiap deploy kayak file di luar data/.
export function getFlipSymbols(): string[] {
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
