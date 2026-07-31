import type { SalesPoint } from '@/types'
import { formatNumber } from '@/utils/format'

interface LineChartProps {
  data: SalesPoint[]
  height?: number
}

export function LineChart({ data, height = 290 }: LineChartProps) {
  const rawMax = Math.max(...data.map((point) => point.amount), 1)
  const niceMax = Math.max(Math.ceil(rawMax / 500) * 500, 500)
  const tickCount = 4
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (niceMax / tickCount) * i)

  const points = data.map((point, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100
    const y = 100 - (point.amount / niceMax) * 100
    return { x, y, ...point }
  })

  const linePath = points.map((point) => `${point.x},${point.y}`).join(' ')
  const areaPath = `0,100 ${linePath} 100,100`

  return (
    <div className="flex flex-col" style={{ height }}>
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex w-12 flex-col justify-between py-0.5 text-right text-xs tabular-nums text-slate-400">
          {ticks
            .slice()
            .reverse()
            .map((tick) => (
              <span key={tick}>{formatNumber(tick)}</span>
            ))}
        </div>

        <div className="relative flex-1">
          {ticks
            .slice()
            .reverse()
            .map((tick, index) => (
              <div
                key={tick}
                className="absolute left-0 right-0 border-t border-dashed border-slate-100"
                style={{ top: `${(index / tickCount) * 100}%` }}
              />
            ))}

          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polygon points={areaPath} fill="var(--chart-fill)" />
            <polyline
              points={linePath}
              fill="none"
              stroke="var(--chart-line)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {points.map((point) => (
            <div
              key={point.label}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
            >
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-slate-500">
                {formatNumber(point.amount)}
              </span>
              <span
                className="block h-2.5 w-2.5 rounded-full border-2 bg-white shadow-sm"
                style={{ borderColor: 'var(--chart-line)' }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <div className="w-12" />
        <div className="relative flex-1">
          {points.map((point) => (
            <span
              key={point.label}
              className="absolute -translate-x-1/2 text-xs text-slate-400"
              style={{ left: `${point.x}%` }}
            >
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
