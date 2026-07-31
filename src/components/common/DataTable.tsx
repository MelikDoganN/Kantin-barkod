import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Inbox } from 'lucide-react'
import { cn } from '@/utils/format'
import { EmptyState } from './EmptyState'

export const TABLE_PAGE_SIZE = 15

export interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  width?: string
  render: (row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: T) => void
  /** Varsayılan 15. 0 veya negatif = sayfalama kapalı */
  pageSize?: number
}

const alignClass = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyTitle = 'Kayıt bulunamadı',
  emptyDescription = 'Görüntülenecek veri bulunmuyor.',
  onRowClick,
  pageSize = TABLE_PAGE_SIZE,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1)
  const paginate = pageSize > 0
  const total = data.length
  const totalPages = paginate ? Math.max(1, Math.ceil(total / pageSize)) : 1

  const dataKey = data.map(rowKey).join('\0')

  useEffect(() => {
    setPage(1)
  }, [dataKey, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageItems = useMemo(() => {
    if (!paginate) return data
    const start = (page - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, page, pageSize, paginate])

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 3) return [1, 2, 3, 4, 5]
    if (page >= totalPages - 2) {
      return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }
    return [page - 2, page - 1, page, page + 1, page + 2]
  }, [page, totalPages])

  if (total === 0) {
    return <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />
  }

  const startIndex = paginate ? (page - 1) * pageSize : 0
  const endIndex = paginate ? Math.min(startIndex + pageSize, total) : total

  return (
    <div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width }}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500',
                    alignClass[column.align ?? 'left'],
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn('px-4 py-3 text-slate-700', alignClass[column.align ?? 'left'])}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginate && total > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <span className="text-xs text-slate-400">
            {startIndex + 1}-{endIndex} / {total} kayıt
          </span>
          <div className="flex items-center gap-1">
            <PageBtn disabled={page === 1} onClick={() => setPage(1)} aria-label="İlk sayfa">
              <ChevronsLeft size={15} />
            </PageBtn>
            <PageBtn disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Önceki">
              <ChevronLeft size={15} />
            </PageBtn>
            {pageNumbers.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={cn(
                  'h-8 min-w-8 rounded-lg px-2 text-sm font-medium transition-colors',
                  p === page ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {p}
              </button>
            ))}
            <PageBtn
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              aria-label="Sonraki"
            >
              <ChevronRight size={15} />
            </PageBtn>
            <PageBtn
              disabled={page === totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="Son sayfa"
            >
              <ChevronsRight size={15} />
            </PageBtn>
          </div>
        </div>
      )}
    </div>
  )
}

interface PageBtnProps {
  disabled: boolean
  onClick: () => void
  children: ReactNode
  'aria-label'?: string
}

function PageBtn({ disabled, onClick, children, 'aria-label': ariaLabel }: PageBtnProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
