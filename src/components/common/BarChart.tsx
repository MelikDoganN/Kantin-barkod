import type { SalesPoint } from '@/types'
import { formatCurrency } from '@/utils/format'

interface BarChartProps {
  data: SalesPoint[]
  height?: number
}

export function BarChart({ data, height = 220 }: BarChartProps) {
  const max = Math.max(...data.map((point) => point.amount), 1)

  return (
    <div className="flex flex-col">
      <div className="flex items-end gap-3" style={{ height }}>
        {data.map((point) => {
          const barHeight = Math.max((point.amount / max) * 100, 4)
          return (
            <div key={point.label} className="group flex flex-1 flex-col items-center justify-end gap-2">
              <span className="text-xs font-medium text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
                {formatCurrency(point.amount)}
              </span>
              <div className="flex w-full items-end justify-center">
                <div
                  className="w-full max-w-[38px] rounded-t-lg bg-brand-500/85 transition-colors group-hover:bg-brand-600"
                  style={{ height: `${barHeight}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex gap-3 border-t border-slate-100 pt-2">
        {data.map((point) => (
          <span key={point.label} className="flex-1 text-center text-xs text-slate-400">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  )
}
