import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

const W = 224
const GAP = 10

interface Props {
  title: string
  description: string
  children: React.ReactNode
  className?: string
  side?: 'top' | 'bottom'
}

export function InfoTooltip({ title, description, children, className = 'inline-flex items-center', side = 'top' }: Props) {
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const enter = useCallback(() => {
    if (ref.current) setRect(ref.current.getBoundingClientRect())
    timer.current = setTimeout(() => setVisible(true), 280)
  }, [])

  const leave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setVisible(false)
  }, [])

  const getPos = () => {
    if (!rect) return { left: 0, top: 0, arrowX: '50%' }
    const cx = rect.left + rect.width / 2
    const left = Math.max(8, Math.min(cx - W / 2, window.innerWidth - W - 8))
    const arrowX = `${Math.round(cx - left)}px`
    const top = side === 'top' ? rect.top - GAP : rect.bottom + GAP
    return { left, top, arrowX }
  }

  const pos = getPos()
  const above = side === 'top'

  return (
    <span ref={ref} onMouseEnter={enter} onMouseLeave={leave} className={cn(className)}>
      {children}
      {visible && rect && createPortal(
        <AnimatePresence>
          <motion.div
            key="tip"
            initial={{ opacity: 0, y: above ? 4 : -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            style={{
              position: 'fixed',
              left: pos.left,
              top: pos.top,
              width: W,
              transform: above ? 'translateY(-100%)' : 'none',
              zIndex: 9500,
              pointerEvents: 'none',
            }}
            className="bg-[#111318] border border-white/12 rounded-xl shadow-[0_8px_32px_-4px_rgba(0,0,0,0.7)] px-3 py-2.5"
          >
            <p className="text-xs font-bold text-white/90 mb-1 leading-tight">{title}</p>
            <p className="text-[9.5px] text-white/70 leading-relaxed">{description}</p>
            {/* Caret */}
            <span
              style={{
                position: 'absolute',
                [above ? 'bottom' : 'top']: -5,
                left: pos.arrowX,
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                [above ? 'borderTop' : 'borderBottom']: '5px solid rgba(255,255,255,0.10)',
              } as React.CSSProperties}
            />
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </span>
  )
}
