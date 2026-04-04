import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { UserProfileMenu } from '@/components/UserProfileMenu'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', labelKey: 'nav.dashboard' as const, end: true as const },
  { to: '/clients', labelKey: 'nav.clients' as const },
  { to: '/leads', labelKey: 'nav.leads' as const },
  { to: '/opportunities', labelKey: 'nav.opportunities' as const },
  { to: '/insurers', labelKey: 'nav.insurers' as const },
  { to: '/campaigns', labelKey: 'nav.campaigns' as const },
] satisfies readonly { to: string; labelKey: string; end?: boolean }[]

function navLinkClassName(isActive: boolean) {
  return cn(
    'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
  )
}

export function AppLayout() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  const renderNavLinks = (onNavigate?: () => void) =>
    navItems.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) => navLinkClassName(isActive)}
      >
        {t(item.labelKey)}
      </NavLink>
    ))

  return (
    <div className="bg-background min-h-svh">
      <a
        href="#main-content"
        className="bg-background text-foreground ring-ring focus:not-sr-only sr-only focus:absolute focus:top-2 focus:left-4 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:shadow-md focus:ring-2"
      >
        {t('layout.skipToContent')}
      </a>
      <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <NavLink
              to="/"
              className="text-foreground shrink-0 text-base font-semibold tracking-tight"
              end
            >
              {t('appTitle')}
            </NavLink>
            <nav
              className="hidden items-center gap-0.5 md:flex"
              aria-label={t('layout.mainNav')}
            >
              {renderNavLinks()}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="md:hidden"
              aria-expanded={mobileNavOpen}
              aria-controls="app-mobile-nav"
              aria-label={mobileNavOpen ? t('layout.closeMenu') : t('layout.openMenu')}
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              {mobileNavOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
            {user ? <UserProfileMenu /> : null}
          </div>
        </div>
        {mobileNavOpen ? (
          <nav
            id="app-mobile-nav"
            className="border-border flex flex-col gap-0.5 border-t px-4 py-3 md:hidden"
            aria-label={t('layout.mainNav')}
          >
            {renderNavLinks()}
          </nav>
        ) : null}
      </header>
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
    </div>
  )
}
