import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PillProps {
  active: boolean
  onClick: () => void
  children: ReactNode
  title?: string
  className?: string
}

// Satu gaya tombol pilihan untuk semua filter & sub-tab di aplikasi.
export function Pill({ active, onClick, children, title, className }: PillProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'min-h-7 px-2.5 rounded-full border text-xs font-medium whitespace-nowrap transition-colors',
        active ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
        className
      )}
    >
      {children}
    </button>
  )
}

export interface PillOption<T> {
  id: T
  label: ReactNode
  title?: string
}

interface PillTabsProps<T> {
  options: PillOption<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}

export function PillTabs<T extends string | number>({ options, value, onChange, className }: PillTabsProps<T>) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {options.map((opt) => (
        <Pill key={opt.id} active={opt.id === value} onClick={() => onChange(opt.id)} title={opt.title}>
          {opt.label}
        </Pill>
      ))}
    </div>
  )
}
