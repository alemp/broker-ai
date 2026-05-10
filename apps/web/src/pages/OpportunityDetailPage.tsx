import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api'
import {
  translateInteractionType,
  translateOpportunityStage,
  translateOpportunityStatus,
  translateProductCategory,
} from '@/lib/crmEnumLabels'
import { formatCurrency } from '@/lib/money'

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

type CoverageAdequacyRow = {
  code: string
  label: string
  status: string
  matched_clause_code: string | null
  matched_clause_description: string | null
  match_confidence: number
  reason: string
}

type OpportunityDetail = {
  id: string
  stage: string
  status: string
  insurance_line: string
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
  proposal_source: string | null
  quote_number: string | null
  quote_item: number | null
  quote_valid_until?: string | null
  proposal_data: unknown
  coverage_adequacy?: CoverageAdequacyRow[]
}

function hasRenderableProposalPayload(value: unknown): boolean {
  if (value == null) {
    return false
  }
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }
  if (typeof value === 'object') {
    return Object.keys(value as object).length > 0
  }
  return true
}

function formatProposalPayloadJson(value: unknown): string {
  if (value == null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function adequacyStatusClass(status: string): string {
  switch (status) {
    case 'GREEN':
      return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-400'
    case 'YELLOW':
      return 'bg-amber-500/15 text-amber-900 dark:text-amber-400'
    case 'RED':
      return 'bg-destructive/15 text-destructive'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

type InteractionDto = {
  id: string
  interaction_type: string
  summary: string
  occurred_at: string
  created_by: { email: string; full_name: string | null }
}

type DocumentBrief = {
  id: string
  document_type: string
  original_filename: string
  opportunity_id: string | null
  updated_at: string
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
  const { t, i18n } = useTranslation('common')
  const { user } = useAuth()
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
  const [mainTab, setMainTab] = useState('summary')
  const [linkedDocs, setLinkedDocs] = useState<DocumentBrief[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)

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

  useEffect(() => {
    if (mainTab !== 'documents' || !opportunityId) {
      return
    }
    let cancelled = false
    setDocumentsLoading(true)
    void (async () => {
      try {
        const all = await apiFetch<DocumentBrief[]>('/v1/documents')
        if (!cancelled) {
          setLinkedDocs(all.filter((d) => d.opportunity_id === opportunityId))
        }
      } catch {
        if (!cancelled) {
          setLinkedDocs([])
        }
      } finally {
        if (!cancelled) {
          setDocumentsLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mainTab, opportunityId])

  useEffect(() => {
    if (mainTab !== 'proposal' || !opportunityId) {
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const d = await apiFetch<OpportunityDetail>(`/v1/opportunities/${opportunityId}`)
        if (cancelled) {
          return
        }
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                proposal_data: d.proposal_data,
                proposal_source: d.proposal_source,
                quote_number: d.quote_number,
                quote_item: d.quote_item,
                quote_valid_until: d.quote_valid_until,
                coverage_adequacy: d.coverage_adequacy,
                estimated_value: d.estimated_value,
                preferred_insurer_name: d.preferred_insurer_name,
                insurance_line: d.insurance_line,
              }
            : d,
        )
      } catch {
        /* keep existing detail */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mainTab, opportunityId])

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

  const money = {
    locale: i18n.resolvedLanguage ?? 'pt',
    currency: user?.organization.currency ?? 'BRL',
  }

  const proposalTabAdequacy = detail?.coverage_adequacy ?? []
  const proposalTabHasSummary = Boolean(detail?.proposal_source || detail?.quote_number)
  const proposalTabHasPayload = detail ? hasRenderableProposalPayload(detail.proposal_data) : false
  const proposalTabHasAdequacy = proposalTabAdequacy.length > 0
  const proposalTabIsEmpty =
    detail != null && !proposalTabHasSummary && !proposalTabHasPayload && !proposalTabHasAdequacy

  const oppDescription = detail
    ? [
        `${t('crm.opportunities.insuranceLine')}: ${translateProductCategory(detail.insurance_line, t)}`,
        `${t('crm.opportunities.pipeline')}: ${translateOpportunityStage(detail.stage, t)} · ${translateOpportunityStatus(detail.status, t)}`,
        `${t('crm.opportunities.probability')}: ${detail.closing_probability}%${
          detail.estimated_value ? ` · ${formatCurrency(detail.estimated_value, money)}` : ''
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
        <TabsRoot value={mainTab} onValueChange={setMainTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">{t('crm.opportunityDetail.tab.summary')}</TabsTrigger>
            <TabsTrigger value="documents">{t('crm.opportunityDetail.tab.documents')}</TabsTrigger>
            <TabsTrigger value="proposal">{t('crm.opportunityDetail.tab.proposal')}</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="mt-4 space-y-8">
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
              {detail.proposal_source ? (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="bg-muted text-foreground rounded-md px-2 py-0.5 text-xs font-medium">
                    {t('crm.opportunityDetail.fromProposal')}
                  </span>
                  {detail.quote_number ? (
                    <span className="text-muted-foreground font-mono text-xs">
                      {t('crm.opportunities.quoteNumberShort')}: {detail.quote_number}
                      {detail.quote_item != null ? ` · #${detail.quote_item}` : ''}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            {error && detail ? <p className="text-destructive text-sm">{error}</p> : null}

      {detail ? (
        <>
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
                  {savingDeal ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
                  {savingDeal ? t('crm.opportunities.savingDeal') : t('crm.opportunities.saveDeal')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

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
        </>
      ) : null}
          </TabsContent>
          <TabsContent value="documents" className="mt-4 space-y-4">
            {documentsLoading ? (
              <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
            ) : linkedDocs.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('crm.opportunityDetail.noDocuments')}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {linkedDocs.map((d) => (
                  <li
                    key={d.id}
                    className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"
                  >
                    <div>
                      <span className="font-medium">{d.original_filename}</span>
                      <span className="text-muted-foreground ml-2 text-xs">({d.document_type})</span>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/documents/${d.id}`}>{t('crm.action.view')}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="proposal" className="mt-4 space-y-4">
            {proposalTabHasSummary ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t('crm.opportunityDetail.proposalSummaryTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {detail.proposal_source ? (
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="bg-muted text-foreground rounded-md px-2 py-0.5 text-xs font-medium">
                        {detail.proposal_source}
                      </span>
                    </p>
                  ) : null}
                  {detail.quote_number ? (
                    <p>
                      <span className="text-muted-foreground">
                        {t('crm.opportunities.quoteNumberShort')}:{' '}
                      </span>
                      <span className="font-mono text-xs">{detail.quote_number}</span>
                      {detail.quote_item != null ? (
                        <span className="text-muted-foreground text-xs"> · #{detail.quote_item}</span>
                      ) : null}
                    </p>
                  ) : null}
                  {detail.preferred_insurer_name ? (
                    <p>
                      <span className="text-muted-foreground">
                        {t('crm.opportunities.preferredInsurer')}:{' '}
                      </span>
                      {detail.preferred_insurer_name}
                    </p>
                  ) : null}
                  {detail.quote_valid_until ? (
                    <p>
                      <span className="text-muted-foreground">
                        {t('crm.opportunityDetail.quoteValidUntil')}:{' '}
                      </span>
                      {new Date(detail.quote_valid_until).toLocaleDateString()}
                    </p>
                  ) : null}
                  {detail.estimated_value ? (
                    <p>
                      <span className="text-muted-foreground">
                        {t('crm.opportunities.tableValue')}:{' '}
                      </span>
                      {formatCurrency(detail.estimated_value, money)}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
            {proposalTabHasAdequacy ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t('crm.opportunityDetail.coverageAdequacyTitle')}
                  </CardTitle>
                  <p className="text-muted-foreground text-sm">
                    {t('crm.opportunityDetail.coverageAdequacySubtitle')}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-3 text-sm">
                    {proposalTabAdequacy.map((row) => (
                      <li
                        key={row.code}
                        className="border-border/60 space-y-1 border-b pb-3 last:border-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{row.label}</span>
                          <span className="text-muted-foreground font-mono text-xs">{row.code}</span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-medium ${adequacyStatusClass(row.status)}`}
                          >
                            {t(`crm.opportunityDetail.adequacy.${row.status}`, { defaultValue: row.status })}
                          </span>
                        </div>
                        {row.matched_clause_code ? (
                          <p className="text-muted-foreground text-xs">
                            {t('crm.opportunityDetail.matchedClause')}:{' '}
                            <span className="font-mono">{row.matched_clause_code}</span>
                            {row.matched_clause_description
                              ? ` — ${row.matched_clause_description}`
                              : null}
                            {row.match_confidence != null ? (
                              <span>
                                {' '}
                                ({t('crm.opportunityDetail.matchConfidence')}: {row.match_confidence}%)
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                        <p className="text-muted-foreground text-xs">{row.reason}</p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
            {proposalTabHasPayload ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">{t('crm.opportunityDetail.proposalJsonHint')}</p>
                <pre className="bg-muted max-h-[32rem] overflow-auto rounded-md border p-3 text-xs">
                  {formatProposalPayloadJson(detail.proposal_data)}
                </pre>
              </div>
            ) : null}
            {proposalTabIsEmpty ? (
              <p className="text-muted-foreground text-sm">{t('crm.opportunityDetail.noProposalData')}</p>
            ) : null}
          </TabsContent>
        </TabsRoot>
      ) : null}
    </div>
  )
}
