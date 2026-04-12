import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FolderTree,
  IdCard,
  Megaphone,
  MessageSquare,
  Package,
  ScrollText,
  Sparkles,
  UserCircle,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { CrmQuickStatsRow } from '@/components/crm/CrmQuickStatsRow'
import { InsuranceProfileTab, type InsuranceProfileShape } from '@/components/InsuranceProfileTab'
import { PageHeader } from '@/components/PageHeader'
import { PartyOpportunitiesCard, type PartyOppRow } from '@/components/PartyOpportunitiesCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '@/components/ui/tabs'
import { apiFetch } from '@/lib/api'
import {
  translateIngestionSource,
  translateInteractionType,
  translateLeadStatus,
  translateOpportunityStage,
  translateOpportunityStatus,
  translateProductCategory,
} from '@/lib/crmEnumLabels'
import { MARKETING_CHANNELS, marketingChannelSummaryLabel } from '@/lib/marketingChannels'

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

type InteractionDto = {
  id: string
  interaction_type: string
  summary: string
  occurred_at: string
  opportunity_id: string | null
  created_by: { email: string; full_name: string | null }
}

type LeadOppRow = Pick<PartyOppRow, 'id' | 'stage' | 'status'>

type UserBrief = {
  id: string
  email: string
  full_name: string | null
}

type InsuredPersonRow = {
  id: string
  full_name: string
  relation: string
  notes: string | null
}

type HeldProductRow = {
  id: string
  insurer_name: string | null
  ingestion_source: string
  product: { id: string; name: string; category: string } | null
}

type AdequacyDto = {
  traffic_light: string
  summary: string
  reasons: string[]
  needs_human_review: boolean
  profile_completeness_score: number
  profile_alert_codes: string[]
  source?: string
  computed_at?: string | null
  inputs_hash?: string | null
  rule_version?: string | null
}

type RecItemDto = {
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

type RecommendationRunDto = {
  id: string
  items: RecItemDto[]
  rule_trace: { rule_id: string; fired: boolean; detail: string }[]
  created_at: string
}

type RecPreviewDto = {
  items: RecItemDto[]
  rule_trace: { rule_id: string; fired: boolean; detail: string }[]
}

type LeadDetail = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  external_id: string | null
  source: string | null
  notes: string | null
  status: string
  client_kind: string
  company_legal_name: string | null
  company_tax_id: string | null
  marketing_opt_in: boolean
  preferred_marketing_channel: string | null
  converted_client_id: string | null
  owner_id: string | null
  owner: UserBrief | null
  profile_data: Record<string, unknown>
  profile: Record<string, unknown>
  profile_completeness_score: number
  profile_alerts: string[]
  insured_persons: InsuredPersonRow[]
  held_products: HeldProductRow[]
  created_at: string
  updated_at: string
}

function insuredRelationLabel(relation: string, translate: TFunction<'common'>): string {
  switch (relation) {
    case 'HOLDER':
      return translate('crm.insured.relationHolder')
    case 'DEPENDENT':
      return translate('crm.insured.relationDependent')
    case 'OTHER':
      return translate('crm.insured.relationOther')
    default:
      return relation
  }
}

function formatPtDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatPtDateOnly(iso: string | null | undefined): string | null {
  if (!iso?.trim()) {
    return null
  }
  const s = iso.trim().slice(0, 10)
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(
      new Date(`${s}T12:00:00`),
    )
  } catch {
    return s
  }
}

function countNonEmptyProfileBlocks(data: Record<string, unknown>): number {
  if (!data || typeof data !== 'object') {
    return 0
  }
  return Object.values(data).filter((block) => {
    if (block == null || typeof block !== 'object' || Array.isArray(block)) {
      return false
    }
    return Object.keys(block as Record<string, unknown>).length > 0
  }).length
}

type LeadSummarySection = {
  key: string
  title: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  items: { label: string; value: string }[]
}

function buildLeadSummarySections(lead: LeadDetail, t: TFunction<'common'>): LeadSummarySection[] {
  const sections: LeadSummarySection[] = []

  const add = (
    key: string,
    title: string,
    icon: LeadSummarySection['icon'],
    raw: { label: string; value: string | null | undefined }[],
  ) => {
    const items = raw
      .map((r) => {
        const v = r.value
        if (v == null) {
          return null
        }
        const s = typeof v === 'string' ? v.trim() : String(v)
        return s ? { label: r.label, value: s } : null
      })
      .filter((x): x is { label: string; value: string } => x != null)
    if (items.length === 0) {
      return
    }
    sections.push({ key, title, icon, items })
  }

  const summaryEmpty = t('crm.clientDetail.summary.valueEmpty')
  add('contact', t('crm.clientDetail.summary.sectionContact'), UserCircle, [
    { label: t('crm.clientDetail.summary.name'), value: lead.full_name?.trim() || null },
    { label: t('crm.clientDetail.summary.email'), value: lead.email?.trim() || null },
    {
      label: t('crm.clientDetail.summary.phone'),
      value: lead.phone?.trim() || summaryEmpty,
    },
    {
      label: t('crm.clientDetail.summary.dateOfBirth'),
      value: formatPtDateOnly(lead.date_of_birth) || summaryEmpty,
    },
    { label: t('crm.clientDetail.summary.notes'), value: lead.notes?.trim() || null },
  ])

  add('crm', t('crm.clientDetail.summary.sectionCrm'), IdCard, [
    {
      label: t('crm.core.owner'),
      value: lead.owner ? lead.owner.full_name?.trim() || lead.owner.email : null,
    },
    {
      label: t('crm.core.kind'),
      value:
        lead.client_kind === 'COMPANY'
          ? t('crm.core.kindCompany')
          : lead.client_kind === 'INDIVIDUAL'
            ? t('crm.core.kindIndividual')
            : lead.client_kind,
    },
    { label: t('crm.core.companyLegal'), value: lead.company_legal_name?.trim() || null },
    { label: t('crm.core.companyTax'), value: lead.company_tax_id?.trim() || null },
    { label: t('crm.leads.field.status'), value: translateLeadStatus(lead.status, t) },
    { label: t('crm.leads.detail.externalId'), value: lead.external_id?.trim() || null },
    { label: t('crm.leads.summary.source'), value: lead.source?.trim() || null },
    { label: t('crm.leads.summary.createdAt'), value: formatPtDateTime(lead.created_at) },
    { label: t('crm.leads.summary.updatedAt'), value: formatPtDateTime(lead.updated_at) },
  ])

  add('marketing', t('crm.clientDetail.summary.sectionMarketing'), Megaphone, [
    {
      label: t('crm.core.marketingOptIn'),
      value: lead.marketing_opt_in ? t('crm.profile.yes') : t('crm.profile.no'),
    },
    {
      label: t('crm.core.marketingChannel'),
      value: marketingChannelSummaryLabel(lead.preferred_marketing_channel, t),
    },
  ])

  const profileCount = countNonEmptyProfileBlocks(lead.profile_data)
  if (profileCount > 0) {
    sections.push({
      key: 'profile',
      title: t('crm.leads.summary.sectionProfile'),
      icon: ClipboardList,
      items: [
        {
          label: t('crm.leads.summary.profileBlocks'),
          value: String(profileCount),
        },
      ],
    })
  }

  if (lead.insured_persons?.length) {
    sections.push({
      key: 'insured',
      title: t('crm.insured.title'),
      icon: Users,
      items: lead.insured_persons.map((p) => ({
        label: insuredRelationLabel(p.relation, t),
        value: p.full_name,
      })),
    })
  }

  if (lead.held_products?.length) {
    sections.push({
      key: 'held',
      title: t('crm.portfolio.heldTitle'),
      icon: Package,
      items: lead.held_products.map((h) => ({
        label: h.product?.name ?? t('crm.portfolio.unlinkedProduct'),
        value: h.insurer_name?.trim() || '—',
      })),
    })
  }

  return sections
}

type ProductBrief = {
  id: string
  name: string
  category?: string
}

type ConvertResponse = {
  client: { id: string }
  opportunity: { id: string } | null
}

export function LeadDetailPage() {
  const { t } = useTranslation('common')
  const { leadId } = useParams<{ leadId: string }>()
  const navigate = useNavigate()
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [meId, setMeId] = useState<string>('')
  const [orgUsers, setOrgUsers] = useState<UserBrief[]>([])
  const [products, setProducts] = useState<ProductBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [withOpp, setWithOpp] = useState(false)
  const [oppOwnerId, setOppOwnerId] = useState('')
  const [oppProductId, setOppProductId] = useState('')
  const [oppValue, setOppValue] = useState('')
  const [oppProb, setOppProb] = useState('20')
  const [converting, setConverting] = useState(false)
  const [insuredName, setInsuredName] = useState('')
  const [insuredRelation, setInsuredRelation] = useState('HOLDER')
  const [insuredNotes, setInsuredNotes] = useState('')
  const [addingInsured, setAddingInsured] = useState(false)
  const [heldProductId, setHeldProductId] = useState('')
  const [heldInsurer, setHeldInsurer] = useState('')
  const [addingHeld, setAddingHeld] = useState(false)
  const [interactions, setInteractions] = useState<InteractionDto[]>([])
  const [leadOpportunities, setLeadOpportunities] = useState<LeadOppRow[]>([])
  const [ixType, setIxType] = useState<string>('CALL')
  const [ixSummary, setIxSummary] = useState('')
  const [ixOppId, setIxOppId] = useState('')
  const [addingIx, setAddingIx] = useState(false)
  const [crmFullName, setCrmFullName] = useState('')
  const [crmEmail, setCrmEmail] = useState('')
  const [crmPhone, setCrmPhone] = useState('')
  const [crmBirthDate, setCrmBirthDate] = useState('')
  const [crmOwnerId, setCrmOwnerId] = useState('')
  const [crmKind, setCrmKind] = useState('INDIVIDUAL')
  const [crmLegal, setCrmLegal] = useState('')
  const [crmTax, setCrmTax] = useState('')
  const [crmMarketingOptIn, setCrmMarketingOptIn] = useState('yes')
  const [crmMarketingChannel, setCrmMarketingChannel] = useState('')
  const [savingCrm, setSavingCrm] = useState(false)
  const [adequacy, setAdequacy] = useState<AdequacyDto | null>(null)
  const [recommendationRuns, setRecommendationRuns] = useState<RecommendationRunDto[]>([])
  const [runRecLoading, setRunRecLoading] = useState(false)
  const [recPreview, setRecPreview] = useState<RecPreviewDto | null>(null)
  const [recPreviewLoading, setRecPreviewLoading] = useState(false)

  const load = useCallback(async () => {
    if (!leadId) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [l, me, plist, users, ixList, adeq, recRuns] = await Promise.all([
        apiFetch<LeadDetail>(`/v1/leads/${leadId}`),
        apiFetch<{ user: { id: string } }>('/v1/me'),
        apiFetch<ProductBrief[]>('/v1/products'),
        apiFetch<UserBrief[]>('/v1/org/users'),
        apiFetch<InteractionDto[]>(`/v1/interactions?lead_id=${leadId}&limit=100`),
        apiFetch<AdequacyDto>(`/v1/leads/${leadId}/adequacy`),
        apiFetch<RecommendationRunDto[]>(`/v1/leads/${leadId}/recommendation-runs?limit=5`),
      ])
      setAdequacy(adeq)
      setRecommendationRuns(recRuns)
      setLead(l)
      setCrmFullName(l.full_name)
      setCrmEmail(l.email ?? '')
      setCrmPhone(l.phone ?? '')
      setCrmBirthDate(l.date_of_birth ? l.date_of_birth.slice(0, 10) : '')
      setCrmOwnerId(l.owner_id ?? '')
      setCrmKind(l.client_kind)
      setCrmLegal(l.company_legal_name ?? '')
      setCrmTax(l.company_tax_id ?? '')
      setCrmMarketingOptIn(l.marketing_opt_in ? 'yes' : 'no')
      setCrmMarketingChannel(l.preferred_marketing_channel ?? '')
      setInteractions(ixList)
      setMeId(me.user.id)
      setOppOwnerId(me.user.id)
      setProducts(plist)
      setOrgUsers(users)
      try {
        const prev = await apiFetch<RecPreviewDto>(`/v1/leads/${leadId}/recommendations`)
        setRecPreview(prev)
      } catch {
        setRecPreview(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
      setLead(null)
      setAdequacy(null)
      setRecommendationRuns([])
      setRecPreview(null)
    } finally {
      setLoading(false)
    }
  }, [leadId, t])

  useEffect(() => {
    void load()
  }, [load])

  const loadRecPreview = useCallback(async () => {
    if (!leadId) {
      return
    }
    setRecPreviewLoading(true)
    try {
      const prev = await apiFetch<RecPreviewDto>(`/v1/leads/${leadId}/recommendations`)
      setRecPreview(prev)
    } catch {
      setRecPreview(null)
    } finally {
      setRecPreviewLoading(false)
    }
  }, [leadId])

  const onRunLeadRecommendation = async () => {
    if (!leadId) {
      return
    }
    setRunRecLoading(true)
    setError(null)
    try {
      const run = await apiFetch<RecommendationRunDto>(`/v1/leads/${leadId}/recommendation-runs`, {
        method: 'POST',
        json: {},
      })
      setRecommendationRuns((prev) => [run, ...prev])
      const ad = await apiFetch<AdequacyDto>(`/v1/leads/${leadId}/adequacy`)
      setAdequacy(ad)
      try {
        const prev = await apiFetch<RecPreviewDto>(`/v1/leads/${leadId}/recommendations`)
        setRecPreview(prev)
      } catch {
        setRecPreview(null)
      }
      toast.success(t('toast.recommendationRun'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setRunRecLoading(false)
    }
  }

  const onAddInsured = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!leadId || !lead || lead.converted_client_id || !insuredName.trim()) {
      return
    }
    setAddingInsured(true)
    setError(null)
    try {
      await apiFetch(`/v1/leads/${leadId}/insured-persons`, {
        method: 'POST',
        json: {
          full_name: insuredName.trim(),
          relation: insuredRelation,
          notes: insuredNotes.trim() || undefined,
        },
      })
      setInsuredName('')
      setInsuredNotes('')
      setInsuredRelation('HOLDER')
      await load()
      toast.success(t('toast.insuredAdded'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setAddingInsured(false)
    }
  }

  const onDeleteInsured = async (insuredId: string) => {
    if (!leadId || !lead || lead.converted_client_id) {
      return
    }
    setError(null)
    try {
      await apiFetch(`/v1/leads/${leadId}/insured-persons/${insuredId}`, { method: 'DELETE' })
      await load()
      toast.success(t('toast.insuredRemoved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    }
  }

  const onAddHeld = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!leadId || !lead || lead.converted_client_id) {
      return
    }
    setAddingHeld(true)
    setError(null)
    try {
      await apiFetch(`/v1/leads/${leadId}/held-products`, {
        method: 'POST',
        json: {
          product_id: heldProductId || undefined,
          insurer_name: heldInsurer.trim() || undefined,
          ingestion_source: 'internal_crm',
        },
      })
      setHeldProductId('')
      setHeldInsurer('')
      await load()
      toast.success(t('toast.heldAdded'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setAddingHeld(false)
    }
  }

  const onConvert = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!leadId || !lead || lead.converted_client_id) {
      return
    }
    setConverting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        client_owner_id: lead.owner_id ?? meId,
      }
      if (withOpp) {
        body.opportunity = {
          owner_id: oppOwnerId || meId,
          product_id: oppProductId || undefined,
          estimated_value: oppValue.trim() || undefined,
          closing_probability: Math.min(100, Math.max(0, parseInt(oppProb, 10) || 0)),
          stage: 'LEAD',
          status: 'OPEN',
        }
      }
      const res = await apiFetch<ConvertResponse>(`/v1/leads/${leadId}/convert`, {
        method: 'POST',
        json: body,
      })
      await navigate(`/clients/${res.client.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setConverting(false)
    }
  }

  const onSaveLeadCore = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!leadId || !lead || lead.converted_client_id) {
      return
    }
    if (!crmFullName.trim()) {
      setError(t('crm.core.fullNameRequired'))
      return
    }
    if (crmKind === 'COMPANY' && !crmLegal.trim()) {
      setError(t('crm.core.companyLegalRequired'))
      return
    }
    setSavingCrm(true)
    setError(null)
    try {
      await apiFetch(`/v1/leads/${leadId}`, {
        method: 'PATCH',
        json: {
          full_name: crmFullName.trim(),
          email: crmEmail.trim() || null,
          phone: crmPhone.trim() || null,
          date_of_birth: crmBirthDate.trim() || null,
          owner_id: crmOwnerId || null,
          client_kind: crmKind,
          company_legal_name: crmKind === 'COMPANY' ? crmLegal.trim() || null : null,
          company_tax_id: crmKind === 'COMPANY' ? crmTax.trim() || null : null,
          marketing_opt_in: crmMarketingOptIn === 'yes',
          preferred_marketing_channel: crmMarketingChannel.trim() || null,
        },
      })
      await load()
      toast.success(t('toast.saved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSavingCrm(false)
    }
  }

  const onAddInteraction = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!leadId || !lead || lead.converted_client_id || !ixSummary.trim()) {
      return
    }
    setAddingIx(true)
    setError(null)
    try {
      await apiFetch('/v1/interactions', {
        method: 'POST',
        json: {
          lead_id: leadId,
          interaction_type: ixType,
          summary: ixSummary.trim(),
          ...(ixOppId ? { opportunity_id: ixOppId } : {}),
        },
      })
      setIxSummary('')
      setIxOppId('')
      await load()
      toast.success(t('toast.interactionAdded'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setAddingIx(false)
    }
  }

  if (!leadId) {
    return null
  }

  const leadHeaderDescription = lead
    ? [lead.email, lead.phone].filter(Boolean).join(' · ') || t('crm.clients.noContact')
    : undefined

  const leadSummarySections = useMemo(
    () => (lead ? buildLeadSummarySections(lead, t) : []),
    [lead, t],
  )

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ to: '/leads', label: t('crm.leads.back') }}
        titleLoading={loading}
        title={lead?.full_name ?? (loading ? '' : t('crm.error.notFound'))}
        description={leadHeaderDescription}
      >
        {lead && !loading && !lead.converted_client_id ? (
          <Button asChild variant="default">
            <Link to={`/opportunities/new?lead_id=${encodeURIComponent(lead.id)}`}>
              {t('crm.opportunities.new')}
            </Link>
          </Button>
        ) : null}
      </PageHeader>
      {!loading && !lead ? (
        <p className="text-destructive text-sm">{error ?? t('crm.error.notFound')}</p>
      ) : null}

      {error && lead ? <p className="text-destructive text-sm">{error}</p> : null}

      {lead?.converted_client_id ? (
        <Card className="to-card border-primary/25 from-primary/5 shadow-sm ring-1 ring-primary/10 bg-gradient-to-br">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 gap-4">
              <div
                className="bg-primary/15 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl"
                aria-hidden
              >
                <CheckCircle2 className="size-6" strokeWidth={2} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <p className="text-foreground text-base font-semibold tracking-tight">
                  {t('crm.leads.convertedHint')}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t('crm.leads.convertedCtaSubtitle')}
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="w-full shrink-0 sm:w-auto">
              <Link to={`/clients/${lead.converted_client_id}`}>{t('crm.leads.openClient')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {lead ? (
        <>
          <CrmQuickStatsRow
            ariaLabel={t('crm.clientDetail.statsAria')}
            items={[
              {
                icon: ClipboardCheck,
                label: t('crm.clientDetail.statsCompleteness'),
                value: `${lead.profile_completeness_score}%`,
              },
              {
                icon: Users,
                label: t('crm.clientDetail.statsInsured'),
                value: (lead.insured_persons ?? []).length,
              },
              {
                icon: MessageSquare,
                label: t('crm.clientDetail.statsInteractions'),
                value: interactions.length,
              },
              {
                icon: Package,
                label: t('crm.clientDetail.statsHeld'),
                value: (lead.held_products ?? []).length,
              },
            ]}
          />

          <PartyOpportunitiesCard
            party={{ type: 'lead', id: lead.id }}
            viewStorageKey="ai-copilot:list-view:party-opportunities:lead"
            searchFieldId="lead-detail-opportunities-search"
            onOpportunitiesLoaded={(rows) =>
              setLeadOpportunities(rows.map((r) => ({ id: r.id, stage: r.stage, status: r.status })))
            }
          />

          <TabsRoot defaultValue="core" className="space-y-2">
            <TabsList
              className="sticky top-2 z-30 h-auto w-full flex-wrap justify-start gap-1 bg-background/95 shadow-sm backdrop-blur-md"
              aria-label={t('crm.clientDetail.tabsAria')}
            >
              <TabsTrigger value="core">
                <ClipboardList className="size-4" aria-hidden />
                {t('crm.clientDetail.tabCore')}
              </TabsTrigger>
              {!lead.converted_client_id ? (
                <TabsTrigger value="crmCore">
                  <Briefcase className="size-4" aria-hidden />
                  {t('crm.clientDetail.tabCrmCore')}
                </TabsTrigger>
              ) : null}
              {!lead.converted_client_id ? (
                <TabsTrigger value="insured">
                  <Users className="size-4" aria-hidden />
                  {t('crm.clientDetail.tabInsured')}
                </TabsTrigger>
              ) : null}
              <TabsTrigger value="profile">
                <UserCircle className="size-4" aria-hidden />
                {t('crm.clientDetail.tabProfile')}
              </TabsTrigger>
              <TabsTrigger value="interactions">
                <MessageSquare className="size-4" aria-hidden />
                {t('crm.clientDetail.tabInteractions')}
              </TabsTrigger>
              {!lead.converted_client_id ? (
                <>
                  <TabsTrigger value="portfolio">
                    <FolderTree className="size-4" aria-hidden />
                    {t('crm.clientDetail.tabPortfolio')}
                  </TabsTrigger>
                  <TabsTrigger value="intel">
                    <Sparkles className="size-4" aria-hidden />
                    {t('crm.clientDetail.tabIntel')}
                  </TabsTrigger>
                  <TabsTrigger value="convert">
                    <UserPlus className="size-4" aria-hidden />
                    {t('crm.leads.detail.tabConvert')}
                  </TabsTrigger>
                </>
              ) : (
                <TabsTrigger value="intel">
                  <Sparkles className="size-4" aria-hidden />
                  {t('crm.clientDetail.tabIntel')}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="core" className="mt-6 space-y-6 outline-none">
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                    <ScrollText className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg tracking-tight">
                      {t('crm.clientDetail.summary.title')}
                    </CardTitle>
                    <p className="text-muted-foreground text-sm">
                      {t('crm.clientDetail.summary.subtitle')}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8">
                  {leadSummarySections.map((sec) => {
                    const Icon = sec.icon
                    return (
                      <section key={sec.key} className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                            <Icon className="size-4" aria-hidden />
                          </div>
                          <h3 className="text-foreground pt-1 text-sm font-semibold">{sec.title}</h3>
                        </div>
                        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 sm:pl-12">
                          {sec.items.map((item, idx) => (
                            <div key={`${sec.key}-${idx}`} className="min-w-0">
                              <dt className="text-muted-foreground text-xs font-medium">{item.label}</dt>
                              <dd className="text-foreground mt-0.5 text-sm font-medium wrap-break-word whitespace-pre-wrap">
                                {item.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    )
                  })}
                </CardContent>
              </Card>
            </TabsContent>

            {!lead.converted_client_id ? (
              <TabsContent value="crmCore" className="mt-6 space-y-6 outline-none">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="flex flex-row items-start gap-4 pb-2">
                    <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                      <Briefcase className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-lg tracking-tight">{t('crm.core.title')}</CardTitle>
                      <p className="text-muted-foreground text-sm">{t('crm.core.subtitle')}</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSaveLeadCore}>
                      <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="lead-crm-name">{t('crm.clients.field.name')}</Label>
                        <Input
                          id="lead-crm-name"
                          value={crmFullName}
                          onChange={(ev) => setCrmFullName(ev.target.value)}
                          autoComplete="name"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lead-crm-email">{t('crm.clients.field.emailOptional')}</Label>
                        <Input
                          id="lead-crm-email"
                          type="email"
                          value={crmEmail}
                          onChange={(ev) => setCrmEmail(ev.target.value)}
                          autoComplete="email"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lead-crm-phone">{t('crm.clients.field.phoneOptional')}</Label>
                        <Input
                          id="lead-crm-phone"
                          type="tel"
                          value={crmPhone}
                          onChange={(ev) => setCrmPhone(ev.target.value)}
                          autoComplete="tel"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lead-crm-dob">{t('crm.clients.field.dateOfBirthOptional')}</Label>
                        <Input
                          id="lead-crm-dob"
                          type="date"
                          value={crmBirthDate}
                          onChange={(ev) => setCrmBirthDate(ev.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lead-crm-owner">{t('crm.core.owner')}</Label>
                        <FormSelect
                          id="lead-crm-owner"
                          value={crmOwnerId}
                          onValueChange={setCrmOwnerId}
                          allowEmpty
                          emptyLabel={t('crm.core.noOwner')}
                          placeholder={t('crm.core.noOwner')}
                          options={orgUsers.map((u) => ({
                            value: u.id,
                            label: u.full_name ?? u.email,
                          }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lead-crm-kind">{t('crm.core.kind')}</Label>
                        <FormSelect
                          id="lead-crm-kind"
                          value={crmKind}
                          onValueChange={setCrmKind}
                          options={[
                            { value: 'INDIVIDUAL', label: t('crm.core.kindIndividual') },
                            { value: 'COMPANY', label: t('crm.core.kindCompany') },
                          ]}
                        />
                      </div>
                      {crmKind === 'COMPANY' ? (
                        <>
                          <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="lead-crm-legal">{t('crm.core.companyLegal')}</Label>
                            <Input
                              id="lead-crm-legal"
                              value={crmLegal}
                              onChange={(ev) => setCrmLegal(ev.target.value)}
                            />
                          </div>
                          <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor="lead-crm-tax">{t('crm.core.companyTax')}</Label>
                            <Input
                              id="lead-crm-tax"
                              value={crmTax}
                              onChange={(ev) => setCrmTax(ev.target.value)}
                            />
                          </div>
                        </>
                      ) : null}
                      <div className="grid gap-2">
                        <Label htmlFor="lead-crm-mkt-opt">{t('crm.core.marketingOptIn')}</Label>
                        <FormSelect
                          id="lead-crm-mkt-opt"
                          value={crmMarketingOptIn}
                          onValueChange={setCrmMarketingOptIn}
                          options={[
                            { value: 'yes', label: t('crm.profile.yes') },
                            { value: 'no', label: t('crm.profile.no') },
                          ]}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lead-crm-mkt-ch">{t('crm.core.marketingChannel')}</Label>
                        <FormSelect
                          id="lead-crm-mkt-ch"
                          value={crmMarketingChannel}
                          onValueChange={setCrmMarketingChannel}
                          allowEmpty
                          emptyLabel={t('crm.core.marketingChannelNone')}
                          placeholder={t('crm.core.marketingChannelNone')}
                          extraOptions={
                            crmMarketingChannel &&
                            !MARKETING_CHANNELS.some((c) => c === crmMarketingChannel)
                              ? [{ value: crmMarketingChannel, label: crmMarketingChannel }]
                              : undefined
                          }
                          options={MARKETING_CHANNELS.map((c) => ({
                            value: c,
                            label: t(`crm.core.marketingChannelOption.${c}`),
                          }))}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Button type="submit" disabled={savingCrm}>
                          {savingCrm ? t('crm.core.saving') : t('crm.core.save')}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            ) : null}


            {!lead.converted_client_id ? (
              <TabsContent value="insured" className="mt-6 space-y-6 outline-none">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="flex flex-row items-start gap-4 pb-2">
                    <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                      <Users className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-lg tracking-tight">{t('crm.insured.title')}</CardTitle>
                      <p className="text-muted-foreground text-sm">{t('crm.insured.subtitle')}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(lead.insured_persons ?? []).length === 0 ? (
                      <p className="text-muted-foreground text-sm">{t('crm.insured.empty')}</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('crm.insured.name')}</TableHead>
                            <TableHead>{t('crm.table.relation')}</TableHead>
                            <TableHead className="hidden md:table-cell">{t('crm.table.notes')}</TableHead>
                            <TableHead className="w-[100px] text-right">{t('crm.table.actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(lead.insured_persons ?? []).map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.full_name}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {insuredRelationLabel(p.relation, t)}
                              </TableCell>
                              <TableCell className="text-muted-foreground hidden max-w-xs truncate text-sm md:table-cell">
                                {p.notes ?? '—'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void onDeleteInsured(p.id)}
                                >
                                  {t('crm.insured.remove')}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    <form className="grid gap-3 sm:grid-cols-2" onSubmit={onAddInsured}>
                      <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="lead-ins-name">{t('crm.insured.name')}</Label>
                        <Input
                          id="lead-ins-name"
                          value={insuredName}
                          onChange={(ev) => setInsuredName(ev.target.value)}
                          autoComplete="off"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lead-ins-rel">{t('crm.insured.relation')}</Label>
                        <FormSelect
                          id="lead-ins-rel"
                          value={insuredRelation}
                          onValueChange={setInsuredRelation}
                          options={[
                            { value: 'HOLDER', label: t('crm.insured.relationHolder') },
                            { value: 'DEPENDENT', label: t('crm.insured.relationDependent') },
                            { value: 'OTHER', label: t('crm.insured.relationOther') },
                          ]}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lead-ins-notes">{t('crm.insured.notesOptional')}</Label>
                        <Input
                          id="lead-ins-notes"
                          value={insuredNotes}
                          onChange={(ev) => setInsuredNotes(ev.target.value)}
                          autoComplete="off"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Button type="submit" disabled={addingInsured || !insuredName.trim()}>
                          {addingInsured ? t('crm.insured.adding') : t('crm.insured.add')}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            ) : null}

            <TabsContent value="profile" className="mt-6 space-y-6 outline-none">
              <InsuranceProfileTab
                apiBasePath={`/v1/leads/${lead.id}`}
                profile={lead.profile as InsuranceProfileShape}
                profileCompletenessScore={lead.profile_completeness_score}
                profileAlerts={lead.profile_alerts}
                reloadKey={lead.updated_at}
                readOnly={!!lead.converted_client_id}
                onAfterSave={load}
              />
            </TabsContent>


            <TabsContent value="interactions" className="mt-6 space-y-6 outline-none">
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                    <MessageSquare className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg tracking-tight">{t('crm.interactions.title')}</CardTitle>
                    <p className="text-muted-foreground text-sm">{t('crm.interactions.subtitle')}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {interactions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t('crm.interactions.empty')}</p>
                  ) : (
                    <div className="max-h-[min(24rem,50vh)] overflow-auto rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('crm.table.date')}</TableHead>
                            <TableHead>{t('crm.table.type')}</TableHead>
                            <TableHead>{t('crm.table.summary')}</TableHead>
                            <TableHead className="hidden md:table-cell">{t('crm.table.author')}</TableHead>
                            <TableHead className="hidden sm:table-cell">{t('crm.table.opp')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {interactions.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="whitespace-nowrap text-xs">
                                {new Date(row.occurred_at).toLocaleString()}
                              </TableCell>
                              <TableCell className="font-medium">
                                {translateInteractionType(row.interaction_type, t)}
                              </TableCell>
                              <TableCell
                                className="max-w-[min(20rem,40vw)] text-sm"
                                title={row.summary}
                              >
                                <span className="line-clamp-2 whitespace-pre-wrap">{row.summary}</span>
                              </TableCell>
                              <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                                {row.created_by.full_name ?? row.created_by.email}
                              </TableCell>
                              <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
                                {row.opportunity_id ? t('crm.interactions.linkedOpp') : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {!lead.converted_client_id ? (
                    <form className="grid gap-3" onSubmit={onAddInteraction}>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="lead-ix-type">{t('crm.interactions.type')}</Label>
                          <FormSelect
                            id="lead-ix-type"
                            value={ixType}
                            onValueChange={setIxType}
                            options={INTERACTION_TYPES.map((code) => ({
                              value: code,
                              label: translateInteractionType(code, t),
                            }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="lead-ix-opp">{t('crm.interactions.opportunityOptional')}</Label>
                          <FormSelect
                            id="lead-ix-opp"
                            value={ixOppId}
                            onValueChange={setIxOppId}
                            allowEmpty
                            emptyLabel={t('crm.interactions.noOpp')}
                            placeholder={t('crm.interactions.noOpp')}
                            options={leadOpportunities.map((o) => ({
                              value: o.id,
                              label: `${translateOpportunityStage(o.stage, t)} (${translateOpportunityStatus(o.status, t)})`,
                            }))}
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lead-ix-sum">{t('crm.interactions.summary')}</Label>
                        <textarea
                          id="lead-ix-sum"
                          className="border-input bg-background min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
                          value={ixSummary}
                          onChange={(ev) => setIxSummary(ev.target.value)}
                        />
                      </div>
                      <Button type="submit" disabled={addingIx || !ixSummary.trim()}>
                        {addingIx ? t('crm.interactions.adding') : t('crm.interactions.add')}
                      </Button>
                    </form>
                  ) : (
                    <p className="text-muted-foreground text-sm">{t('crm.leads.detail.interactionsConvertedHint')}</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {!lead.converted_client_id ? (
                <TabsContent value="portfolio" className="mt-6 space-y-6 outline-none">
                  <Card className="border-border/80 shadow-sm">
                    <CardHeader className="flex flex-row items-start gap-4 pb-2">
                      <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                        <Package className="size-5" aria-hidden />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="text-lg tracking-tight">{t('crm.portfolio.heldTitle')}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(lead.held_products ?? []).length === 0 ? (
                        <p className="text-muted-foreground text-sm">{t('crm.portfolio.heldEmpty')}</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('crm.table.product')}</TableHead>
                              <TableHead className="hidden sm:table-cell">{t('crm.table.insurer')}</TableHead>
                              <TableHead>{t('crm.table.source')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(lead.held_products ?? []).map((h) => (
                              <TableRow key={h.id}>
                                <TableCell className="font-medium">
                                  {h.product?.name ?? t('crm.portfolio.unlinkedProduct')}
                                </TableCell>
                                <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                                  {h.insurer_name ?? '—'}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {translateIngestionSource(h.ingestion_source, t)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                      <form className="grid gap-4 sm:grid-cols-2" onSubmit={onAddHeld}>
                        <div className="grid gap-2">
                          <Label htmlFor="lead-held-prod">{t('crm.portfolio.catalogProduct')}</Label>
                          <FormSelect
                            id="lead-held-prod"
                            value={heldProductId}
                            onValueChange={setHeldProductId}
                            allowEmpty
                            emptyLabel={t('crm.portfolio.optionalProduct')}
                            placeholder={t('crm.portfolio.optionalProduct')}
                            options={products.map((p) => ({ value: p.id, label: p.name }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="lead-held-ins">{t('crm.portfolio.insurerOptional')}</Label>
                          <Input
                            id="lead-held-ins"
                            value={heldInsurer}
                            onChange={(ev) => setHeldInsurer(ev.target.value)}
                            autoComplete="off"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Button type="submit" disabled={addingHeld}>
                            {addingHeld ? t('crm.portfolio.addingHeld') : t('crm.portfolio.addHeld')}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>
            ) : null}

            <TabsContent value="intel" className="mt-6 space-y-6 outline-none">
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="flex flex-row items-start gap-4 pb-2">
                  <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                    <Sparkles className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg tracking-tight">{t('crm.intel.title')}</CardTitle>
                    <p className="text-muted-foreground text-sm">{t('crm.intel.subtitle')}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {adequacy ? (
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="text-muted-foreground">{t('crm.intel.traffic')}: </span>
                        <span
                          className={
                            adequacy.traffic_light === 'RED'
                              ? 'font-semibold text-red-600'
                              : adequacy.traffic_light === 'YELLOW'
                                ? 'font-semibold text-amber-600'
                                : 'font-semibold text-emerald-600'
                          }
                        >
                          {adequacy.traffic_light}
                        </span>
                      </p>
                      {adequacy.source === 'batch' && adequacy.computed_at ? (
                        <p className="text-muted-foreground text-xs">
                          {t('crm.intel.adequacyBatchLine', {
                            when: new Date(adequacy.computed_at).toLocaleString(),
                          })}
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-xs">{t('crm.intel.adequacyLiveLine')}</p>
                      )}
                      <p>
                        <span className="text-muted-foreground">{t('crm.intel.summary')}: </span>
                        {adequacy.summary}
                      </p>
                      {adequacy.reasons.length > 0 ? (
                        <div>
                          <p className="text-muted-foreground mb-1">{t('crm.intel.reasons')}</p>
                          <ul className="list-inside list-disc text-xs">
                            {adequacy.reasons.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="space-y-3 border-t pt-4">
                    <div>
                      <p className="text-sm font-medium">{t('crm.intel.livePreviewTitle')}</p>
                      <p className="text-muted-foreground text-xs">{t('crm.intel.livePreviewSubtitle')}</p>
                    </div>
                    {recPreviewLoading ? (
                      <p className="text-muted-foreground text-sm">{t('crm.opportunities.recLoading')}</p>
                    ) : recPreview ? (
                      <>
                        {recPreview.items.length > 0 ? (
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
                                    <span className="font-medium text-foreground">
                                      {t('crm.intel.rulesMatched')}:{' '}
                                    </span>
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
                                  <span className="font-medium text-foreground">
                                    {t('crm.intel.nbaLabel')}:{' '}
                                  </span>
                                  {it.next_best_action}
                                </p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-muted-foreground text-sm">{t('crm.opportunities.recEmpty')}</p>
                        )}
                        {recPreview.rule_trace.length > 0 ? (
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              {t('crm.intel.ruleTraceTitle')}
                            </summary>
                            <ul className="mt-2 space-y-1 font-mono">
                              {recPreview.rule_trace.map((tr) => (
                                <li key={tr.rule_id}>
                                  <span
                                    className={tr.fired ? 'text-emerald-700' : 'text-muted-foreground'}
                                  >
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={recPreviewLoading || !leadId}
                      onClick={() => void loadRecPreview()}
                    >
                      {t('crm.intel.refreshPreview')}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    disabled={runRecLoading || !leadId}
                    onClick={() => void onRunLeadRecommendation()}
                  >
                    {runRecLoading ? t('crm.intel.running') : t('crm.intel.runRecommendation')}
                  </Button>
                  {recommendationRuns.length > 0 ? (
                    <div className="space-y-4">
                      <p className="text-muted-foreground text-sm font-medium">
                        {t('crm.intel.recentRuns')}
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('crm.table.date')}</TableHead>
                            <TableHead>{t('crm.intel.suggestionsCount')}</TableHead>
                            <TableHead className="hidden sm:table-cell">ID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recommendationRuns.map((run) => (
                            <TableRow key={`sum-${run.id}`}>
                              <TableCell className="whitespace-nowrap font-medium">
                                {new Date(run.created_at).toLocaleString()}
                              </TableCell>
                              <TableCell className="tabular-nums">{run.items.length}</TableCell>
                              <TableCell className="text-muted-foreground hidden max-w-[8rem] truncate font-mono text-xs sm:table-cell">
                                {run.id.slice(0, 8)}…
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <p className="text-muted-foreground text-xs">{t('crm.intel.runSummary')}</p>
                      {recommendationRuns.map((run) => (
                        <div key={run.id} className="bg-muted/40 rounded-md border p-3 text-xs">
                          <p className="text-muted-foreground mb-2">
                            {new Date(run.created_at).toLocaleString()} · {run.id.slice(0, 8)}…
                          </p>
                          {run.items.length === 0 ? (
                            <p>{t('crm.intel.noItems')}</p>
                          ) : (
                            <ul className="space-y-2">
                              {run.items.map((it) => (
                                <li
                                  key={`${run.id}-${it.product_id}`}
                                  className="border-t pt-2 first:border-0 first:pt-0"
                                >
                                  <span className="font-medium">{it.product_name}</span>
                                  <span className="text-muted-foreground ml-2">
                                    ({translateProductCategory(it.product_category, t)}) ·{' '}
                                    {t('crm.intel.itemPriority')}: {it.priority}
                                  </span>
                                  <p className="mt-1">{it.rationale}</p>
                                  {it.rule_ids.length > 0 ? (
                                    <p className="text-muted-foreground mt-1 text-[11px]">
                                      <span className="font-medium text-foreground">
                                        {t('crm.intel.rulesMatched')}:{' '}
                                      </span>
                                      {it.rule_ids.join(', ')}
                                    </p>
                                  ) : null}
                                  <p className="text-muted-foreground mt-1 text-[11px]">
                                    <span className="font-medium text-foreground">
                                      {t('crm.intel.protectionGapsLabel')}:{' '}
                                    </span>
                                    {it.protection_gaps}
                                  </p>
                                  <p className="text-muted-foreground mt-1 text-[11px]">
                                    <span className="font-medium text-foreground">
                                      {t('crm.intel.objectionsLabel')}:{' '}
                                    </span>
                                    {it.predictable_objections}
                                  </p>
                                  <p className="text-muted-foreground mt-1 text-[11px]">
                                    <span className="font-medium text-foreground">
                                      {t('crm.intel.nbaLabel')}:{' '}
                                    </span>
                                    {it.next_best_action}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                          {run.rule_trace.length > 0 ? (
                            <details className="mt-2 border-t pt-2">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                {t('crm.intel.ruleTraceTitle')}
                              </summary>
                              <ul className="mt-2 space-y-1 font-mono text-[11px]">
                                {run.rule_trace.map((tr) => (
                                  <li key={`${run.id}-${tr.rule_id}`}>
                                    <span
                                      className={
                                        tr.fired ? 'text-emerald-700' : 'text-muted-foreground'
                                      }
                                    >
                                      {tr.rule_id}{' '}
                                      {tr.fired
                                        ? `(${t('crm.intel.ruleTraceFired')})`
                                        : `(${t('crm.intel.ruleTraceNotFired')})`}
                                    </span>
                                    <span className="text-muted-foreground"> — {tr.detail}</span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            {!lead.converted_client_id ? (
                <TabsContent value="convert" className="mt-6 space-y-6 outline-none">
                  <Card className="border-border/80 shadow-sm">
                    <CardHeader className="flex flex-row items-start gap-4 pb-2">
                      <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                        <Sparkles className="size-5" aria-hidden />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="text-lg tracking-tight">{t('crm.leads.convertTitle')}</CardTitle>
                        <p className="text-muted-foreground text-sm">{t('crm.leads.convertSubtitle')}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <form className="space-y-4" onSubmit={onConvert}>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={withOpp}
                            onChange={(ev) => setWithOpp(ev.target.checked)}
                          />
                          {t('crm.leads.createOpp')}
                        </label>
                        {withOpp ? (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                              <Label htmlFor="conv-owner">{t('crm.leads.oppOwner')}</Label>
                              <FormSelect
                                id="conv-owner"
                                value={oppOwnerId}
                                onValueChange={setOppOwnerId}
                                options={orgUsers.map((u) => ({
                                  value: u.id,
                                  label: u.full_name ?? u.email,
                                }))}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="conv-prod">{t('crm.portfolio.catalogProduct')}</Label>
                              <FormSelect
                                id="conv-prod"
                                value={oppProductId}
                                onValueChange={setOppProductId}
                                allowEmpty
                                emptyLabel={t('crm.portfolio.optionalProduct')}
                                placeholder={t('crm.portfolio.optionalProduct')}
                                options={products.map((p) => ({ value: p.id, label: p.name }))}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="conv-val">{t('crm.leads.estimatedValue')}</Label>
                              <Input
                                id="conv-val"
                                value={oppValue}
                                onChange={(ev) => setOppValue(ev.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="conv-prob">{t('crm.opportunities.probability')} (%)</Label>
                              <Input
                                id="conv-prob"
                                type="number"
                                min={0}
                                max={100}
                                value={oppProb}
                                onChange={(ev) => setOppProb(ev.target.value)}
                              />
                            </div>
                          </div>
                        ) : null}
                        <Button type="submit" disabled={converting}>
                          {converting ? t('crm.leads.converting') : t('crm.leads.convert')}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>
            ) : null}
          </TabsRoot>
        </>
      ) : null}
    </div>
  )
}
