import { Toaster } from 'sonner'

import { useTheme } from '@/contexts/ThemeContext'

export function ThemedToaster() {
  const { resolvedDark } = useTheme()

  return <Toaster richColors position="top-center" closeButton theme={resolvedDark ? 'dark' : 'light'} />
}
