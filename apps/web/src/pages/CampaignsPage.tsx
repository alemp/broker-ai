import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { CrmListCardHeader } from '@/components/CrmListCardHeader'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePersistedListViewMode } from '@/hooks/usePersistedListViewMode'
import { apiFetch } from '@/lib/api'
import { translateCampaignKind } from '@/lib/crmEnumLabels'

const LIST_VIEW_STORAGE_KEY = 'ai-copilot:list-view:campaigns'

type CampaignDto = {
  id: string
  name: string
  kind: string
  active: boolean
  template_body: string
  segment_criteria: Record<string, unknown>
}

export function CampaignsPage() {
  const { t } = useTranslation('common')
  const [rows, setRows] = useState<CampaignDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [listSearch, setListSearch] = useState('')
  const debouncedListSearch = useDebouncedValue(listSearch, 350)
  const [viewMode, setViewMode] = usePersistedListViewMode(LIST_VIEW_STORAGE_KEY)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', '100')
      const q = debouncedListSearch.trim()
      if (q) {
        params.set('q', q)
      }
      const data = await apiFetch<CampaignDto[]>(`/v1/campaigns?${params.toString()}`)
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

  const onRefreshSegment = async (id: string) => {
    setRefreshingId(id)
    setError(null)
    try {
      await apiFetch(`/v1/campaigns/${id}/segment-refresh`, {
        method: 'POST',
        json: { channel: 'EMAIL' },
      })
      toast.success(t('toast.segmentRefreshed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setRefreshingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader title={t('nav.campaigns')} description={t('crm.campaigns.subtitle')}>
        <Button asChild>
          <Link to="/campaigns/new">{t('action.newRecord')}</Link>
        </Button>
      </PageHeader>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CrmListCardHeader
          listTitle={t('crm.campaigns.list')}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={load}
          loading={loading}
          searchId="campaigns-list-search"
          searchValue={listSearch}
          onSearchChange={setListSearch}
          searchPlaceholder={t('crm.campaigns.listSearch')}
          searchAriaLabel={t('crm.campaigns.listSearchAria')}
        />
        <CardContent>
          {loading ? (
            viewMode === 'table' ? (
              <div className="space-y-2" aria-busy="true" aria-label={t('auth.loading')}>
                <div className="flex gap-2 border-b px-3 py-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="ml-auto h-3 w-20" />
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-2 border-b px-3 py-3 last:border-0">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="ml-auto h-8 w-36" />
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
                    <Skeleton className="h-3 w-1/2" />
                    <div className="flex justify-end border-t border-border/60 pt-3">
                      <Skeleton className="h-8 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.campaigns.empty')}</p>
          ) : viewMode === 'table' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('crm.campaigns.name')}</TableHead>
                  <TableHead>{t('crm.campaigns.tableKind')}</TableHead>
                  <TableHead>{t('crm.campaigns.tableState')}</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-right">
                    {t('crm.clients.tableActions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {translateCampaignKind(r.kind, t)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.active ? t('crm.insurers.active') : t('crm.insurers.inactive')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={refreshingId === r.id}
                        onClick={() => void onRefreshSegment(r.id)}
                      >
                        {refreshingId === r.id
                          ? t('crm.campaigns.refreshing')
                          : t('crm.campaigns.segmentRefresh')}
                      </Button>
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
                            <dt className="text-foreground/80 font-medium">{t('crm.campaigns.tableKind')}</dt>
                            <dd>{translateCampaignKind(r.kind, t)}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <dt className="text-foreground/80 font-medium">
                              {t('crm.campaigns.tableState')}
                            </dt>
                            <dd>{r.active ? t('crm.insurers.active') : t('crm.insurers.inactive')}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="flex justify-end border-t border-border/60 pt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={refreshingId === r.id}
                          onClick={() => void onRefreshSegment(r.id)}
                        >
                          {refreshingId === r.id
                            ? t('crm.campaigns.refreshing')
                            : t('crm.campaigns.segmentRefresh')}
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
