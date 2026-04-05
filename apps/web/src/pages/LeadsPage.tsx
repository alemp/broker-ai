import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { CrmListCardHeader } from '@/components/CrmListCardHeader'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePersistedListViewMode } from '@/hooks/usePersistedListViewMode'
import { apiFetch } from '@/lib/api'

const LIST_VIEW_STORAGE_KEY = 'ai-copilot:list-view:leads'

type UserBrief = {
  id: string
  email: string
  full_name: string | null
}

type LeadRow = {
  id: string
  full_name: string
  client_kind: string
  marketing_opt_in: boolean
  converted_client_id: string | null
  owner: UserBrief | null
}

function clientKindLabel(kind: string, translate: (key: string) => string): string {
  if (kind === 'COMPANY') {
    return translate('crm.core.kindCompany')
  }
  if (kind === 'INDIVIDUAL') {
    return translate('crm.core.kindIndividual')
  }
  return kind
}

function brokerLabel(owner: UserBrief | null, translate: (key: string) => string): string {
  if (!owner) {
    return translate('crm.core.noOwner')
  }
  return owner.full_name?.trim() || owner.email
}

export function LeadsPage() {
  const { t } = useTranslation('common')
  const [items, setItems] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listSearch, setListSearch] = useState('')
  const debouncedListSearch = useDebouncedValue(listSearch, 350)
  const [viewMode, setViewMode] = usePersistedListViewMode(LIST_VIEW_STORAGE_KEY)

  const loadLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      const q = debouncedListSearch.trim()
      if (q) {
        params.set('q', q)
      }
      const qs = params.toString()
      const leads = await apiFetch<LeadRow[]>(qs ? `/v1/leads?${qs}` : '/v1/leads')
      setItems(leads)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoading(false)
    }
  }, [debouncedListSearch, t])

  useEffect(() => {
    void loadLeads()
  }, [loadLeads])

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader title={t('crm.leads.title')} description={t('crm.leads.subtitle')}>
        <Button asChild>
          <Link to="/leads/new">{t('action.newRecord')}</Link>
        </Button>
      </PageHeader>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CrmListCardHeader
          listTitle={t('crm.leads.list')}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={loadLeads}
          loading={loading}
          searchId="leads-list-search"
          searchValue={listSearch}
          onSearchChange={setListSearch}
          searchPlaceholder={t('crm.leads.listSearch')}
          searchAriaLabel={t('crm.leads.listSearchAria')}
        />
        <CardContent>
          {loading ? (
            viewMode === 'table' ? (
              <div className="space-y-2" aria-busy="true" aria-label={t('auth.loading')}>
                <div className="flex gap-2 border-b px-3 py-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="ml-auto h-3 w-16" />
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-2 border-b px-3 py-3 last:border-0">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
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
                    <Skeleton className="h-3 w-1/3" />
                    <div className="flex justify-end border-t border-border/60 pt-3">
                      <Skeleton className="h-7 w-14" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.leads.empty')}</p>
          ) : viewMode === 'table' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('crm.clients.field.name')}</TableHead>
                  <TableHead>{t('crm.clients.tableBroker')}</TableHead>
                  <TableHead>{t('crm.core.kind')}</TableHead>
                  <TableHead>{t('crm.leads.tableMarketing')}</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-right">
                    {t('crm.clients.tableActions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <Link to={`/leads/${row.id}`} className="hover:underline">
                        {row.full_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {brokerLabel(row.owner, t)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {clientKindLabel(row.client_kind, t)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.marketing_opt_in ? t('crm.leads.yes') : t('crm.leads.no')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/leads/${row.id}`}>
                          {row.converted_client_id ? t('crm.leads.openConverted') : t('crm.action.view')}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((row) => (
                <li key={row.id}>
                  <Card className="border-border/80 h-full shadow-sm transition-shadow hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Link
                          to={`/leads/${row.id}`}
                          className="text-foreground line-clamp-2 text-base font-semibold hover:underline"
                        >
                          {row.full_name}
                        </Link>
                        <dl className="text-muted-foreground space-y-1 text-sm">
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <dt className="text-foreground/80 font-medium">
                              {t('crm.clients.tableBroker')}
                            </dt>
                            <dd className="min-w-0 break-words">{brokerLabel(row.owner, t)}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <dt className="text-foreground/80 font-medium">{t('crm.core.kind')}</dt>
                            <dd>{clientKindLabel(row.client_kind, t)}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <dt className="text-foreground/80 font-medium">
                              {t('crm.leads.tableMarketing')}
                            </dt>
                            <dd>{row.marketing_opt_in ? t('crm.leads.yes') : t('crm.leads.no')}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="flex justify-end border-t border-border/60 pt-3">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/leads/${row.id}`}>
                            {row.converted_client_id ? t('crm.leads.openConverted') : t('crm.action.view')}
                          </Link>
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
