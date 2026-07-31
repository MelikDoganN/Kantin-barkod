import { useNavigate } from 'react-router-dom'
import { ShieldAlert, Home, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { defaultRouteForRole } from '@/config/permissions'

export function AccessDeniedPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isPersonnel = user?.role === 'PERSONNEL'

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="flex max-w-md flex-col items-center rounded-card border border-slate-200 bg-white p-10 text-center shadow-card">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
          <ShieldAlert size={32} />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-slate-800">Bu sayfaya erişim yetkiniz yok.</h1>
        <div className="mt-6">
          {isPersonnel ? (
            <Button icon={<ShoppingCart size={18} />} onClick={() => navigate('/sales')}>
              Satış Ekranına Dön
            </Button>
          ) : (
            <Button icon={<Home size={18} />} onClick={() => navigate(defaultRouteForRole(user?.role ?? 'ADMIN'))}>
              Ana Sayfaya Dön
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
