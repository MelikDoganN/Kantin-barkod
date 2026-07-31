import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopHeader } from './TopHeader'

export function AppLayout() {
  return (
    <div className="app-theme flex h-screen w-screen overflow-hidden bg-surface">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col transition-[flex-basis] duration-sidebar ease-in-out">
        <TopHeader />
        <main className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4 pt-3 sm:px-6 sm:pb-5 sm:pt-3">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
