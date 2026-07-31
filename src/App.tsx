import { Routes, Route } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { LoginPage } from '@/pages/LoginPage'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { routePermissions } from '@/config/permissions'
import { DashboardPage } from '@/pages/DashboardPage'
import { SalesPage } from '@/pages/SalesPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { CategoriesPage } from '@/pages/CategoriesPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { StockCountPage } from '@/pages/StockCountPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { ShiftsPage } from '@/pages/ShiftsPage'
import { DayEndPage } from '@/pages/DayEndPage'
import { CreditPage } from '@/pages/CreditPage'
import { AuditLogsPage } from '@/pages/AuditLogsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import type { ReactElement } from 'react'

function guarded(path: string, element: ReactElement) {
  return <ProtectedRoute allowedRoles={routePermissions[path]}>{element}</ProtectedRoute>
}

export default function App() {
  const { user, initializing } = useAuth()

  if (initializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={guarded('/', <DashboardPage />)} />
        <Route path="/sales" element={guarded('/sales', <SalesPage />)} />
        <Route path="/products" element={guarded('/products', <ProductsPage />)} />
        <Route path="/categories" element={guarded('/categories', <CategoriesPage />)} />
        <Route path="/inventory" element={guarded('/inventory', <InventoryPage />)} />
        <Route path="/stock-count" element={guarded('/stock-count', <StockCountPage />)} />
        <Route path="/reports" element={guarded('/reports', <ReportsPage />)} />
        <Route path="/shifts" element={guarded('/shifts', <ShiftsPage />)} />
        <Route path="/day-end" element={guarded('/day-end', <DayEndPage />)} />
        <Route path="/credit" element={guarded('/credit', <CreditPage />)} />
        <Route path="/audit-logs" element={guarded('/audit-logs', <AuditLogsPage />)} />
        <Route path="/settings" element={guarded('/settings', <SettingsPage />)} />
      </Route>
    </Routes>
  )
}
