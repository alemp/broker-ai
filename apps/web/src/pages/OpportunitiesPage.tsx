import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { CrmListCardHeader } from '@/components/CrmListCardHeader'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePersistedListViewMode } from '@/hooks/usePersistedListViewMode'
import { apiFetch } from '@/lib/api'
import {
  translateOpportunityStage,
  translateOpportunityStatus,
} from '@/lib/crmEnumLabels'
import { formatCurrency } from '@/lib/money'
import { cn } from '@/lib/utils'

const LIST_VIEW_STORAGE_KEY = 'ai-copilot:list-view:opportunities'

type OpportunityRow = {
  id: string
  stage: string
  status: string
  estimated_value: string | null
  client: { id: string; full_name: string } | null
  lead: { id: string; full_name: string; email: string | null } | null
}

type MetricsSummary = {
  by_stage: Record<string, number>
  by_owner_open: Record<string, number>
  open_total: number
}

const PIPELINE_STAGES = [
  'LEAD',
  'QUALIFIED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
  'POST_SALE',
] as const

export function OpportunitiesPage() {
  const { t, i18n } = useTranslation('common')
  const { user } = useAuth()
  const [items, setItems] = useState<OpportunityRow[]>([])
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = usePersistedListViewMode(LIST_VIEW_STORAGE_KEY)
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

  const partyLabel = (o: OpportunityRow) => o.client?.full_name ?? o.lead?.full_name ?? '—'
  const money = useMemo(
    () => ({
      locale: i18n.resolvedLanguage ?? 'pt',
      currency: user?.organization.currency ?? 'BRL',
    }),
    [i18n.resolvedLanguage, user?.organization.currency],
  )

  const filterRow = (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="grid gap-2">
        <Label htmlFor="opp-filter-stage">{t('crm.opportunities.filterStage')}</Label>
        <FormSelect
          id="opp-filter-stage"
          value={filterStage}
          onValueChange={setFilterStage}
          allowEmpty
          emptyLabel={t('crm.opportunities.filterAll')}
          placeholder={t('crm.opportunities.filterAll')}
          options={PIPELINE_STAGES.map((s) => ({
            value: s,
            label: translateOpportunityStage(s, t),
          }))}
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
            { value: 'OPEN', label: translateOpportunityStatus('OPEN', t) },
            { value: 'WON', label: translateOpportunityStatus('WON', t) },
            { value: 'LOST', label: translateOpportunityStatus('LOST', t) },
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
    </div>
  )

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
              {t('crm.opportunities.metricsOpen')}:{' '}
              <span className="text-foreground font-medium">{metrics.open_total}</span>
              <span className="mt-1 block">{t('crm.opportunities.metricsStageFilterHint')}</span>
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            {PIPELINE_STAGES.map((s) => {
              const count = metrics.by_stage[s] ?? 0
              const selected = filterStage === s
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilterStage((prev) => (prev === s ? '' : s))}
                  className={cn(
                    'rounded-md border border-transparent px-2 py-1 transition-colors',
                    'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground hover:bg-muted/80',
                  )}
                >
                  {translateOpportunityStage(s, t)}: {count}
                </button>
              )
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CrmListCardHeader
          listTitle={t('crm.opportunities.list')}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={load}
          loading={loading}
          searchId="opp-list-search"
          searchValue={listSearch}
          onSearchChange={setListSearch}
          searchPlaceholder={t('crm.opportunities.listSearch')}
          searchAriaLabel={t('crm.opportunities.listSearchAria')}
          beforeSearch={filterRow}
        />
        <CardContent>
          {error ? <p className="text-destructive mb-4 text-sm">{error}</p> : null}
          {loading ? (
            viewMode === 'table' ? (
              <div className="space-y-2" aria-busy="true" aria-label={t('auth.loading')}>
                <div className="flex gap-2 border-b px-3 py-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="ml-auto h-3 w-14" />
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-2 border-b px-3 py-3 last:border-0">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="ml-auto h-4 w-14" />
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                aria-busy="true"
                aria-label={t('auth.loading')}
              >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="border-border/80 flex flex-col gap-3 rounded-xl border p-4">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <div className="flex justify-end border-t border-border/60 pt-3">
                      <Skeleton className="h-7 w-14" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.opportunities.empty')}</p>
          ) : viewMode === 'table' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('crm.opportunities.tableParty')}</TableHead>
                  <TableHead>{t('crm.opportunities.filterStage')}</TableHead>
                  <TableHead>{t('crm.opportunities.tableOppStatus')}</TableHead>
                  <TableHead>{t('crm.opportunities.tableValue')}</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-right">
                    {t('crm.clients.tableActions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      <Link to={`/opportunities/${o.id}`} className="hover:underline">
                        {partyLabel(o)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {translateOpportunityStage(o.stage, t)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {translateOpportunityStatus(o.status, t)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.estimated_value ? formatCurrency(o.estimated_value, money) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/opportunities/${o.id}`}>{t('crm.action.view')}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((o) => (
                <li key={o.id}>
                  <Card className="border-border/80 h-full shadow-sm transition-shadow hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Link
                          to={`/opportunities/${o.id}`}
                          className="text-foreground line-clamp-2 text-base font-semibold hover:underline"
                        >
                          {partyLabel(o)}
                        </Link>
                        <dl className="text-muted-foreground space-y-1 text-sm">
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <dt className="text-foreground/80 font-medium">
                              {t('crm.opportunities.filterStage')}
                            </dt>
                            <dd>{translateOpportunityStage(o.stage, t)}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <dt className="text-foreground/80 font-medium">
                              {t('crm.opportunities.tableOppStatus')}
                            </dt>
                            <dd>{translateOpportunityStatus(o.status, t)}</dd>
                          </div>
                          {o.estimated_value ? (
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                              <dt className="text-foreground/80 font-medium">
                                {t('crm.opportunities.tableValue')}
                              </dt>
                              <dd>{formatCurrency(o.estimated_value, money)}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                      <div className="flex justify-end border-t border-border/60 pt-3">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/opportunities/${o.id}`}>{t('crm.action.view')}</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
