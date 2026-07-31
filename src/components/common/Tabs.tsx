import { cn } from '@/utils/format'

export interface TabItem {
  id: string
  label: string
}

interface TabsProps {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-card">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            active === tab.id
              ? 'bg-brand-500 text-white'
              : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
