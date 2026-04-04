import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api'

type ClientRow = {
  id: string
  full_name: string
}

type OpportunityRow = {
  id: string
  stage: string
  status: string
  estimated_value: string | null
  client: { id: string; full_name: string }
}

export function OpportunitiesPage() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const [items, setItems] = useState<OpportunityRow[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [opps, cl] = await Promise.all([
        apiFetch<OpportunityRow[]>('/v1/opportunities'),
        apiFetch<ClientRow[]>('/v1/clients'),
      ])
      setItems(opps)
      setClients(cl)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onCreate = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!user || !clientId) {
      return
    }
    setCreating(true)
    setError(null)
    try {
      await apiFetch('/v1/opportunities', {
        method: 'POST',
        json: {
          client_id: clientId,
          owner_id: user.id,
          stage: 'LEAD',
          status: 'OPEN',
          closing_probability: 10,
        },
      })
      setClientId('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('crm.opportunities.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('crm.opportunities.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.opportunities.new')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={onCreate}>
            <div className="grid flex-1 gap-2">
              <Label htmlFor="opp-client">{t('crm.opportunities.client')}</Label>
              <select
                id="opp-client"
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={clientId}
                onChange={(ev) => setClientId(ev.target.value)}
                required
              >
                <option value="">{t('crm.opportunities.selectClient')}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={creating || !clientId}>
              {creating ? t('crm.opportunities.creating') : t('crm.opportunities.create')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t('crm.opportunities.list')}</CardTitle>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {t('action.refresh')}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.opportunities.empty')}</p>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </main>
  )
}
