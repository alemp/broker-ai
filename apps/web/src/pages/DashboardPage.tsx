import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { apiFetch, getApiBaseUrl } from '@/lib/api'
import { translateInteractionType, translateOpportunityStage } from '@/lib/crmEnumLabels'

type ApiState = 'loading' | 'ok' | 'error'

type OverdueOppRow = {
  id: string
  stage: string
  next_action: string | null
  next_action_due_at: string | null
  client: { full_name: string }
}

type TodayInteractionRow = {
  id: string
  interaction_type: string
  summary: string
  occurred_at: string
  client_id: string | null
  lead_id: string | null
  opportunity_id: string | null
}

function todayIxPartyLink(row: TodayInteractionRow): { to: string; labelKey: string } | null {
  if (row.client_id) {
    return { to: `/clients/${row.client_id}`, labelKey: 'crm.dashboard.openClient' }
  }
  if (row.lead_id) {
    return { to: `/leads/${row.lead_id}`, labelKey: 'crm.dashboard.openLead' }
  }
  if (row.opportunity_id) {
    return { to: `/opportunities/${row.opportunity_id}`, labelKey: 'crm.dashboard.openOpportunity' }
  }
  return null
}

export function DashboardPage() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const [state, setState] = useState<ApiState>('loading')
  const [overdue, setOverdue] = useState<OverdueOppRow[]>([])
  const [todayIx, setTodayIx] = useState<TodayInteractionRow[]>([])
  const [panelLoading, setPanelLoading] = useState(true)

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

  const loadTodayPanel = useCallback(async () => {
    setPanelLoading(true)
    try {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date()
      end.setHours(23, 59, 59, 999)
      const from = encodeURIComponent(start.toISOString())
      const to = encodeURIComponent(end.toISOString())
      const [od, ix] = await Promise.all([
        apiFetch<OverdueOppRow[]>('/v1/opportunities?overdue_next_action=true&limit=30'),
        apiFetch<TodayInteractionRow[]>(`/v1/interactions?occurred_from=${from}&occurred_to=${to}&limit=50`),
      ])
      setOverdue(od)
      setTodayIx(ix)
    } catch {
      setOverdue([])
      setTodayIx([])
    } finally {
      setPanelLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHealth()
  }, [loadHealth])

  useEffect(() => {
    void loadTodayPanel()
  }, [loadTodayPanel])

  const onRefresh = () => {
    setState('loading')
    void loadHealth()
    void loadTodayPanel()
  }

  const statusLabel =
    state === 'loading' ? t('apiStatus.checking') : state === 'ok' ? t('apiStatus.ok') : t('apiStatus.error')

  const statusDotClass =
    state === 'loading'
      ? 'bg-muted-foreground animate-pulse'
      : state === 'ok'
        ? 'bg-emerald-600 dark:bg-emerald-500'
        : 'bg-destructive'

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        title={t('appTitle')}
        description={t('dashboard.welcome', { email: user?.email ?? '' })}
      >
        <Button type="button" variant="secondary" size="sm" onClick={onRefresh}>
          {t('action.refresh')}
        </Button>
      </PageHeader>
      <p className="text-muted-foreground -mt-4 text-xs sm:-mt-6">
        {t('dashboard.organization', {
          name: user?.organization.name ?? '',
          slug: user?.organization.slug ?? '',
        })}
      </p>
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {t('dashboard.systemStatus')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn('size-2 shrink-0 rounded-full', statusDotClass)}
            aria-hidden
          />
          <p className="text-sm font-medium" data-testid="api-status">
            {statusLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/clients">{t('nav.clients')}</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/opportunities">{t('nav.opportunities')}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="text-base font-semibold">{t('crm.dashboard.overdueTitle')}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{t('crm.dashboard.overdueSubtitle')}</p>
          {panelLoading ? (
            <div className="mt-4 space-y-3" aria-busy="true" aria-label={t('auth.loading')}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2 border-b pb-3 last:border-0">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : overdue.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">{t('crm.dashboard.overdueEmpty')}</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {overdue.map((o) => (
                <li key={o.id} className="border-b pb-3 last:border-0">
                  <Link to={`/opportunities/${o.id}`} className="font-medium text-primary hover:underline">
                    {o.client.full_name}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {translateOpportunityStage(o.stage, t)}
                    {o.next_action_due_at
                      ? ` · ${new Date(o.next_action_due_at).toLocaleString()}`
                      : ''}
                  </p>
                  {o.next_action ? <p className="mt-1">{o.next_action}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="text-base font-semibold">{t('crm.dashboard.todayIxTitle')}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{t('crm.dashboard.todayIxSubtitle')}</p>
          {panelLoading ? (
            <div className="mt-4 space-y-3" aria-busy="true" aria-label={t('auth.loading')}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2 border-b pb-3 last:border-0">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : todayIx.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">{t('crm.dashboard.todayIxEmpty')}</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {todayIx.map((row) => {
                const partyLink = todayIxPartyLink(row)
                return (
                  <li key={row.id} className="border-b pb-3 last:border-0">
                    <div className="font-medium">
                      {translateInteractionType(row.interaction_type, t)}{' '}
                      <span className="text-muted-foreground font-normal">
                        · {new Date(row.occurred_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2">{row.summary}</p>
                    {partyLink ? (
                      <Link
                        to={partyLink.to}
                        className="text-primary mt-1 inline-block text-xs hover:underline"
                      >
                        {t(partyLink.labelKey)}
                      </Link>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
