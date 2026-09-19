export const THEME_STORAGE_KEY = 'datavisTheme'

const VALID_THEMES = new Set(['light', 'dark'])

const getSystemTheme = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const getStoredTheme = () => {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return VALID_THEMES.has(stored) ? stored : null
}

export const getPreferredTheme = () => getStoredTheme() || 'light'

export const applyTheme = (theme) => {
  if (typeof document === 'undefined') return 'light'

  const resolvedTheme = VALID_THEMES.has(theme) ? theme : 'light'
  const root = document.documentElement

  root.classList.toggle('dark', resolvedTheme === 'dark')
  root.dataset.theme = resolvedTheme
  root.style.colorScheme = resolvedTheme

  return resolvedTheme
}

export const setThemePreference = (theme) => {
  const resolvedTheme = applyTheme(theme)

  if (typeof window !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme)
    window.dispatchEvent(new Event('themechange'))
  }

  return resolvedTheme
}

export const initializeTheme = () => {
  return applyTheme(getPreferredTheme())
}

export const getCurrentTheme = () => {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}
