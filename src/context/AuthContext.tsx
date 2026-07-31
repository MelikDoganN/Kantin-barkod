import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { UserRole } from '@/config/permissions'
import { api, clearToken, getToken, setToken } from '@/services/api'

export interface AuthUser {
  id: number
  fullName: string
  username: string
  role: UserRole
}

interface LoginResponse {
  token: string
  user: AuthUser
}

interface MeResponse {
  user: AuthUser
}

const USER_KEY = 'kantin-pos-user'

interface AuthContextValue {
  user: AuthUser | null
  initializing: boolean
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function persistUser(user: AuthUser | null): void {
  try {
    if (user) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      sessionStorage.removeItem(USER_KEY)
    }
  } catch {
    /* ignore storage errors */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser)
  const [initializing, setInitializing] = useState(true)

  // Uygulama açılışında token varsa oturumu backend'den doğrula.
  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const token = getToken()
      if (!token) {
        setInitializing(false)
        return
      }

      try {
        const data = await api.get<MeResponse>('/auth/me')
        if (!cancelled) {
          setUser(data.user)
          persistUser(data.user)
        }
      } catch {
        if (!cancelled) {
          clearToken()
          persistUser(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setInitializing(false)
        }
      }
    }

    void restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const data = await api.post<LoginResponse>('/auth/login', { username, password })
    setToken(data.token)
    persistUser(data.user)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    clearToken()
    persistUser(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, initializing, login, logout }),
    [user, initializing, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
