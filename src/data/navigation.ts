import type { NavItem } from '@/types'
import { navigationPermissions } from '@/config/permissions'

export const navItems: NavItem[] = [
  { label: 'Ana Sayfa', path: '/', icon: 'LayoutDashboard', allowedRoles: navigationPermissions['/'] },
  { label: 'Satış', path: '/sales', icon: 'ShoppingCart', allowedRoles: navigationPermissions['/sales'] },
  { label: 'Ürünler', path: '/products', icon: 'Package', allowedRoles: navigationPermissions['/products'] },
  { label: 'Kategoriler', path: '/categories', icon: 'Tags', allowedRoles: navigationPermissions['/categories'] },
  { label: 'Stok Yönetimi', path: '/inventory', icon: 'Boxes', allowedRoles: navigationPermissions['/inventory'] },
  { label: 'Sayım', path: '/stock-count', icon: 'ClipboardList', allowedRoles: navigationPermissions['/stock-count'] },
  { label: 'Raporlar', path: '/reports', icon: 'BarChart3', allowedRoles: navigationPermissions['/reports'] },
  { label: 'Vardiyalar', path: '/shifts', icon: 'Clock', allowedRoles: navigationPermissions['/shifts'] },
  { label: 'Gün Sonu', path: '/day-end', icon: 'CalendarCheck', allowedRoles: navigationPermissions['/day-end'] },
  { label: 'Borçlar', path: '/credit', icon: 'HandCoins', allowedRoles: navigationPermissions['/credit'] },
  { label: 'İşlem Geçmişi', path: '/audit-logs', icon: 'ScrollText', allowedRoles: navigationPermissions['/audit-logs'] },
  { label: 'Ayarlar', path: '/settings', icon: 'Settings', allowedRoles: navigationPermissions['/settings'] },
]
