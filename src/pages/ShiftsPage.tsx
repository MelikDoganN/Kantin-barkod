import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus,
  LockKeyhole,
  User,
  ClipboardList,
  TrendingUp,
  UserCheck,
  Scale,
  Banknote,
  CreditCard,
  HandCoins,
  Clock,
  Loader2,
} from 'lucide-react'
import {
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  DataTable,
} from '@/components/common'
import type { Column } from '@/components/common'
import { Button } from '@/components/ui'
import { NewShiftModal } from '@/components/shifts/NewShiftModal'
import { CloseShiftModal } from '@/components/shifts/CloseShiftModal'
import { useAuth } from '@/context/AuthContext'
import { useShift } from '@/context/ShiftContext'
import { hasPermission, roleLabel, type UserRole } from '@/config/permissions'
import { ApiError } from '@/services/api'
import {
  fetchShifts,
  formatElapsed,
  formatShiftDate,
  formatShiftTime,
  type ShiftListItem,
} from '@/services/shifts'
import type { BadgeTone } from '@/types'
import { formatCurrency, cn } from '@/utils/format'

function roleTone(role: string): BadgeTone {
  return role === 'ADMIN' ? 'info' : 'neutral'
}

export function ShiftsPage() {
  const { user } = useAuth()
  const { currentShift: current, refreshShift } = useShift()
  const canManageAll = hasPermission(user?.role, 'shift.viewAll')
  const canOpen = hasPermission(user?.role, 'shift.create')

  const [shifts, setShifts] = useState<ShiftListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [realCash, setRealCash] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [, list] = await Promise.all([refreshShift(), fetchShifts()])
      setShifts(list)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Vardiyalar yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [refreshShift])

  useEffect(() => {
    if (current) {
      setRealCash(String(current.openingCash + current.salesSummary.cashSales))
    } else {
      setRealCash('')
    }
  }, [current])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const pastShifts = useMemo(
    () => shifts.filter((s) => s.status === 'CLOSED'),
    [shifts],
  )

  const openCount = useMemo(
    () => (canManageAll ? shifts.filter((s) => s.status === 'OPEN').length : current ? 1 : 0),
    [canManageAll, shifts, current],
  )

  const todaySales = useMemo(() => {
    const today = new Date().toDateString()
    return shifts
      .filter((s) => new Date(s.startTime).toDateString() === today)
      .reduce((sum, s) => sum + s.totalSales, 0)
  }, [shifts])

  const totalSales = current?.salesSummary.totalSales ?? 0
  const expectedCash = current
    ? current.openingCash + current.salesSummary.cashSales
    : 0
  const cashDiff =
    !current || realCash === '' ? null : Number(realCash) - expectedCash

  const columns: Column<ShiftListItem>[] = [
    {
      key: 'date',
      header: 'Tarih',
      render: (row) => (
        <span className="tabular-nums text-slate-600">{formatShiftDate(row.startTime)}</span>
      ),
    },
    {
      key: 'personnel',
      header: 'Personel',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">{row.personnel}</span>
          <StatusBadge tone={roleTone(row.role)}>
            {roleLabel(row.role as UserRole)}
          </StatusBadge>
        </div>
      ),
    },
    {
      key: 'start',
      header: 'Başlangıç',
      align: 'center',
      render: (row) => formatShiftTime(row.startTime),
    },
    {
      key: 'end',
      header: 'Bitiş',
      align: 'center',
      render: (row) => (row.endTime ? formatShiftTime(row.endTime) : '—'),
    },
    {
      key: 'sales',
      header: 'Satış',
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-slate-700">{formatCurrency(row.totalSales)}</span>
      ),
    },
    {
      key: 'cash',
      header: 'Nakit',
      align: 'right',
      render: (row) => formatCurrency(row.cashSales),
    },
    {
      key: 'card',
      header: 'Kart',
      align: 'right',
      render: (row) => formatCurrency(row.cardSales),
    },
    {
      key: 'credit',
      header: 'Borç',
      align: 'right',
      render: (row) => formatCurrency(row.creditSales),
    },
    {
      key: 'diff',
      header: 'Kasa Farkı',
      align: 'center',
      render: (row) => {
        const diff = row.difference ?? 0
        if (diff === 0) return <StatusBadge tone="success">₺0,00</StatusBadge>
        return (
          <StatusBadge tone={diff > 0 ? 'warning' : 'danger'}>
            {diff > 0 ? '+' : ''}
            {formatCurrency(diff)}
          </StatusBadge>
        )
      },
    },
    {
      key: 'status',
      header: 'Durum',
      align: 'center',
      render: (row) =>
        row.status === 'OPEN' ? (
          <StatusBadge tone="success">Açık</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Tamamlandı</StatusBadge>
        ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vardiya Yönetimi"
        actions={
          canOpen && !current ? (
            <Button icon={<Plus size={18} />} onClick={() => setNewOpen(true)}>
              Yeni Vardiya
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 size={20} className="animate-spin text-brand-600" />
          <span className="text-sm">Vardiyalar yükleniyor...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" onClick={() => void loadData()}>
            Tekrar Dene
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Aktif Vardiya"
              value={String(openCount)}
              icon={ClipboardList}
              tone="brand"
              description="Devam eden vardiya"
            />
            <StatCard
              label="Bugünkü Satış"
              value={formatCurrency(todaySales)}
              icon={TrendingUp}
              tone="emerald"
              description="Günlük ciro"
            />
            <StatCard
              label="Açık Personel"
              value={current?.personnel ?? '—'}
              icon={UserCheck}
              tone="brand"
              description={
                current ? roleLabel(current.role as UserRole) : 'Açık vardiya yok'
              }
            />
            <StatCard
              label="Kasa Farkı"
              value={
                cashDiff === null || Number.isNaN(cashDiff)
                  ? '—'
                  : formatCurrency(cashDiff)
              }
              icon={Scale}
              tone="amber"
              description="Anlık fark"
            />
          </div>

          {!current ? (
            <SectionCard title="Aktif Vardiya">
              <div className="flex flex-col items-start gap-3 py-4">
                <p className="text-sm text-slate-500">Açık vardiyanız bulunmuyor.</p>
                {canOpen && (
                  <Button icon={<Plus size={16} />} onClick={() => setNewOpen(true)}>
                    Vardiya Aç
                  </Button>
                )}
              </div>
            </SectionCard>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <SectionCard
                title="Aktif Vardiya"
                action={<StatusBadge tone="success">Açık</StatusBadge>}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <User size={24} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-800">{current.personnel}</p>
                    <div className="mt-1">
                      <StatusBadge tone={roleTone(current.role)}>
                        {roleLabel(current.role as UserRole)}
                      </StatusBadge>
                    </div>
                  </div>
                </div>
                <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Başlangıç</dt>
                    <dd className="font-medium text-slate-700">
                      {formatShiftTime(current.startTime)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Açılış Kasası</dt>
                    <dd className="font-medium text-slate-700">
                      {formatCurrency(current.openingCash)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Geçen Süre</dt>
                    <dd className="flex items-center gap-1 font-medium text-slate-700">
                      <Clock size={14} className="text-slate-400" />
                      {formatElapsed(current.startTime)}
                    </dd>
                  </div>
                </dl>
              </SectionCard>

              <SectionCard title="Satış Özeti">
                <div className="space-y-2.5">
                  <SummaryRow
                    icon={<Banknote size={16} />}
                    tone="emerald"
                    label="Nakit Satış"
                    value={formatCurrency(current.salesSummary.cashSales)}
                  />
                  <SummaryRow
                    icon={<CreditCard size={16} />}
                    tone="brand"
                    label="Kart Satış"
                    value={formatCurrency(current.salesSummary.cardSales)}
                  />
                  <SummaryRow
                    icon={<HandCoins size={16} />}
                    tone="amber"
                    label="Borç Satış"
                    value={formatCurrency(current.salesSummary.creditSales)}
                  />
                  <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
                    <span className="text-sm font-semibold text-slate-700">Toplam Satış</span>
                    <span className="text-xl font-bold text-brand-600">
                      {formatCurrency(totalSales)}
                    </span>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Kasa Durumu">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Başlangıç Kasa</dt>
                    <dd className="font-medium text-slate-700">
                      {formatCurrency(current.openingCash)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">+ Nakit Satış</dt>
                    <dd className="font-medium text-slate-700">
                      {formatCurrency(current.salesSummary.cashSales)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                    <dt className="font-semibold text-slate-700">= Beklenen Kasa</dt>
                    <dd className="text-lg font-bold text-brand-600">
                      {formatCurrency(expectedCash)}
                    </dd>
                  </div>
                </dl>

                <label className="mt-3 block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Fiili Kasa (₺)
                  </span>
                  <input
                    type="number"
                    value={realCash}
                    onChange={(e) => setRealCash(e.target.value)}
                    placeholder="Sayılan tutarı girin"
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </label>

                <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-500">Kasa Farkı</span>
                  {cashDiff === null || Number.isNaN(cashDiff) ? (
                    <span className="text-sm font-semibold text-slate-400">—</span>
                  ) : (
                    <StatusBadge
                      tone={cashDiff === 0 ? 'success' : cashDiff < 0 ? 'danger' : 'warning'}
                    >
                      {cashDiff === 0 ? 'Kasa Tam' : cashDiff < 0 ? 'Eksik' : 'Fazla'} ·{' '}
                      {cashDiff > 0 ? '+' : ''}
                      {formatCurrency(cashDiff)}
                    </StatusBadge>
                  )}
                </div>

                <Button
                  className="mt-4"
                  variant="danger"
                  fullWidth
                  icon={<LockKeyhole size={18} />}
                  onClick={() => setCloseOpen(true)}
                >
                  Vardiyayı Kapat
                </Button>
              </SectionCard>
            </div>
          )}

          <SectionCard
            title="Geçmiş Vardiyalar"
            description={
              canManageAll ? 'Tamamlanan vardiya kayıtları' : 'Kendi tamamladığınız vardiyalar'
            }
            noPadding
          >
            <DataTable
              columns={columns}
              data={pastShifts}
              rowKey={(row) => String(row.id)}
              emptyTitle="Vardiya kaydı bulunamadı"
            />
          </SectionCard>
        </>
      )}

      <NewShiftModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSuccess={loadData}
      />

      {current && (
        <CloseShiftModal
          open={closeOpen}
          shift={current}
          onClose={() => setCloseOpen(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  )
}

interface SummaryRowProps {
  icon: React.ReactNode
  tone: 'emerald' | 'brand' | 'amber'
  label: string
  value: string
}

const summaryToneStyles: Record<SummaryRowProps['tone'], string> = {
  emerald: 'bg-emerald-50 text-emerald-600',
  brand: 'bg-brand-50 text-brand-600',
  amber: 'bg-amber-50 text-amber-600',
}

function SummaryRow({ icon, tone, label, value }: SummaryRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', summaryToneStyles[tone])}>
        {icon}
      </span>
      <span className="flex-1 text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-700">{value}</span>
    </div>
  )
}
