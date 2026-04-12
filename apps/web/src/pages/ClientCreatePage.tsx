import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { apiFetch } from '@/lib/api'

type UserBrief = {
  id: string
  email: string
  full_name: string | null
}

type CreatedClient = {
  id: string
}

export function ClientCreatePage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [clientKind, setClientKind] = useState('INDIVIDUAL')
  const [companyLegal, setCompanyLegal] = useState('')
  const [companyTax, setCompanyTax] = useState('')
  const [orgUsers, setOrgUsers] = useState<UserBrief[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const users = await apiFetch<UserBrief[]>('/v1/org/users')
        if (!cancelled) {
          setOrgUsers(users)
        }
      } catch {
        /* dropdown pode falhar sem bloquear o formulário */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
      const created = await apiFetch<CreatedClient>('/v1/clients', {
        method: 'POST',
        json: {
          full_name: fullName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          date_of_birth: dateOfBirth.trim() || undefined,
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
      toast.success(t('toast.clientCreated'))
      void navigate(`/clients/${created.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ to: '/clients', label: t('crm.clients.back') }}
        title={t('crm.clients.new')}
        description={t('crm.clients.subtitle')}
      />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

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
              <Label htmlFor="client-phone">{t('crm.clients.field.phoneOptional')}</Label>
              <Input
                id="client-phone"
                type="tel"
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                autoComplete="tel"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-dob">{t('crm.clients.field.dateOfBirthOptional')}</Label>
              <Input
                id="client-dob"
                type="date"
                value={dateOfBirth}
                onChange={(ev) => setDateOfBirth(ev.target.value)}
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
    </div>
  )
}
