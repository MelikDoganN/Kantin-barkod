import { useEffect, useState } from 'react'
import { Save, Shield, User } from 'lucide-react'
import { Modal } from '@/components/common'
import { Button, Input, Select } from '@/components/ui'
import { ApiError } from '@/services/api'
import { createUser, updateUser } from '@/services/users'
import type { Personnel } from '@/types'
import { cn } from '@/utils/format'

interface NewPersonnelModalProps {
  open: boolean
  editTarget?: Personnel | null
  onClose: () => void
  onSaved: () => void
}

export function NewPersonnelModal({ open, editTarget, onClose, onSaved }: NewPersonnelModalProps) {
  const editing = Boolean(editTarget)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const [role, setRole] = useState<'cashier' | 'manager'>('cashier')
  const [status, setStatus] = useState('active')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editTarget) {
      setName(editTarget.name)
      setPhone(editTarget.phone === '—' ? '' : editTarget.phone)
      setUsername(editTarget.username)
      setRole(editTarget.role === 'admin' || editTarget.role === 'manager' ? 'manager' : 'cashier')
      setStatus(editTarget.status)
      setPassword('')
      setPasswordRepeat('')
    } else {
      setName('')
      setPhone('')
      setUsername('')
      setPassword('')
      setPasswordRepeat('')
      setRole('cashier')
      setStatus('active')
    }
    setError(null)
  }, [open, editTarget])

  function resetAndClose() {
    setError(null)
    onClose()
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const apiRole = role === 'manager' ? 'ADMIN' : 'PERSONNEL'
      const apiStatus = status === 'active' ? 'ACTIVE' : 'PASSIVE'

      if (editing && editTarget) {
        await updateUser(editTarget.id, {
          fullName: name.trim(),
          username: username.trim(),
          phone: phone.trim() || null,
          role: apiRole,
          status: apiStatus,
        })
      } else {
        if (password.length < 4) {
          setError('Şifre en az 4 karakter olmalıdır.')
          setSaving(false)
          return
        }
        if (password !== passwordRepeat) {
          setError('Şifreler eşleşmiyor.')
          setSaving(false)
          return
        }
        await createUser({
          fullName: name.trim(),
          username: username.trim(),
          phone: phone.trim() || undefined,
          password,
          passwordConfirm: passwordRepeat,
          role: apiRole,
          status: apiStatus,
        })
      }
      onSaved()
      resetAndClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kayıt başarısız.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={editing ? 'Personel Düzenle' : 'Yeni Personel'}
      description={editing ? 'Kullanıcı bilgilerini güncelleyin.' : 'Yeni kullanıcı oluşturun ve rol atayın.'}
      onClose={resetAndClose}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={resetAndClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button icon={<Save size={16} />} onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {error && (
          <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <Input label="Ad Soyad" placeholder="Örn. Ayşe Yılmaz" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Telefon" placeholder="0532 000 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Kullanıcı Adı" placeholder="Örn. ayse" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Select
          label="Durum"
          options={[
            { value: 'active', label: 'Aktif' },
            { value: 'passive', label: 'Pasif' },
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
        {!editing && (
          <>
            <Input label="Şifre" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input
              label="Şifre Tekrar"
              type="password"
              placeholder="••••••••"
              value={passwordRepeat}
              onChange={(e) => setPasswordRepeat(e.target.value)}
            />
          </>
        )}
        <div className="md:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Rol</span>
          <div className="grid grid-cols-2 gap-2">
            <RoleOption
              active={role === 'cashier'}
              icon={<User size={16} />}
              label="Personel"
              onClick={() => setRole('cashier')}
            />
            <RoleOption
              active={role === 'manager'}
              icon={<Shield size={16} />}
              label="Yönetici"
              onClick={() => setRole('manager')}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}

interface RoleOptionProps {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}

function RoleOption({ active, icon, label, onClick }: RoleOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full border-2',
          active ? 'border-brand-500' : 'border-slate-300',
        )}
      >
        {active && <span className="h-2 w-2 rounded-full bg-brand-500" />}
      </span>
      {icon}
      {label}
    </button>
  )
}
