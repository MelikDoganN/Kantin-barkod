import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/context/AuthContext'
import { fetchSettings } from '@/services/settings'
import {
  applyDocumentTheme,
  normalizeTheme,
  readStoredTheme,
  type AppTheme,
} from '@/theme/theme'

interface ThemeContextValue {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth()
  const [theme, setThemeState] = useState<AppTheme>(() => readStoredTheme())

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next)
    applyDocumentTheme(next)
  }, [])

  useEffect(() => {
    applyDocumentTheme(theme)
  }, [theme])

  useEffect(() => {
    if (initializing || !user) return

    let cancelled = false
    void fetchSettings()
      .then((settings) => {
        if (cancelled) return
        setTheme(normalizeTheme(settings.system.theme))
      })
      .catch(() => {
        /* keep cached theme */
      })

    return () => {
      cancelled = true
    }
  }, [user, initializing, setTheme])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
