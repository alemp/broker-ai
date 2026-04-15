import { ChevronDown, Menu, ScrollText, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DropdownMenu } from 'radix-ui'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { UserProfileMenu } from '@/components/UserProfileMenu'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const mainNavItems = [
  { to: '/', labelKey: 'nav.dashboard' as const, end: true as const },
  { to: '/leads', labelKey: 'nav.leads' as const },
  { to: '/clients', labelKey: 'nav.clients' as const },
  { to: '/opportunities', labelKey: 'nav.opportunities' as const },
] satisfies readonly { to: string; labelKey: string; end?: boolean }[]

const adminNavItems = [
  { to: '/users', labelKey: 'nav.users' as const, adminOnly: true as const },
  { to: '/insurers', labelKey: 'nav.insurers' as const },
  { to: '/products', labelKey: 'nav.products' as const },
  { to: '/campaigns', labelKey: 'nav.campaigns' as const },
] satisfies readonly { to: string; labelKey: string; adminOnly?: boolean }[]

const adminDropdownItemClass = cn(
  'focus:bg-accent focus:text-accent-foreground relative flex cursor-default select-none items-center rounded-sm py-1.5 pr-2 pl-2 text-sm outline-none',
  'data-disabled:pointer-events-none data-disabled:opacity-50',
)

const adminDropdownContentClass = cn(
  'bg-popover text-popover-foreground z-50 min-w-[10rem] overflow-hidden rounded-md border p-1 shadow-md',
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
)

function navLinkClassName(isActive: boolean) {
  return cn(
    'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
  )
}

function isAdminPath(pathname: string) {
  return (
    pathname === '/users' ||
    pathname === '/insurers' ||
    pathname.startsWith('/insurers/') ||
    pathname === '/products' ||
    pathname.startsWith('/products/') ||
    pathname === '/campaigns' ||
    pathname.startsWith('/campaigns/')
  )
}

export function AppLayout() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const adminSectionActive = isAdminPath(location.pathname)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  const renderMainNavLinks = (onNavigate?: () => void) =>
    mainNavItems.map((item) => (
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

  const renderAdminNavLinks = (onNavigate?: () => void) =>
    adminNavItems
      .filter((item) => !item.adminOnly || user?.role === 'ADMIN')
      .map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        className={({ isActive }) => navLinkClassName(isActive)}
      >
        {t(item.labelKey)}
      </NavLink>
      ))

  const renderDesktopNav = () => (
    <>
      {renderMainNavLinks()}
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
              adminSectionActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
          >
            {t('nav.administration')}
            <ChevronDown className="text-muted-foreground size-3.5 shrink-0 opacity-70" aria-hidden />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={adminDropdownContentClass}
            sideOffset={6}
            align="start"
            collisionPadding={12}
          >
            {adminNavItems.map((item) => (
              (item.adminOnly && user?.role !== 'ADMIN') ? null : (
              <DropdownMenu.Item key={item.to} asChild>
                <NavLink
                  to={item.to}
                  className={adminDropdownItemClass}
                >
                  {t(item.labelKey)}
                </NavLink>
              </DropdownMenu.Item>
              )
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  )

  const renderMobileNav = () => (
    <>
      {renderMainNavLinks(() => setMobileNavOpen(false))}
      <div
        className="border-border mt-1 flex flex-col gap-0.5 border-t pt-2"
        role="group"
        aria-label={t('nav.administration')}
      >
        <span className="text-muted-foreground px-2.5 py-1 text-xs font-medium tracking-wide uppercase">
          {t('nav.administration')}
        </span>
        <div className="flex flex-col gap-0.5 pl-1">{renderAdminNavLinks(() => setMobileNavOpen(false))}</div>
      </div>
    </>
  )

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
              {renderDesktopNav()}
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
            {user ? (
              <>
                <Button
                  asChild
                  variant="outline"
                  size="icon-sm"
                  aria-label={t('releaseNotes.navButtonAria')}
                >
                  <Link to="/release-notes">
                    <ScrollText className="size-4" aria-hidden />
                  </Link>
                </Button>
                <UserProfileMenu />
              </>
            ) : null}
          </div>
        </div>
        {mobileNavOpen ? (
          <nav
            id="app-mobile-nav"
            className="border-border flex flex-col gap-0.5 border-t px-4 py-3 md:hidden"
            aria-label={t('layout.mainNav')}
          >
            {renderMobileNav()}
          </nav>
        ) : null}
      </header>
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
    </div>
  )
}
