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

type ClientRow = {
  id: string
  full_name: string
  email: string | null
}

type UserBrief = {
  id: string
  email: string
  full_name: string | null
}

export function ClientsPage() {
  const { t } = useTranslation('common')
  const [items, setItems] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [clientKind, setClientKind] = useState('INDIVIDUAL')
  const [companyLegal, setCompanyLegal] = useState('')
  const [companyTax, setCompanyTax] = useState('')
  const [orgUsers, setOrgUsers] = useState<UserBrief[]>([])
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, users] = await Promise.all([
        apiFetch<ClientRow[]>('/v1/clients'),
        apiFetch<UserBrief[]>('/v1/org/users'),
      ])
      setItems(data)
      setOrgUsers(users)
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
    if (clientKind === 'COMPANY' && !companyLegal.trim()) {
      setError(t('crm.core.companyLegalRequired'))
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
          owner_id: ownerId || undefined,
          client_kind: clientKind,
          ...(clientKind === 'COMPANY'
            ? {
                company_legal_name: companyLegal.trim(),
                company_tax_id: companyTax.trim() || undefined,
              }
            : {}),
        },
      })
      setFullName('')
      setEmail('')
      setOwnerId('')
      setClientKind('INDIVIDUAL')
      setCompanyLegal('')
      setCompanyTax('')
      await load()
      toast.success(t('toast.clientCreated'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader title={t('crm.clients.title')} description={t('crm.clients.subtitle')} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.clients.new')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onCreate}>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="client-name">{t('crm.clients.field.name')}</Label>
              <Input
                id="client-name"
                value={fullName}
                onChange={(ev) => setFullName(ev.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-email">{t('crm.clients.field.emailOptional')}</Label>
              <Input
                id="client-email"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-owner">{t('crm.core.owner')}</Label>
              <FormSelect
                id="client-owner"
                value={ownerId}
                onValueChange={setOwnerId}
                allowEmpty
                emptyLabel={t('crm.core.noOwner')}
                placeholder={t('crm.core.noOwner')}
                options={orgUsers.map((u) => ({
                  value: u.id,
                  label: u.full_name ?? u.email,
                }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-kind">{t('crm.core.kind')}</Label>
              <FormSelect
                id="client-kind"
                value={clientKind}
                onValueChange={setClientKind}
                options={[
                  { value: 'INDIVIDUAL', label: t('crm.core.kindIndividual') },
                  { value: 'COMPANY', label: t('crm.core.kindCompany') },
                ]}
              />
            </div>
            {clientKind === 'COMPANY' ? (
              <>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="client-legal">{t('crm.core.companyLegal')}</Label>
                  <Input
                    id="client-legal"
                    value={companyLegal}
                    onChange={(ev) => setCompanyLegal(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="client-tax">{t('crm.core.companyTax')}</Label>
                  <Input
                    id="client-tax"
                    value={companyTax}
                    onChange={(ev) => setCompanyTax(ev.target.value)}
                  />
                </div>
              </>
            ) : null}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={creating}>
                {creating ? t('crm.clients.creating') : t('crm.clients.create')}
              </Button>
            </div>
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
            <div className="space-y-2 rounded-md border p-2" aria-busy="true" aria-label={t('auth.loading')}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-2 py-2">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
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
    </div>
  )
}
