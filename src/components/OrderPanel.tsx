import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Ticker, MarketType } from '@/types'

interface Props {
  ticker: Ticker | null
  currentPrice: number
  marketType: MarketType
  prefillPrice?: number
}

type OrderType = 'limit' | 'market'
type Side = 'buy' | 'sell'
type MarginMode = 'cross' | 'isolated'

const PCT_BUTTONS = [25, 50, 75, 100]
const LEVERAGE_PRESETS = [1, 2, 5, 10, 20, 50, 100, 125]

function calcLiqPrice(entry: number, side: Side, leverage: number): number {
  // simplified isolated margin liquidation price
  const mmr = 0.004 // maintenance margin rate
  if (side === 'buy') return entry * (1 - 1 / leverage + mmr)
  return entry * (1 + 1 / leverage - mmr)
}

export function OrderPanel({ ticker, currentPrice, marketType, prefillPrice }: Props) {
  const [side, setSide] = useState<Side>('buy')
  const [orderType, setOrderType] = useState<OrderType>('limit')
  const [price, setPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [pct, setPct] = useState(0)
  const [leverage, setLeverage] = useState(10)
  const [marginMode, setMarginMode] = useState<MarginMode>('cross')

  const isFutures = marketType === 'futures'

  useEffect(() => {
    if (prefillPrice !== undefined) setPrice(prefillPrice.toString())
  }, [prefillPrice])

  useEffect(() => {
    if (currentPrice > 0 && !price) setPrice(currentPrice.toFixed(4))
  }, [currentPrice])

  const priceVal = parseFloat(price) || currentPrice
  const amountVal = parseFloat(amount) || 0
  const total = (priceVal * amountVal).toFixed(2)

  const marginRequired = isFutures
    ? ((priceVal * amountVal) / leverage).toFixed(2)
    : null

  const liqPrice = isFutures && amountVal > 0
    ? calcLiqPrice(priceVal, side, leverage)
    : null

  const handlePct = (p: number) => {
    if (currentPrice <= 0) return
    setPct(p)
    const balance = side === 'buy' ? 1000 : 0.5
    if (orderType === 'market' || !price) {
      setAmount(((balance * (p / 100)) / currentPrice).toFixed(6))
    } else {
      setAmount(((balance * (p / 100)) / priceVal).toFixed(6))
    }
  }

  const handleSubmit = () => {
    const action = isFutures
      ? side === 'buy' ? 'LONG' : 'SHORT'
      : side === 'buy' ? 'BELI' : 'JUAL'
    const details = isFutures
      ? `${action} ${amount} ${ticker?.baseAsset ?? ''} @ ${orderType === 'market' ? 'Market' : price}\nLeverage: ${leverage}x | Margin: ${marginMode.toUpperCase()}\nMargin diperlukan: ${marginRequired} USDT\nLiq. Price: ${liqPrice?.toFixed(4) ?? '-'}`
      : `${action} ${amount} ${ticker?.baseAsset ?? ''} @ ${orderType === 'market' ? 'Market' : price} USDT\nTotal: ${total} USDT`
    alert(`[SIMULASI]\n${details}`)
  }

  return (
    <div className="flex flex-col h-full p-3 gap-2.5">
      {/* Ticker info */}
      {ticker && (
        <div className="text-center pb-2 border-b border-border">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-xs font-bold text-foreground">
              {ticker.baseAsset}/{isFutures ? 'PERP' : 'USDT'}
            </span>
            {isFutures && (
              <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1 py-0.5 rounded font-mono">
                PERP
              </span>
            )}
          </div>
          <div
            className={cn(
              'text-lg font-bold font-mono',
              ticker.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
            )}
          >
            {currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}
          </div>
          {isFutures && ticker.markPrice && (
            <div className="text-[10px] text-muted-foreground">
              Mark: {ticker.markPrice.toFixed(4)}
            </div>
          )}
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>H: {ticker.high24h.toFixed(4)}</span>
            <span className={cn(ticker.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400', 'font-medium')}>
              {ticker.priceChangePercent >= 0 ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}%
            </span>
            <span>L: {ticker.low24h.toFixed(4)}</span>
          </div>
          {isFutures && ticker.fundingRate !== undefined && (
            <div className="flex justify-center gap-1 mt-1 text-[10px]">
              <span className="text-muted-foreground">Funding:</span>
              <span className={ticker.fundingRate >= 0 ? 'text-green-400' : 'text-red-400'}>
                {ticker.fundingRate >= 0 ? '+' : ''}{ticker.fundingRate.toFixed(4)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Futures: Leverage + Margin mode */}
      {isFutures && (
        <div className="flex flex-col gap-2 pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Leverage</span>
            <div className="flex gap-1">
              {(['cross', 'isolated'] as MarginMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMarginMode(m)}
                  className={cn(
                    'px-2 py-0.5 text-[10px] rounded border transition-colors',
                    marginMode === m
                      ? 'border-primary text-primary bg-primary/10'
                      : 'border-border text-muted-foreground hover:border-muted-foreground'
                  )}
                >
                  {m === 'cross' ? 'Cross' : 'Isolated'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {LEVERAGE_PRESETS.map((lv) => (
              <button
                key={lv}
                onClick={() => setLeverage(lv)}
                className={cn(
                  'py-1 text-[10px] rounded border transition-colors font-mono',
                  leverage === lv
                    ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
                    : 'border-border text-muted-foreground hover:border-yellow-500/50'
                )}
              >
                {lv}x
              </button>
            ))}
          </div>

          {/* Custom leverage input */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground shrink-0">Custom:</span>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="range"
                min={1}
                max={125}
                value={leverage}
                onChange={(e) => setLeverage(parseInt(e.target.value))}
                className="flex-1 h-1 accent-yellow-500 cursor-pointer"
              />
              <span className="text-[10px] font-mono text-yellow-400 w-8 text-right">{leverage}x</span>
            </div>
          </div>
        </div>
      )}

      {/* Long / Short OR Buy / Sell toggle */}
      <div className="grid grid-cols-2 rounded-lg overflow-hidden border border-border">
        {(['buy', 'sell'] as Side[]).map((s) => (
          <motion.button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              'py-2 text-sm font-semibold transition-colors',
              side === s && s === 'buy' && 'bg-green-500 text-white',
              side === s && s === 'sell' && 'bg-red-500 text-white',
              side !== s && 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            whileTap={{ scale: 0.97 }}
          >
            {isFutures
              ? s === 'buy' ? 'Long' : 'Short'
              : s === 'buy' ? 'Beli' : 'Jual'}
          </motion.button>
        ))}
      </div>

      {/* Order type */}
      <div className="flex gap-1">
        {(['limit', 'market'] as OrderType[]).map((t) => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={cn(
              'flex-1 py-1 text-xs rounded border transition-colors',
              orderType === t
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border text-muted-foreground hover:border-muted-foreground'
            )}
          >
            {t === 'limit' ? 'Limit' : 'Market'}
          </button>
        ))}
      </div>

      {/* Available balance */}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{isFutures ? 'Margin tersedia' : 'Tersedia'}</span>
        <span className="font-mono">
          {side === 'buy'
            ? `1,000.00 USDT`
            : `0.5 ${ticker?.baseAsset ?? ''}`}
        </span>
      </div>

      {/* Price input */}
      {orderType === 'limit' && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Harga (USDT)</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            className="bg-muted rounded px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="0.00"
          />
        </div>
      )}

      {/* Amount input */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-muted-foreground">
          Jumlah ({ticker?.baseAsset ?? 'Koin'})
        </label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          className="bg-muted rounded px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="0.00"
        />
      </div>

      {/* Percentage buttons */}
      <div className="grid grid-cols-4 gap-1">
        {PCT_BUTTONS.map((p) => (
          <button
            key={p}
            onClick={() => handlePct(p)}
            className={cn(
              'py-1 text-[10px] rounded border transition-colors',
              pct === p
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border text-muted-foreground hover:border-muted-foreground'
            )}
          >
            {p}%
          </button>
        ))}
      </div>

      {/* Total / Margin info */}
      {isFutures ? (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Nilai posisi</span>
            <span className="font-mono text-foreground">{total} USDT</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Margin diperlukan</span>
            <span className="font-mono text-yellow-400">{marginRequired ?? '0.00'} USDT</span>
          </div>
          {liqPrice !== null && (
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Est. Liq. Price</span>
              <span className={cn('font-mono', side === 'buy' ? 'text-red-400' : 'text-green-400')}>
                {liqPrice.toFixed(4)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Total (USDT)</label>
          <div className="bg-muted rounded px-3 py-2 text-sm font-mono text-muted-foreground">{total}</div>
        </div>
      )}

      {/* Submit */}
      <motion.button
        onClick={handleSubmit}
        disabled={!amount || parseFloat(amount) <= 0}
        whileTap={{ scale: 0.97 }}
        className={cn(
          'w-full py-3 rounded-lg font-semibold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed',
          side === 'buy'
            ? 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20'
            : 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20'
        )}
      >
        {isFutures
          ? side === 'buy'
            ? `Long ${ticker?.baseAsset ?? ''} ${leverage}x`
            : `Short ${ticker?.baseAsset ?? ''} ${leverage}x`
          : side === 'buy'
            ? `Beli ${ticker?.baseAsset ?? ''}`
            : `Jual ${ticker?.baseAsset ?? ''}`}
      </motion.button>

      <p className="text-[9px] text-muted-foreground text-center">
        Mode simulasi — tidak ada transaksi nyata
      </p>
    </div>
  )
}
