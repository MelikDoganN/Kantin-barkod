import { Search } from 'lucide-react'
import { cn } from '@/utils/format'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, placeholder = 'Ara...', className }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800',
          'placeholder:text-slate-400 transition-colors',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
        )}
      />
    </div>
  )
}
