import type { BadgeTone } from '@/types'
import { cn } from '@/utils/format'

interface StatusBadgeProps {
  tone: BadgeTone
  children: React.ReactNode
}

const toneStyles: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-brand-50 text-brand-700 border-brand-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        toneStyles[tone],
      )}
    >
      {children}
    </span>
  )
}
