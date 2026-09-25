import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'green' | 'red' | 'yellow' | 'orange' | 'blue' | 'primary' | 'muted'

const TONE: Record<BadgeTone, string> = {
  green: 'bg-green-500/15 text-green-400 border-green-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  blue: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  primary: 'bg-primary/10 text-primary border-primary/30',
  muted: 'bg-muted/60 text-muted-foreground border-border',
}

export const BADGE_TEXT_TONE: Record<BadgeTone, string> = {
  green: 'text-green-400', red: 'text-red-400', yellow: 'text-yellow-400', orange: 'text-orange-400',
  blue: 'text-sky-400', primary: 'text-primary', muted: 'text-muted-foreground',
}

interface Props {
  tone?: BadgeTone
  title?: string
  className?: string
  children: ReactNode
}

// Satu gaya badge/chip untuk seluruh aplikasi.
export function Badge({ tone = 'muted', title, className, children }: Props) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 px-1.5 py-px rounded border text-xs font-medium whitespace-nowrap', TONE[tone], className)}>
      {children}
    </span>
  )
}
