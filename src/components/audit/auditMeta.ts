import {
  ShoppingCart,
  Boxes,
  Package,
  Clock,
  CalendarCheck,
  ClipboardList,
  HandCoins,
  Utensils,
  Users,
  Settings,
  ShieldCheck,
  History,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { BadgeTone } from '@/types'

interface ModuleMeta {
  label: string
  icon: LucideIcon
  tone: BadgeTone
}

const MODULE_BY_KEY: Record<string, ModuleMeta> = {
  SALE: { label: 'Satış', icon: ShoppingCart, tone: 'info' },
  SALES: { label: 'Satış', icon: ShoppingCart, tone: 'info' },
  STOCK: { label: 'Stok', icon: Boxes, tone: 'violet' },
  INVENTORY: { label: 'Stok Yönetimi', icon: Boxes, tone: 'violet' },
  PRODUCT: { label: 'Ürün Yönetimi', icon: Package, tone: 'info' },
  CATEGORY: { label: 'Kategori', icon: Package, tone: 'info' },
  SHIFT: { label: 'Vardiya', icon: Clock, tone: 'warning' },
  DAY_END: { label: 'Gün Sonu', icon: CalendarCheck, tone: 'success' },
  DAYEND: { label: 'Gün Sonu', icon: CalendarCheck, tone: 'success' },
  COUNT: { label: 'Sayım', icon: ClipboardList, tone: 'violet' },
  CREDIT: { label: 'Borç', icon: HandCoins, tone: 'warning' },
  PERSONNEL_CONSUMPTION: { label: 'Personel Tüketimi', icon: Utensils, tone: 'violet' },
  CONSUMPTION: { label: 'Personel Tüketimi', icon: Utensils, tone: 'violet' },
  USER: { label: 'Personel', icon: Users, tone: 'info' },
  PERSONNEL: { label: 'Personel', icon: Users, tone: 'info' },
  SETTINGS: { label: 'Ayarlar', icon: Settings, tone: 'neutral' },
  AUTH: { label: 'Giriş / Güvenlik', icon: ShieldCheck, tone: 'neutral' },
  BACKUP: { label: 'Yedekleme', icon: History, tone: 'neutral' },
  CASH: { label: 'Kasa', icon: Wallet, tone: 'warning' },
  // legacy lowercase mock keys
  sales: { label: 'Satış', icon: ShoppingCart, tone: 'info' },
  stock: { label: 'Stok', icon: Boxes, tone: 'violet' },
  product: { label: 'Ürün Yönetimi', icon: Package, tone: 'info' },
  shift: { label: 'Vardiya', icon: Clock, tone: 'warning' },
  dayend: { label: 'Gün Sonu', icon: CalendarCheck, tone: 'success' },
  count: { label: 'Sayım', icon: ClipboardList, tone: 'violet' },
  credit: { label: 'Borç', icon: HandCoins, tone: 'warning' },
  consumption: { label: 'Personel Tüketimi', icon: Utensils, tone: 'violet' },
  personnel: { label: 'Personel', icon: Users, tone: 'info' },
  settings: { label: 'Ayarlar', icon: Settings, tone: 'neutral' },
  auth: { label: 'Giriş / Güvenlik', icon: ShieldCheck, tone: 'neutral' },
}

const DEFAULT_META: ModuleMeta = {
  label: 'Diğer',
  icon: History,
  tone: 'neutral',
}

export function resolveModuleMeta(module: string): ModuleMeta {
  return MODULE_BY_KEY[module] ?? MODULE_BY_KEY[module.toUpperCase()] ?? {
    ...DEFAULT_META,
    label: module,
  }
}

/** @deprecated use resolveModuleMeta — kept for compatibility */
export const moduleMeta = new Proxy({} as Record<string, ModuleMeta>, {
  get: (_target, prop: string) => resolveModuleMeta(prop),
})

const ACTION_LABELS: Record<string, string> = {
  SALE: 'Satış',
  CREATE: 'Oluşturma',
  CREATE_USER: 'Kullanıcı Oluşturma',
  UPDATE_USER: 'Kullanıcı Güncelleme',
  UPDATE_STATUS: 'Durum Değiştirme',
  RESET_PASSWORD: 'Şifre Sıfırlama',
  CHANGE_PASSWORD: 'Şifre Değiştirme',
  LOGIN: 'Giriş',
  FAILED_LOGIN: 'Başarısız Giriş',
  CREATE_DEBT_CUSTOMER: 'Borçlu Oluşturma',
  PURCHASE: 'Mal Kabul',
  CARTON_OPEN: 'Koli Açma',
  INITIAL_STOCK_LOAD: 'İlk Stok Girişi',
  WASTE: 'Fire',
  SHIFT_OPEN: 'Vardiya Açma',
  SHIFT_CLOSE: 'Vardiya Kapatma',
  DAY_END_CREATE: 'Gün Sonu',
  PAYMENT: 'Tahsilat',
  CANCEL: 'Satış İptali',
  CASH_ADJUSTMENT: 'Kasa Düzeltme',
  COUNT_START: 'Sayım Başlatma',
  COUNT_COMPLETE: 'Sayım Tamamlama',
  COUNT_ADJUSTMENT: 'Sayım Düzeltme',
  UPDATE_BUSINESS_SETTINGS: 'İşletme Ayarları',
  UPDATE_SYSTEM_SETTINGS: 'Sistem Ayarları',
  UPDATE_BARCODE_SETTINGS: 'Barkod Ayarları',
  UPDATE_BACKUP_SETTINGS: 'Yedekleme Ayarları',
  UPDATE_LOGO: 'Logo Güncelleme',
  CREATE_BACKUP: 'Yedek Oluşturma',
  FAILED_CREATE_BACKUP: 'Başarısız Yedek',
  DELETE_BACKUP: 'Yedek Silme',
  CREATE_CATEGORY: 'Kategori Oluşturma',
  UPDATE_CATEGORY: 'Kategori Güncelleme',
  UPDATE_CATEGORY_STATUS: 'Kategori Durumu',
  DELETE_CATEGORY: 'Kategori Silme',
  create: 'Oluşturma',
  update: 'Güncelleme',
  delete: 'Silme / Pasife Alma',
  sale: 'Satış',
  collect: 'Tahsilat',
  shiftOpen: 'Vardiya Açma',
  shiftClose: 'Vardiya Kapatma',
  login: 'Giriş',
  logout: 'Çıkış',
}

export function resolveActionLabel(actionType: string): string {
  return ACTION_LABELS[actionType] ?? ACTION_LABELS[actionType.toUpperCase()] ?? actionType
}

/** @deprecated use resolveActionLabel */
export const actionTypeLabels = new Proxy({} as Record<string, string>, {
  get: (_target, prop: string) => resolveActionLabel(prop),
})

export function logTone(module: string, actionType: string): BadgeTone {
  const upper = actionType.toUpperCase()
  if (upper.includes('FAILED') || upper.includes('DELETE')) return 'danger'
  if (upper.includes('LOGIN') || upper.includes('LOGOUT')) return 'neutral'
  return resolveModuleMeta(module).tone
}
