import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
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

type LeadRow = {
  id: string
  full_name: string
  converted_client_id: string | null
}

type PartyKind = 'client' | 'lead'

type CreatedOpportunity = {
  id: string
}

export function OpportunityCreatePage() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetClientId = searchParams.get('client_id')
  const presetLeadId = searchParams.get('lead_id')
  const presetKey = `${presetClientId ?? ''}\0${presetLeadId ?? ''}`
  const appliedPresetKeyRef = useRef<string | null>(null)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [partyKind, setPartyKind] = useState<PartyKind>('client')
  const [clientId, setClientId] = useState('')
  const [leadId, setLeadId] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingParties, setLoadingParties] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadingParties(true)
      try {
        const [cl, ld] = await Promise.all([
          apiFetch<ClientRow[]>('/v1/clients'),
          apiFetch<LeadRow[]>('/v1/leads'),
        ])
        if (!cancelled) {
          setClients(cl)
          setLeads(ld.filter((l) => !l.converted_client_id))
        }
      } catch {
        if (!cancelled) {
          setError(t('crm.error.generic'))
        }
      } finally {
        if (!cancelled) {
          setLoadingParties(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    if (loadingParties) {
      return
    }
    if (!presetClientId && !presetLeadId) {
      appliedPresetKeyRef.current = null
      return
    }
    if (appliedPresetKeyRef.current === presetKey) {
      return
    }
    if (presetClientId && clients.some((c) => c.id === presetClientId)) {
      setPartyKind('client')
      setClientId(presetClientId)
      appliedPresetKeyRef.current = presetKey
      return
    }
    if (presetLeadId && leads.some((l) => l.id === presetLeadId)) {
      setPartyKind('lead')
      setLeadId(presetLeadId)
      appliedPresetKeyRef.current = presetKey
    }
  }, [loadingParties, presetKey, presetClientId, presetLeadId, clients, leads])

  const onCreate = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!user) {
      return
    }
    if (partyKind === 'client' && !clientId) {
      return
    }
    if (partyKind === 'lead' && !leadId) {
      return
    }
    setCreating(true)
    setError(null)
    try {
      const partyPayload =
        partyKind === 'client' ? { client_id: clientId } : { lead_id: leadId }
      const created = await apiFetch<CreatedOpportunity>('/v1/opportunities', {
        method: 'POST',
        json: {
          ...partyPayload,
          owner_id: user.id,
          stage: 'LEAD',
          status: 'OPEN',
          closing_probability: 10,
          next_action:
            partyKind === 'client'
              ? 'Primeiro contato com o cliente'
              : 'Primeiro contato com o lead',
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
          <form className="flex flex-col gap-4" onSubmit={onCreate}>
            <div className="grid gap-2 sm:max-w-md">
              <Label htmlFor="opp-party-kind">{t('crm.opportunities.partyKind')}</Label>
              <FormSelect
                id="opp-party-kind"
                value={partyKind}
                onValueChange={(v) => setPartyKind(v as PartyKind)}
                disabled={loadingParties || !user}
                options={[
                  { value: 'client', label: t('crm.opportunities.partyClient') },
                  { value: 'lead', label: t('crm.opportunities.partyLead') },
                ]}
              />
            </div>
            {partyKind === 'client' ? (
              <div className="grid flex-1 gap-2 sm:max-w-md">
                <Label htmlFor="opp-client">{t('crm.opportunities.client')}</Label>
                <FormSelect
                  id="opp-client"
                  value={clientId}
                  onValueChange={setClientId}
                  allowEmpty
                  emptyLabel={t('crm.opportunities.selectClient')}
                  placeholder={t('crm.opportunities.selectClient')}
                  disabled={loadingParties || !user}
                  options={clients.map((c) => ({ value: c.id, label: c.full_name }))}
                />
              </div>
            ) : (
              <div className="grid flex-1 gap-2 sm:max-w-md">
                <Label htmlFor="opp-lead">{t('crm.opportunities.lead')}</Label>
                <FormSelect
                  id="opp-lead"
                  value={leadId}
                  onValueChange={setLeadId}
                  allowEmpty
                  emptyLabel={t('crm.opportunities.selectLead')}
                  placeholder={t('crm.opportunities.selectLead')}
                  disabled={loadingParties || !user}
                  options={leads.map((l) => ({ value: l.id, label: l.full_name }))}
                />
              </div>
            )}
            <Button
              type="submit"
              disabled={
                creating ||
                !user ||
                (partyKind === 'client' && !clientId) ||
                (partyKind === 'lead' && !leadId)
              }
            >
              {creating ? t('crm.opportunities.creating') : t('crm.opportunities.create')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
