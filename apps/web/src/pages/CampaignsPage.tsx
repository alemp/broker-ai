import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'

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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<CampaignDto[]>('/v1/campaigns?limit=100')
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = async (id: string) => {
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
        <CardHeader>
          <CardTitle className="text-base">{t('crm.campaigns.list')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4" aria-busy="true" aria-label={t('auth.loading')}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-b pb-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="mt-2 h-3 w-64" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.campaigns.empty')}</p>
          ) : (
            <ul className="space-y-4 text-sm">
              {rows.map((r) => (
                <li key={r.id} className="border-b pb-4 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{r.name}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={refreshingId === r.id}
                      onClick={() => onRefresh(r.id)}
                    >
                      {refreshingId === r.id
                        ? t('crm.campaigns.refreshing')
                        : t('crm.campaigns.segmentRefresh')}
                    </Button>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {r.kind} · {r.active ? t('crm.insurers.active') : t('crm.insurers.inactive')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
