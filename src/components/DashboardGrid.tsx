import { X } from 'lucide-react'
import { TradingChart } from './TradingChart'

interface Props {
  items: { symbol: string; tvSymbol: string }[]
  onRemove: (symbol: string) => void
}

export function DashboardGrid({ items, onRemove }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4 bg-card">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <span className="text-2xl opacity-50">⊞</span>
        </div>
        <p className="text-sm">Grid kosong. Tambahkan koin ke grid menggunakan tombol "+ Grid".</p>
      </div>
    )
  }

  // Auto-layout columns based on count (max 9 items = 3x3)
  const cols = items.length <= 1 ? 1 : items.length <= 4 ? 2 : 3

  return (
    <div 
      className="flex-1 overflow-auto grid gap-px bg-border"
      style={{ 
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridAutoRows: items.length <= 2 ? '100%' : '50%'
      }}
    >
      {items.map((item) => (
        <div key={item.symbol} className="relative flex flex-col bg-background min-h-[250px] overflow-hidden">
          <div className="absolute top-2 right-2 z-10 flex gap-1">
            <div className="bg-background/80 backdrop-blur text-[10px] font-mono font-bold px-2 py-1 rounded border border-border shadow-sm">
              {item.symbol}
            </div>
            <button 
              onClick={() => onRemove(item.symbol)}
              className="bg-background/80 backdrop-blur p-1 rounded border border-border hover:text-red-400 hover:border-red-500/50 transition-colors shadow-sm"
              title="Hapus dari grid"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {/* Tambahkan key unmount-remount jika tvSymbol berubah? Ngga perlu, TradingChart sudah handle. */}
          <div className="flex-1 -m-1"> {/* Negative margin untuk hide border bawaan TV */}
            <TradingChart tvSymbol={item.tvSymbol} />
          </div>
        </div>
      ))}
    </div>
  )
}
