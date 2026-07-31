import { NavLink } from 'react-router-dom'
import { LogOut, Store } from 'lucide-react'
import { navItems } from '@/data/navigation'
import { iconMap } from '@/utils/icons'
import { cn } from '@/utils/format'
import { useAuth } from '@/context/AuthContext'
import { roleLabel } from '@/config/permissions'

export function Sidebar() {
  const { user, logout } = useAuth()
  const visibleItems = navItems.filter((item) => !user || item.allowedRoles.includes(user.role))

  return (
    <aside
      className={cn(
        'group/sidebar relative z-30 flex h-full flex-shrink-0 flex-col overflow-hidden',
        'w-sidebar-collapsed hover:w-sidebar-expanded',
        'border-r border-white/5 bg-[#111111] text-[#D1D5DB]',
        'transition-[width] duration-sidebar ease-in-out',
      )}
    >
      <div className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-white/5 px-3.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#F97316] text-white shadow-sm">
          <Store size={18} />
        </div>
        <div className="min-w-0 overflow-hidden opacity-0 transition-opacity duration-sidebar group-hover/sidebar:opacity-100">
          <p className="truncate text-sm font-semibold text-white">Kantin POS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin px-2 py-3">
        {visibleItems.map((item) => {
          const Icon = iconMap[item.icon]
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium',
                  'transition-colors duration-150',
                  isActive
                    ? 'bg-[#F97316] text-white shadow-sm'
                    : 'text-[#D1D5DB] hover:bg-[rgba(249,115,22,0.15)] hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {Icon && (
                    <Icon
                      size={20}
                      className={cn(
                        'flex-shrink-0',
                        isActive ? 'text-white' : 'text-[#F97316]',
                      )}
                      strokeWidth={1.75}
                    />
                  )}
                  <span className="whitespace-nowrap opacity-0 transition-opacity duration-sidebar group-hover/sidebar:opacity-100">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="flex-shrink-0 border-t border-white/5 bg-[#1A1A1A] p-2">
        <div className="flex h-11 items-center gap-3 rounded-xl bg-[#111111] px-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F97316] text-sm font-semibold text-white">
            {(user?.fullName ?? 'Y').charAt(0)}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden opacity-0 transition-opacity duration-sidebar group-hover/sidebar:opacity-100">
            <p className="truncate text-sm font-medium text-white">{user?.fullName ?? 'Yönetici'}</p>
            <p className="truncate text-xs text-[#9CA3AF]">{user ? roleLabel(user.role) : 'Yönetici'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          title="Çıkış Yap"
          className="mt-1 flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#D1D5DB] transition-colors hover:bg-[rgba(249,115,22,0.15)] hover:text-white"
        >
          <LogOut size={20} className="flex-shrink-0 text-[#F97316]" strokeWidth={1.75} />
          <span className="whitespace-nowrap opacity-0 transition-opacity duration-sidebar group-hover/sidebar:opacity-100">
            Çıkış Yap
          </span>
        </button>
      </div>
    </aside>
  )
}
