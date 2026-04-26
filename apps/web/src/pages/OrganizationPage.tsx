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
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api'

type OrganizationAdminOut = {
  id: string
  name: string
  slug: string
  created_at: string
}

export function OrganizationPage() {
  const { t } = useTranslation('common')
  const { user, refreshUser } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
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
    return !!orgName.trim() && orgName.trim() !== (user?.organization.name ?? '')
  }, [canManageOrg, loading, orgName, saving, user?.organization.name])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const org = await apiFetch<OrganizationAdminOut>('/v1/org/admin')
      setOrgName(org.name)
      setOrgSlug(org.slug)
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
        json: { name: orgName.trim() },
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

