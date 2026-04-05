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

const LIST_VIEW_STORAGE_KEY = 'ai-copilot:list-view:clients'

type UserBrief = {
  id: string
  email: string
  full_name: string | null
}

type ClientListItem = {
  id: string
  full_name: string
  email: string | null
  client_kind: string
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

export function ClientsPage() {
  const { t } = useTranslation('common')
  const [items, setItems] = useState<ClientListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listSearch, setListSearch] = useState('')
  const debouncedListSearch = useDebouncedValue(listSearch, 350)
  const [viewMode, setViewMode] = usePersistedListViewMode(LIST_VIEW_STORAGE_KEY)

  const loadClients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      const q = debouncedListSearch.trim()
      if (q) {
        params.set('q', q)
      }
      const qs = params.toString()
      const data = await apiFetch<ClientListItem[]>(qs ? `/v1/clients?${qs}` : '/v1/clients')
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoading(false)
    }
  }, [debouncedListSearch, t])

  useEffect(() => {
    void loadClients()
  }, [loadClients])

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader title={t('crm.clients.title')} description={t('crm.clients.subtitle')}>
        <Button asChild>
          <Link to="/clients/new">{t('action.newRecord')}</Link>
        </Button>
      </PageHeader>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CrmListCardHeader
          listTitle={t('crm.clients.list')}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={loadClients}
          loading={loading}
          searchId="clients-list-search"
          searchValue={listSearch}
          onSearchChange={setListSearch}
          searchPlaceholder={t('crm.clients.listSearch')}
          searchAriaLabel={t('crm.clients.listSearchAria')}
        />
        <CardContent>
          {loading ? (
            viewMode === 'table' ? (
              <div className="space-y-2" aria-busy="true" aria-label={t('auth.loading')}>
                <div className="flex gap-2 border-b px-3 py-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="ml-auto h-3 w-16" />
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-2 border-b px-3 py-3 last:border-0">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-40" />
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
                    <Skeleton className="h-5 w-3/4" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <div className="flex justify-end border-t border-border/60 pt-3">
                      <Skeleton className="h-7 w-14" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.clients.empty')}</p>
          ) : viewMode === 'table' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('crm.clients.field.name')}</TableHead>
                  <TableHead>{t('crm.clients.tableType')}</TableHead>
                  <TableHead>{t('crm.clients.tableBroker')}</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-right">
                    {t('crm.clients.tableActions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link to={`/clients/${c.id}`} className="hover:underline">
                        {c.full_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {clientKindLabel(c.client_kind, t)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {brokerLabel(c.owner, t)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/clients/${c.id}`}>{t('crm.action.view')}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((c) => (
                <li key={c.id}>
                  <Card className="border-border/80 h-full shadow-sm transition-shadow hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Link
                          to={`/clients/${c.id}`}
                          className="text-foreground line-clamp-2 text-base font-semibold hover:underline"
                        >
                          {c.full_name}
                        </Link>
                        <dl className="text-muted-foreground space-y-1 text-sm">
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <dt className="text-foreground/80 font-medium">{t('crm.clients.tableType')}</dt>
                            <dd>{clientKindLabel(c.client_kind, t)}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <dt className="text-foreground/80 font-medium">{t('crm.clients.tableBroker')}</dt>
                            <dd className="min-w-0 break-words">{brokerLabel(c.owner, t)}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="flex justify-end border-t border-border/60 pt-3">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/clients/${c.id}`}>{t('crm.action.view')}</Link>
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
