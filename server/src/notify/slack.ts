// Notifikasi Slack — cuma buat kejadian PENTING (LIVE OPEN, SL, TP1, TIME_STOP, KRITIS,
// rekonsiliasi mismatch), BUKAN tiap log() biasa (94% activity log itu "ditolak gate",
// spam kalau semua dikirim). Gagal kirim gak boleh pernah ganggu trading logic — makanya
// error di sini cuma di-log ke console, gak pernah di-throw ke pemanggil.
import { CONFIG } from '../config/env.js'

export async function sendSlackMessage(text: string): Promise<void> {
  if (!CONFIG.slackWebhookUrl) return // gak dikonfigurasi -> no-op senyap
  try {
    const res = await fetch(CONFIG.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      console.error(`[slack] gagal kirim notif -> HTTP ${res.status}`)
    }
  } catch (e) {
    console.error(`[slack] gagal kirim notif: ${(e as Error).message}`)
  }
}
