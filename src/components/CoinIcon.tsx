import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  asset: string
  size?: number
  logo?: string
  className?: string
}

const ICON_CDN = 'https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color'

// Diingat lintas render/baris — tanpa ini tiap baris CoinList nembak ulang URL yang udah pasti 404.
const failedUrls = new Set<string>()

// Kontrak futures kecil ditulis "1000PEPE", "1000000MOG" dst — ikonnya tetap ikon PEPE/MOG.
export function normalizeAsset(asset: string): string {
  return asset.toUpperCase().replace(/^(.+?)(USDT|USDC|PERP)$/, '$1').replace(/^10{3,}(?=[A-Z])/, '')
}

function hueFor(text: string): number {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

export function CoinIcon({ asset, size = 28, logo, className }: Props) {
  // Dalam rem (bukan px) supaya ikut skala tombol A−/A+ bareng teks di sekitarnya.
  const dim = `${size / 16}rem`
  const sym = normalizeAsset(asset)
  const sources = [logo, `${ICON_CDN}/${sym.toLowerCase()}.svg`].filter((s): s is string => !!s && !failedUrls.has(s))
  const [, rerender] = useState(0)
  const src = sources[0]

  const base = cn(
    'shrink-0 rounded-full transition-transform duration-200 ease-out hover:scale-125 hover:-rotate-6 hover:shadow-[0_0_14px_rgba(244,208,111,0.45)]',
    className
  )

  if (!src) {
    const hue = hueFor(sym)
    return (
      <span
        title={sym}
        className={cn(base, 'inline-flex items-center justify-center font-bold text-white ring-1 ring-white/15')}
        style={{
          width: dim,
          height: dim,
          fontSize: `${(size * 0.42) / 16}rem`,
          background: `linear-gradient(135deg, hsl(${hue} 70% 50%), hsl(${(hue + 40) % 360} 70% 32%))`,
        }}
      >
        {sym.slice(0, sym.length > 4 ? 1 : 2)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={sym}
      title={sym}
      width={size}
      height={size}
      loading="lazy"
      onError={() => { failedUrls.add(src); rerender((n) => n + 1) }}
      className={cn(base, 'bg-white/5')}
      style={{ width: dim, height: dim }}
    />
  )
}
