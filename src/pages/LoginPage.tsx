import { useState, type FormEvent } from 'react'
import { Store, User, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { defaultRouteForRole } from '@/config/permissions'
import { ApiError } from '@/services/api'
import { cn } from '@/utils/format'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      const loggedIn = await login(username, password)
      navigate(defaultRouteForRole(loggedIn.role), { replace: true })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Giriş yapılamadı. Lütfen tekrar deneyin.'
      setError(message)
      setLoading(false)
    }
  }

  return (
    <div className="login-screen relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#0C0C0C] px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.18),_transparent_55%)]" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-[#F97316]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-1/3 h-72 w-72 rounded-full bg-[#EA580C]/10 blur-3xl" />

      <div className="login-panel relative z-10 w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-[0_12px_40px_rgba(249,115,22,0.35)]">
            <Store size={28} />
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">Kantin POS</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)] sm:p-7"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-[#D1D5DB]">
                Kullanıcı Adı
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
                <input
                  id="username"
                  type="text"
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#111111] pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-[#6B7280] focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#D1D5DB]">
                Şifre
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#111111] pl-10 pr-11 text-sm text-white outline-none transition-colors placeholder:text-[#6B7280] focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#9CA3AF] transition-colors hover:bg-white/5 hover:text-white"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] text-sm font-semibold text-white transition-colors',
                loading ? 'cursor-not-allowed opacity-80' : 'hover:bg-[#EA580C]',
              )}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Giriş yapılıyor…
                </>
              ) : (
                'Giriş Yap'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
