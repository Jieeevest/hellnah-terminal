import { useState, useEffect, useCallback, useRef } from 'react'
import type { Exchange, MarketType } from '@/types'
import type { SignalTimeframe } from '@/hooks/useSignalData'
import { fetchCandles } from '@/hooks/useSignalData'
import { calcRSI, calcEMA } from '@/lib/indicators'

export type TechIndicator = 'RSI' | 'EMA'
export type TechCondition = 'above' | 'below'

export interface TechnicalAlert {
  id: string
  symbol: string
  exchange: Exchange
  marketType: MarketType
  baseAsset: string
  indicator: TechIndicator
  condition: TechCondition
  value: number
  timeframe: SignalTimeframe
  triggered: boolean
  createdAt: number
}

const STORAGE_KEY = 'hellnah-terminal_tech_alerts'

function load(): TechnicalAlert[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function save(alerts: TechnicalAlert[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
}

export function useTechnicalAlerts() {
  const [alerts, setAlerts] = useState<TechnicalAlert[]>(load)

  const addAlert = useCallback((params: Omit<TechnicalAlert, 'id' | 'triggered' | 'createdAt'>) => {
    setAlerts((prev) => {
      const next = [...prev, { ...params, id: Date.now().toString(), triggered: false, createdAt: Date.now() }]
      save(next)
      return next
    })
  }, [])

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => { const next = prev.filter((a) => a.id !== id); save(next); return next })
  }, [])

  const markTriggered = useCallback((id: string) => {
    setAlerts((prev) => {
      const next = prev.map((a) => a.id === id ? { ...a, triggered: true } : a)
      save(next)
      return next
    })
  }, [])

  const clearTriggered = useCallback(() => {
    setAlerts((prev) => { const next = prev.filter((a) => !a.triggered); save(next); return next })
  }, [])

  return { alerts, addAlert, removeAlert, markTriggered, clearTriggered }
}

export function useTechnicalAlertChecker(
  alerts: TechnicalAlert[],
  onTrigger: (id: string, msg: string) => void
) {
  const onTriggerRef = useRef(onTrigger)
  useEffect(() => { onTriggerRef.current = onTrigger })

  const alertsRef = useRef(alerts)
  useEffect(() => { alertsRef.current = alerts })

  useEffect(() => {
    const check = async () => {
      const pending = alertsRef.current.filter((a) => !a.triggered)
      if (pending.length === 0) return
      for (const alert of pending) {
        try {
          const candles = await fetchCandles(alert.symbol, alert.exchange, alert.marketType, alert.timeframe)
          if (candles.length < 20) continue
          const closes = candles.map((c) => c.close)
          const lastClose = closes[closes.length - 1]

          let conditionMet = false
          let msg = ''

          if (alert.indicator === 'RSI') {
            const rsiArr = calcRSI(closes, 14)
            const rsi = rsiArr[rsiArr.length - 1]
            if (rsi == null) continue
            conditionMet = alert.condition === 'above' ? rsi > alert.value : rsi < alert.value
            msg = `${alert.baseAsset} RSI ${rsi.toFixed(1)} ${alert.condition === 'above' ? '>' : '<'} ${alert.value} di ${alert.timeframe}`
          } else {
            const emaArr = calcEMA(closes, alert.value)
            const ema = emaArr[emaArr.length - 1]
            if (ema == null) continue
            conditionMet = alert.condition === 'above' ? lastClose > ema : lastClose < ema
            msg = `${alert.baseAsset} harga ${alert.condition === 'above' ? 'di atas' : 'di bawah'} EMA${alert.value} di ${alert.timeframe}`
          }

          if (conditionMet) onTriggerRef.current(alert.id, msg)
        } catch {
          // ignore per-alert errors
        }
      }
    }

    const id = setInterval(check, 2 * 60 * 1000)
    return () => clearInterval(id)
  }, []) // interval stabil selamanya — baca state terbaru via ref
}
