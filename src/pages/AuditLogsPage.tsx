import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FileDown,
  History,
  ShoppingCart,
  Boxes,
  Users,
  ShieldAlert,
  ChevronsRight,
  ChevronsLeft,
  Eye,
  RefreshCw,
} from 'lucide-react'
import {
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  SearchInput,
  EmptyState,
} from '@/components/common'
import { Button, Select } from '@/components/ui'
import { AuditDetailPanel } from '@/components/audit/AuditDetailPanel'
import { logTone, resolveActionLabel, resolveModuleMeta } from '@/components/audit/auditMeta'
import {
  fetchAuditFilters,
  fetchAuditLogDetail,
  fetchAuditLogs,
  fetchAuditSummary,
  type AuditFilters,
  type AuditSummary,
} from '@/services/auditLogs'
import { useAuth } from '@/context/AuthContext'
import type { AuditLog } from '@/types'
import { cn } from '@/utils/format'

const PAGE_SIZE = 15

function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function isoToTr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function longTr(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  })
}

function downloadCsv(filename: string, rows: AuditLog[]) {
  const header = [
    'Tarih',
    'Saat',
    'Kullanıcı',
    'Rol',
    'Modül',
    'İşlem',
    'Açıklama',
    'İlgili Kayıt',
    'Durum',
    'Cihaz',
    'IP',
  ]
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const lines = [
    header.join(','),
    ...rows.map((log) =>
      [
        log.date,
        log.time,
        log.userName,
        log.userRole,
        resolveModuleMeta(log.module).label,
        resolveActionLabel(log.actionType),
        log.description,
        log.entityLabel,
        log.status === 'success' ? 'Başarılı' : 'Başarısız',
        log.deviceName,
        log.ipAddress,
      ]
        .map((v) => escape(String(v ?? '')))
        .join(','),
    ),
  ]
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const emptySummary: AuditSummary = {
  totalOperations: 0,
  saleOperations: 0,
  stockOperations: 0,
  userOperations: 0,
  failedOperations: 0,
  modules: [],
}

export function AuditLogsPage() {
  const { user } = useAuth()
  const today = todayISO()

  const [selected, setSelected] = useState(today)
  const [userFilter, setUserFilter] = useState('all')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [summary, setSummary] = useState<AuditSummary>(emptySummary)
  const [filters, setFilters] = useState<AuditFilters>({ users: [], modules: [], actionTypes: [] })
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null)
  const [exported, setExported] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const trDate = isoToTr(selected)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 400)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [selected, userFilter, moduleFilter, actionFilter, statusFilter, debouncedSearch])

  useEffect(() => {
    if (!exported) return
    const timer = window.setTimeout(() => setExported(false), 3000)
    return () => window.clearTimeout(timer)
  }, [exported])

  const loadFilters = useCallback(async () => {
    try {
      setFilters(await fetchAuditFilters())
    } catch {
      /* filters are non-blocking */
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, daySummary] = await Promise.all([
        fetchAuditLogs({
          date: selected,
          userId: userFilter,
          module: moduleFilter,
          actionType: actionFilter,
          status: statusFilter,
          search: debouncedSearch,
          page,
          limit: PAGE_SIZE,
        }),
        fetchAuditSummary(selected),
      ])
      setItems(list.items)
      setTotal(list.pagination.total)
      setTotalPages(list.pagination.totalPages)
      setSummary(daySummary)
    } catch {
      setError('Kayıtlar yüklenemedi.')
      setItems([])
      setTotal(0)
      setTotalPages(1)
      setSummary(emptySummary)
    } finally {
      setLoading(false)
    }
  }, [selected, userFilter, moduleFilter, actionFilter, statusFilter, debouncedSearch, page])

  useEffect(() => {
    void loadFilters()
  }, [loadFilters])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const userOptions = useMemo(
    () => [
      { value: 'all', label: 'Tümü' },
      ...filters.users.map((u) => ({ value: String(u.id), label: u.fullName })),
    ],
    [filters.users],
  )

  const moduleOptions = useMemo(
    () => [
      { value: 'all', label: 'Tümü' },
      ...filters.modules.map((m) => ({ value: m, label: resolveModuleMeta(m).label })),
    ],
    [filters.modules],
  )

  const actionOptions = useMemo(
    () => [
      { value: 'all', label: 'Tümü' },
      ...filters.actionTypes.map((a) => ({ value: a, label: resolveActionLabel(a) })),
    ],
    [filters.actionTypes],
  )

  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE
  const isToday = selected >= today
  const pageNumbers = useMemo(() => {
    const maxButtons = 7
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const start = Math.max(1, Math.min(page - 3, totalPages - maxButtons + 1))
    return Array.from({ length: maxButtons }, (_, i) => start + i)
  }, [page, totalPages])

  async function openDetail(log: AuditLog) {
    try {
      const detail = await fetchAuditLogDetail(log.id)
      setDetailLog(detail)
    } catch {
      setDetailLog(log)
    }
  }

  async function handleExport() {
    try {
      const all = await fetchAuditLogs({
        date: selected,
        userId: userFilter,
        module: moduleFilter,
        actionType: actionFilter,
        status: statusFilter,
        search: debouncedSearch,
        page: 1,
        limit: 100,
      })
      // gather remaining pages if needed
      let rows = [...all.items]
      for (let p = 2; p <= all.pagination.totalPages && p <= 20; p += 1) {
        const next = await fetchAuditLogs({
          date: selected,
          userId: userFilter,
          module: moduleFilter,
          actionType: actionFilter,
          status: statusFilter,
          search: debouncedSearch,
          page: p,
          limit: 100,
        })
        rows = rows.concat(next.items)
      }
      downloadCsv(`islem-gecmisi-${selected}.csv`, rows)
      setExported(true)
    } catch {
      setError('Kayıtlar yüklenemedi.')
    }
  }

  if (user?.role !== 'ADMIN') {
    return (
      <div className="space-y-5">
        <PageHeader title="İşlem Geçmişi" />
        <SectionCard>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
              <ShieldAlert size={28} />
            </span>
            <h3 className="text-lg font-semibold text-slate-800">Erişim Yetkiniz Yok</h3>
            <p className="max-w-sm text-sm text-slate-500">
              İşlem geçmişi kayıtları yalnızca Yönetici rolündeki kullanıcılar tarafından görüntülenebilir.
            </p>
          </div>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="İşlem Geçmişi"
        actions={
          <Button variant="outline" icon={<FileDown size={18} />} onClick={() => void handleExport()}>
            Günlük Log Raporu
          </Button>
        }
      />

      {exported && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          <FileDown size={16} />
          {trDate} tarihli günlük log raporu dışa aktarıldı.
        </div>
      )}

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <Button variant="outline" icon={<RefreshCw size={16} />} onClick={() => void loadData()}>
            Tekrar Dene
          </Button>
        </div>
      )}

      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" icon={<ChevronLeft size={16} />} onClick={() => setSelected(addDays(selected, -1))}>
              Önceki Gün
            </Button>
            <div className="relative">
              <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={selected}
                max={today}
                onChange={(e) => setSelected(e.target.value || today)}
                className="h-10 rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <Button
              variant="outline"
              icon={<ChevronRight size={16} />}
              onClick={() => setSelected(addDays(selected, 1))}
              disabled={isToday}
            >
              Sonraki Gün
            </Button>
            <Button variant={isToday ? 'primary' : 'ghost'} onClick={() => setSelected(today)}>
              Bugün
            </Button>
          </div>
          <p className="text-sm font-medium text-slate-600">{longTr(selected)}</p>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Toplam İşlem" value={String(summary.totalOperations)} icon={History} tone="brand" description="Seçilen gün" />
        <StatCard label="Satış İşlemi" value={String(summary.saleOperations)} icon={ShoppingCart} tone="emerald" description="Satış modülü" />
        <StatCard label="Stok İşlemi" value={String(summary.stockOperations)} icon={Boxes} tone="brand" description="Stok, sayım, tüketim" />
        <StatCard label="Kullanıcı İşlemi" value={String(summary.userOperations)} icon={Users} tone="amber" description="Giriş ve personel" />
      </div>

      <SectionCard>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Select label="Kullanıcı" options={userOptions} value={userFilter} onChange={(e) => setUserFilter(e.target.value)} />
          <Select label="Modül" options={moduleOptions} value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} />
          <Select label="İşlem Türü" options={actionOptions} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} />
          <Select
            label="Durum"
            options={[
              { value: 'all', label: 'Tümü' },
              { value: 'success', label: 'Başarılı' },
              { value: 'failed', label: 'Başarısız' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Arama</span>
            <SearchInput value={search} onChange={setSearch} placeholder="Kullanıcı, işlem veya kayıt ara..." />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Günlük Zaman Çizelgesi"
        description={`${trDate} tarihli işlemler`}
        action={
          total > 0 ? (
            <span className="text-xs text-slate-400">
              {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, total)} / {total} işlem
            </span>
          ) : undefined
        }
      >
        {loading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
            ))}
            <p className="pt-2 text-center text-sm text-slate-400">Yükleniyor…</p>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={History}
            title="Bu tarihte kayıtlı işlem bulunamadı."
            description="Farklı bir tarih seçin veya filtreleri temizleyin."
          />
        ) : (
          <ul className="space-y-2">
            {items.map((log) => {
              const meta = resolveModuleMeta(log.module)
              const Icon = meta.icon
              return (
                <li key={log.id}>
                  <button
                    onClick={() => void openDetail(log)}
                    className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-brand-300 hover:bg-slate-50"
                  >
                    <span className="w-12 flex-shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-slate-500">
                      {log.time}
                    </span>
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">{log.userName}</span>
                        <span className="text-xs text-slate-400">{log.userRole}</span>
                        <StatusBadge tone={logTone(log.module, log.actionType)}>{meta.label}</StatusBadge>
                        {log.status === 'failed' && <StatusBadge tone="danger">Başarısız</StatusBadge>}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-slate-600">{log.description}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Kayıt: {log.entityLabel} · {log.deviceName} · {log.ipAddress}
                      </p>
                    </div>
                    <span className="flex flex-shrink-0 items-center gap-1 self-center rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500">
                      <Eye size={13} />
                      Detay
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-400">
              {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, total)} / {total} işlem
            </span>
            <div className="flex items-center gap-1">
              <PageBtn disabled={page === 1} onClick={() => setPage(1)}>
                <ChevronsLeft size={15} />
              </PageBtn>
              <PageBtn disabled={page === 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={15} />
              </PageBtn>
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'h-8 min-w-8 rounded-lg px-2 text-sm font-medium transition-colors',
                    p === page ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {p}
                </button>
              ))}
              <PageBtn disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight size={15} />
              </PageBtn>
              <PageBtn disabled={page === totalPages} onClick={() => setPage(totalPages)}>
                <ChevronsRight size={15} />
              </PageBtn>
            </div>
          </div>
        )}
      </SectionCard>

      <AuditDetailPanel log={detailLog} onClose={() => setDetailLog(null)} />
    </div>
  )
}

interface PageBtnProps {
  disabled: boolean
  onClick: () => void
  children: ReactNode
}

function PageBtn({ disabled, onClick, children }: PageBtnProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
