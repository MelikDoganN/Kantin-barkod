import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Modal } from '@/components/common'
import { Button, Input } from '@/components/ui'
import { ApiError } from '@/services/api'
import { resetUserPassword } from '@/services/users'
import type { Personnel } from '@/types'

interface ResetPasswordModalProps {
  personnel: Personnel | null
  onClose: () => void
  onConfirm: () => void
}

export function ResetPasswordModal({ personnel, onClose, onConfirm }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (personnel) {
      setPassword('')
      setPasswordRepeat('')
      setError(null)
    }
  }, [personnel])

  function handleClose() {
    setPassword('')
    setPasswordRepeat('')
    setError(null)
    onClose()
  }

  async function handleConfirm() {
    if (!personnel) return
    setSaving(true)
    setError(null)
    try {
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
      await resetUserPassword(personnel.id, {
        newPassword: password,
        newPasswordConfirm: passwordRepeat,
      })
      setPassword('')
      setPasswordRepeat('')
      onConfirm()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Şifre sıfırlanamadı.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={personnel !== null}
      title="Şifre Sıfırla"
      description="Kullanıcı için yeni bir şifre belirleyin."
      onClose={handleClose}
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button icon={<KeyRound size={16} />} onClick={() => void handleConfirm()} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">
            {personnel?.name.charAt(0)}
          </span>
          <div>
            <p className="text-sm font-medium text-slate-700">{personnel?.name}</p>
            <p className="text-xs text-slate-400">@{personnel?.username}</p>
          </div>
        </div>
        <Input
          label="Yeni Şifre"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Yeni Şifre Tekrar"
          type="password"
          placeholder="••••••••"
          value={passwordRepeat}
          onChange={(e) => setPasswordRepeat(e.target.value)}
        />
      </div>
    </Modal>
  )
}
