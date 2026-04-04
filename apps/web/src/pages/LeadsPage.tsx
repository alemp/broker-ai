import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'

type UserBrief = {
  id: string
  email: string
  full_name: string | null
}

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
  const [users, setUsers] = useState<UserBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [leads, orgUsers] = await Promise.all([
        apiFetch<LeadRow[]>('/v1/leads'),
        apiFetch<UserBrief[]>('/v1/org/users'),
      ])
      setItems(leads)
      setUsers(orgUsers)
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
    if (!fullName.trim()) {
      return
    }
    setCreating(true)
    setError(null)
    try {
      await apiFetch('/v1/leads', {
        method: 'POST',
        json: {
          full_name: fullName.trim(),
          email: email.trim() || undefined,
          owner_id: ownerId || undefined,
          status: 'NEW',
        },
      })
      setFullName('')
      setEmail('')
      setOwnerId('')
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
        <h1 className="text-2xl font-semibold tracking-tight">{t('crm.leads.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('crm.leads.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.leads.new')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onCreate}>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="lead-name">{t('crm.clients.field.name')}</Label>
              <Input
                id="lead-name"
                value={fullName}
                onChange={(ev) => setFullName(ev.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-email">{t('crm.clients.field.emailOptional')}</Label>
              <Input
                id="lead-email"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead-owner">{t('crm.leads.ownerOptional')}</Label>
              <select
                id="lead-owner"
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={ownerId}
                onChange={(ev) => setOwnerId(ev.target.value)}
              >
                <option value="">{t('crm.leads.noOwner')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name ?? u.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={creating}>
                {creating ? t('crm.leads.creating') : t('crm.leads.create')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t('crm.leads.list')}</CardTitle>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {t('action.refresh')}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
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
    </main>
  )
}
