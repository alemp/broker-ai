import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'

const STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'] as const

const INTERACTION_TYPES = [
  'CALL',
  'WHATSAPP',
  'EMAIL',
  'MEETING',
  'VISIT',
  'PROPOSAL_SENT',
  'CLIENT_REPLY',
  'NOTE',
  'POST_SALE',
  'CAMPAIGN_TOUCH',
] as const

type OpportunityDetail = {
  id: string
  stage: string
  status: string
  closing_probability: number
  estimated_value: string | null
  client: { id: string; full_name: string; email: string | null }
  next_action: string | null
  next_action_due_at: string | null
  last_interaction_at: string | null
}

type InteractionDto = {
  id: string
  interaction_type: string
  summary: string
  occurred_at: string
  created_by: { email: string; full_name: string | null }
}

export function OpportunityDetailPage() {
  const { t } = useTranslation('common')
  const { opportunityId } = useParams<{ opportunityId: string }>()
  const [detail, setDetail] = useState<OpportunityDetail | null>(null)
  const [interactions, setInteractions] = useState<InteractionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyStage, setBusyStage] = useState<string | null>(null)
  const [ixType, setIxType] = useState<string>('CALL')
  const [ixSummary, setIxSummary] = useState('')
  const [addingIx, setAddingIx] = useState(false)

  const load = useCallback(async () => {
    if (!opportunityId) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [d, ix] = await Promise.all([
        apiFetch<OpportunityDetail>(`/v1/opportunities/${opportunityId}`),
        apiFetch<InteractionDto[]>(`/v1/interactions?opportunity_id=${opportunityId}&limit=100`),
      ])
      setDetail(d)
      setInteractions(ix)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
      setDetail(null)
      setInteractions([])
    } finally {
      setLoading(false)
    }
  }, [opportunityId, t])

  useEffect(() => {
    void load()
  }, [load])

  const setStage = async (stage: string) => {
    if (!opportunityId) {
      return
    }
    setBusyStage(stage)
    setError(null)
    try {
      const d = await apiFetch<OpportunityDetail>(`/v1/opportunities/${opportunityId}/stage`, {
        method: 'POST',
        json: { stage },
      })
      setDetail(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setBusyStage(null)
    }
  }

  const onAddInteraction = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!opportunityId || !detail || !ixSummary.trim()) {
      return
    }
    setAddingIx(true)
    setError(null)
    try {
      await apiFetch('/v1/interactions', {
        method: 'POST',
        json: {
          client_id: detail.client.id,
          opportunity_id: opportunityId,
          interaction_type: ixType,
          summary: ixSummary.trim(),
        },
      })
      setIxSummary('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setAddingIx(false)
    }
  }

  if (!opportunityId) {
    return null
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <Link to="/opportunities" className="text-muted-foreground hover:text-foreground text-sm">
          ← {t('crm.opportunities.back')}
        </Link>
        {loading ? (
          <p className="text-muted-foreground mt-4 text-sm">{t('auth.loading')}</p>
        ) : detail ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">{detail.client.full_name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('crm.opportunities.pipeline')}: {detail.stage} · {detail.status}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('crm.opportunities.probability')}: {detail.closing_probability}%
              {detail.estimated_value ? ` · ${detail.estimated_value}` : ''}
            </p>
            {detail.next_action ? (
              <p className="mt-2 text-sm">{detail.next_action}</p>
            ) : null}
            {detail.next_action_due_at ? (
              <p className="text-muted-foreground text-sm">
                {t('crm.opportunities.due')}: {new Date(detail.next_action_due_at).toLocaleString()}
              </p>
            ) : null}
            {detail.last_interaction_at ? (
              <p className="text-muted-foreground text-sm">
                {t('crm.opportunities.lastInteraction')}:{' '}
                {new Date(detail.last_interaction_at).toLocaleString()}
              </p>
            ) : null}
            <p className="mt-2 text-sm">
              <Link to={`/clients/${detail.client.id}`} className="text-primary hover:underline">
                {t('crm.opportunities.openClient')}
              </Link>
            </p>
          </>
        ) : (
          <p className="text-destructive mt-4 text-sm">{error ?? t('crm.error.notFound')}</p>
        )}
      </div>

      {error && detail ? <p className="text-destructive text-sm">{error}</p> : null}

      {detail ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('crm.interactions.title')}</CardTitle>
            <p className="text-muted-foreground text-sm">{t('crm.interactions.oppSubtitle')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {interactions.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('crm.interactions.empty')}</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {interactions.map((row) => (
                  <li key={row.id} className="border-b pb-3 last:border-0">
                    <div className="font-medium">
                      {row.interaction_type}{' '}
                      <span className="text-muted-foreground font-normal">
                        · {new Date(row.occurred_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{row.summary}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.created_by.full_name ?? row.created_by.email}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <form className="grid gap-3" onSubmit={onAddInteraction}>
              <div className="grid gap-2">
                <Label htmlFor="opp-ix-type">{t('crm.interactions.type')}</Label>
                <select
                  id="opp-ix-type"
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  value={ixType}
                  onChange={(ev) => setIxType(ev.target.value)}
                >
                  {INTERACTION_TYPES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="opp-ix-sum">{t('crm.interactions.summary')}</Label>
                <textarea
                  id="opp-ix-sum"
                  className="border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
                  value={ixSummary}
                  onChange={(ev) => setIxSummary(ev.target.value)}
                />
              </div>
              <Button type="submit" disabled={addingIx || !ixSummary.trim()}>
                {addingIx ? t('crm.interactions.adding') : t('crm.interactions.add')}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {detail ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('crm.opportunities.stageActions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={detail.stage === s ? 'default' : 'secondary'}
                  disabled={busyStage !== null}
                  onClick={() => void setStage(s)}
                >
                  {busyStage === s ? t('crm.opportunities.updating') : s}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  )
}
