import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Save,
  Upload,
  ScanBarcode,
  DatabaseBackup,
  RotateCcw,
  Sun,
  Moon,
  Usb,
  CheckCircle2,
  Clock,
  RefreshCw,
  Trash2,
  Download,
  ImageOff,
} from 'lucide-react'
import { PageHeader, SectionCard, StatusBadge, Tabs, ConfirmModal, DataTable } from '@/components/common'
import type { TabItem, Column } from '@/components/common'
import { Button, Input, Select } from '@/components/ui'
import { changeOwnPassword } from '@/services/users'
import { UserManagementSection } from '@/components/settings/UserManagementSection'
import { ApiError } from '@/services/api'
import {
  deleteLogo,
  fetchSettings,
  logoUrl,
  updateBarcodeSettings,
  updateBackupSettings,
  updateBusinessSettings,
  updateSystemSettings,
  uploadLogo,
  type AppSettings,
} from '@/services/settings'
import {
  createBackup,
  deleteBackup,
  downloadBackup,
  fetchBackups,
  formatBytes,
  type BackupItem,
} from '@/services/backups'
import { fetchCategories, type ApiCategory } from '@/services/catalog'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/utils/format'

const tabs: TabItem[] = [
  { id: 'business', label: 'İşletme Ayarları' },
  { id: 'system', label: 'Sistem Ayarları' },
  { id: 'barcode', label: 'Barkod Ayarları' },
  { id: 'backup', label: 'Yedekleme' },
  { id: 'users', label: 'Kullanıcı Yönetimi' },
  { id: 'account', label: 'Hesap Ayarları' },
]

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Henüz yedek alınmadı'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('tr-TR')
}

export function SettingsPage() {
  const { user } = useAuth()
  const { setTheme: applyAppTheme } = useTheme()
  const isAdmin = user?.role === 'ADMIN'

  const [active, setActive] = useState('business')
  const visibleTabs = useMemo(
    () =>
      isAdmin
        ? tabs
        : tabs.filter((t) => t.id === 'business' || t.id === 'system' || t.id === 'barcode'),
    [isAdmin],
  )

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === active)) {
      setActive(visibleTabs[0]?.id ?? 'business')
    }
  }, [active, visibleTabs])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)

  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [businessSaving, setBusinessSaving] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [currency, setCurrency] = useState<'TRY'>('TRY')
  const [dateFormat, setDateFormat] = useState<'DD.MM.YYYY' | 'YYYY-MM-DD'>('DD.MM.YYYY')
  const [defaultCategoryId, setDefaultCategoryId] = useState('')
  const [theme, setTheme] = useState<'LIGHT' | 'DARK'>('LIGHT')
  const [lowStockThreshold, setLowStockThreshold] = useState('10')
  const [systemSaving, setSystemSaving] = useState(false)

  const [barcodeEnabled, setBarcodeEnabled] = useState(true)
  const [barcodeAutoAdd, setBarcodeAutoAdd] = useState(true)
  const [barcodeQuantityMode, setBarcodeQuantityMode] = useState(false)
  const [barcodeSaving, setBarcodeSaving] = useState(false)
  const [testBarcode, setTestBarcode] = useState('')

  const [backupDirectory, setBackupDirectory] = useState('')
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false)
  const [autoBackupFrequency, setAutoBackupFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | ''>('')
  const [backupSaving, setBackupSaving] = useState(false)
  const [backupCreating, setBackupCreating] = useState(false)
  const [backups, setBackups] = useState<BackupItem[]>([])
  const [deleteTarget, setDeleteTarget] = useState<BackupItem | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!errorToast) return
    const t = window.setTimeout(() => setErrorToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [errorToast])

  const applySettings = useCallback((data: AppSettings) => {
    setSettings(data)
    setBusinessName(data.business.businessName)
    setPhone(data.business.phone ?? '')
    setAddress(data.business.address ?? '')
    setLogoPreview(logoUrl(data.business.logoPath))
    setCurrency((data.system.currency as 'TRY') || 'TRY')
    setDateFormat(
      data.system.dateFormat === 'YYYY-MM-DD' ? 'YYYY-MM-DD' : 'DD.MM.YYYY',
    )
    setDefaultCategoryId(
      data.system.defaultCategoryId != null ? String(data.system.defaultCategoryId) : '',
    )
    setTheme(data.system.theme === 'DARK' ? 'DARK' : 'LIGHT')
    applyAppTheme(data.system.theme === 'DARK' ? 'DARK' : 'LIGHT')
    setLowStockThreshold(String(data.system.lowStockThreshold ?? 10))
    setBarcodeEnabled(data.barcode.barcodeEnabled)
    setBarcodeAutoAdd(data.barcode.barcodeAutoAdd)
    setBarcodeQuantityMode(data.barcode.barcodeQuantityMode)
    setBackupDirectory(data.backup.backupDirectory ?? '')
    setAutoBackupEnabled(data.backup.autoBackupEnabled)
    setAutoBackupFrequency(
      data.backup.autoBackupFrequency === 'DAILY' ||
        data.backup.autoBackupFrequency === 'WEEKLY' ||
        data.backup.autoBackupFrequency === 'MONTHLY'
        ? data.backup.autoBackupFrequency
        : '',
    )
  }, [applyAppTheme])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [settingsData, cats] = await Promise.all([
        fetchSettings(),
        fetchCategories().catch(() => [] as ApiCategory[]),
      ])
      applySettings(settingsData)
      setCategories(cats.filter((c) => c.isActive))
      if (isAdmin) {
        const list = await fetchBackups({ page: 1, limit: 100 })
        setBackups(list.items)
      }
    } catch {
      setLoadError('Ayarlar yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [applySettings, isAdmin])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  async function refreshBackups() {
    if (!isAdmin) return
    const list = await fetchBackups({ page: 1, limit: 100 })
    setBackups(list.items)
  }

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Seçilmedi' },
      ...categories.map((c) => ({ value: String(c.id), label: c.name })),
    ],
    [categories],
  )

  const backupColumns = useMemo<Column<BackupItem>[]>(
    () => [
      {
        key: 'fileName',
        header: 'Dosya Adı',
        render: (row) => <span className="font-medium text-slate-700">{row.fileName}</span>,
      },
      {
        key: 'size',
        header: 'Boyut',
        render: (row) => formatBytes(row.fileSize),
      },
      {
        key: 'createdBy',
        header: 'Oluşturan',
        render: (row) => row.createdBy?.fullName ?? 'Sistem',
      },
      {
        key: 'date',
        header: 'Tarih',
        render: (row) => formatDateTime(row.createdAt),
      },
      {
        key: 'status',
        header: 'Durum',
        render: (row) => (
          <StatusBadge tone={row.status === 'SUCCESS' ? 'success' : 'danger'}>
            {row.status === 'SUCCESS' ? 'Başarılı' : 'Başarısız'}
          </StatusBadge>
        ),
      },
      {
        key: 'actions',
        header: 'İşlemler',
        render: (row) => (
          <div className="flex gap-1">
            {row.status === 'SUCCESS' && (
              <Button
                variant="outline"
                icon={<Download size={14} />}
                onClick={() => {
                  void downloadBackup(row.id, row.fileName).catch((err) => {
                    setErrorToast(err instanceof ApiError ? err.message : 'İndirilemedi.')
                  })
                }}
              >
                İndir
              </Button>
            )}
            <Button
              variant="outline"
              icon={<Trash2 size={14} />}
              onClick={() => setDeleteTarget(row)}
            >
              Sil
            </Button>
          </div>
        ),
      },
    ],
    [],
  )

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Ayarlar" />
        <SectionCard>
          <div className="space-y-2 py-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
            <p className="pt-2 text-center text-sm text-slate-400">Yükleniyor…</p>
          </div>
        </SectionCard>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-5">
        <PageHeader title="Ayarlar" />
        <SectionCard>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
            <Button icon={<RefreshCw size={16} />} onClick={() => void loadAll()}>
              Tekrar Dene
            </Button>
          </div>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Ayarlar" />

      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          {toast}
        </div>
      )}
      {errorToast && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {errorToast}
        </div>
      )}

      <Tabs tabs={visibleTabs} active={active} onChange={setActive} />

      {active === 'business' && (
        <SectionCard title="Kantin Bilgileri">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[200px_1fr]">
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Logo</span>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={!isAdmin || logoUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  void (async () => {
                    setLogoUploading(true)
                    setErrorToast(null)
                    try {
                      const updated = await uploadLogo(file)
                      applySettings(updated)
                      setToast('Logo güncellendi.')
                    } catch (err) {
                      setErrorToast(
                        err instanceof ApiError
                          ? err.message
                          : 'Yalnızca JPG, PNG veya WEBP dosyaları yüklenebilir.',
                      )
                    } finally {
                      setLogoUploading(false)
                    }
                  })()
                }}
              />
              <button
                type="button"
                disabled={!isAdmin || logoUploading}
                onClick={() => logoInputRef.current?.click()}
                className="relative flex h-40 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-card border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition-colors hover:border-brand-400 hover:text-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-2" />
                ) : (
                  <>
                    <Upload size={26} />
                    <span className="text-xs font-medium">
                      {logoUploading ? 'Yükleniyor…' : 'Logo Yükle'}
                    </span>
                    <span className="text-[11px] text-slate-400">PNG, JPG (max 2MB)</span>
                  </>
                )}
              </button>
              {isAdmin && logoPreview && (
                <Button
                  variant="outline"
                  className="mt-2 w-full"
                  icon={<ImageOff size={14} />}
                  disabled={logoUploading}
                  onClick={() => {
                    void (async () => {
                      try {
                        const updated = await deleteLogo()
                        applySettings(updated)
                        setToast('Logo kaldırıldı.')
                      } catch (err) {
                        setErrorToast(err instanceof ApiError ? err.message : 'Logo kaldırılamadı.')
                      }
                    })()
                  }}
                >
                  Logoyu Kaldır
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="İşletme Adı"
                value={businessName}
                disabled={!isAdmin}
                onChange={(e) => setBusinessName(e.target.value)}
              />
              <Input
                label="Telefon"
                value={phone}
                disabled={!isAdmin}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div className="md:col-span-2">
                <Input
                  label="Adres"
                  value={address}
                  disabled={!isAdmin}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
              <Button
                icon={<Save size={16} />}
                disabled={businessSaving}
                onClick={() => {
                  void (async () => {
                    setBusinessSaving(true)
                    setErrorToast(null)
                    try {
                      const updated = await updateBusinessSettings({
                        businessName,
                        phone,
                        address,
                      })
                      applySettings(updated)
                      setToast('İşletme bilgileri güncellendi.')
                    } catch (err) {
                      setErrorToast(
                        err instanceof ApiError ? err.message : 'İşletme bilgileri kaydedilemedi.',
                      )
                    } finally {
                      setBusinessSaving(false)
                    }
                  })()
                }}
              >
                {businessSaving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          )}
        </SectionCard>
      )}

      {active === 'system' && (
        <SectionCard title="Genel Ayarlar">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Para Birimi"
              value={currency}
              disabled={!isAdmin}
              onChange={() => setCurrency('TRY')}
              options={[{ value: 'TRY', label: 'Türk Lirası (₺)' }]}
            />
            <Select
              label="Tarih Formatı"
              value={dateFormat}
              disabled={!isAdmin}
              onChange={(e) =>
                setDateFormat(e.target.value === 'YYYY-MM-DD' ? 'YYYY-MM-DD' : 'DD.MM.YYYY')
              }
              options={[
                { value: 'DD.MM.YYYY', label: 'GG.AA.YYYY' },
                { value: 'YYYY-MM-DD', label: 'YYYY-AA-GG' },
              ]}
            />
            <Select
              label="Varsayılan Kategori"
              value={defaultCategoryId}
              disabled={!isAdmin}
              onChange={(e) => setDefaultCategoryId(e.target.value)}
              options={categoryOptions}
            />
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Tema</span>
              <div className="inline-flex w-full rounded-xl border border-slate-200 bg-slate-50 p-1">
                <ThemeButton
                  active={theme === 'LIGHT'}
                  icon={<Sun size={16} />}
                  label="Açık"
                  disabled={!isAdmin}
                  onClick={() => {
                    setTheme('LIGHT')
                    applyAppTheme('LIGHT')
                  }}
                />
                <ThemeButton
                  active={theme === 'DARK'}
                  icon={<Moon size={16} />}
                  label="Karanlık"
                  disabled={!isAdmin}
                  onClick={() => {
                    setTheme('DARK')
                    applyAppTheme('DARK')
                  }}
                />
              </div>
            </div>
            <Input
              label="Kritik Stok Eşiği"
              type="number"
              min={0}
              max={100000}
              value={lowStockThreshold}
              disabled={!isAdmin}
              onChange={(e) => setLowStockThreshold(e.target.value)}
            />
          </div>
          {isAdmin && (
            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
              <Button
                icon={<Save size={16} />}
                disabled={systemSaving}
                onClick={() => {
                  void (async () => {
                    setSystemSaving(true)
                    setErrorToast(null)
                    try {
                      const updated = await updateSystemSettings({
                        currency: 'TRY',
                        dateFormat,
                        defaultCategoryId: defaultCategoryId ? Number(defaultCategoryId) : null,
                        theme,
                        lowStockThreshold: Number(lowStockThreshold) || 0,
                      })
                      applySettings(updated)
                      applyAppTheme(theme)
                      setToast('Sistem ayarları güncellendi.')
                    } catch (err) {
                      setErrorToast(
                        err instanceof ApiError ? err.message : 'Sistem ayarları kaydedilemedi.',
                      )
                    } finally {
                      setSystemSaving(false)
                    }
                  })()
                }}
              >
                {systemSaving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          )}
        </SectionCard>
      )}

      {active === 'barcode' && (
        <SectionCard title="Barkod Okuyucu Ayarları">
          <div className="space-y-3">
            <InfoRow
              icon={<CheckCircle2 size={18} className="text-emerald-500" />}
              label="Barkod Kullanımı"
              value={
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={barcodeEnabled}
                    disabled={!isAdmin}
                    onChange={(e) => setBarcodeEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="font-medium text-slate-700">Aktif</span>
                </label>
              }
            />
            <InfoRow
              icon={<Usb size={18} className="text-slate-400" />}
              label="Bağlantı Türü"
              value={<span className="text-sm font-medium text-slate-700">USB Barkod Okuyucu</span>}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label
              className={cn(
                'flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm',
                !barcodeEnabled && 'opacity-50',
              )}
            >
              <span className="text-slate-600">Okuma Sonrası Otomatik Sepete Ekle</span>
              <input
                type="checkbox"
                checked={barcodeAutoAdd}
                disabled={!isAdmin || !barcodeEnabled}
                onChange={(e) => setBarcodeAutoAdd(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
            </label>
            <label
              className={cn(
                'flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm',
                !barcodeEnabled && 'opacity-50',
              )}
            >
              <span className="text-slate-600">Miktar Modu</span>
              <input
                type="checkbox"
                checked={barcodeQuantityMode}
                disabled={!isAdmin || !barcodeEnabled}
                onChange={(e) => setBarcodeQuantityMode(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
            </label>
            <div className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Test Barkodu</span>
              <div className="flex gap-2">
                <Input
                  placeholder="Barkod okutun..."
                  className="flex-1"
                  value={testBarcode}
                  onChange={(e) => setTestBarcode(e.target.value)}
                  disabled={!barcodeEnabled}
                />
                <Button
                  variant="outline"
                  icon={<ScanBarcode size={16} />}
                  disabled={!barcodeEnabled || !testBarcode.trim()}
                  onClick={() => setToast(`Test barkodu: ${testBarcode.trim()}`)}
                >
                  Test Et
                </Button>
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
              <Button
                icon={<Save size={16} />}
                disabled={barcodeSaving}
                onClick={() => {
                  void (async () => {
                    setBarcodeSaving(true)
                    setErrorToast(null)
                    try {
                      const updated = await updateBarcodeSettings({
                        barcodeEnabled,
                        barcodeAutoAdd,
                        barcodeQuantityMode,
                      })
                      applySettings(updated)
                      setToast('Barkod ayarları güncellendi.')
                    } catch (err) {
                      setErrorToast(
                        err instanceof ApiError ? err.message : 'Barkod ayarları kaydedilemedi.',
                      )
                    } finally {
                      setBarcodeSaving(false)
                    }
                  })()
                }}
              >
                {barcodeSaving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          )}
        </SectionCard>
      )}

      {active === 'backup' && isAdmin && (
        <>
          <SectionCard title="Veri Yedekleme">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input
                  label="Yedekleme Dizini"
                  value={backupDirectory}
                  onChange={(e) => setBackupDirectory(e.target.value)}
                  placeholder="Örn: C:\\KantinYedekleri"
                />
              </div>
              <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <span className="text-slate-600">Otomatik Yedekleme</span>
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
              </label>
              <Select
                label="Yedekleme Sıklığı"
                value={autoBackupFrequency}
                disabled={!autoBackupEnabled}
                onChange={(e) =>
                  setAutoBackupFrequency(
                    e.target.value as 'DAILY' | 'WEEKLY' | 'MONTHLY' | '',
                  )
                }
                options={[
                  { value: '', label: 'Seçin' },
                  { value: 'DAILY', label: 'Günlük' },
                  { value: 'WEEKLY', label: 'Haftalık' },
                  { value: 'MONTHLY', label: 'Aylık' },
                ]}
              />
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-brand-600 shadow-card">
                <Clock size={18} />
              </span>
              <div>
                <p className="text-xs text-slate-500">Son Yedekleme Tarihi</p>
                <p className="text-sm font-semibold text-slate-700">
                  {formatDateTime(settings?.backup.lastBackupAt)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                icon={<DatabaseBackup size={16} />}
                disabled={backupCreating}
                onClick={() => {
                  void (async () => {
                    setBackupCreating(true)
                    setErrorToast(null)
                    try {
                      await createBackup()
                      const refreshed = await fetchSettings()
                      applySettings(refreshed)
                      await refreshBackups()
                      setToast('Veritabanı yedeği oluşturuldu.')
                    } catch (err) {
                      setErrorToast(
                        err instanceof ApiError ? err.message : 'Yedek oluşturulamadı.',
                      )
                      try {
                        await refreshBackups()
                      } catch {
                        /* ignore */
                      }
                    } finally {
                      setBackupCreating(false)
                    }
                  })()
                }}
              >
                {backupCreating ? 'Yedekleniyor…' : 'Şimdi Yedekle'}
              </Button>
              <Button variant="outline" icon={<RotateCcw size={16} />} disabled title="Pasif">
                Yedeği Geri Yükle
              </Button>
              <p className="w-full text-xs text-slate-500">
                Güvenlik nedeniyle geri yükleme işlemi masaüstü bakım modunda yapılacaktır.
              </p>
            </div>

            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
              <Button
                icon={<Save size={16} />}
                disabled={backupSaving}
                onClick={() => {
                  void (async () => {
                    setBackupSaving(true)
                    setErrorToast(null)
                    try {
                      const updated = await updateBackupSettings({
                        backupDirectory: backupDirectory || null,
                        autoBackupEnabled,
                        autoBackupFrequency: autoBackupEnabled
                          ? (autoBackupFrequency as 'DAILY' | 'WEEKLY' | 'MONTHLY') || null
                          : null,
                      })
                      applySettings(updated)
                      setToast('Yedekleme ayarları güncellendi.')
                    } catch (err) {
                      setErrorToast(
                        err instanceof ApiError ? err.message : 'Yedekleme ayarları kaydedilemedi.',
                      )
                    } finally {
                      setBackupSaving(false)
                    }
                  })()
                }}
              >
                {backupSaving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Yedek Geçmişi" noPadding>
            <DataTable
              columns={backupColumns}
              data={backups}
              rowKey={(row) => row.id}
              emptyTitle="Henüz yedek kaydı yok"
              emptyDescription="Oluşturulan yedekler burada listelenir."
            />
          </SectionCard>
        </>
      )}

      {active === 'users' && isAdmin && <UserManagementSection />}

      {active === 'account' && isAdmin && (
        <SectionCard title="Şifre Değiştir">
          <div className="grid max-w-xl grid-cols-1 gap-4">
            {passwordError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {passwordSuccess}
              </div>
            )}
            <Input
              label="Mevcut Şifre"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              label="Yeni Şifre"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              label="Yeni Şifre Tekrar"
              type="password"
              placeholder="••••••••"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
            />
          </div>
          <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
            <Button
              icon={<Save size={16} />}
              disabled={passwordSaving}
              onClick={() => {
                void (async () => {
                  setPasswordSaving(true)
                  setPasswordError(null)
                  setPasswordSuccess(null)
                  try {
                    await changeOwnPassword({
                      currentPassword,
                      newPassword,
                      newPasswordConfirm,
                    })
                    setPasswordSuccess('Şifreniz başarıyla değiştirildi.')
                    setCurrentPassword('')
                    setNewPassword('')
                    setNewPasswordConfirm('')
                  } catch (err) {
                    setPasswordError(
                      err instanceof ApiError ? err.message : 'Şifre değiştirilemedi.',
                    )
                  } finally {
                    setPasswordSaving(false)
                  }
                })()
              }}
            >
              {passwordSaving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </SectionCard>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Yedeği Sil"
        message="Bu yedek kaydı ve dosyası silinecek. Devam etmek istiyor musunuz?"
        confirmLabel="Sil"
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          const id = deleteTarget.id
          setDeleteTarget(null)
          void (async () => {
            try {
              await deleteBackup(id)
              await refreshBackups()
              setToast('Yedek silindi.')
            } catch (err) {
              setErrorToast(err instanceof ApiError ? err.message : 'Yedek silinemedi.')
            }
          })()
        }}
      />
    </div>
  )
}

interface ThemeButtonProps {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}

function ThemeButton({ active, icon, label, onClick, disabled }: ThemeButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors',
        active ? 'bg-surface-card text-brand-600 shadow-card' : 'text-slate-500 hover:text-slate-700',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

interface InfoRowProps {
  icon: ReactNode
  label: string
  value: ReactNode
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2.5">
        {icon}
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      {value}
    </div>
  )
}
