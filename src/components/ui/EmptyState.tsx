import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'

interface Props {
  icon?: LucideIcon
  loading?: boolean
  title: string
  description?: ReactNode
  action?: ReactNode
}

// Tampilan seragam untuk "belum ada data", "memuat", atau "tidak terhubung".
export function EmptyState({ icon: Icon, loading, title, description, action }: Props) {
  return (
    <div className="flex h-full min-h-32 flex-col items-center justify-center gap-1.5 px-6 py-8 text-center">
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : Icon && <Icon className="h-6 w-6 text-muted-foreground" />}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description != null && <p className="text-xs text-muted-foreground max-w-sm">{description}</p>}
      {action}
    </div>
  )
}
