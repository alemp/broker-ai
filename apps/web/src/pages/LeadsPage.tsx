import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
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
      toast.success(t('toast.leadCreated'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader title={t('crm.leads.title')} description={t('crm.leads.subtitle')} />

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
              <FormSelect
                id="lead-owner"
                value={ownerId}
                onValueChange={setOwnerId}
                allowEmpty
                emptyLabel={t('crm.leads.noOwner')}
                placeholder={t('crm.leads.noOwner')}
                options={users.map((u) => ({
                  value: u.id,
                  label: u.full_name ?? u.email,
                }))}
              />
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
