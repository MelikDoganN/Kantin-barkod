import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, Wallet, HandCoins, CheckCircle2, Eye, Plus } from 'lucide-react'
import {
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  DataTable,
  SearchInput,
} from '@/components/common'
import type { Column } from '@/components/common'
import { Button, Select } from '@/components/ui'
import { CustomerDetailPanel } from '@/components/credit/CustomerDetailPanel'
import { CreateDebtCustomerModal } from '@/components/credit/CreateDebtCustomerModal'
import { useAuth } from '@/context/AuthContext'
import {
  fetchCreditCustomers,
  fetchCreditSummary,
} from '@/services/credits'
import { ApiError } from '@/services/api'
import type { CreditSummary, Customer } from '@/types'
import { formatCurrency } from '@/utils/format'

const emptySummary: CreditSummary = {
  totalDebtors: 0,
  totalReceivable: 0,
  todayDebtSales: 0,
  collected: 0,
}

export function CreditPage() {
  const { user } = useAuth()
  const canCreate = user?.role === 'ADMIN'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailTarget, setDetailTarget] = useState<Customer | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [creditSummary, setCreditSummary] = useState<CreditSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (searchTerm?: string) => {
    setLoading(true)
    setError(null)
    try {
      const [list, summary] = await Promise.all([
        fetchCreditCustomers(searchTerm),
        fetchCreditSummary(),
      ])
      setCustomers(list)
      setCreditSummary(summary)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Borç listesi yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load(search)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [load, search])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(t)
  }, [toast])

  const filtered = useMemo(() => {
    return customers.filter((customer) => {
      if (statusFilter !== 'all' && customer.status !== statusFilter) return false
      return true
    })
  }, [customers, statusFilter])

  function handlePaid(updated: Customer) {
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setDetailTarget(updated)
    void fetchCreditSummary().then(setCreditSummary).catch(() => undefined)
  }

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Ad Soyad',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">
            {row.name.charAt(0)}
          </span>
          <span className="font-medium text-slate-700">{row.name}</span>
        </div>
      ),
    },
    { key: 'phone', header: 'Telefon', render: (row) => <span className="tabular-nums text-slate-600">{row.phone}</span> },
    {
      key: 'totalDebt',
      header: 'Toplam Borç',
      align: 'right',
      render: (row) => (
        <span className={row.totalDebt > 0 ? 'font-semibold text-amber-600' : 'font-semibold text-slate-400'}>
          {formatCurrency(row.totalDebt)}
        </span>
      ),
    },
    { key: 'lastPurchase', header: 'Son Alış', align: 'center', render: (row) => <span className="text-slate-600">{row.lastPurchase}</span> },
    {
      key: 'status',
      header: 'Durum',
      align: 'center',
      render: (row) =>
        row.status === 'open' ? (
          <StatusBadge tone="warning">Açık</StatusBadge>
        ) : (
          <StatusBadge tone="success">Ödendi</StatusBadge>
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
            setDetailTarget(row)
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
        title="Borç Yönetimi"
        actions={
          canCreate ? (
            <Button icon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>
              Yeni Borçlu
            </Button>
          ) : undefined
        }
      />

      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          {toast}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Toplam Borçlu" value={`${creditSummary.totalDebtors} kişi`} icon={Users} tone="brand" description="Borç kaydı olan kişi" />
        <StatCard label="Toplam Alacak" value={formatCurrency(creditSummary.totalReceivable)} icon={Wallet} tone="brand" description="Tahsil edilecek tutar" />
        <StatCard label="Bugünkü Borç Satışı" value={formatCurrency(creditSummary.todayDebtSales)} icon={HandCoins} tone="brand" description="Bugün açılan borç" />
        <StatCard label="Tahsil Edilen" value={formatCurrency(creditSummary.collected)} icon={CheckCircle2} tone="emerald" description="Bu ay tahsilat" />
      </div>

      <SectionCard>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Arama</span>
            <SearchInput value={search} onChange={setSearch} placeholder="İsim veya telefon ara..." />
          </div>
          <Select
            label="Durum"
            options={[
              { value: 'all', label: 'Tümü' },
              { value: 'open', label: 'Açık' },
              { value: 'paid', label: 'Ödendi' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Borç Listesi" description="Müşteri ve personel borç kayıtları" noPadding>
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Borç listesi yükleniyor…</p>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(row) => row.id}
            onRowClick={(row) => setDetailTarget(row)}
            emptyTitle="Borç kaydı bulunamadı"
            emptyDescription="Seçilen filtrelere uygun kayıt bulunmuyor."
          />
        )}
      </SectionCard>

      <CustomerDetailPanel
        customer={detailTarget}
        onClose={() => setDetailTarget(null)}
        onPaid={handlePaid}
      />

      <CreateDebtCustomerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={async () => {
          await load(search)
          setToast('Borçlu hesabı oluşturuldu.')
        }}
      />
    </div>
  )
}
