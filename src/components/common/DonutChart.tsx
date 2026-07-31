interface DonutSegment {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  size?: number
  centerLabel?: string
  centerValue?: string
}

export function DonutChart({ segments, size = 150, centerLabel, centerValue }: DonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1

  let cursor = 0
  const stops = segments
    .map((segment) => {
      const start = (cursor / total) * 100
      cursor += segment.value
      const end = (cursor / total) * 100
      return `${segment.color} ${start}% ${end}%`
    })
    .join(', ')

  return (
    <div className="flex items-center gap-6">
      <div
        className="relative flex-shrink-0 rounded-full"
        style={{ width: size, height: size, background: `conic-gradient(${stops})` }}
      >
        <div className="absolute inset-[24%] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
          {centerLabel && <span className="text-xs text-slate-400">{centerLabel}</span>}
          {centerValue && (
            <span className="text-sm font-bold text-slate-800">{centerValue}</span>
          )}
        </div>
      </div>

      <ul className="space-y-2.5">
        {segments.map((segment) => {
          const percent = Math.round((segment.value / total) * 100)
          return (
            <li key={segment.label} className="flex items-center gap-2 text-sm">
              <span
                className="h-3 w-3 flex-shrink-0 rounded-sm"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-slate-600">{segment.label}</span>
              <span className="ml-auto font-semibold text-slate-800">%{percent}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
