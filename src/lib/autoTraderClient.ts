import { API_URLS } from '@/constants/apiUrls'
import type { AutoTradeState } from '@/types/autoTrade'
import type { F3Snapshot } from '@/lib/fundingSqueeze'

const TOKEN = import.meta.env.VITE_TRADING_API_TOKEN as string | undefined

function authHeaders(): HeadersInit {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}
}

export async function fetchAutoTradeState(baseUrl = API_URLS.trading): Promise<AutoTradeState> {
  const res = await fetch(`${baseUrl}/api/state`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/state -> HTTP ${res.status}`)
  return res.json()
}

async function postControl(action: 'enable' | 'disable' | 'close-all', baseUrl: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/control/${action}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`POST /api/control/${action} -> HTTP ${res.status}`)
}

export const enableAutoTrade = (baseUrl = API_URLS.trading) => postControl('enable', baseUrl)
export const disableAutoTrade = (baseUrl = API_URLS.trading) => postControl('disable', baseUrl)
export const closeAllAutoTradePositions = (baseUrl = API_URLS.trading) => postControl('close-all', baseUrl)

export function subscribeAutoTradeStream(
  onState: (state: AutoTradeState) => void,
  onError?: (err: Event) => void,
  baseUrl = API_URLS.trading
): () => void {
  // Base = origin halaman saat ini — wajib kalau API_URLS.trading berupa path relatif
  // (mis. '/api-trading' di deployment Docker), karena `new URL()` throw kalau argumen
  // pertama relatif dan nggak dikasih base sama sekali.
  const url = new URL(`${baseUrl}/api/stream`, window.location.origin)
  if (TOKEN) url.searchParams.set('token', TOKEN) // EventSource tidak bisa kirim header custom

  const es = new EventSource(url.toString())
  es.onmessage = (ev) => {
    try {
      onState(JSON.parse(ev.data))
    } catch {
      // frame korup — abaikan, tunggu event berikutnya
    }
  }
  if (onError) es.onerror = onError
  return () => es.close()
}

// Snapshot panel Funding Squeeze (F3) dari server/src/engine/fundingShadow.ts, dikirim lewat SSE
// tiap siklus (±5 menit) — pola sama dengan subscribeAutoTradeStream di atas.
export function subscribeFundingStream(
  onSnapshot: (snapshot: F3Snapshot) => void,
  onError?: (err: Event) => void
): () => void {
  const url = new URL(`${API_URLS.trading}/api/funding-stream`, window.location.origin)
  if (TOKEN) url.searchParams.set('token', TOKEN)

  const es = new EventSource(url.toString())
  es.onmessage = (ev) => {
    try {
      onSnapshot(JSON.parse(ev.data))
    } catch {
      // frame korup — abaikan, tunggu event berikutnya
    }
  }
  if (onError) es.onerror = onError
  return () => es.close()
}
