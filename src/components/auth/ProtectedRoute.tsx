import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/config/permissions'
import { AccessDeniedPage } from '@/pages/AccessDeniedPage'

interface ProtectedRouteProps {
  allowedRoles: UserRole[]
  children: ReactNode
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { user } = useAuth()

  // Oturum yoksa login'e dön (ekstra güvenlik; App zaten oturumsuz durumu ele alır).
  if (!user) return <Navigate to="/" replace />

  // Rol yetkisizse route seviyesinde erişim engellenir.
  if (!allowedRoles.includes(user.role)) return <AccessDeniedPage />

  return <>{children}</>
}
