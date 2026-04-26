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
import { formatCnpj, isValidCnpj } from '@/lib/cnpj'

type UserBrief = {
  id: string
  email: string
  full_name: string | null
}

type CreatedClient = {
  id: string
}

export function ClientCreatePage() {
  const { t, i18n } = useTranslation('common')
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
  const [touchedFullName, setTouchedFullName] = useState(false)
  const [touchedCompanyLegal, setTouchedCompanyLegal] = useState(false)
  const [touchedCompanyTax, setTouchedCompanyTax] = useState(false)

  const fullNameError = (touchedFullName || fullName !== '') && !fullName.trim() ? t('crm.core.fullNameRequired') : null
  const companyLegalError =
    clientKind === 'COMPANY' && (touchedCompanyLegal || companyLegal !== '') && !companyLegal.trim()
      ? t('crm.core.companyLegalRequired')
      : null
  const companyTaxError =
    clientKind === 'COMPANY' && (touchedCompanyTax || companyTax !== '') && !companyTax.trim()
      ? t('crm.core.companyTaxRequired')
      : null
  const isPtBr = (i18n.resolvedLanguage ?? 'pt-BR').toLowerCase() === 'pt-br'
  const companyTaxInvalidError =
    isPtBr &&
    clientKind === 'COMPANY' &&
    (touchedCompanyTax || companyTax !== '') &&
    companyTax.trim() &&
    !isValidCnpj(companyTax)
      ? t('crm.core.companyTaxInvalid')
      : null

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
      setTouchedFullName(true)
      return
    }
    if (clientKind === 'COMPANY' && !companyLegal.trim()) {
      setTouchedCompanyLegal(true)
      setError(t('crm.core.companyLegalRequired'))
      return
    }
    if (clientKind === 'COMPANY' && !companyTax.trim()) {
      setTouchedCompanyTax(true)
      setError(t('crm.core.companyTaxRequired'))
      return
    }
    if (isPtBr && clientKind === 'COMPANY' && !isValidCnpj(companyTax)) {
      setTouchedCompanyTax(true)
      setError(t('crm.core.companyTaxInvalid'))
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
                company_tax_id: companyTax.trim(),
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
          <form className="space-y-8" onSubmit={onCreate}>
            <section className="space-y-4" aria-labelledby="client-create-party-heading">
              <div>
                <h3
                  id="client-create-party-heading"
                  className="text-foreground text-sm font-semibold tracking-tight"
                >
                  {t('crm.form.sectionClient')}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">{t('crm.form.sectionClientSubtitle')}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="client-name">{t('crm.clients.field.name')}</Label>
                  <Input
                    id="client-name"
                    value={fullName}
                    onChange={(ev) => setFullName(ev.target.value)}
                    autoComplete="name"
                    required
                    onBlur={() => setTouchedFullName(true)}
                    aria-invalid={fullNameError ? true : undefined}
                  />
                  {fullNameError ? <p className="text-destructive text-xs">{fullNameError}</p> : null}
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
                        onBlur={() => setTouchedCompanyLegal(true)}
                        aria-invalid={companyLegalError ? true : undefined}
                      />
                      {companyLegalError ? (
                        <p className="text-destructive text-xs">{companyLegalError}</p>
                      ) : null}
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="client-tax">{t('crm.core.companyTax')}</Label>
                      <Input
                        id="client-tax"
                        value={companyTax}
                        onChange={(ev) =>
                          setCompanyTax(isPtBr ? formatCnpj(ev.target.value) : ev.target.value)
                        }
                        onBlur={() => setTouchedCompanyTax(true)}
                        aria-invalid={companyTaxError || companyTaxInvalidError ? true : undefined}
                        required
                      />
                      {companyTaxError ? <p className="text-destructive text-xs">{companyTaxError}</p> : null}
                      {companyTaxInvalidError ? (
                        <p className="text-destructive text-xs">{companyTaxInvalidError}</p>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </section>
            <section
              className="border-border space-y-4 border-t pt-8"
              aria-labelledby="client-create-broker-heading"
            >
              <div>
                <h3
                  id="client-create-broker-heading"
                  className="text-foreground text-sm font-semibold tracking-tight"
                >
                  {t('crm.form.sectionBroker')}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">{t('crm.form.sectionBrokerSubtitle')}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:max-w-md">
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
              </div>
            </section>
            <div>
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
