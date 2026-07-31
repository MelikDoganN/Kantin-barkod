import { Bell, CalendarDays, CircleDot, Clock, Loader2 } from 'lucide-react'
import { useClock } from '@/hooks/useClock'
import { useShift } from '@/context/ShiftContext'
import { cn } from '@/utils/format'

export function TopHeader() {
  const { time, date } = useClock()
  const { currentShift, loading } = useShift()

  return (
    <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-[color:var(--color-border)] bg-surface-card px-4">
      <div className="flex items-center gap-1.5 text-sm text-ink-muted">
        <CalendarDays size={15} className="text-[#F97316]" />
        <span className="capitalize">{date}</span>
      </div>

      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium sm:text-sm',
            loading
              ? 'border-slate-200 bg-slate-50 text-slate-500'
              : currentShift
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-600',
          )}
        >
          {loading ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Vardiya kontrol ediliyor…</span>
            </>
          ) : currentShift ? (
            <>
              <CircleDot size={13} />
              <span>Açık Vardiya · {currentShift.personnel}</span>
            </>
          ) : (
            <>
              <CircleDot size={13} className="text-slate-400" />
              <span>Aktif Vardiya Yok</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 sm:text-sm">
          <Clock size={13} className="text-slate-400" />
          <span className="tabular-nums">{time}</span>
        </div>

        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-surface-card text-slate-500 transition-colors hover:bg-slate-50"
        >
          <Bell size={16} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger-500" />
        </button>
      </div>
    </header>
  )
}
