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

type CreatedLead = {
  id: string
}

export function LeadCreatePage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserBrief[]>([])
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [ownerId, setOwnerId] = useState('')
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
    setCreating(true)
    setError(null)
    try {
      const created = await apiFetch<CreatedLead>('/v1/leads', {
        method: 'POST',
        json: {
          full_name: fullName.trim(),
          email: email.trim() || undefined,
          owner_id: ownerId || undefined,
          status: 'NEW',
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
    </div>
  )
}
