import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/format'

type Tone = 'brand' | 'emerald' | 'violet' | 'amber' | 'danger'

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  tone?: Tone
  trend?: string
  description?: string
}

const toneStyles: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-brand-50 text-brand-600',
  amber: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
}

export function StatCard({ label, value, icon: Icon, tone = 'brand', trend, description }: StatCardProps) {
  return (
    <div className="flex flex-col rounded-card border border-slate-200 bg-surface-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl', toneStyles[tone])}>
          <Icon size={20} />
        </div>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        {trend && (
          <span className="mb-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-600">
            {trend}
          </span>
        )}
      </div>
      {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
    </div>
  )
}
