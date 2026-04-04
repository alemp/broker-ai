import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { getApiBaseUrl } from '@/lib/api'

type ApiState = 'loading' | 'ok' | 'error'

export function DashboardPage() {
  const { t } = useTranslation('common')
  const { user, logout } = useAuth()
  const [state, setState] = useState<ApiState>('loading')

  const loadHealth = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/health`)
      if (!response.ok) {
        setState('error')
        return
      }
      const body: unknown = await response.json()
      if (
        typeof body === 'object' &&
        body !== null &&
        'status' in body &&
        (body as { status: string }).status === 'ok'
      ) {
        setState('ok')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => {
    void loadHealth()
  }, [loadHealth])

  const onRefresh = () => {
    setState('loading')
    void loadHealth()
  }

  const statusLabel =
    state === 'loading' ? t('apiStatus.checking') : state === 'ok' ? t('apiStatus.ok') : t('apiStatus.error')

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('appTitle')}</h1>
        <p className="text-muted-foreground text-sm">{t('dashboard.welcome', { email: user?.email ?? '' })}</p>
        <p className="text-muted-foreground text-xs">
          {t('dashboard.organization', {
            name: user?.organization.name ?? '',
            slug: user?.organization.slug ?? '',
          })}
        </p>
      </div>
      <div className="flex flex-col items-center gap-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm" data-testid="api-status">
          {statusLabel}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="secondary" onClick={onRefresh}>
            {t('action.refresh')}
          </Button>
          <Button type="button" variant="outline" onClick={logout}>
            {t('auth.logout')}
          </Button>
        </div>
      </div>
    </main>
  )
}
