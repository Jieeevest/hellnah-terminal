import { useState, useCallback } from 'react'

export type AlertDirection = 'above' | 'below'

export interface PriceAlert {
  id: string
  symbol: string
  baseAsset: string
  targetPrice: number
  direction: AlertDirection
  triggered: boolean
  createdAt: number
}

const STORAGE_KEY = 'hellnah-terminal_price_alerts'

function loadAlerts(): PriceAlert[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
}

export function usePriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>(loadAlerts)

  const addAlert = useCallback(
    (symbol: string, baseAsset: string, targetPrice: number, direction: AlertDirection) => {
      setAlerts((prev) => {
        const next: PriceAlert[] = [
          ...prev,
          { id: `${symbol}-${Date.now()}`, symbol, baseAsset, targetPrice, direction, triggered: false, createdAt: Date.now() },
        ]
        saveAlerts(next)
        return next
      })
    },
    [],
  )

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id)
      saveAlerts(next)
      return next
    })
  }, [])

  const clearTriggered = useCallback(() => {
    setAlerts((prev) => {
      const next = prev.filter((a) => !a.triggered)
      saveAlerts(next)
      return next
    })
  }, [])

  const checkAlerts = useCallback((symbol: string, currentPrice: number) => {
    setAlerts((prev) => {
      let changed = false
      const next = prev.map((alert) => {
        if (alert.triggered || alert.symbol !== symbol) return alert
        const hit =
          (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
          (alert.direction === 'below' && currentPrice <= alert.targetPrice)
        if (!hit) return alert

        changed = true
        if (Notification.permission === 'granted') {
          new Notification(`🔔 Alert: ${alert.baseAsset}`, {
            body: `Harga ${currentPrice.toLocaleString()} sudah ${alert.direction === 'above' ? 'di atas' : 'di bawah'} target ${alert.targetPrice.toLocaleString()}`,
            icon: '/favicon.ico',
          })
        }
        return { ...alert, triggered: true }
      })
      if (changed) saveAlerts(next)
      return changed ? next : prev
    })
  }, [])

  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }, [])

  return { alerts, addAlert, removeAlert, clearTriggered, checkAlerts, requestPermission }
}
