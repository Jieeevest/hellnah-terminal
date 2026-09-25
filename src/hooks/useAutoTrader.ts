import { useState, useEffect, useCallback, useRef } from 'react'
import type { AutoTradeState } from '@/types/autoTrade'
import {
  fetchAutoTradeState,
  subscribeAutoTradeStream,
  enableAutoTrade,
  disableAutoTrade,
  closeAllAutoTradePositions,
} from '@/lib/autoTraderClient'
import { API_URLS } from '@/constants/apiUrls'

export type AutoTradeConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export function useAutoTrader(active: boolean, baseUrl = API_URLS.trading) {
  const [state, setState] = useState<AutoTradeState | null>(null)
  const [status, setStatus] = useState<AutoTradeConnectionStatus>('connecting')
  const [actionError, setActionError] = useState<string | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!active) return

    let cancelled = false
    setState(null)
    setStatus('connecting')

    fetchAutoTradeState(baseUrl)
      .then((s) => { if (!cancelled) setState(s) })
      .catch(() => { /* SSE onerror di bawah yang akan set status disconnected */ })

    unsubscribeRef.current = subscribeAutoTradeStream(
      (s) => { setState(s); setStatus('connected') },
      () => setStatus('disconnected'),
      baseUrl
    )

    return () => {
      cancelled = true
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [active, baseUrl])

  const runAction = useCallback(async (fn: () => Promise<void>) => {
    setActionError(null)
    try {
      await fn()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Gagal menjalankan aksi')
    }
  }, [])

  const enable = useCallback(() => runAction(() => enableAutoTrade(baseUrl)), [runAction, baseUrl])
  const disable = useCallback(() => runAction(() => disableAutoTrade(baseUrl)), [runAction, baseUrl])
  const closeAll = useCallback(() => runAction(() => closeAllAutoTradePositions(baseUrl)), [runAction, baseUrl])

  return { state, status, actionError, enable, disable, closeAll }
}
