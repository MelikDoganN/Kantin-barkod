import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, KeyRound, Power } from 'lucide-react'
import { SectionCard, StatusBadge, DataTable, ConfirmModal } from '@/components/common'
import type { Column } from '@/components/common'
import { Button } from '@/components/ui'
import { NewPersonnelModal } from '@/components/personnel/NewPersonnelModal'
import { ResetPasswordModal } from '@/components/personnel/ResetPasswordModal'
import { fetchUsers, roleLabels, updateUserStatus } from '@/services/users'
import { ApiError } from '@/services/api'
import type { BadgeTone, Personnel } from '@/types'
import { cn } from '@/utils/format'

function roleTone(role: Personnel['role']): BadgeTone {
  return role === 'cashier' ? 'info' : 'violet'
}

export function UserManagementSection() {
  const [list, setList] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Personnel | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Personnel | null>(null)
  const [resetTarget, setResetTarget] = useState<Personnel | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchUsers()
      setList(rows)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kullanıcı listesi yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleStatusConfirm() {
    if (!confirmTarget) return
    try {
      const next = confirmTarget.status === 'active' ? 'PASSIVE' : 'ACTIVE'
      await updateUserStatus(confirmTarget.id, next)
      setConfirmTarget(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Durum güncellenemedi.')
      setConfirmTarget(null)
    }
  }

  const columns: Column<Personnel>[] = [
    {
      key: 'name',
      header: 'Ad Soyad',
      render: (row) => <span className="font-medium text-slate-700">{row.name}</span>,
    },
    {
      key: 'username',
      header: 'Kullanıcı Adı',
      render: (row) => <span className="text-slate-500">@{row.username}</span>,
    },
    {
      key: 'role',
      header: 'Rol',
      render: (row) => <StatusBadge tone={roleTone(row.role)}>{roleLabels[row.role]}</StatusBadge>,
    },
    {
      key: 'status',
      header: 'Durum',
      align: 'center',
      render: (row) =>
        row.status === 'active' ? (
          <StatusBadge tone="success">Aktif</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Pasif</StatusBadge>
        ),
    },
    {
      key: 'actions',
      header: 'İşlemler',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <IconAction
            title="Düzenle"
            onClick={() => {
              setEditTarget(row)
              setFormOpen(true)
            }}
          >
            <Pencil size={15} />
          </IconAction>
          <IconAction title="Şifre Sıfırla" onClick={() => setResetTarget(row)}>
            <KeyRound size={15} />
          </IconAction>
          <IconAction
            title={row.status === 'active' ? 'Pasife Al' : 'Aktife Al'}
            tone="danger"
            onClick={() => setConfirmTarget(row)}
          >
            <Power size={15} />
          </IconAction>
        </div>
      ),
    },
  ]

  return (
    <>
      <SectionCard
        title="Kullanıcı Yönetimi"
        description="Personel ekleme, düzenleme ve şifre işlemleri"
        action={
          <Button
            icon={<Plus size={16} />}
            onClick={() => {
              setEditTarget(null)
              setFormOpen(true)
            }}
          >
            Personel Ekle
          </Button>
        }
        noPadding
      >
        {error && (
          <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Yükleniyor…</p>
        ) : (
          <DataTable columns={columns} data={list} rowKey={(row) => row.id} />
        )}
      </SectionCard>

      <NewPersonnelModal
        open={formOpen}
        editTarget={editTarget}
        onClose={() => {
          setFormOpen(false)
          setEditTarget(null)
        }}
        onSaved={() => void load()}
      />

      <ResetPasswordModal
        personnel={resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={() => setResetTarget(null)}
      />

      <ConfirmModal
        open={confirmTarget !== null}
        title="Durum Değiştir"
        message={`"${confirmTarget?.name}" adlı kullanıcıyı ${
          confirmTarget?.status === 'active' ? 'pasife' : 'aktife'
        } almak istediğinize emin misiniz?`}
        confirmLabel="Evet, Değiştir"
        onConfirm={() => void handleStatusConfirm()}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  )
}

interface IconActionProps {
  title: string
  tone?: 'default' | 'danger'
  onClick: () => void
  children: React.ReactNode
}

function IconAction({ title, tone = 'default', onClick, children }: IconActionProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors',
        tone === 'danger'
          ? 'hover:border-red-200 hover:bg-red-50 hover:text-red-600'
          : 'hover:bg-slate-50 hover:text-brand-600',
      )}
    >
      {children}
    </button>
  )
}
