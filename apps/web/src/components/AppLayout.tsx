import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export function AppLayout() {
  const { t } = useTranslation('common')
  const { user, logout } = useAuth()

  const linkClass = 'text-muted-foreground hover:text-foreground text-sm font-medium transition-colors'

  return (
    <div className="bg-background min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav className="flex flex-wrap items-center gap-4">
            <Link to="/" className={linkClass}>
              {t('nav.dashboard')}
            </Link>
            <Link to="/clients" className={linkClass}>
              {t('nav.clients')}
            </Link>
            <Link to="/leads" className={linkClass}>
              {t('nav.leads')}
            </Link>
            <Link to="/opportunities" className={linkClass}>
              {t('nav.opportunities')}
            </Link>
            <Link to="/insurers" className={linkClass}>
              {t('nav.insurers')}
            </Link>
            <Link to="/campaigns" className={linkClass}>
              {t('nav.campaigns')}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground hidden text-xs sm:inline">{user?.email}</span>
            <Button type="button" variant="outline" size="sm" onClick={logout}>
              {t('auth.logout')}
            </Button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
