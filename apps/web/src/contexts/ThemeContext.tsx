import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export const THEME_STORAGE_KEY = 'ai-copilot:theme'

export type ThemePreference = 'system' | 'light' | 'dark'

function readStoredPreference(): ThemePreference {
  try {
    const s = localStorage.getItem(THEME_STORAGE_KEY)
    if (s === 'light' || s === 'dark' || s === 'system') {
      return s
    }
  } catch {
    /* private mode / quota */
  }
  return 'system'
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Applies theme to `<html>`; returns whether dark is active. */
function applyDocumentTheme(preference: ThemePreference): boolean {
  const dark = preference === 'dark' || (preference === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  return dark
}

type ThemeContextValue = {
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  resolvedDark: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [resolvedDark, setResolvedDark] = useState(() =>
    typeof window === 'undefined' ? false : applyDocumentTheme(readStoredPreference()),
  )

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, p)
    } catch {
      /* ignore */
    }
    setResolvedDark(applyDocumentTheme(p))
  }, [])

  useEffect(() => {
    if (preference !== 'system') {
      return
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      setResolvedDark(applyDocumentTheme('system'))
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  const value = useMemo(
    () => ({
      preference,
      setPreference,
      resolvedDark,
    }),
    [preference, setPreference, resolvedDark],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
