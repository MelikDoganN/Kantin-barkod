import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarCheck, Wallet, Receipt, Scale, Eye, Plus, Loader2 } from 'lucide-react'
import {
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  DataTable,
  SearchInput,
  Modal,
} from '@/components/common'
import type { Column } from '@/components/common'
import { Button, Input, Select } from '@/components/ui'
import { DayEndDetailPanel } from '@/components/dayend/DayEndDetailPanel'
import { SaleDetailPanel } from '@/components/dayend/SaleDetailPanel'
import { paymentLabels, paymentTones, statusLabels, statusTones } from '@/components/dayend/helpers'
import {
  createDayEnd,
  fetchDayEnds,
  fetchEligibleShifts,
  toApiStatus,
  type EligibleShift,
} from '@/services/dayEnd'
import {
  createCashAdjustment,
  fetchCashAdjustments,
  type CashAdjustment,
} from '@/services/cashAdjustments'
import { fetchSaleRecord, fetchShiftSales, type ShiftSaleListItem } from '@/services/sales'
import { ApiError } from '@/services/api'
import { roleLabel, hasPermission } from '@/config/permissions'
import type { DayEndRecord, SaleRecord } from '@/types'
import { cn, formatCurrency, formatNumber } from '@/utils/format'
import { useAuth } from '@/context/AuthContext'
import { formatShiftDate, formatShiftTime } from '@/services/shifts'

function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function shiftISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function resolveDateFilter(
  preset: 'today' | 'yesterday' | 'all' | 'custom',
  customDate: string,
): string | undefined {
  if (preset === 'today') return todayISO()
  if (preset === 'yesterday') return shiftISO(-1)
  if (preset === 'custom') return customDate || todayISO()
  return undefined
}

export function DayEndPage() {
  const { user } = useAuth()
  const canViewAll = hasPermission(user?.role, 'dayend.viewAll')
  const canAdjustCash = hasPermission(user?.role, 'cash.adjust')
  const canCancelSale = hasPermission(user?.role, 'sale.cancel')

  const [records, setRecords] = useState<DayEndRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'all' | 'custom'>('today')
  const [customDate, setCustomDate] = useState(todayISO)
  const [personnelFilter, setPersonnelFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState<number | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [eligible, setEligible] = useState<EligibleShift[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState('')
  const [actualCash, setActualCash] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [shiftSales, setShiftSales] = useState<ShiftSaleListItem[]>([])
  const [previewSale, setPreviewSale] = useState<SaleRecord | null>(null)

  const [cashAmount, setCashAmount] = useState('')
  const [cashNote, setCashNote] = useState('')
  const [cashSaving, setCashSaving] = useState(false)
  const [cashError, setCashError] = useState<string | null>(null)
  const [cashList, setCashList] = useState<CashAdjustment[]>([])
  const [cashToast, setCashToast] = useState<string | null>(null)

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchDayEnds({
        date: resolveDateFilter(datePreset, customDate),
        status: toApiStatus(statusFilter),
        userId:
          canViewAll && personnelFilter !== 'all' ? Number(personnelFilter) : undefined,
      })
      setRecords(list)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gün sonu kayıtları yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [datePreset, customDate, statusFilter, personnelFilter, canViewAll])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  const personnelOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of records) {
      // list already scoped; for filter we need userId - collect from unique names is weak
      // Keep name-based client filter fallback when viewing all without userId param reload
      map.set(r.personnel, r.personnel)
    }
    return [{ value: 'all', label: 'Tümü' }, ...Array.from(map.keys()).map((name) => ({ value: name, label: name }))]
  }, [records])

  // When admin filters by personnel name, filter client-side (list doesn't always include userId in filter UI as id)
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return records.filter((record) => {
      if (canViewAll && personnelFilter !== 'all' && Number.isNaN(Number(personnelFilter))) {
        if (record.personnel !== personnelFilter) return false
      }
      if (query) {
        const matches =
          record.personnel.toLowerCase().includes(query) ||
          record.sales.some((sale) => sale.saleNo.toLowerCase().includes(query)) ||
          record.id.includes(query)
        if (!matches) return false
      }
      return true
    })
  }, [records, canViewAll, personnelFilter, search])

  const stats = useMemo(() => {
    return {
      count: filtered.length,
      totalSales: filtered.reduce((sum, r) => sum + r.totalSales, 0),
      transactions: filtered.reduce((sum, r) => sum + r.saleCount, 0),
      cashDifference: filtered.reduce((sum, r) => sum + r.cashDifference, 0),
    }
  }, [filtered])

  async function openCreate() {
    setCreateOpen(true)
    setCreateError(null)
    setShiftSales([])
    setPreviewSale(null)
    try {
      const shifts = await fetchEligibleShifts()
      setEligible(shifts)
      if (shifts[0]) {
        const id = String(shifts[0].id)
        setSelectedShiftId(id)
        setActualCash(String(shifts[0].closingCash ?? shifts[0].expectedCash ?? 0))
        if (canCancelSale) {
          const sales = await fetchShiftSales(shifts[0].id)
          setShiftSales(sales)
        }
      } else {
        setSelectedShiftId('')
        setActualCash('')
      }
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Uygun vardiyalar yüklenemedi.')
    }
  }

  async function handleShiftChange(id: string) {
    setSelectedShiftId(id)
    const shift = eligible.find((s) => String(s.id) === id)
    if (shift) {
      setActualCash(String(shift.closingCash ?? shift.expectedCash ?? 0))
    }
    if (canCancelSale && id) {
      try {
        setShiftSales(await fetchShiftSales(Number(id)))
      } catch {
        setShiftSales([])
      }
    }
  }

  async function loadCashAdjustments() {
    if (!canAdjustCash) return
    try {
      setCashList(await fetchCashAdjustments(20))
    } catch {
      /* non-blocking */
    }
  }

  useEffect(() => {
    void loadCashAdjustments()
  }, [canAdjustCash])

  async function handleCashAdjust() {
    if (!canAdjustCash || cashSaving) return
    const amount = Number(cashAmount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount === 0) {
      setCashError('Tutar 0 olamaz.')
      return
    }
    if (cashNote.trim().length < 3) {
      setCashError('Açıklama en az 3 karakter olmalıdır.')
      return
    }
    setCashSaving(true)
    setCashError(null)
    try {
      await createCashAdjustment({ amount, description: cashNote.trim() })
      setCashAmount('')
      setCashNote('')
      setCashToast('Kasa düzeltme kaydedildi.')
      await loadCashAdjustments()
    } catch (err) {
      setCashError(err instanceof ApiError ? err.message : 'Kasa düzeltme kaydedilemedi.')
    } finally {
      setCashSaving(false)
    }
  }

  useEffect(() => {
    if (!cashToast) return
    const t = window.setTimeout(() => setCashToast(null), 3000)
    return () => window.clearTimeout(t)
  }, [cashToast])

  async function handleCreate() {
    if (creating || !selectedShiftId) return
    const cash = Number(actualCash)
    if (!Number.isFinite(cash) || cash < 0) {
      setCreateError('Sayılan kasa 0 veya daha büyük olmalıdır.')
      return
    }

    setCreating(true)
    setCreateError(null)
    try {
      await createDayEnd({ shiftId: Number(selectedShiftId), actualCash: cash })
      setCreateOpen(false)
      await loadRecords()
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Gün sonu oluşturulamadı.')
    } finally {
      setCreating(false)
    }
  }

  const columns: Column<DayEndRecord>[] = [
    {
      key: 'date',
      header: 'Tarih',
      render: (row) => <span className="font-medium text-slate-700">{row.date}</span>,
    },
    {
      key: 'personnel',
      header: 'Personel',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">
            {row.personnel.charAt(0)}
          </span>
          <div>
            <p className="font-medium text-slate-700">{row.personnel}</p>
            <p className="text-xs text-slate-400">
              {roleLabel(row.role === 'admin' ? 'ADMIN' : 'PERSONNEL')}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'shift',
      header: 'Vardiya',
      render: (row) => <span className="text-slate-600">{row.shift}</span>,
    },
    {
      key: 'saleCount',
      header: 'Satış Adedi',
      align: 'center',
      render: (row) => formatNumber(row.saleCount),
    },
    {
      key: 'totalSales',
      header: 'Toplam Satış',
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-slate-700">{formatCurrency(row.totalSales)}</span>
      ),
    },
    {
      key: 'cashSales',
      header: 'Nakit',
      align: 'right',
      render: (row) => <span className="text-slate-600">{formatCurrency(row.cashSales)}</span>,
    },
    {
      key: 'cardSales',
      header: 'Kart',
      align: 'right',
      render: (row) => <span className="text-slate-600">{formatCurrency(row.cardSales)}</span>,
    },
    {
      key: 'debtSales',
      header: 'Borç',
      align: 'right',
      render: (row) => <span className="text-slate-600">{formatCurrency(row.debtSales)}</span>,
    },
    {
      key: 'cashDifference',
      header: 'Kasa Farkı',
      align: 'right',
      render: (row) => (
        <span
          className={cn(
            'font-semibold',
            row.cashDifference === 0
              ? 'text-emerald-600'
              : row.cashDifference < 0
                ? 'text-red-600'
                : 'text-amber-600',
          )}
        >
          {formatCurrency(row.cashDifference)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      align: 'center',
      render: (row) => (
        <StatusBadge tone={statusTones[row.status]}>{statusLabels[row.status]}</StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'İşlem',
      align: 'right',
      render: (row) => (
        <button
          title="Detay"
          onClick={(e) => {
            e.stopPropagation()
            setDetailId(Number(row.id))
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-brand-600"
        >
          <Eye size={14} />
          Detay
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gün Sonu Yönetimi"
        actions={
          <Button icon={<Plus size={18} />} onClick={() => void openCreate()}>
            Gün Sonu Al
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Bugünkü Gün Sonu"
          value={String(stats.count)}
          icon={CalendarCheck}
          tone="brand"
          description="Listelenen kayıt"
        />
        <StatCard
          label="Toplam Satış"
          value={formatCurrency(stats.totalSales)}
          icon={Wallet}
          tone="emerald"
          description="Toplam ciro"
        />
        <StatCard
          label="Toplam İşlem"
          value={formatNumber(stats.transactions)}
          icon={Receipt}
          tone="brand"
          description="Satış adedi"
        />
        <StatCard
          label="Kasa Farkı"
          value={formatCurrency(stats.cashDifference)}
          icon={Scale}
          tone={
            stats.cashDifference === 0
              ? 'emerald'
              : stats.cashDifference < 0
                ? 'danger'
                : 'amber'
          }
          description="Sayılan - beklenen"
        />
      </div>

      {canAdjustCash && (
        <SectionCard title="Kasa Düzeltme" description="Eksik / fazla para veya sayım farkı kayıtları">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Input
                label="Tutar (₺)"
                type="number"
                step="0.01"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="Örn. -50 veya 25"
              />
              <Input
                label="Açıklama"
                value={cashNote}
                onChange={(e) => setCashNote(e.target.value)}
                placeholder="Örn. Eksik para / Fazla para / Sayım farkı"
              />
              {cashError && <p className="text-sm text-red-600">{cashError}</p>}
              {cashToast && <p className="text-sm text-emerald-600">{cashToast}</p>}
              <Button onClick={() => void handleCashAdjust()} disabled={cashSaving}>
                {cashSaving ? 'Kaydediliyor…' : 'Düzeltmeyi Kaydet'}
              </Button>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Son düzeltmeler
              </p>
              {cashList.length === 0 ? (
                <p className="text-sm text-slate-400">Henüz kasa düzeltmesi yok.</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                  {cashList.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700">{row.description}</p>
                        <p className="text-xs text-slate-400">
                          {row.user.fullName} ·{' '}
                          {new Date(row.createdAt).toLocaleString('tr-TR')}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 font-semibold',
                          row.amount < 0 ? 'text-red-600' : 'text-emerald-600',
                        )}
                      >
                        {formatCurrency(row.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Select
            label="Tarih"
            options={[
              { value: 'today', label: 'Bugün' },
              { value: 'yesterday', label: 'Dün' },
              { value: 'all', label: 'Tümü (geçmiş dahil)' },
              { value: 'custom', label: 'Tarih seç…' },
            ]}
            value={datePreset}
            onChange={(e) => {
              const value = e.target.value as typeof datePreset
              setDatePreset(value)
              if (value === 'custom' && !customDate) setCustomDate(todayISO())
            }}
          />
          {datePreset === 'custom' && (
            <Input
              label="Gün seçin"
              type="date"
              value={customDate}
              max={todayISO()}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          )}
          {canViewAll && (
            <Select
              label="Personel"
              options={personnelOptions}
              value={personnelFilter}
              onChange={(e) => setPersonnelFilter(e.target.value)}
            />
          )}
          <Select
            label="Durum"
            options={[
              { value: 'all', label: 'Tümü' },
              { value: 'pending', label: 'Bekliyor' },
              { value: 'completed', label: 'Tamamlandı' },
              { value: 'reviewed', label: 'İncelendi' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Arama</span>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Personel veya kayıt ara..."
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Gün Sonu Listesi"
        description={
          datePreset === 'all'
            ? 'Tüm geçmiş gün sonu kayıtları'
            : datePreset === 'yesterday'
              ? 'Dünkü gün sonu kayıtları'
              : datePreset === 'custom'
                ? `${customDate} tarihli gün sonu kayıtları`
                : 'Bugünkü gün sonu kayıtları'
        }
        noPadding
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 size={20} className="animate-spin text-brand-600" />
            <span className="text-sm">Kayıtlar yükleniyor...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" onClick={() => void loadRecords()}>
              Tekrar Dene
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(row) => row.id}
            onRowClick={(row) => setDetailId(Number(row.id))}
            emptyTitle="Gün sonu kaydı bulunamadı"
            emptyDescription="Seçilen filtrelere uygun kayıt bulunmuyor."
          />
        )}
      </SectionCard>

      <DayEndDetailPanel recordId={detailId} onClose={() => setDetailId(null)} />

      <SaleDetailPanel
        sale={previewSale}
        personnel={previewSale?.personnel ?? ''}
        onClose={() => setPreviewSale(null)}
        onCancelled={() => {
          if (selectedShiftId) void handleShiftChange(selectedShiftId)
        }}
      />

      <Modal
        open={createOpen}
        title="Gün Sonu Al"
        description="Kapanmış vardiya için gün sonu kaydı oluşturun. Açık satışları iptal edebilirsiniz."
        onClose={() => !creating && setCreateOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Vazgeç
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={creating || !selectedShiftId}
            >
              {creating ? 'Kaydediliyor...' : 'Gün Sonunu Kaydet'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {eligible.length === 0 ? (
            <p className="text-sm text-slate-500">
              Gün sonu alınabilecek kapanmış vardiya bulunmuyor. Önce vardiyayı kapatın.
            </p>
          ) : (
            <>
              <Select
                label="Vardiya"
                options={eligible.map((s) => ({
                  value: String(s.id),
                  label: `${s.personnel} · ${formatShiftDate(s.startTime)} ${formatShiftTime(s.startTime)}-${s.endTime ? formatShiftTime(s.endTime) : '—'}`,
                }))}
                value={selectedShiftId}
                onChange={(e) => void handleShiftChange(e.target.value)}
              />
              <Input
                label="Sayılan Kasa (₺)"
                type="number"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
              />
              {selectedShiftId && (
                <dl className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                  {(() => {
                    const s = eligible.find((x) => String(x.id) === selectedShiftId)
                    if (!s) return null
                    return (
                      <>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Beklenen Kasa</dt>
                          <dd className="font-medium text-slate-700">
                            {formatCurrency(s.expectedCash ?? 0)}
                          </dd>
                        </div>
                        <div className="mt-1 flex justify-between">
                          <dt className="text-slate-500">Kapanış Sayımı</dt>
                          <dd className="font-medium text-slate-700">
                            {formatCurrency(s.closingCash ?? 0)}
                          </dd>
                        </div>
                      </>
                    )
                  })()}
                </dl>
              )}
              {canCancelSale && selectedShiftId && (
                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Vardiya satışları ({shiftSales.length})
                  </div>
                  {shiftSales.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-slate-400">Satış yok.</p>
                  ) : (
                    <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto">
                      {shiftSales.map((sale) => {
                        const cancelled = sale.status === 'CANCELLED'
                        const pay = sale.paymentType
                        const payLabel =
                          pay === 'CARD'
                            ? paymentLabels.card
                            : pay === 'CREDIT'
                              ? paymentLabels.debt
                              : paymentLabels.cash
                        const payTone =
                          pay === 'CARD'
                            ? paymentTones.card
                            : pay === 'CREDIT'
                              ? paymentTones.debt
                              : paymentTones.cash
                        return (
                          <li key={sale.id}>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
                              onClick={() => {
                                void fetchSaleRecord(sale.id)
                                  .then(setPreviewSale)
                                  .catch(() => setCreateError('Satış detayı yüklenemedi.'))
                              }}
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={cn(
                                      'text-sm font-medium',
                                      cancelled ? 'text-red-600 line-through' : 'text-slate-700',
                                    )}
                                  >
                                    #{sale.id}
                                  </span>
                                  {cancelled && (
                                    <StatusBadge tone="danger">İptal edildi</StatusBadge>
                                  )}
                                  <StatusBadge tone={payTone}>{payLabel}</StatusBadge>
                                </div>
                                <p className="text-xs text-slate-400">
                                  {new Date(sale.createdAt).toLocaleTimeString('tr-TR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}{' '}
                                  · {sale.itemCount} ürün
                                </p>
                              </div>
                              <span
                                className={cn(
                                  'shrink-0 text-sm font-semibold',
                                  cancelled ? 'text-red-600' : 'text-slate-700',
                                )}
                              >
                                {formatCurrency(sale.total)}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
          {createError && <p className="text-sm text-red-600">{createError}</p>}
        </div>
      </Modal>
    </div>
  )
}
