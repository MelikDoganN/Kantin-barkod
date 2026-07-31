import { useEffect, useMemo, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Drawer, SectionCard, StatusBadge, DataTable } from '@/components/common'
import type { Column } from '@/components/common'
import { Button } from '@/components/ui'
import { ProductThumb } from '@/components/products/ProductThumb'
import { ApiError } from '@/services/api'
import {
  fetchCountById,
  type ApiCountDetail,
  type ApiCountItem,
} from '@/services/counts'
import type { BadgeTone } from '@/types'
import { cn } from '@/utils/format'

interface CountHistoryDetailDrawerProps {
  countId: string | null
  onClose: () => void
}

function countTypeLabel(type: string): string {
  return type.toUpperCase() === 'WAREHOUSE' ? 'Depo Sayımı' : 'Raf Sayımı'
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('tr-TR')
}

function resultTone(result: ApiCountItem['result']): BadgeTone {
  if (result === 'Eksik') return 'danger'
  if (result === 'Fazla') return 'warning'
  if (result === 'Aynı') return 'success'
  return 'neutral'
}

function escapeCsv(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function downloadCountCsv(detail: ApiCountDetail) {
  const typeSlug = detail.type.toUpperCase() === 'WAREHOUSE' ? 'depo' : 'raf'
  const datePart = detail.startedAt.slice(0, 10)
  const filename = `sayim-raporu-${typeSlug}-${datePart}.csv`
  const headers = [
    'Ürün',
    'Barkod',
    'Kategori',
    'Sistem Miktarı',
    'Sayılan Miktar',
    'Fark',
    'Durum',
    'Açıklama',
  ]
  const rows = detail.items.map((item) => [
    item.product.name,
    item.product.barcode ?? '',
    item.product.category,
    item.systemQuantity,
    item.countedQuantity ?? '',
    item.difference ?? '',
    item.result ?? '',
    item.note ?? '',
  ])
  const csv =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function CountHistoryDetailDrawer({ countId, onClose }: CountHistoryDetailDrawerProps) {
  const [detail, setDetail] = useState<ApiCountDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!countId) {
      setDetail(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchCountById(countId)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setDetail(null)
          setError(
            err instanceof ApiError
              ? err.status === 404
                ? 'Sayım kaydı bulunamadı.'
                : err.message
              : 'Sayım detayı yüklenemedi.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [countId])

  const columns: Column<ApiCountItem>[] = useMemo(
    () => [
      {
        key: 'image',
        header: 'Görsel',
        width: '56px',
        render: (row) => (
          <ProductThumb
            src={row.product.imageUrl ?? row.product.imagePath}
            size="sm"
            className="h-11 w-11"
          />
        ),
      },
      {
        key: 'product',
        header: 'Ürün',
        render: (row) => <span className="font-medium text-slate-700">{row.product.name}</span>,
      },
      {
        key: 'barcode',
        header: 'Barkod',
        render: (row) => (
          <span className="tabular-nums text-slate-500">{row.product.barcode || '—'}</span>
        ),
      },
      {
        key: 'category',
        header: 'Kategori',
        render: (row) => <span className="text-slate-600">{row.product.category}</span>,
      },
      {
        key: 'system',
        header: 'Sistem Miktarı',
        align: 'center',
        render: (row) => row.systemQuantity,
      },
      {
        key: 'counted',
        header: 'Sayılan Miktar',
        align: 'center',
        render: (row) => (row.countedQuantity === null ? '—' : row.countedQuantity),
      },
      {
        key: 'diff',
        header: 'Fark',
        align: 'center',
        render: (row) => {
          if (row.difference === null) return '—'
          return (
            <span
              className={cn(
                'font-semibold tabular-nums',
                row.difference === 0
                  ? 'text-slate-500'
                  : row.difference < 0
                    ? 'text-red-600'
                    : 'text-amber-600',
              )}
            >
              {row.difference > 0 ? '+' : ''}
              {row.difference}
            </span>
          )
        },
      },
      {
        key: 'result',
        header: 'Durum',
        align: 'center',
        render: (row) =>
          row.result ? (
            <StatusBadge tone={resultTone(row.result)}>{row.result}</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Bekliyor</StatusBadge>
          ),
      },
      {
        key: 'note',
        header: 'Açıklama',
        render: (row) => <span className="text-slate-600">{row.note?.trim() || '—'}</span>,
      },
    ],
    [],
  )

  const summary = detail?.summary

  return (
    <Drawer
      open={countId !== null}
      title={
        detail
          ? `Sayım Detayı — ${countTypeLabel(detail.type)}`
          : loading
            ? 'Sayım Detayı'
            : 'Sayım Detayı'
      }
      description={detail ? `#${detail.id}` : undefined}
      onClose={onClose}
      width={880}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 size={20} className="animate-spin text-brand-600" />
          <span className="text-sm">Sayım detayı yükleniyor...</span>
        </div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : !detail ? (
        <p className="py-10 text-center text-sm text-slate-500">Sayım kaydı bulunamadı.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoRow label="Sayım tarihi" value={formatDateTime(detail.date)} />
            <InfoRow label="Sayım türü" value={countTypeLabel(detail.type)} />
            <InfoRow label="Sayımı yapan" value={detail.createdBy?.fullName ?? detail.user} />
            <InfoRow label="Açıklama" value={detail.description?.trim() || '—'} />
            <InfoRow label="Başlangıç" value={formatDateTime(detail.startedAt)} />
            <InfoRow label="Tamamlanma" value={formatDateTime(detail.completedAt)} />
          </div>

          {summary && (
            <div className="flex flex-wrap gap-2">
              <SummaryChip label="Toplam Sayılan Ürün" value={summary.totalProducts} tone="neutral" />
              <SummaryChip label="Eksik Ürün" value={summary.missingProducts} tone="danger" />
              <SummaryChip label="Fazla Ürün" value={summary.excessProducts} tone="warning" />
              <SummaryChip label="Toplam Eksik Adet" value={summary.totalMissingQuantity} tone="danger" />
              <SummaryChip label="Toplam Fazla Adet" value={summary.totalExcessQuantity} tone="warning" />
            </div>
          )}

          <div className="flex justify-end">
            <Button
              variant="outline"
              icon={<Download size={16} />}
              onClick={() => downloadCountCsv(detail)}
              disabled={detail.items.length === 0}
            >
              Raporu İndir
            </Button>
          </div>

          <SectionCard title="Sayım Kalemleri" noPadding>
            {detail.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                Bu sayımda ürün kaydı bulunmuyor.
              </p>
            ) : (
              <DataTable
                columns={columns}
                data={detail.items}
                rowKey={(row) => String(row.id)}
              />
            )}
          </SectionCard>
        </div>
      )}
    </Drawer>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-700">{value}</p>
    </div>
  )
}

const chipStyles: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-brand-50 text-brand-700',
  neutral: 'bg-slate-100 text-slate-600',
  violet: 'bg-violet-50 text-violet-700',
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: BadgeTone
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', chipStyles[tone])}>
      {label}
      <span className="font-bold">{value}</span>
    </span>
  )
}
