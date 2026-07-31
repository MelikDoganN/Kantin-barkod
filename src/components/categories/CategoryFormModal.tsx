import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Modal } from '@/components/common'
import { Button, Input, Select } from '@/components/ui'
import type { ApiCategoryRow, CategoryPayload } from '@/services/categories'
import { ApiError } from '@/services/api'

interface CategoryFormModalProps {
  open: boolean
  onClose: () => void
  category?: ApiCategoryRow | null
  onSubmit: (payload: CategoryPayload) => Promise<void>
}

export function CategoryFormModal({
  open,
  onClose,
  category = null,
  onSubmit,
}: CategoryFormModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (category) {
      setName(category.name)
      setDescription(category.description ?? '')
      setIsActive(category.isActive)
    } else {
      setName('')
      setDescription('')
      setIsActive(true)
    }
    setError(null)
    setLoading(false)
  }, [open, category])

  function resetAndClose() {
    if (loading) return
    onClose()
  }

  async function handleSave() {
    if (loading) return
    setError(null)
    if (!name.trim()) {
      setError('Kategori adı zorunludur.')
      return
    }

    const payload: CategoryPayload = {
      name: name.trim(),
      description: description.trim() || null,
      isActive,
    }

    setLoading(true)
    try {
      await onSubmit(payload)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kategori kaydedilemedi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={category ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}
      description={
        category
          ? 'Kategori bilgilerini güncelleyin.'
          : 'Yeni bir ürün kategorisi oluşturun.'
      }
      onClose={resetAndClose}
      footer={
        <>
          <Button variant="outline" onClick={resetAndClose} disabled={loading}>
            Vazgeç
          </Button>
          <Button icon={<Save size={16} />} onClick={() => void handleSave()} disabled={loading}>
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <Input
          label="Kategori Adı"
          placeholder="Örn. İçecekler"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Açıklama"
          placeholder="Opsiyonel açıklama"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Select
          label="Durum"
          value={isActive ? 'active' : 'passive'}
          onChange={(e) => setIsActive(e.target.value === 'active')}
          options={[
            { value: 'active', label: 'Aktif' },
            { value: 'passive', label: 'Pasif' },
          ]}
        />
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
