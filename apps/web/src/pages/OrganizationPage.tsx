import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormSelectOption } from '@/components/ui/select'
import { FormSelect } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api'

type OrganizationAdminOut = {
  id: string
  name: string
  slug: string
  currency: string
  created_at: string
}

type CurrencyOptionsOut = {
  options: { code: string; label: string }[]
}

export function OrganizationPage() {
  const { t } = useTranslation('common')
  const { user, refreshUser } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [orgCurrency, setOrgCurrency] = useState('BRL')
  const [currencyOptions, setCurrencyOptions] = useState<FormSelectOption[]>([])
  const [touchedName, setTouchedName] = useState(false)

  const canManageOrg = user?.role === 'ADMIN'

  const nameError =
    (touchedName || orgName !== '') && !orgName.trim() ? t('crm.validation.required') : null

  const canSubmit = useMemo(() => {
    if (!canManageOrg) {
      return false
    }
    if (loading || saving) {
      return false
    }
    const nameChanged = orgName.trim() !== (user?.organization.name ?? '')
    const currencyChanged = orgCurrency !== (user?.organization.currency ?? 'BRL')
    return !!orgName.trim() && (nameChanged || currencyChanged)
  }, [
    canManageOrg,
    loading,
    orgCurrency,
    orgName,
    saving,
    user?.organization.currency,
    user?.organization.name,
  ])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [org, currencies] = await Promise.all([
        apiFetch<OrganizationAdminOut>('/v1/org/admin'),
        apiFetch<CurrencyOptionsOut>('/v1/org/currencies'),
      ])
      setOrgName(org.name)
      setOrgSlug(org.slug)
      setOrgCurrency(org.currency)
      setCurrencyOptions(currencies.options.map((o) => ({ value: o.code, label: o.label })))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (canManageOrg) {
      void load()
    }
  }, [canManageOrg, load])

  const onSave = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!orgName.trim()) {
      setTouchedName(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiFetch<OrganizationAdminOut>('/v1/org/admin', {
        method: 'PATCH',
        json: { name: orgName.trim(), currency: orgCurrency },
      })
      await refreshUser()
      toast.success(t('org.toast.saved'))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSaving(false)
    }
  }

  if (!canManageOrg) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader title={t('org.title')} description={t('org.subtitle')} />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('org.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
          ) : (
            <form className="space-y-4" onSubmit={(e) => void onSave(e)}>
              <div className="grid gap-2">
                <Label htmlFor="org-name">{t('org.field.name')}</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(ev) => setOrgName(ev.target.value)}
                  onBlur={() => setTouchedName(true)}
                  aria-invalid={nameError ? true : undefined}
                  required
                />
                {nameError ? <p className="text-destructive text-xs">{nameError}</p> : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-slug">{t('org.field.slug')}</Label>
                <Input id="org-slug" value={orgSlug} readOnly disabled />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org-currency">{t('org.field.currency')}</Label>
                <FormSelect
                  id="org-currency"
                  value={orgCurrency}
                  onValueChange={setOrgCurrency}
                  options={currencyOptions}
                  disabled={loading || saving || !currencyOptions.length}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={!canSubmit}>
                  {saving ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
                  {saving ? t('org.saving') : t('org.save')}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

