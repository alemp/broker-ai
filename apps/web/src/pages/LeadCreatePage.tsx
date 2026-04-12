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
import { MARKETING_CHANNELS } from '@/lib/marketingChannels'

type UserBrief = {
  id: string
  email: string
  full_name: string | null
}

type CreatedLead = {
  id: string
}

export function LeadCreatePage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserBrief[]>([])
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [externalId, setExternalId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [clientKind, setClientKind] = useState('INDIVIDUAL')
  const [companyLegal, setCompanyLegal] = useState('')
  const [companyTax, setCompanyTax] = useState('')
  const [marketingOptIn, setMarketingOptIn] = useState(true)
  const [preferredChannel, setPreferredChannel] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const orgUsers = await apiFetch<UserBrief[]>('/v1/org/users')
        if (!cancelled) {
          setUsers(orgUsers)
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
      const created = await apiFetch<CreatedLead>('/v1/leads', {
        method: 'POST',
        json: {
          full_name: fullName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          date_of_birth: dateOfBirth.trim() || undefined,
          external_id: externalId.trim() || undefined,
          owner_id: ownerId || undefined,
          status: 'NEW',
          client_kind: clientKind,
          ...(clientKind === 'COMPANY'
            ? {
                company_legal_name: companyLegal.trim(),
                company_tax_id: companyTax.trim() || undefined,
              }
            : {}),
          marketing_opt_in: marketingOptIn,
          preferred_marketing_channel: preferredChannel || undefined,
        },
      })
      toast.success(t('toast.leadCreated'))
      void navigate(`/leads/${created.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ to: '/leads', label: t('crm.leads.back') }}
        title={t('crm.leads.new')}
        description={t('crm.leads.subtitle')}
      />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.leads.new')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-8" onSubmit={onCreate}>
            <section className="space-y-4" aria-labelledby="lead-create-party-heading">
              <div>
                <h3
                  id="lead-create-party-heading"
                  className="text-foreground text-sm font-semibold tracking-tight"
                >
                  {t('crm.form.sectionLead')}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">{t('crm.form.sectionLeadSubtitle')}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="lead-name">{t('crm.clients.field.name')}</Label>
                  <Input
                    id="lead-name"
                    value={fullName}
                    onChange={(ev) => setFullName(ev.target.value)}
                    autoComplete="name"
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
                    autoComplete="email"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lead-phone">{t('crm.leads.field.phoneOptional')}</Label>
                  <Input
                    id="lead-phone"
                    type="tel"
                    value={phone}
                    onChange={(ev) => setPhone(ev.target.value)}
                    autoComplete="tel"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lead-dob">{t('crm.clients.field.dateOfBirthOptional')}</Label>
                  <Input
                    id="lead-dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(ev) => setDateOfBirth(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lead-ext">{t('crm.leads.field.externalIdOptional')}</Label>
                  <Input
                    id="lead-ext"
                    value={externalId}
                    onChange={(ev) => setExternalId(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lead-kind">{t('crm.core.kind')}</Label>
                  <FormSelect
                    id="lead-kind"
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
                      <Label htmlFor="lead-legal">{t('crm.core.companyLegal')}</Label>
                      <Input
                        id="lead-legal"
                        value={companyLegal}
                        onChange={(ev) => setCompanyLegal(ev.target.value)}
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="lead-tax">{t('crm.core.companyTax')}</Label>
                      <Input
                        id="lead-tax"
                        value={companyTax}
                        onChange={(ev) => setCompanyTax(ev.target.value)}
                      />
                    </div>
                  </>
                ) : null}
                <div className="flex items-center gap-2 sm:col-span-2">
                  <input
                    id="lead-mkt"
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(ev) => setMarketingOptIn(ev.target.checked)}
                    className="h-4 w-4 rounded border"
                  />
                  <Label htmlFor="lead-mkt" className="font-normal">
                    {t('crm.leads.field.marketingOptIn')}
                  </Label>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="lead-channel">{t('crm.core.marketingChannel')}</Label>
                  <FormSelect
                    id="lead-channel"
                    value={preferredChannel}
                    onValueChange={setPreferredChannel}
                    allowEmpty
                    emptyLabel={t('crm.core.marketingChannelNone')}
                    placeholder={t('crm.core.marketingChannelNone')}
                    extraOptions={
                      preferredChannel &&
                      !MARKETING_CHANNELS.some((c) => c === preferredChannel)
                        ? [{ value: preferredChannel, label: preferredChannel }]
                        : undefined
                    }
                    options={MARKETING_CHANNELS.map((c) => ({
                      value: c,
                      label: t(`crm.core.marketingChannelOption.${c}`),
                    }))}
                  />
                </div>
              </div>
            </section>
            <section
              className="border-border space-y-4 border-t pt-8"
              aria-labelledby="lead-create-broker-heading"
            >
              <div>
                <h3
                  id="lead-create-broker-heading"
                  className="text-foreground text-sm font-semibold tracking-tight"
                >
                  {t('crm.form.sectionBroker')}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">{t('crm.form.sectionBrokerSubtitle')}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:max-w-md">
                  <Label htmlFor="lead-owner">{t('crm.core.owner')}</Label>
                  <FormSelect
                    id="lead-owner"
                    value={ownerId}
                    onValueChange={setOwnerId}
                    allowEmpty
                    emptyLabel={t('crm.core.noOwner')}
                    placeholder={t('crm.core.noOwner')}
                    options={users.map((u) => ({
                      value: u.id,
                      label: u.full_name ?? u.email,
                    }))}
                  />
                </div>
              </div>
            </section>
            <div>
              <Button type="submit" disabled={creating}>
                {creating ? t('crm.leads.creating') : t('crm.leads.create')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
