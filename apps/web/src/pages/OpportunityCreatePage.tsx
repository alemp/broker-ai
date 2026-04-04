import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api'

type ClientRow = {
  id: string
  full_name: string
}

type CreatedOpportunity = {
  id: string
}

export function OpportunityCreatePage() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [clientId, setClientId] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingClients, setLoadingClients] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadingClients(true)
      try {
        const cl = await apiFetch<ClientRow[]>('/v1/clients')
        if (!cancelled) {
          setClients(cl)
        }
      } catch {
        if (!cancelled) {
          setError(t('crm.error.generic'))
        }
      } finally {
        if (!cancelled) {
          setLoadingClients(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const onCreate = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!user || !clientId) {
      return
    }
    setCreating(true)
    setError(null)
    try {
      const created = await apiFetch<CreatedOpportunity>('/v1/opportunities', {
        method: 'POST',
        json: {
          client_id: clientId,
          owner_id: user.id,
          stage: 'LEAD',
          status: 'OPEN',
          closing_probability: 10,
          next_action: 'Primeiro contato com o cliente',
        },
      })
      toast.success(t('toast.opportunityCreated'))
      void navigate(`/opportunities/${created.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ to: '/opportunities', label: t('crm.opportunities.back') }}
        title={t('crm.opportunities.new')}
        description={t('crm.opportunities.subtitle')}
      />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.opportunities.new')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={onCreate}>
            <div className="grid flex-1 gap-2">
              <Label htmlFor="opp-client">{t('crm.opportunities.client')}</Label>
              <FormSelect
                id="opp-client"
                value={clientId}
                onValueChange={setClientId}
                allowEmpty
                emptyLabel={t('crm.opportunities.selectClient')}
                placeholder={t('crm.opportunities.selectClient')}
                disabled={loadingClients || !user}
                options={clients.map((c) => ({ value: c.id, label: c.full_name }))}
              />
            </div>
            <Button type="submit" disabled={creating || !clientId || !user}>
              {creating ? t('crm.opportunities.creating') : t('crm.opportunities.create')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
