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
import { fetchCurrentShift, type CurrentShift } from '@/services/shifts'

interface ShiftContextValue {
  currentShift: CurrentShift | null
  loading: boolean
  refreshShift: () => Promise<void>
}

const ShiftContext = createContext<ShiftContextValue | null>(null)

export function ShiftProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [currentShift, setCurrentShift] = useState<CurrentShift | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshShift = useCallback(async () => {
    if (!user) {
      setCurrentShift(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const shift = await fetchCurrentShift()
      setCurrentShift(shift)
    } catch {
      setCurrentShift(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refreshShift()
  }, [refreshShift])

  const value = useMemo(
    () => ({ currentShift, loading, refreshShift }),
    [currentShift, loading, refreshShift],
  )

  return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>
}

export function useShift(): ShiftContextValue {
  const ctx = useContext(ShiftContext)
  if (!ctx) throw new Error('useShift must be used within ShiftProvider')
  return ctx
}
