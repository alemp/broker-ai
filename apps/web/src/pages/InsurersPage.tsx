import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'

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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<InsurerDto[]>('/v1/insurers?active_only=false')
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

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader title={t('nav.insurers')} description={t('crm.insurers.subtitle')}>
        <Button asChild>
          <Link to="/insurers/new">{t('action.newRecord')}</Link>
        </Button>
      </PageHeader>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.insurers.list')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2" aria-busy="true" aria-label={t('auth.loading')}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between gap-2 py-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.insurers.empty')}</p>
          ) : (
            <ul className="divide-y text-sm">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground">
                    {r.code ?? '—'} · {r.active ? t('crm.insurers.active') : t('crm.insurers.inactive')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
