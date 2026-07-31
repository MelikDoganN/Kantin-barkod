export type UserRole = 'ADMIN' | 'PERSONNEL'

// Kod içinde yalnızca ADMIN / PERSONNEL kullanılır; ekranda gösterilen etiketler buradan gelir.
export const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Yönetici',
  PERSONNEL: 'Personel',
}

export function roleLabel(role: UserRole): string {
  return roleLabels[role]
}

// Rota bazlı erişim matrisi.
export const routePermissions: Record<string, UserRole[]> = {
  '/': ['ADMIN'],
  '/sales': ['ADMIN', 'PERSONNEL'],
  '/products': ['ADMIN'],
  '/categories': ['ADMIN', 'PERSONNEL'],
  '/inventory': ['ADMIN', 'PERSONNEL'],
  '/stock-count': ['ADMIN'],
  '/reports': ['ADMIN'],
  '/shifts': ['ADMIN', 'PERSONNEL'],
  '/day-end': ['ADMIN', 'PERSONNEL'],
  '/credit': ['ADMIN'],
  '/audit-logs': ['ADMIN'],
  '/settings': ['ADMIN', 'PERSONNEL'],
}

// Menü görünürlüğü rota izinleriyle aynı kaynaktan beslenir.
export const navigationPermissions = routePermissions

// Sayfa içi kritik yetkiler.
export type PermissionKey =
  | 'shift.create'
  | 'shift.viewAll'
  | 'dayend.viewAll'
  | 'dayend.review'
  | 'product.edit'
  | 'stock.edit'
  | 'stock.cartonOpen'
  | 'sale.cancel'
  | 'cash.adjust'

export const permissionMatrix: Record<PermissionKey, UserRole[]> = {
  'shift.create': ['ADMIN', 'PERSONNEL'],
  'shift.viewAll': ['ADMIN'],
  'dayend.viewAll': ['ADMIN'],
  'dayend.review': ['ADMIN'],
  'product.edit': ['ADMIN'],
  'stock.edit': ['ADMIN'],
  'stock.cartonOpen': ['ADMIN', 'PERSONNEL'],
  'sale.cancel': ['ADMIN'],
  'cash.adjust': ['ADMIN'],
}

export function hasRouteAccess(role: UserRole | undefined, path: string): boolean {
  if (!role) return false
  const allowed = routePermissions[path]
  // Tanımsız rota varsayılan olarak yalnızca ADMIN'e açıktır.
  if (!allowed) return role === 'ADMIN'
  return allowed.includes(role)
}

export function hasPermission(role: UserRole | undefined, permission: PermissionKey): boolean {
  if (!role) return false
  return permissionMatrix[permission].includes(role)
}

// Rol için varsayılan giriş sonrası yönlendirme.
export function defaultRouteForRole(role: UserRole): string {
  return role === 'ADMIN' ? '/' : '/sales'
}
