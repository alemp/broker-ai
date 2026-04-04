import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api'

const PIPELINE_STAGES = [
  'LEAD',
  'QUALIFIED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
  'POST_SALE',
] as const

type ClientRow = {
  id: string
  full_name: string
}

type OpportunityRow = {
  id: string
  stage: string
  status: string
  estimated_value: string | null
  client: { id: string; full_name: string }
}

type MetricsSummary = {
  by_stage: Record<string, number>
  by_owner_open: Record<string, number>
  open_total: number
}

export function OpportunitiesPage() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const [items, setItems] = useState<OpportunityRow[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [filterStage, setFilterStage] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterOwner, setFilterOwner] = useState<'all' | 'mine'>('all')

  const querySuffix = useMemo(() => {
    const p = new URLSearchParams()
    if (filterStage) {
      p.set('stage', filterStage)
    }
    if (filterStatus) {
      p.set('status', filterStatus)
    }
    if (filterOwner === 'mine' && user?.id) {
      p.set('owner_id', user.id)
    }
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [filterStage, filterStatus, filterOwner, user?.id])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [opps, cl, m] = await Promise.all([
        apiFetch<OpportunityRow[]>(`/v1/opportunities${querySuffix}`),
        apiFetch<ClientRow[]>('/v1/clients'),
        apiFetch<MetricsSummary>('/v1/opportunities/metrics/summary'),
      ])
      setItems(opps)
      setClients(cl)
      setMetrics(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoading(false)
    }
  }, [querySuffix, t])

  useEffect(() => {
    void load()
  }, [load])

  const byStage = useMemo(() => {
    const map: Record<string, OpportunityRow[]> = {}
    for (const s of PIPELINE_STAGES) {
      map[s] = []
    }
    for (const o of items) {
      const bucket = map[o.stage] ?? (map[o.stage] = [])
      bucket.push(o)
    }
    return map
  }, [items])

  const onCreate = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!user || !clientId) {
      return
    }
    setCreating(true)
    setError(null)
    try {
      await apiFetch('/v1/opportunities', {
        method: 'POST',
        json: {
          client_id: clientId,
          owner_id: user.id,
          stage: 'LEAD',
          status: 'OPEN',
          closing_probability: 10,
          next_action: 'Primeiro contacto com o cliente',
        },
      })
      setClientId('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('crm.opportunities.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('crm.opportunities.subtitle')}</p>
      </div>

      {metrics ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('crm.opportunities.metricsByStage')}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t('crm.opportunities.metricsOpen')}: <span className="text-foreground font-medium">{metrics.open_total}</span>
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            {PIPELINE_STAGES.map((s) => (
              <span key={s} className="bg-muted rounded-md px-2 py-1">
                {s}: {metrics.by_stage[s] ?? 0}
              </span>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.opportunities.new')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={onCreate}>
            <div className="grid flex-1 gap-2">
              <Label htmlFor="opp-client">{t('crm.opportunities.client')}</Label>
              <select
                id="opp-client"
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={clientId}
                onChange={(ev) => setClientId(ev.target.value)}
                required
              >
                <option value="">{t('crm.opportunities.selectClient')}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={creating || !clientId}>
              {creating ? t('crm.opportunities.creating') : t('crm.opportunities.create')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-4 sm:grid-cols-3 sm:flex-1">
            <div className="grid gap-2">
              <Label>{t('crm.opportunities.filterStage')}</Label>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={filterStage}
                onChange={(ev) => setFilterStage(ev.target.value)}
              >
                <option value="">{t('crm.opportunities.filterAll')}</option>
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>{t('crm.opportunities.filterStatus')}</Label>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={filterStatus}
                onChange={(ev) => setFilterStatus(ev.target.value)}
              >
                <option value="">{t('crm.opportunities.filterAll')}</option>
                <option value="OPEN">OPEN</option>
                <option value="WON">WON</option>
                <option value="LOST">LOST</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>{t('crm.opportunities.filterOwner')}</Label>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={filterOwner}
                onChange={(ev) => setFilterOwner(ev.target.value as 'all' | 'mine')}
              >
                <option value="all">{t('crm.opportunities.filterAll')}</option>
                <option value="mine">{t('crm.opportunities.filterMine')}</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={view === 'list' ? 'default' : 'secondary'} size="sm" onClick={() => setView('list')}>
              {t('crm.opportunities.viewList')}
            </Button>
            <Button type="button" variant={view === 'kanban' ? 'default' : 'secondary'} size="sm" onClick={() => setView('kanban')}>
              {t('crm.opportunities.viewKanban')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {t('action.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-destructive mb-4 text-sm">{error}</p> : null}
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.opportunities.empty')}</p>
          ) : view === 'list' ? (
            <ul className="divide-y rounded-md border">
              {items.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div>
                    <Link to={`/opportunities/${o.id}`} className="font-medium hover:underline">
                      {o.client.full_name}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {o.stage} · {o.status}
                      {o.estimated_value ? ` · ${o.estimated_value}` : ''}
                    </p>
                  </div>
                  <Link
                    to={`/opportunities/${o.id}`}
                    className="text-muted-foreground hover:text-foreground text-xs font-medium"
                  >
                    {t('crm.action.view')}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {PIPELINE_STAGES.map((stage) => (
                <div key={stage} className="bg-muted/40 w-[220px] shrink-0 rounded-lg border p-2">
                  <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">{stage}</p>
                  <ul className="space-y-2">
                    {(byStage[stage] ?? []).map((o) => (
                      <li key={o.id}>
                        <Link
                          to={`/opportunities/${o.id}`}
                          className="bg-background block rounded-md border px-2 py-2 text-sm shadow-sm hover:border-primary"
                        >
                          <span className="font-medium">{o.client.full_name}</span>
                          <span className="text-muted-foreground block text-xs">
                            {o.status}
                            {o.estimated_value ? ` · ${o.estimated_value}` : ''}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
