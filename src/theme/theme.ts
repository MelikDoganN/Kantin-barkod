export type AppTheme = 'LIGHT' | 'DARK'

export const THEME_STORAGE_KEY = 'kantin-pos-theme'

export function normalizeTheme(value: string | null | undefined): AppTheme {
  return value === 'DARK' ? 'DARK' : 'LIGHT'
}

export function readStoredTheme(): AppTheme {
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'LIGHT'
  }
}

export function applyDocumentTheme(theme: AppTheme): void {
  const mode = theme === 'DARK' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', mode)
  document.documentElement.style.colorScheme = mode
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}
