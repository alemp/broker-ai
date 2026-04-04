import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { apiFetch } from '@/lib/api'

type LeadRow = {
  id: string
  full_name: string
  email: string | null
  status: string
  converted_client_id: string | null
}

export function LeadsPage() {
  const { t } = useTranslation('common')
  const [items, setItems] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listSearch, setListSearch] = useState('')
  const debouncedListSearch = useDebouncedValue(listSearch, 350)

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
        <CardHeader className="flex flex-col gap-4 space-y-0">
          <div className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">{t('crm.leads.list')}</CardTitle>
            <Button type="button" variant="secondary" size="sm" onClick={() => void loadLeads()} disabled={loading}>
              {t('action.refresh')}
            </Button>
          </div>
          <div className="w-full max-w-md">
            <Label htmlFor="leads-list-search" className="sr-only">
              {t('crm.leads.listSearchAria')}
            </Label>
            <Input
              id="leads-list-search"
              type="search"
              value={listSearch}
              onChange={(ev) => setListSearch(ev.target.value)}
              placeholder={t('crm.leads.listSearch')}
              aria-label={t('crm.leads.listSearchAria')}
              autoComplete="off"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 rounded-md border p-2" aria-busy="true" aria-label={t('auth.loading')}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-2 py-2">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.leads.empty')}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {items.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div>
                    <Link to={`/leads/${row.id}`} className="font-medium hover:underline">
                      {row.full_name}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {row.status}
                      {row.email ? ` · ${row.email}` : ''}
                    </p>
                  </div>
                  <Link
                    to={`/leads/${row.id}`}
                    className="text-muted-foreground hover:text-foreground text-xs font-medium"
                  >
                    {row.converted_client_id ? t('crm.leads.openConverted') : t('crm.action.view')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
