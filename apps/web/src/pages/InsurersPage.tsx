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

const LIST_VIEW_STORAGE_KEY = 'ai-copilot:list-view:insurers'

type InsurerDto = {
  id: string
  name: string
  code: string | null
  active: boolean
  notes: string | null
}

export function InsurersPage() {
  const { t } = useTranslation('common')
  const [rows, setRows] = useState<InsurerDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listSearch, setListSearch] = useState('')
  const debouncedListSearch = useDebouncedValue(listSearch, 350)
  const [viewMode, setViewMode] = usePersistedListViewMode(LIST_VIEW_STORAGE_KEY)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('active_only', 'false')
      const q = debouncedListSearch.trim()
      if (q) {
        params.set('q', q)
      }
      const data = await apiFetch<InsurerDto[]>(`/v1/insurers?${params.toString()}`)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoading(false)
    }
  }, [debouncedListSearch, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader title={t('nav.insurers')} description={t('crm.insurers.subtitle')}>
        <Button asChild>
          <Link to="/insurers/new">{t('action.newRecord')}</Link>
        </Button>
      </PageHeader>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CrmListCardHeader
          listTitle={t('crm.insurers.list')}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={load}
          loading={loading}
          searchId="insurers-list-search"
          searchValue={listSearch}
          onSearchChange={setListSearch}
          searchPlaceholder={t('crm.insurers.listSearch')}
          searchAriaLabel={t('crm.insurers.listSearchAria')}
        />
        <CardContent>
          {loading ? (
            viewMode === 'table' ? (
              <div className="space-y-2" aria-busy="true" aria-label={t('auth.loading')}>
                <div className="flex gap-2 border-b px-3 py-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-32" />
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-2 border-b px-3 py-3 last:border-0">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 max-w-xs flex-1" />
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
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))}
              </div>
            )
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.insurers.empty')}</p>
          ) : viewMode === 'table' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('crm.insurers.name')}</TableHead>
                  <TableHead>{t('crm.insurers.code')}</TableHead>
                  <TableHead>{t('crm.opportunities.filterStatus')}</TableHead>
                  <TableHead>{t('crm.clientDetail.summary.notes')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.code ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.active ? t('crm.insurers.active') : t('crm.insurers.inactive')}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground max-w-xs truncate"
                      title={r.notes ?? undefined}
                    >
                      {r.notes?.trim() ? r.notes : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <li key={r.id}>
                  <Card className="border-border/80 h-full shadow-sm transition-shadow hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-foreground line-clamp-2 text-base font-semibold">{r.name}</p>
                        <dl className="text-muted-foreground space-y-1 text-sm">
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <dt className="text-foreground/80 font-medium">{t('crm.insurers.code')}</dt>
                            <dd>{r.code ?? '—'}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <dt className="text-foreground/80 font-medium">
                              {t('crm.opportunities.filterStatus')}
                            </dt>
                            <dd>{r.active ? t('crm.insurers.active') : t('crm.insurers.inactive')}</dd>
                          </div>
                          {r.notes?.trim() ? (
                            <p className="text-muted-foreground line-clamp-3 text-xs" title={r.notes}>
                              {r.notes}
                            </p>
                          ) : null}
                        </dl>
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
