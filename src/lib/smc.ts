import type { Candle } from '@/lib/indicators'

export type SmcSide = 'bull' | 'bear'

export interface SmcBreak {
  kind: 'BOS' | 'CHoCH'
  side: SmcSide
  level: number
  swingTime: number
  time: number
}

export interface SmcZone {
  kind: 'OB' | 'FVG'
  side: SmcSide
  top: number
  bottom: number
  fromTime: number
}

export interface SmcResult {
  trend: SmcSide | null
  breaks: SmcBreak[]
  zones: SmcZone[]
}

interface Swing {
  index: number
  price: number
  broken: boolean
}

const SWING_LEN = 5
const MAX_BREAKS = 6
const MAX_ZONES_PER_KIND_SIDE = 3
// FVG yang lebih tipis dari ini cuma noise di timeframe kecil.
const MIN_FVG_PCT = 0.1

function isPivotHigh(c: Candle[], i: number) {
  for (let k = i - SWING_LEN; k <= i + SWING_LEN; k++) if (k !== i && c[k].high >= c[i].high) return false
  return true
}

function isPivotLow(c: Candle[], i: number) {
  for (let k = i - SWING_LEN; k <= i + SWING_LEN; k++) if (k !== i && c[k].low <= c[i].low) return false
  return true
}

// Order block = candle berlawanan arah terakhir sebelum kaki impuls yang menembus struktur.
function findOrderBlock(c: Candle[], from: number, to: number, side: SmcSide): SmcZone | null {
  let extreme = from
  for (let k = from; k <= to; k++) {
    if (side === 'bull' ? c[k].low < c[extreme].low : c[k].high > c[extreme].high) extreme = k
  }
  for (let k = extreme; k >= from; k--) {
    const opposite = side === 'bull' ? c[k].close < c[k].open : c[k].close > c[k].open
    if (opposite) return { kind: 'OB', side, top: c[k].high, bottom: c[k].low, fromTime: c[k].time }
  }
  return null
}

function isMitigated(zone: SmcZone, later: Candle[]) {
  // OB batal kalau ada close menembus sisi jauhnya; FVG dianggap terisi kalau harga menyentuh ujung jauhnya.
  if (zone.kind === 'OB') {
    return later.some((k) => (zone.side === 'bull' ? k.close < zone.bottom : k.close > zone.top))
  }
  return later.some((k) => (zone.side === 'bull' ? k.low <= zone.bottom : k.high >= zone.top))
}

export function analyzeSmc(candles: Candle[]): SmcResult {
  const c = candles
  const breaks: SmcBreak[] = []
  const zones: SmcZone[] = []
  let trend: SmcSide | null = null
  let lastHigh: Swing | null = null
  let lastLow: Swing | null = null

  for (let j = 0; j < c.length; j++) {
    // Pivot di index i baru "terkonfirmasi" setelah SWING_LEN candle sesudahnya terbentuk.
    const i = j - SWING_LEN
    if (i >= SWING_LEN) {
      if (isPivotHigh(c, i)) lastHigh = { index: i, price: c[i].high, broken: false }
      if (isPivotLow(c, i)) lastLow = { index: i, price: c[i].low, broken: false }
    }

    if (lastHigh && !lastHigh.broken && c[j].close > lastHigh.price) {
      lastHigh.broken = true
      breaks.push({ kind: trend === 'bear' ? 'CHoCH' : 'BOS', side: 'bull', level: lastHigh.price, swingTime: c[lastHigh.index].time, time: c[j].time })
      trend = 'bull'
      const ob = findOrderBlock(c, lastHigh.index, j, 'bull')
      if (ob) zones.push(ob)
    }
    if (lastLow && !lastLow.broken && c[j].close < lastLow.price) {
      lastLow.broken = true
      breaks.push({ kind: trend === 'bull' ? 'CHoCH' : 'BOS', side: 'bear', level: lastLow.price, swingTime: c[lastLow.index].time, time: c[j].time })
      trend = 'bear'
      const ob = findOrderBlock(c, lastLow.index, j, 'bear')
      if (ob) zones.push(ob)
    }

    if (j >= 2) {
      const mid = c[j - 1].close
      if (c[j].low > c[j - 2].high && ((c[j].low - c[j - 2].high) / mid) * 100 >= MIN_FVG_PCT) {
        zones.push({ kind: 'FVG', side: 'bull', top: c[j].low, bottom: c[j - 2].high, fromTime: c[j - 1].time })
      }
      if (c[j].high < c[j - 2].low && ((c[j - 2].low - c[j].high) / mid) * 100 >= MIN_FVG_PCT) {
        zones.push({ kind: 'FVG', side: 'bear', top: c[j - 2].low, bottom: c[j].high, fromTime: c[j - 1].time })
      }
    }
  }

  const active = zones.filter((z) => !isMitigated(z, c.filter((k) => k.time > z.fromTime)))
  const kept: SmcZone[] = []
  for (const kind of ['OB', 'FVG'] as const) {
    for (const side of ['bull', 'bear'] as const) {
      kept.push(...active.filter((z) => z.kind === kind && z.side === side).slice(-MAX_ZONES_PER_KIND_SIDE))
    }
  }

  return { trend, breaks: breaks.slice(-MAX_BREAKS), zones: kept }
}
