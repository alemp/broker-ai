import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { apiFetch } from '@/lib/api'
import {
  translateInteractionType,
  translateOpportunityStage,
  translateOpportunityStatus,
  translateProductCategory,
} from '@/lib/crmEnumLabels'

const STAGES = [
  'LEAD',
  'QUALIFIED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
  'POST_SALE',
] as const

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
  preferred_insurer_name: string | null
  expected_close_at: string | null
  loss_reason: string | null
  client: { id: string; full_name: string; email: string | null } | null
  lead: { id: string; full_name: string; email: string | null } | null
  next_action: string | null
  next_action_due_at: string | null
  last_interaction_at: string | null
  product: { id: string; name: string } | null
}

type InteractionDto = {
  id: string
  interaction_type: string
  summary: string
  occurred_at: string
  created_by: { email: string; full_name: string | null }
}

type OppRecItem = {
  product_id: string
  product_name: string
  product_category: string
  priority: number
  rule_ids: string[]
  rationale: string
  protection_gaps: string
  predictable_objections: string
  next_best_action: string
}

type OppRecPreview = {
  items: OppRecItem[]
  rule_trace: { rule_id: string; fired: boolean; detail: string }[]
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) {
    return ''
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return ''
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  const [closeLossReason, setCloseLossReason] = useState('')
  const [insurer, setInsurer] = useState('')
  const [expectedClose, setExpectedClose] = useState('')
  const [nextActionEdit, setNextActionEdit] = useState('')
  const [nextDueEdit, setNextDueEdit] = useState('')
  const [savingDeal, setSavingDeal] = useState(false)
  const [recPreview, setRecPreview] = useState<OppRecPreview | null>(null)
  const [recLoading, setRecLoading] = useState(false)

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
      setInsurer(d.preferred_insurer_name ?? '')
      setExpectedClose(toDatetimeLocalValue(d.expected_close_at))
      setNextActionEdit(d.next_action ?? '')
      setNextDueEdit(toDatetimeLocalValue(d.next_action_due_at))
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

  const loadRecommendationsPreview = useCallback(async () => {
    if (!opportunityId || !detail?.client) {
      return
    }
    setRecLoading(true)
    try {
      const p = await apiFetch<OppRecPreview>(
        `/v1/clients/${detail.client.id}/recommendations?opportunity_id=${encodeURIComponent(opportunityId)}`,
      )
      setRecPreview(p)
    } catch {
      setRecPreview(null)
    } finally {
      setRecLoading(false)
    }
  }, [opportunityId, detail])

  useEffect(() => {
    if (detail?.client) {
      void loadRecommendationsPreview()
    } else {
      setRecPreview(null)
      setRecLoading(false)
    }
  }, [detail?.client?.id, opportunityId, loadRecommendationsPreview])

  const setStage = async (stage: string) => {
    if (!opportunityId) {
      return
    }
    if (stage === 'CLOSED_LOST' && !closeLossReason.trim()) {
      setError(t('crm.opportunities.lossReasonRequired'))
      return
    }
    setBusyStage(stage)
    setError(null)
    try {
      const json: { stage: string; loss_reason?: string } = { stage }
      if (stage === 'CLOSED_LOST') {
        json.loss_reason = closeLossReason.trim()
      }
      const d = await apiFetch<OpportunityDetail>(`/v1/opportunities/${opportunityId}/stage`, {
        method: 'POST',
        json,
      })
      setDetail(d)
      setCloseLossReason('')
      toast.success(t('toast.stageUpdated'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setBusyStage(null)
    }
  }

  const onSaveDeal = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!opportunityId) {
      return
    }
    setSavingDeal(true)
    setError(null)
    try {
      const json: Record<string, string | null> = {
        preferred_insurer_name: insurer.trim() || null,
        expected_close_at: expectedClose ? new Date(expectedClose).toISOString() : null,
        next_action: nextActionEdit.trim() || null,
        next_action_due_at: nextDueEdit ? new Date(nextDueEdit).toISOString() : null,
      }
      const d = await apiFetch<OpportunityDetail>(`/v1/opportunities/${opportunityId}`, {
        method: 'PATCH',
        json,
      })
      setDetail(d)
      toast.success(t('toast.saved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSavingDeal(false)
    }
  }

  const onAddInteraction = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!opportunityId || !detail || !ixSummary.trim()) {
      return
    }
    const party =
      detail.client != null
        ? { client_id: detail.client.id }
        : detail.lead != null
          ? { lead_id: detail.lead.id }
          : null
    if (party == null) {
      return
    }
    setAddingIx(true)
    setError(null)
    try {
      await apiFetch('/v1/interactions', {
        method: 'POST',
        json: {
          ...party,
          opportunity_id: opportunityId,
          interaction_type: ixType,
          summary: ixSummary.trim(),
        },
      })
      setIxSummary('')
      await load()
      toast.success(t('toast.interactionAdded'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setAddingIx(false)
    }
  }

  if (!opportunityId) {
    return null
  }

  const partyName =
    detail?.client?.full_name ?? detail?.lead?.full_name ?? ''

  const canPostSale =
    detail?.stage === 'CLOSED_WON' || detail?.stage === 'POST_SALE' || detail?.status === 'WON'

  const oppDescription = detail
    ? [
        `${t('crm.opportunities.pipeline')}: ${translateOpportunityStage(detail.stage, t)} · ${translateOpportunityStatus(detail.status, t)}`,
        `${t('crm.opportunities.probability')}: ${detail.closing_probability}%${
          detail.estimated_value ? ` · ${detail.estimated_value}` : ''
        }`,
        detail.product
          ? `${t('crm.opportunities.productInterest')}: ${detail.product.name}`
          : '',
        detail.preferred_insurer_name
          ? `${t('crm.opportunities.preferredInsurer')}: ${detail.preferred_insurer_name}`
          : '',
        detail.expected_close_at
          ? `${t('crm.opportunities.expectedClose')}: ${new Date(detail.expected_close_at).toLocaleString()}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : undefined

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ to: '/opportunities', label: t('crm.opportunities.back') }}
        titleLoading={loading}
        title={partyName}
        description={oppDescription}
      />
      {!loading && !detail ? (
        <p className="text-destructive text-sm">{error ?? t('crm.error.notFound')}</p>
      ) : null}
      {detail && !loading ? (
        <div className="space-y-1">
          {detail.next_action ? <p className="mt-2 text-sm">{detail.next_action}</p> : null}
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
          {detail.loss_reason ? (
            <p className="text-destructive mt-2 text-sm">
              {t('crm.opportunities.lossReason')}: {detail.loss_reason}
            </p>
          ) : null}
          <p className="mt-2 text-sm">
            {detail.client ? (
              <Link to={`/clients/${detail.client.id}`} className="text-primary hover:underline">
                {t('crm.opportunities.openClient')}
              </Link>
            ) : detail.lead ? (
              <Link to={`/leads/${detail.lead.id}`} className="text-primary hover:underline">
                {t('crm.opportunities.openLead')}
              </Link>
            ) : null}
          </p>
        </div>
      ) : null}

      {error && detail ? <p className="text-destructive text-sm">{error}</p> : null}

      {detail ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('crm.opportunities.dealFields')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSaveDeal}>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="opp-insurer">{t('crm.opportunities.preferredInsurer')}</Label>
                <input
                  id="opp-insurer"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={insurer}
                  onChange={(ev) => setInsurer(ev.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="opp-close">{t('crm.opportunities.expectedClose')}</Label>
                <input
                  id="opp-close"
                  type="datetime-local"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={expectedClose}
                  onChange={(ev) => setExpectedClose(ev.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="opp-na">{t('crm.opportunities.nextActionEdit')}</Label>
                <input
                  id="opp-na"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={nextActionEdit}
                  onChange={(ev) => setNextActionEdit(ev.target.value)}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="opp-due">{t('crm.opportunities.nextDueEdit')}</Label>
                <input
                  id="opp-due"
                  type="datetime-local"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={nextDueEdit}
                  onChange={(ev) => setNextDueEdit(ev.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={savingDeal}>
                  {savingDeal ? t('crm.opportunities.savingDeal') : t('crm.opportunities.saveDeal')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {detail ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('crm.opportunities.recommendationsTitle')}</CardTitle>
            <p className="text-muted-foreground text-sm">{t('crm.opportunities.recommendationsSubtitle')}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {!detail.client ? (
              <p className="text-muted-foreground text-sm">{t('crm.opportunities.recLeadOnlyHint')}</p>
            ) : recLoading ? (
              <p className="text-muted-foreground text-sm">{t('crm.opportunities.recLoading')}</p>
            ) : recPreview && recPreview.items.length > 0 ? (
              <>
                <ul className="space-y-3 text-sm">
                  {recPreview.items.map((it) => (
                    <li key={it.product_id} className="border-b pb-3 last:border-0">
                      <div className="font-medium">
                        {it.product_name}{' '}
                        <span className="text-muted-foreground font-normal">
                          ({translateProductCategory(it.product_category, t)}) ·{' '}
                          {t('crm.intel.itemPriority')}: {it.priority}
                        </span>
                      </div>
                      <p className="mt-1">{it.rationale}</p>
                      {it.rule_ids.length > 0 ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          <span className="font-medium text-foreground">{t('crm.intel.rulesMatched')}: </span>
                          {it.rule_ids.join(', ')}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground mt-1 text-xs">
                        <span className="font-medium text-foreground">
                          {t('crm.intel.protectionGapsLabel')}:{' '}
                        </span>
                        {it.protection_gaps}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        <span className="font-medium text-foreground">
                          {t('crm.intel.objectionsLabel')}:{' '}
                        </span>
                        {it.predictable_objections}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        <span className="font-medium text-foreground">{t('crm.intel.nbaLabel')}: </span>
                        {it.next_best_action}
                      </p>
                    </li>
                  ))}
                </ul>
                {recPreview.rule_trace.length > 0 ? (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      {t('crm.intel.ruleTraceTitle')}
                    </summary>
                    <ul className="mt-2 space-y-1 font-mono">
                      {recPreview.rule_trace.map((tr) => (
                        <li key={tr.rule_id}>
                          <span className={tr.fired ? 'text-emerald-700' : 'text-muted-foreground'}>
                            {tr.rule_id}
                          </span>
                          <span className="text-muted-foreground"> — {tr.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">{t('crm.opportunities.recEmpty')}</p>
            )}
            {detail.client ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={recLoading}
                onClick={() => void loadRecommendationsPreview()}
              >
                {t('crm.opportunities.recRefresh')}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
                      {translateInteractionType(row.interaction_type, t)}{' '}
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
                <FormSelect
                  id="opp-ix-type"
                  value={ixType}
                  onValueChange={setIxType}
                  options={INTERACTION_TYPES.map((code) => ({
                    value: code,
                    label: translateInteractionType(code, t),
                  }))}
                />
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
            <p className="text-muted-foreground text-sm">{t('crm.opportunities.lossReasonHint')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="opp-loss">{t('crm.opportunities.lossReason')}</Label>
              <textarea
                id="opp-loss"
                className="border-input bg-background min-h-[64px] w-full rounded-md border px-3 py-2 text-sm"
                value={closeLossReason}
                onChange={(ev) => setCloseLossReason(ev.target.value)}
                placeholder={t('crm.opportunities.lossReasonHint')}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((s) => {
                const disabled =
                  busyStage !== null || (s === 'POST_SALE' && !canPostSale)
                return (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={detail.stage === s ? 'default' : 'secondary'}
                    disabled={disabled}
                    title={s === 'POST_SALE' && !canPostSale ? t('crm.opportunities.postSaleDisabledHint') : undefined}
                    onClick={() => void setStage(s)}
                  >
                    {busyStage === s
                      ? t('crm.opportunities.updating')
                      : translateOpportunityStage(s, t)}
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
