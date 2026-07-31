import { useEffect, useState } from 'react'
import { Drawer, StatusBadge, DataTable } from '@/components/common'
import type { Column } from '@/components/common'
import { roleLabel } from '@/config/permissions'
import { ApiError } from '@/services/api'
import { fetchDayEndDetail, fetchDayEndSale } from '@/services/dayEnd'
import type { DayEndRecord, SaleRecord } from '@/types'
import { cn, formatCurrency, formatNumber } from '@/utils/format'
import { paymentLabels, paymentTones, statusLabels, statusTones } from './helpers'
import { SaleDetailPanel } from './SaleDetailPanel'

interface DayEndDetailPanelProps {
  recordId: number | null
  onClose: () => void
}

export function DayEndDetailPanel({ recordId, onClose }: DayEndDetailPanelProps) {
  const [record, setRecord] = useState<DayEndRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSale, setActiveSale] = useState<(SaleRecord & { personnel?: string }) | null>(null)
  const [saleLoading, setSaleLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (recordId === null) {
      setRecord(null)
      setActiveSale(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setActiveSale(null)

    void fetchDayEndDetail(recordId)
      .then((detail) => {
        if (!cancelled) setRecord(detail)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Detay yüklenemedi.')
          setRecord(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [recordId, reloadKey])

  async function handleSaleClick(sale: SaleRecord) {
    if (!recordId || saleLoading) return
    setSaleLoading(true)
    try {
      const detail = await fetchDayEndSale(recordId, Number(sale.id))
      setActiveSale(detail)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Satış detayı yüklenemedi.')
    } finally {
      setSaleLoading(false)
    }
  }

  if (recordId === null) return null

  const saleColumns: Column<SaleRecord>[] = [
    {
      key: 'saleNo',
      header: 'Satış No',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-medium',
              row.status === 'CANCELLED' ? 'text-red-600 line-through' : 'text-slate-700',
            )}
          >
            {row.saleNo}
          </span>
          {row.status === 'CANCELLED' && <StatusBadge tone="danger">İptal edildi</StatusBadge>}
        </div>
      ),
    },
    { key: 'time', header: 'Saat', render: (row) => <span className="text-slate-600">{row.time}</span> },
    {
      key: 'payment',
      header: 'Ödeme',
      render: (row) => (
        <StatusBadge tone={paymentTones[row.payment]}>{paymentLabels[row.payment]}</StatusBadge>
      ),
    },
    {
      key: 'itemCount',
      header: 'Ürün',
      align: 'center',
      render: (row) => `${row.itemCount} ürün`,
    },
    {
      key: 'total',
      header: 'Toplam',
      align: 'right',
      render: (row) => (
        <span
          className={cn(
            'font-semibold',
            row.status === 'CANCELLED' ? 'text-red-600' : 'text-slate-700',
          )}
        >
          {formatCurrency(row.total)}
        </span>
      ),
    },
  ]

  return (
    <>
      <Drawer
        open
        title="Gün Sonu Detayı"
        description={record ? `${record.date} · ${record.shift}` : 'Yükleniyor...'}
        onClose={onClose}
        width={560}
      >
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Detay yükleniyor...</p>
        ) : error && !record ? (
          <p className="py-8 text-center text-sm text-red-600">{error}</p>
        ) : record ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-card border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-lg font-semibold text-brand-600">
                  {record.personnel.charAt(0)}
                </span>
                <div>
                  <p className="text-base font-semibold text-slate-800">{record.personnel}</p>
                  <p className="text-sm text-slate-500">
                    {roleLabel(record.role === 'admin' ? 'ADMIN' : 'PERSONNEL')}
                  </p>
                </div>
              </div>
              <StatusBadge tone={statusTones[record.status]}>{statusLabels[record.status]}</StatusBadge>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCell label="Vardiya" value={record.shift} />
              <SummaryCell label="Başlangıç Kasası" value={formatCurrency(record.openingCash)} />
              <SummaryCell label="Satış Adedi" value={formatNumber(record.saleCount)} />
              <SummaryCell label="Toplam Satış" value={formatCurrency(record.totalSales)} highlight />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCell label="Nakit" value={formatCurrency(record.cashSales)} />
              <SummaryCell label="Kart" value={formatCurrency(record.cardSales)} />
              <SummaryCell label="Borç" value={formatCurrency(record.debtSales)} />
              <SummaryCell
                label="Kasa Farkı"
                value={formatCurrency(record.cashDifference)}
                tone={
                  record.cashDifference === 0 ? 'ok' : record.cashDifference < 0 ? 'bad' : 'warn'
                }
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="rounded-card border border-slate-200">
              <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Satış Listesi {saleLoading ? '(yükleniyor...)' : ''}
              </div>
              <DataTable
                columns={saleColumns}
                data={record.sales}
                rowKey={(row) => row.id}
                onRowClick={(row) => void handleSaleClick(row)}
                emptyTitle="Satış bulunmuyor"
              />
            </div>
          </div>
        ) : null}
      </Drawer>

      <SaleDetailPanel
        sale={activeSale}
        personnel={activeSale?.personnel ?? record?.personnel ?? ''}
        onClose={() => setActiveSale(null)}
        onCancelled={() => setReloadKey((k) => k + 1)}
      />
    </>
  )
}

interface SummaryCellProps {
  label: string
  value: string
  highlight?: boolean
  tone?: 'ok' | 'bad' | 'warn'
}

function SummaryCell({ label, value, highlight, tone }: SummaryCellProps) {
  const valueClass = tone
    ? tone === 'ok'
      ? 'text-emerald-600'
      : tone === 'bad'
        ? 'text-red-600'
        : 'text-amber-600'
    : highlight
      ? 'text-brand-700'
      : 'text-slate-700'

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5',
        highlight ? 'border-brand-100 bg-brand-50' : 'border-slate-100 bg-slate-50',
      )}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn('mt-0.5 text-sm font-semibold', valueClass)}>{value}</p>
    </div>
  )
}
