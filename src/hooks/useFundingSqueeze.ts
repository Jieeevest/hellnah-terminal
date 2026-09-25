import { useState, useEffect } from 'react'
import type { F3Snapshot } from '@/lib/fundingSqueeze'
import { subscribeFundingStream } from '@/lib/autoTraderClient'

export type FundingStreamStatus = 'connecting' | 'connected' | 'disconnected'

// Data panel Funding Squeeze dihitung server (server/src/engine/fundingShadow.ts) dan dikirim
// lewat SSE — jadi panel ini selalu sama dengan catatan forward-test, dan browser tidak perlu
// menembak Binance sendiri. EventSource otomatis mencoba sambung ulang kalau server mati.
export function useFundingSqueeze() {
  const [snapshot, setSnapshot] = useState<F3Snapshot | null>(null)
  const [status, setStatus] = useState<FundingStreamStatus>('connecting')

  useEffect(() => {
    return subscribeFundingStream(
      (s) => { setSnapshot(s); setStatus('connected') },
      () => setStatus('disconnected')
    )
  }, [])

  return { snapshot, status }
}
