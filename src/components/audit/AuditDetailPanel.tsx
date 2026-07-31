import type { ReactNode } from 'react'
import { CheckCircle2, XCircle, Monitor, Wifi } from 'lucide-react'
import { Drawer, SectionCard, StatusBadge } from '@/components/common'
import type { AuditLog } from '@/types'
import { logTone, resolveActionLabel, resolveModuleMeta } from './auditMeta'

interface AuditDetailPanelProps {
  log: AuditLog | null
  onClose: () => void
}

function ValuesBlock({ title, values }: { title: string; values?: Record<string, string> }) {
  if (!values || Object.keys(values).length === 0) return null
  return (
    <SectionCard title={title}>
      <dl className="space-y-2.5 text-sm">
        {Object.entries(values).map(([key, value]) => (
          <div key={key} className="flex items-start justify-between gap-3">
            <dt className="text-slate-500">{key}</dt>
            <dd className="max-w-[60%] break-words text-right font-medium text-slate-700">{value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}

export function AuditDetailPanel({ log, onClose }: AuditDetailPanelProps) {
  if (!log) return null

  const meta = resolveModuleMeta(log.module)
  const Icon = meta.icon

  return (
    <Drawer open title="İşlem Detayı" description={`${log.date} · ${log.time}`} onClose={onClose} width={480}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-card border border-slate-200 bg-white p-4">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={logTone(log.module, log.actionType)}>{meta.label}</StatusBadge>
              {log.status === 'success' ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircle2 size={13} /> Başarılı
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                  <XCircle size={13} /> Başarısız
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm font-semibold text-slate-800">{log.title}</p>
            <p className="mt-0.5 text-sm text-slate-600">{log.description}</p>
          </div>
        </div>

        <SectionCard title="İşlem Bilgileri">
          <dl className="space-y-2.5 text-sm">
            <Row label="Tarih & Saat" value={`${log.date} ${log.time}`} />
            <Row label="Kullanıcı" value={log.userName} />
            <Row label="Rol" value={log.userRole} />
            <Row label="Modül" value={meta.label} />
            <Row label="İşlem Türü" value={resolveActionLabel(log.actionType)} />
            <Row label="Başlık" value={log.title} />
            <Row label="Açıklama" value={log.description || '—'} />
            <Row label="İlgili Kayıt" value={`${log.entityLabel} (${log.entityId})`} />
            <Row label="Durum" value={log.status === 'success' ? 'Başarılı' : 'Başarısız'} />
          </dl>
        </SectionCard>

        <ValuesBlock title="Önceki Değerler" values={log.oldValues} />
        <ValuesBlock title="Yeni Değerler" values={log.newValues} />

        {log.metadata && Object.keys(log.metadata).length > 0 && (
          <SectionCard title="Kayıt Bilgileri">
            <dl className="space-y-2.5 text-sm">
              {Object.entries(log.metadata).map(([key, value]) => (
                <Row key={key} label={key} value={value} />
              ))}
            </dl>
          </SectionCard>
        )}

        <SectionCard title="Cihaz & Bağlantı">
          <dl className="space-y-2.5 text-sm">
            <Row label="Cihaz" value={log.deviceName} icon={<Monitor size={14} />} />
            <Row label="IP Adresi" value={log.ipAddress} icon={<Wifi size={14} />} />
          </dl>
        </SectionCard>
      </div>
    </Drawer>
  )
}

interface RowProps {
  label: string
  value: string
  icon?: ReactNode
}

function Row({ label, value, icon }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-slate-500">
        {icon && <span className="text-slate-400">{icon}</span>}
        {label}
      </dt>
      <dd className="text-right font-medium text-slate-700">{value}</dd>
    </div>
  )
}
