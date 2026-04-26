import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { CrmListCardHeader } from '@/components/CrmListCardHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePersistedListViewMode } from '@/hooks/usePersistedListViewMode'
import { apiFetch } from '@/lib/api'
import {
  translateOpportunityStage,
  translateOpportunityStatus,
} from '@/lib/crmEnumLabels'
import { formatCurrency } from '@/lib/money'
import { useAuth } from '@/contexts/AuthContext'
export type PartyOppRow = {
  id: string
  stage: string
  status: string
  estimated_value: string | null
  product: { id: string; name: string } | null
  next_action: string | null
  closing_probability: number
  updated_at: string
}

export type PartyOpportunitiesCardProps = {
  party: { type: 'client'; id: string } | { type: 'lead'; id: string }
  /** localStorage key for table vs cards preference */
  viewStorageKey: string
  /** Unique id for the search input (accessibility) */
  searchFieldId: string
  /** Called after each successful load with full rows (e.g. sync opportunity pickers) */
  onOpportunitiesLoaded?: (rows: PartyOppRow[]) => void
}

function rowMatchesQuery(row: PartyOppRow, q: string, t: TFunction<'common'>): boolean {
  if (!q.trim()) {
    return true
  }
  const n = q.trim().toLowerCase()
  const hay = [
    row.id,
    row.stage,
    translateOpportunityStage(row.stage, t),
    row.status,
    translateOpportunityStatus(row.status, t),
    row.product?.name,
    row.estimated_value,
    row.next_action,
    String(row.closing_probability),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(n)
}

export function PartyOpportunitiesCard({
  party,
  viewStorageKey,
  searchFieldId,
  onOpportunitiesLoaded,
}: PartyOpportunitiesCardProps) {
  const { t, i18n } = useTranslation('common')
  const { user } = useAuth()
  const onLoadedRef = useRef(onOpportunitiesLoaded)
  onLoadedRef.current = onOpportunitiesLoaded

  const [allRows, setAllRows] = useState<PartyOppRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = usePersistedListViewMode(viewStorageKey)
  const [listSearch, setListSearch] = useState('')
  const debouncedListSearch = useDebouncedValue(listSearch, 350)

  const queryUrl = useMemo(() => {
    const p = new URLSearchParams()
    p.set('limit', '100')
    if (party.type === 'client') {
      p.set('client_id', party.id)
    } else {
      p.set('lead_id', party.id)
    }
    return `/v1/opportunities?${p.toString()}`
  }, [party])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await apiFetch<PartyOppRow[]>(queryUrl)
      setAllRows(rows)
      onLoadedRef.current?.(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
      setAllRows([])
      onLoadedRef.current?.([])
    } finally {
      setLoading(false)
    }
  }, [queryUrl, t])

  useEffect(() => {
    void load()
  }, [load])

  const items = useMemo(
    () => allRows.filter((r) => rowMatchesQuery(r, debouncedListSearch, t)),
    [allRows, debouncedListSearch, t],
  )

  const money = useMemo(
    () => ({
      locale: i18n.resolvedLanguage ?? 'pt',
      currency: user?.organization.currency ?? 'BRL',
    }),
    [i18n.resolvedLanguage, user?.organization.currency],
  )

  return (
    <Card>
      <CrmListCardHeader
        listTitle={t('crm.opportunities.partySectionTitle')}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={load}
        loading={loading}
        searchId={searchFieldId}
        searchValue={listSearch}
        onSearchChange={setListSearch}
        searchPlaceholder={t('crm.opportunities.partySearchPlaceholder')}
        searchAriaLabel={t('crm.opportunities.partySearchAria')}
      />
      <CardContent>
        {error ? <p className="text-destructive mb-4 text-sm">{error}</p> : null}
        {loading ? (
          viewMode === 'table' ? (
            <div className="space-y-2" aria-busy="true" aria-label={t('auth.loading')}>
              <div className="flex gap-2 border-b px-3 py-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="ml-auto h-3 w-14" />
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-2 border-b px-3 py-3 last:border-0">
                  <Skeleton className="h-4 w-36" />
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
                <TableHead>{t('crm.opportunities.productInterest')}</TableHead>
                <TableHead>{t('crm.opportunities.filterStage')}</TableHead>
                <TableHead>{t('crm.opportunities.tableOppStatus')}</TableHead>
                <TableHead>{t('crm.opportunities.tableValue')}</TableHead>
                <TableHead>{t('crm.opportunities.probability')}</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap text-right">
                  {t('crm.clients.tableActions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="max-w-[12rem] font-medium">
                    <span className="line-clamp-2" title={o.product?.name ?? undefined}>
                      {o.product?.name ?? '—'}
                    </span>
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
                  <TableCell className="text-muted-foreground tabular-nums">
                    {o.closing_probability}%
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
                        {o.product?.name?.trim()
                          ? o.product.name
                          : t('crm.opportunities.cardTitleFallback')}
                      </Link>
                      <dl className="text-muted-foreground space-y-1 text-sm">
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          <dt className="text-foreground/80 font-medium">
                            {t('crm.opportunities.productInterest')}
                          </dt>
                          <dd className="line-clamp-2">{o.product?.name ?? '—'}</dd>
                        </div>
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
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          <dt className="text-foreground/80 font-medium">
                            {t('crm.opportunities.probability')}
                          </dt>
                          <dd>{o.closing_probability}%</dd>
                        </div>
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
  )
}
