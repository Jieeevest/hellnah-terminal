import type {
  IChartApi, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesApi, ISeriesPrimitive, SeriesAttachedParameter, Time,
} from 'lightweight-charts'
import type { SmcResult, SmcSide } from '@/lib/smc'

type DrawTarget = Parameters<IPrimitivePaneRenderer['draw']>[0]

const ZONE_STYLE: Record<'OB' | 'FVG', Record<SmcSide, { fill: string; stroke: string; text: string }>> = {
  OB: {
    bull: { fill: 'rgba(34,197,94,0.16)', stroke: 'rgba(34,197,94,0.6)', text: '#4ade80' },
    bear: { fill: 'rgba(239,68,68,0.16)', stroke: 'rgba(239,68,68,0.6)', text: '#f87171' },
  },
  FVG: {
    bull: { fill: 'rgba(56,189,248,0.10)', stroke: 'rgba(56,189,248,0.35)', text: '#7dd3fc' },
    bear: { fill: 'rgba(251,146,60,0.10)', stroke: 'rgba(251,146,60,0.35)', text: '#fdba74' },
  },
}

// Menggambar kotak OB/FVG (memanjang ke kanan sampai ujung chart) dan garis + label BOS/CHoCH.
// toChartTime harus sama dengan konversi waktu yang dipakai saat setData ke series.
export class SmcPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null
  private series: ISeriesApi<'Candlestick'> | null = null
  private requestUpdate: (() => void) | null = null
  private data: SmcResult | null = null

  constructor(private readonly toChartTime: (ms: number) => Time) {}

  attached(param: SeriesAttachedParameter<Time>) {
    this.chart = param.chart as IChartApi
    this.series = param.series as ISeriesApi<'Candlestick'>
    this.requestUpdate = param.requestUpdate
  }

  detached() {
    this.chart = null
    this.series = null
    this.requestUpdate = null
  }

  setData(data: SmcResult | null) {
    this.data = data
    this.requestUpdate?.()
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [{ zOrder: () => 'bottom', renderer: () => ({ draw: (target) => this.draw(target) }) }]
  }

  private draw(target: DrawTarget) {
    const { data, chart, series } = this
    if (!data || !chart || !series) return
    const timeScale = chart.timeScale()
    const x = (ms: number) => timeScale.timeToCoordinate(this.toChartTime(ms))
    const y = (price: number) => series.priceToCoordinate(price)

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      // Ikut skala A−/A+ (ukuran root font), sama seperti text-xs di tempat lain.
      const fontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.8125
      ctx.font = `600 ${fontPx}px "Space Grotesk", system-ui, sans-serif`

      for (const zone of data.zones) {
        const x1 = x(zone.fromTime)
        const yTop = y(zone.top)
        const yBottom = y(zone.bottom)
        if (x1 == null || yTop == null || yBottom == null) continue
        const style = ZONE_STYLE[zone.kind][zone.side]
        const h = Math.max(1, yBottom - yTop)
        ctx.fillStyle = style.fill
        ctx.fillRect(x1, yTop, mediaSize.width - x1, h)
        ctx.strokeStyle = style.stroke
        ctx.lineWidth = 1
        ctx.strokeRect(x1 + 0.5, yTop + 0.5, mediaSize.width - x1 - 1, h - 1)
        ctx.fillStyle = style.text
        ctx.fillText(zone.kind, x1 + 4, yTop + fontPx + 1)
      }

      for (const brk of data.breaks) {
        const x1 = x(brk.swingTime)
        const x2 = x(brk.time)
        const yl = y(brk.level)
        if (x1 == null || x2 == null || yl == null) continue
        const color = brk.side === 'bull' ? '#4ade80' : '#f87171'
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(x1, yl)
        ctx.lineTo(x2, yl)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = color
        const label = brk.kind
        const w = ctx.measureText(label).width
        ctx.fillText(label, (x1 + x2) / 2 - w / 2, brk.side === 'bull' ? yl - 4 : yl + fontPx + 1)
      }
    })
  }
}
