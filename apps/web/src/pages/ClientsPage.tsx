import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'

type ClientRow = {
  id: string
  full_name: string
  email: string | null
}

export function ClientsPage() {
  const { t } = useTranslation('common')
  const [items, setItems] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<ClientRow[]>('/v1/clients')
      setItems(data)
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
      await apiFetch<ClientRow>('/v1/clients', {
        method: 'POST',
        json: {
          full_name: fullName.trim(),
          email: email.trim() || undefined,
        },
      })
      setFullName('')
      setEmail('')
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
        <h1 className="text-2xl font-semibold tracking-tight">{t('crm.clients.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('crm.clients.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.clients.new')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={onCreate}>
            <div className="grid flex-1 gap-2">
              <Label htmlFor="client-name">{t('crm.clients.field.name')}</Label>
              <Input
                id="client-name"
                value={fullName}
                onChange={(ev) => setFullName(ev.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div className="grid flex-1 gap-2">
              <Label htmlFor="client-email">{t('crm.clients.field.emailOptional')}</Label>
              <Input
                id="client-email"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                autoComplete="email"
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? t('crm.clients.creating') : t('crm.clients.create')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t('crm.clients.list')}</CardTitle>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {t('action.refresh')}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.clients.empty')}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {items.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div>
                    <Link to={`/clients/${c.id}`} className="font-medium hover:underline">
                      {c.full_name}
                    </Link>
                    {c.email ? (
                      <p className="text-muted-foreground text-xs">{c.email}</p>
                    ) : null}
                  </div>
                  <Link
                    to={`/clients/${c.id}`}
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
