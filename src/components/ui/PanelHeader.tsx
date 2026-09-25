import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  icon?: LucideIcon
  iconClassName?: string
  title: string
  subtitle?: ReactNode
  right?: ReactNode
  children?: ReactNode
}

// Header seragam untuk semua panel di menu kanan: ikon + judul + keterangan + slot kanan.
export function PanelHeader({ icon: Icon, iconClassName, title, subtitle, right, children }: Props) {
  return (
    <div className="px-3 py-2 border-b border-border bg-card shrink-0 space-y-1.5">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className={cn('h-4 w-4 shrink-0', iconClassName ?? 'text-primary')} />}
        <p className="text-sm font-bold text-foreground truncate">{title}</p>
        {right != null && <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">{right}</div>}
      </div>
      {subtitle != null && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      {children}
    </div>
  )
}
