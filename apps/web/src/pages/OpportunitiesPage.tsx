import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
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
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [filterStage, setFilterStage] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterOwner, setFilterOwner] = useState<'all' | 'mine'>('all')
  const [listSearch, setListSearch] = useState('')
  const debouncedListSearch = useDebouncedValue(listSearch, 350)

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
    const q = debouncedListSearch.trim()
    if (q) {
      p.set('q', q)
    }
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [filterStage, filterStatus, filterOwner, user?.id, debouncedListSearch])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [opps, m] = await Promise.all([
        apiFetch<OpportunityRow[]>(`/v1/opportunities${querySuffix}`),
        apiFetch<MetricsSummary>('/v1/opportunities/metrics/summary'),
      ])
      setItems(opps)
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

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        title={t('crm.opportunities.title')}
        description={t('crm.opportunities.subtitle')}
      >
        <Button asChild>
          <Link to="/opportunities/new">{t('action.newRecord')}</Link>
        </Button>
      </PageHeader>

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
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-4 sm:grid-cols-3 sm:flex-1">
            <div className="grid gap-2">
              <Label htmlFor="opp-filter-stage">{t('crm.opportunities.filterStage')}</Label>
              <FormSelect
                id="opp-filter-stage"
                value={filterStage}
                onValueChange={setFilterStage}
                allowEmpty
                emptyLabel={t('crm.opportunities.filterAll')}
                placeholder={t('crm.opportunities.filterAll')}
                options={PIPELINE_STAGES.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opp-filter-status">{t('crm.opportunities.filterStatus')}</Label>
              <FormSelect
                id="opp-filter-status"
                value={filterStatus}
                onValueChange={setFilterStatus}
                allowEmpty
                emptyLabel={t('crm.opportunities.filterAll')}
                placeholder={t('crm.opportunities.filterAll')}
                options={[
                  { value: 'OPEN', label: 'OPEN' },
                  { value: 'WON', label: 'WON' },
                  { value: 'LOST', label: 'LOST' },
                ]}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opp-filter-owner">{t('crm.opportunities.filterOwner')}</Label>
              <FormSelect
                id="opp-filter-owner"
                value={filterOwner}
                onValueChange={(v) => setFilterOwner(v as 'all' | 'mine')}
                options={[
                  { value: 'all', label: t('crm.opportunities.filterAll') },
                  { value: 'mine', label: t('crm.opportunities.filterMine') },
                ]}
              />
            </div>
            <div className="grid gap-2 sm:col-span-3">
              <Label htmlFor="opp-list-search" className="sr-only">
                {t('crm.opportunities.listSearchAria')}
              </Label>
              <Input
                id="opp-list-search"
                type="search"
                value={listSearch}
                onChange={(ev) => setListSearch(ev.target.value)}
                placeholder={t('crm.opportunities.listSearch')}
                aria-label={t('crm.opportunities.listSearchAria')}
                autoComplete="off"
              />
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
            <div className="space-y-2 rounded-md border p-2" aria-busy="true" aria-label={t('auth.loading')}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-2 py-2">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-52" />
                  </div>
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
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
    </div>
  )
}
