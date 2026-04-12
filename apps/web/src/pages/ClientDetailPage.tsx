import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import {
  Briefcase,
  Building2,
  Car,
  ClipboardCheck,
  ClipboardList,
  Contact,
  FolderTree,
  HeartPulse,
  Home,
  IdCard,
  Megaphone,
  MessageSquare,
  Package,
  PawPrint,
  ScrollText,
  Sparkles,
  UserCircle,
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


function insuredRelationLabel(relation: string, translate: (key: string) => string): string {
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

function auditEnumLabel(
  prefix: 'crm.audit.action' | 'crm.audit.entity',
  value: string,
  translate: (key: string) => string,
): string {
  const key = `${prefix}.${value}`
  const out = translate(key)
  return out === key ? value : out
}


function profileStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function profileIntStr(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
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

type ProductBrief = {
  id: string
  name: string
  category: string
}

type HeldDto = {
  id: string
  product_id: string | null
  insurer_name: string | null
  policy_status: string | null
  ingestion_source: string
  product: ProductBrief | null
}

type ProfileBlock = Record<string, unknown> | null

type UserBrief = {
  id: string
  email: string
  full_name: string | null
}

type InsuredDto = {
  id: string
  full_name: string
  relation: string
  notes: string | null
}

type AuditEventDto = {
  id: string
  entity_type: string
  entity_id: string
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
  actor_user_id: string
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

type ClientDetail = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  notes: string | null
  owner_id: string | null
  owner: UserBrief | null
  client_kind: string
  company_legal_name: string | null
  company_tax_id: string | null
  marketing_opt_in: boolean
  preferred_marketing_channel: string | null
  held_products: HeldDto[]
  insured_persons: InsuredDto[]
  profile: Record<string, ProfileBlock>
  profile_completeness_score: number
  profile_alerts: string[]
  updated_at: string
}

type GeneralSummarySection = {
  key: string
  title: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  items: { label: string; value: string }[]
}

function i18nProfileOption(
  prefix: string,
  value: string,
  translate: (key: string) => string,
): string {
  const k = `${prefix}.${value}`
  const out = translate(k)
  return out === k ? value : out
}

function triBoolToLabel(v: unknown, translate: (key: string) => string): string | null {
  if (v === true) {
    return translate('crm.profile.yes')
  }
  if (v === false) {
    return translate('crm.profile.no')
  }
  return null
}

function buildGeneralSummarySections(
  d: ClientDetail,
  translate: (key: string) => string,
): GeneralSummarySection[] {
  const t = translate
  const sections: GeneralSummarySection[] = []

  const add = (
    key: string,
    title: string,
    icon: GeneralSummarySection['icon'],
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

  add('contact', t('crm.clientDetail.summary.sectionContact'), UserCircle, [
    { label: t('crm.clientDetail.summary.name'), value: d.full_name?.trim() || null },
    { label: t('crm.clientDetail.summary.email'), value: d.email?.trim() || null },
    { label: t('crm.clientDetail.summary.phone'), value: d.phone?.trim() || null },
    {
      label: t('crm.clientDetail.summary.dateOfBirth'),
      value: formatPtDateOnly(d.date_of_birth),
    },
    { label: t('crm.clientDetail.summary.notes'), value: d.notes?.trim() || null },
  ])

  add('crm', t('crm.clientDetail.summary.sectionCrm'), IdCard, [
    {
      label: t('crm.core.owner'),
      value: d.owner ? (d.owner.full_name?.trim() || d.owner.email) : null,
    },
    {
      label: t('crm.core.kind'),
      value:
        d.client_kind === 'COMPANY'
          ? t('crm.core.kindCompany')
          : d.client_kind === 'INDIVIDUAL'
            ? t('crm.core.kindIndividual')
            : d.client_kind,
    },
    { label: t('crm.core.companyLegal'), value: d.company_legal_name?.trim() || null },
    { label: t('crm.core.companyTax'), value: d.company_tax_id?.trim() || null },
  ])

  add('marketing', t('crm.clientDetail.summary.sectionMarketing'), Megaphone, [
    {
      label: t('crm.core.marketingOptIn'),
      value: d.marketing_opt_in ? t('crm.profile.yes') : t('crm.profile.no'),
    },
    {
      label: t('crm.core.marketingChannel'),
      value: marketingChannelSummaryLabel(d.preferred_marketing_channel, t),
    },
  ])

  const per = d.profile.personal as Record<string, unknown> | null | undefined
  const res = d.profile.residence as Record<string, unknown> | null | undefined
  const mob = d.profile.mobility as Record<string, unknown> | null | undefined

  add('family', t('crm.clientDetail.summary.sectionFamily'), Users, [
    {
      label: t('crm.profile.lifeStage'),
      value:
        typeof per?.life_stage === 'string' && per.life_stage
          ? i18nProfileOption('crm.profile.lifeStageOption', per.life_stage, t)
          : null,
    },
    {
      label: t('crm.profile.maritalStatus'),
      value:
        typeof per?.marital_status === 'string' && per.marital_status
          ? i18nProfileOption('crm.profile.maritalStatusOption', per.marital_status, t)
          : null,
    },
    {
      label: t('crm.profile.children'),
      value:
        typeof per?.number_of_children === 'number' && Number.isFinite(per.number_of_children)
          ? String(per.number_of_children)
          : null,
    },
    {
      label: t('crm.profile.childrenAgesSummary'),
      value: profileStr(per?.children_ages_summary) || null,
    },
    {
      label: t('crm.profile.financialDependents'),
      value:
        typeof per?.financial_dependents === 'number' && Number.isFinite(per.financial_dependents)
          ? String(per.financial_dependents)
          : null,
    },
    {
      label: t('crm.profile.mainIncomeProvider'),
      value: profileStr(per?.main_income_provider) || null,
    },
    {
      label: t('crm.profile.hasPartner'),
      value: triBoolToLabel(per?.has_partner, t),
    },
  ])

  add('property', t('crm.clientDetail.summary.sectionProperty'), Home, [
    {
      label: t('crm.profile.ownsProperty'),
      value: triBoolToLabel(res?.owns_property, t),
    },
    {
      label: t('crm.profile.propertyType'),
      value:
        typeof res?.property_type === 'string' && res.property_type
          ? i18nProfileOption('crm.profile.propertyTypeOption', res.property_type, t)
          : null,
    },
    {
      label: t('crm.profile.propertyUse'),
      value:
        typeof res?.property_use === 'string' && res.property_use
          ? i18nProfileOption('crm.profile.propertyUseOption', res.property_use, t)
          : null,
    },
    {
      label: t('crm.profile.propertyValueBand'),
      value: profileStr(res?.property_value_band) || null,
    },
    {
      label: t('crm.profile.propertyLocation'),
      value: profileStr(res?.property_location) || null,
    },
    {
      label: t('crm.profile.propertyStyle'),
      value:
        typeof res?.property_style === 'string' && res.property_style
          ? i18nProfileOption('crm.profile.propertyStyleOption', res.property_style, t)
          : null,
    },
    {
      label: t('crm.profile.highValueItems'),
      value: triBoolToLabel(res?.high_value_items, t),
    },
  ])

  add('vehicle', t('crm.clientDetail.summary.sectionVehicle'), Car, [
    {
      label: t('crm.profile.ownsVehicle'),
      value: triBoolToLabel(mob?.owns_vehicle, t),
    },
    {
      label: t('crm.profile.vehicleCount'),
      value:
        typeof mob?.vehicle_count === 'number' && Number.isFinite(mob.vehicle_count)
          ? String(mob.vehicle_count)
          : null,
    },
    {
      label: t('crm.profile.vehicleType'),
      value: profileStr(mob?.vehicle_type) || null,
    },
    {
      label: t('crm.profile.vehicleYear'),
      value:
        typeof mob?.vehicle_year === 'number' && Number.isFinite(mob.vehicle_year)
          ? String(mob.vehicle_year)
          : null,
    },
    {
      label: t('crm.profile.vehicleUse'),
      value:
        typeof mob?.vehicle_primary_use === 'string' && mob.vehicle_primary_use
          ? i18nProfileOption('crm.profile.vehicleUseOption', mob.vehicle_primary_use, t)
          : null,
    },
    {
      label: t('crm.profile.primaryDriver'),
      value: profileStr(mob?.primary_driver) || null,
    },
    {
      label: t('crm.profile.hasGarage'),
      value: triBoolToLabel(mob?.has_garage, t),
    },
    {
      label: t('crm.profile.circulationCity'),
      value: profileStr(mob?.circulation_city) || null,
    },
  ])

  const pro = d.profile.professional as Record<string, unknown> | null | undefined
  add('professional', t('crm.clientDetail.summary.sectionProfessional'), Briefcase, [
    { label: t('crm.profile.profession'), value: profileStr(pro?.profession) || null },
    {
      label: t('crm.profile.employmentType'),
      value:
        typeof pro?.employment_type === 'string' && pro.employment_type
          ? i18nProfileOption('crm.profile.employmentTypeOption', pro.employment_type, t)
          : null,
    },
    {
      label: t('crm.profile.incomeBand'),
      value: profileStr(pro?.approximate_income_band) || null,
    },
    {
      label: t('crm.profile.incomeStability'),
      value: profileStr(pro?.income_stability) || null,
    },
    { label: t('crm.profile.wealthBand'), value: profileStr(pro?.wealth_band) || null },
    {
      label: t('crm.profile.hasCompanyStake'),
      value: triBoolToLabel(pro?.has_company_stake, t),
    },
  ])

  const hlth = d.profile.health as Record<string, unknown> | null | undefined
  add('health', t('crm.clientDetail.summary.sectionHealth'), HeartPulse, [
    { label: t('crm.profile.hasHealthPlan'), value: triBoolToLabel(hlth?.has_health_plan, t) },
    {
      label: t('crm.profile.healthPlanType'),
      value:
        typeof hlth?.health_plan_type === 'string' && hlth.health_plan_type
          ? i18nProfileOption('crm.profile.healthPlanTypeOption', hlth.health_plan_type, t)
          : null,
    },
    {
      label: t('crm.profile.healthLivesCount'),
      value: profileIntStr(hlth?.health_lives_count) || null,
    },
    {
      label: t('crm.profile.dependentsAgeBand'),
      value: profileStr(hlth?.dependents_age_band) || null,
    },
    {
      label: t('crm.profile.healthSatisfaction'),
      value: profileStr(hlth?.health_plan_satisfaction) || null,
    },
    {
      label: t('crm.profile.healthInterest'),
      value: profileStr(hlth?.health_plan_interest) || null,
    },
  ])

  const bus = d.profile.business as Record<string, unknown> | null | undefined
  add('business', t('crm.clientDetail.summary.sectionBusiness'), Building2, [
    { label: t('crm.profile.ownsBusiness'), value: triBoolToLabel(bus?.owns_business, t) },
    { label: t('crm.profile.businessSegment'), value: profileStr(bus?.business_segment) || null },
    {
      label: t('crm.profile.revenueBand'),
      value: profileStr(bus?.estimated_revenue_band) || null,
    },
    { label: t('crm.profile.employeeCount'), value: profileIntStr(bus?.employee_count) || null },
    { label: t('crm.profile.participatesBids'), value: triBoolToLabel(bus?.participates_bids, t) },
    {
      label: t('crm.profile.contractsGuarantee'),
      value: triBoolToLabel(bus?.contracts_require_guarantee, t),
    },
    {
      label: t('crm.profile.needsPerformanceBond'),
      value: triBoolToLabel(bus?.needs_performance_bond, t),
    },
  ])

  const pet = d.profile.pet as Record<string, unknown> | null | undefined
  add('pet', t('crm.clientDetail.summary.sectionPet'), PawPrint, [
    { label: t('crm.profile.hasPet'), value: triBoolToLabel(pet?.has_pet, t) },
    { label: t('crm.profile.petSpecies'), value: profileStr(pet?.pet_species) || null },
    { label: t('crm.profile.petBreed'), value: profileStr(pet?.pet_breed) || null },
    { label: t('crm.profile.petAge'), value: profileStr(pet?.pet_age) || null },
    { label: t('crm.profile.petCount'), value: profileIntStr(pet?.pet_count) || null },
    {
      label: t('crm.profile.vetUsage'),
      value:
        typeof pet?.vet_usage_frequency === 'string' && pet.vet_usage_frequency
          ? i18nProfileOption('crm.profile.vetUsageOption', pet.vet_usage_frequency, t)
          : null,
    },
  ])

  const beh = d.profile.behavior as Record<string, unknown> | null | undefined
  add('behavior', t('crm.clientDetail.summary.sectionBehavior'), Contact, [
    {
      label: t('crm.profile.preferredChannel'),
      value:
        typeof beh?.preferred_contact_channel === 'string' && beh.preferred_contact_channel
          ? i18nProfileOption('crm.profile.contactChannelOption', beh.preferred_contact_channel, t)
          : null,
    },
    {
      label: t('crm.profile.preferredTime'),
      value: profileStr(beh?.preferred_contact_time) || null,
    },
    { label: t('crm.profile.footballTeam'), value: profileStr(beh?.football_team) || null },
    {
      label: t('crm.profile.relevantDates'),
      value: profileStr(beh?.relevant_dates_note) || null,
    },
    {
      label: t('crm.profile.communicationPrefs'),
      value: profileStr(beh?.communication_preferences) || null,
    },
    { label: t('crm.profile.lifeEvents'), value: profileStr(beh?.life_events_note) || null },
  ])

  const portfolioItems: { label: string; value: string }[] = []
  if (d.held_products.length > 0) {
    portfolioItems.push({
      label: t('crm.clientDetail.summary.heldProducts'),
      value: d.held_products
        .map((h) => h.product?.name ?? h.insurer_name ?? t('crm.clientDetail.summary.productUnnamed'))
        .join(', '),
    })
  }
  if (portfolioItems.length > 0) {
    sections.push({
      key: 'portfolio',
      title: t('crm.clientDetail.summary.sectionPortfolio'),
      icon: FolderTree,
      items: portfolioItems,
    })
  }

  if (d.insured_persons.length > 0) {
    sections.push({
      key: 'insured',
      title: t('crm.clientDetail.summary.sectionInsured'),
      icon: Users,
      items: d.insured_persons.map((p) => ({
        label: insuredRelationLabel(p.relation, t),
        value: [p.full_name?.trim(), p.notes?.trim()].filter(Boolean).join(' — ') || '—',
      })),
    })
  }

  return sections
}

type InteractionDto = {
  id: string
  interaction_type: string
  summary: string
  occurred_at: string
  opportunity_id: string | null
  created_by: { email: string; full_name: string | null }
}

type ClientOppRow = Pick<PartyOppRow, 'id' | 'stage' | 'status'>

export function ClientDetailPage() {
  const { t } = useTranslation('common')
  const { clientId } = useParams<{ clientId: string }>()
  const [detail, setDetail] = useState<ClientDetail | null>(null)
  const [products, setProducts] = useState<ProductBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState('')
  const [insurer, setInsurer] = useState('')
  const [addingHeld, setAddingHeld] = useState(false)
  const [interactions, setInteractions] = useState<InteractionDto[]>([])
  const [clientOpportunities, setClientOpportunities] = useState<ClientOppRow[]>([])
  const [ixType, setIxType] = useState<string>('CALL')
  const [ixSummary, setIxSummary] = useState('')
  const [ixOppId, setIxOppId] = useState('')
  const [addingIx, setAddingIx] = useState(false)
  const [orgUsers, setOrgUsers] = useState<UserBrief[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEventDto[]>([])
  const [crmFullName, setCrmFullName] = useState('')
  const [crmEmail, setCrmEmail] = useState('')
  const [crmPhone, setCrmPhone] = useState('')
  const [crmBirthDate, setCrmBirthDate] = useState('')
  const [crmOwnerId, setCrmOwnerId] = useState('')
  const [crmKind, setCrmKind] = useState('INDIVIDUAL')
  const [crmLegal, setCrmLegal] = useState('')
  const [crmTax, setCrmTax] = useState('')
  const [savingCrm, setSavingCrm] = useState(false)
  const [insuredName, setInsuredName] = useState('')
  const [insuredRelation, setInsuredRelation] = useState('HOLDER')
  const [insuredNotes, setInsuredNotes] = useState('')
  const [addingInsured, setAddingInsured] = useState(false)
  const [crmMarketingOptIn, setCrmMarketingOptIn] = useState('yes')
  const [crmMarketingChannel, setCrmMarketingChannel] = useState('')
  const [adequacy, setAdequacy] = useState<AdequacyDto | null>(null)
  const [recommendationRuns, setRecommendationRuns] = useState<RecommendationRunDto[]>([])
  const [runRecLoading, setRunRecLoading] = useState(false)
  const [recPreview, setRecPreview] = useState<RecPreviewDto | null>(null)
  const [recPreviewLoading, setRecPreviewLoading] = useState(false)

  const loadAll = useCallback(async () => {
    if (!clientId) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [d, plist, ixList, users, audits, adeq, recRuns] = await Promise.all([
          apiFetch<ClientDetail>(`/v1/clients/${clientId}`),
          apiFetch<ProductBrief[]>('/v1/products'),
          apiFetch<InteractionDto[]>(`/v1/interactions?client_id=${clientId}&limit=100`),
          apiFetch<UserBrief[]>('/v1/org/users'),
          apiFetch<AuditEventDto[]>(`/v1/clients/${clientId}/audit-events?limit=100`),
          apiFetch<AdequacyDto>(`/v1/clients/${clientId}/adequacy`),
          apiFetch<RecommendationRunDto[]>(
            `/v1/clients/${clientId}/recommendation-runs?limit=5`,
          ),
        ])
      setAdequacy(adeq)
      setRecommendationRuns(recRuns)
      setInteractions(ixList)
      setDetail(d)
      setOrgUsers(users)
      setAuditEvents(audits)
      setCrmFullName(d.full_name)
      setCrmEmail(d.email ?? '')
      setCrmPhone(d.phone ?? '')
      setCrmBirthDate(d.date_of_birth ? d.date_of_birth.slice(0, 10) : '')
      setCrmOwnerId(d.owner_id ?? '')
      setCrmKind(d.client_kind)
      setCrmLegal(d.company_legal_name ?? '')
      setCrmTax(d.company_tax_id ?? '')
      setCrmMarketingOptIn(d.marketing_opt_in ? 'yes' : 'no')
      setCrmMarketingChannel(d.preferred_marketing_channel ?? '')
      setProducts(plist)
      try {
        const prev = await apiFetch<RecPreviewDto>(`/v1/clients/${clientId}/recommendations`)
        setRecPreview(prev)
      } catch {
        setRecPreview(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [clientId, t])

  const loadRecPreview = useCallback(async () => {
    if (!clientId) {
      return
    }
    setRecPreviewLoading(true)
    try {
      const prev = await apiFetch<RecPreviewDto>(`/v1/clients/${clientId}/recommendations`)
      setRecPreview(prev)
    } catch {
      setRecPreview(null)
    } finally {
      setRecPreviewLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const onAddHeld = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!clientId) {
      return
    }
    setAddingHeld(true)
    setError(null)
    try {
      await apiFetch(`/v1/clients/${clientId}/held-products`, {
        method: 'POST',
        json: {
          product_id: selectedProduct || undefined,
          insurer_name: insurer.trim() || undefined,
          ingestion_source: 'internal_crm',
        },
      })
      setSelectedProduct('')
      setInsurer('')
      await loadAll()
      toast.success(t('toast.heldAdded'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setAddingHeld(false)
    }
  }

  const onSaveCrmCore = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!clientId) {
      return
    }
    if (!crmFullName.trim()) {
      setError(t('crm.core.fullNameRequired'))
      return
    }
    setSavingCrm(true)
    setError(null)
    try {
      await apiFetch(`/v1/clients/${clientId}`, {
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
      await loadAll()
      toast.success(t('toast.saved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSavingCrm(false)
    }
  }

  const onAddInsured = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!clientId || !insuredName.trim()) {
      return
    }
    setAddingInsured(true)
    setError(null)
    try {
      await apiFetch(`/v1/clients/${clientId}/insured-persons`, {
        method: 'POST',
        json: {
          full_name: insuredName.trim(),
          relation: insuredRelation,
          notes: insuredNotes.trim() || undefined,
        },
      })
      setInsuredName('')
      setInsuredRelation('HOLDER')
      setInsuredNotes('')
      await loadAll()
      toast.success(t('toast.insuredAdded'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setAddingInsured(false)
    }
  }

  const onDeleteInsured = async (insuredId: string) => {
    if (!clientId) {
      return
    }
    setError(null)
    try {
      await apiFetch(`/v1/clients/${clientId}/insured-persons/${insuredId}`, {
        method: 'DELETE',
      })
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    }
  }

  const onRunRecommendation = async () => {
    if (!clientId) {
      return
    }
    setRunRecLoading(true)
    setError(null)
    try {
      const run = await apiFetch<RecommendationRunDto>(`/v1/clients/${clientId}/recommendation-runs`, {
        method: 'POST',
        json: {},
      })
      setRecommendationRuns((prev) => [run, ...prev])
      const ad = await apiFetch<AdequacyDto>(`/v1/clients/${clientId}/adequacy`)
      setAdequacy(ad)
      try {
        const prev = await apiFetch<RecPreviewDto>(`/v1/clients/${clientId}/recommendations`)
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

  const onAddInteraction = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!clientId || !ixSummary.trim()) {
      return
    }
    setAddingIx(true)
    setError(null)
    try {
      await apiFetch('/v1/interactions', {
        method: 'POST',
        json: {
          client_id: clientId,
          interaction_type: ixType,
          summary: ixSummary.trim(),
          ...(ixOppId ? { opportunity_id: ixOppId } : {}),
        },
      })
      setIxSummary('')
      setIxOppId('')
      await loadAll()
      toast.success(t('toast.interactionAdded'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setAddingIx(false)
    }
  }

  const generalSummarySections = useMemo(
    () => (detail ? buildGeneralSummarySections(detail, t) : []),
    [detail, t],
  )

  if (!clientId) {
    return null
  }

  const clientHeaderDescription = detail
    ? [detail.email, detail.phone].filter(Boolean).join(' · ') || t('crm.clients.noContact')
    : undefined

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ to: '/clients', label: t('crm.clients.back') }}
        titleLoading={loading}
        title={detail?.full_name ?? (loading ? '' : t('crm.error.notFound'))}
        description={clientHeaderDescription}
      >
        {detail && !loading ? (
          <Button asChild variant="default">
            <Link to={`/opportunities/new?client_id=${encodeURIComponent(detail.id)}`}>
              {t('crm.opportunities.new')}
            </Link>
          </Button>
        ) : null}
      </PageHeader>
      {!loading && !detail ? (
        <p className="text-destructive text-sm">{error ?? t('crm.error.notFound')}</p>
      ) : null}

      {error && detail ? <p className="text-destructive text-sm">{error}</p> : null}

      {detail ? (
        <>
          <CrmQuickStatsRow
            ariaLabel={t('crm.clientDetail.statsAria')}
            items={[
              {
                icon: ClipboardCheck,
                label: t('crm.clientDetail.statsCompleteness'),
                value: `${detail.profile_completeness_score}%`,
              },
              {
                icon: Users,
                label: t('crm.clientDetail.statsInsured'),
                value: detail.insured_persons.length,
              },
              {
                icon: MessageSquare,
                label: t('crm.clientDetail.statsInteractions'),
                value: interactions.length,
              },
              {
                icon: Package,
                label: t('crm.clientDetail.statsHeld'),
                value: detail.held_products.length,
              },
            ]}
          />

          <PartyOpportunitiesCard
            party={{ type: 'client', id: clientId }}
            viewStorageKey="ai-copilot:list-view:party-opportunities:client"
            searchFieldId="client-detail-opportunities-search"
            onOpportunitiesLoaded={(rows) =>
              setClientOpportunities(
                rows.map((r) => ({ id: r.id, stage: r.stage, status: r.status })),
              )
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
              <TabsTrigger value="crmCore">
                <Briefcase className="size-4" aria-hidden />
                {t('crm.clientDetail.tabCrmCore')}
              </TabsTrigger>
              <TabsTrigger value="intel">
                <Sparkles className="size-4" aria-hidden />
                {t('crm.clientDetail.tabIntel')}
              </TabsTrigger>
              <TabsTrigger value="insured">
                <Users className="size-4" aria-hidden />
                {t('crm.clientDetail.tabInsured')}
              </TabsTrigger>
              <TabsTrigger value="profile">
                <UserCircle className="size-4" aria-hidden />
                {t('crm.clientDetail.tabProfile')}
              </TabsTrigger>
              <TabsTrigger value="interactions">
                <MessageSquare className="size-4" aria-hidden />
                {t('crm.clientDetail.tabInteractions')}
              </TabsTrigger>
              <TabsTrigger value="portfolio">
                <FolderTree className="size-4" aria-hidden />
                {t('crm.clientDetail.tabPortfolio')}
              </TabsTrigger>
              <TabsTrigger value="audit">
                <ScrollText className="size-4" aria-hidden />
                {t('crm.clientDetail.tabAudit')}
              </TabsTrigger>
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
                  {generalSummarySections.map((sec) => {
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
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSaveCrmCore}>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="crm-full-name">{t('crm.clients.field.name')}</Label>
                  <Input
                    id="crm-full-name"
                    value={crmFullName}
                    onChange={(ev) => setCrmFullName(ev.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="crm-email">{t('crm.clients.field.emailOptional')}</Label>
                  <Input
                    id="crm-email"
                    type="email"
                    value={crmEmail}
                    onChange={(ev) => setCrmEmail(ev.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="crm-phone">{t('crm.clients.field.phoneOptional')}</Label>
                  <Input
                    id="crm-phone"
                    type="tel"
                    value={crmPhone}
                    onChange={(ev) => setCrmPhone(ev.target.value)}
                    autoComplete="tel"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="crm-dob">{t('crm.clients.field.dateOfBirthOptional')}</Label>
                  <Input
                    id="crm-dob"
                    type="date"
                    value={crmBirthDate}
                    onChange={(ev) => setCrmBirthDate(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="crm-owner">{t('crm.core.owner')}</Label>
                  <FormSelect
                    id="crm-owner"
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
                  <Label htmlFor="crm-kind">{t('crm.core.kind')}</Label>
                  <FormSelect
                    id="crm-kind"
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
                      <Label htmlFor="crm-legal">{t('crm.core.companyLegal')}</Label>
                      <Input
                        id="crm-legal"
                        value={crmLegal}
                        onChange={(ev) => setCrmLegal(ev.target.value)}
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="crm-tax">{t('crm.core.companyTax')}</Label>
                      <Input id="crm-tax" value={crmTax} onChange={(ev) => setCrmTax(ev.target.value)} />
                    </div>
                  </>
                ) : null}
                <div className="grid gap-2">
                  <Label htmlFor="crm-mkt-opt">{t('crm.core.marketingOptIn')}</Label>
                  <FormSelect
                    id="crm-mkt-opt"
                    value={crmMarketingOptIn}
                    onValueChange={setCrmMarketingOptIn}
                    options={[
                      { value: 'yes', label: t('crm.profile.yes') },
                      { value: 'no', label: t('crm.profile.no') },
                    ]}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="crm-mkt-ch">{t('crm.core.marketingChannel')}</Label>
                  <FormSelect
                    id="crm-mkt-ch"
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={recPreviewLoading || !clientId}
                  onClick={() => void loadRecPreview()}
                >
                  {t('crm.intel.refreshPreview')}
                </Button>
              </div>
              <Button
                type="button"
                disabled={runRecLoading || !clientId}
                onClick={() => void onRunRecommendation()}
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
                            <li key={`${run.id}-${it.product_id}`} className="border-t pt-2 first:border-0 first:pt-0">
                              <span className="font-medium">{it.product_name}</span>
                              <span className="text-muted-foreground ml-2">
                                ({translateProductCategory(it.product_category, t)}) ·{' '}
                                {t('crm.intel.itemPriority')}:{' '}
                                {it.priority}
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
                                <span className={tr.fired ? 'text-emerald-700' : 'text-muted-foreground'}>
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
              {detail.insured_persons.length === 0 ? (
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
                    {detail.insured_persons.map((p) => (
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
                  <Label htmlFor="ins-name">{t('crm.insured.name')}</Label>
                  <Input
                    id="ins-name"
                    value={insuredName}
                    onChange={(ev) => setInsuredName(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ins-rel">{t('crm.insured.relation')}</Label>
                  <FormSelect
                    id="ins-rel"
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
                  <Label htmlFor="ins-notes">{t('crm.insured.notesOptional')}</Label>
                  <Input
                    id="ins-notes"
                    value={insuredNotes}
                    onChange={(ev) => setInsuredNotes(ev.target.value)}
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

            <TabsContent value="profile" className="mt-6 space-y-6 outline-none">
              <InsuranceProfileTab
                apiBasePath={`/v1/clients/${clientId}`}
                profile={detail.profile as InsuranceProfileShape}
                profileCompletenessScore={detail.profile_completeness_score}
                profileAlerts={detail.profile_alerts}
                reloadKey={detail.updated_at}
                onAfterSave={loadAll}
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
              <form className="grid gap-3" onSubmit={onAddInteraction}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="ix-type">{t('crm.interactions.type')}</Label>
                    <FormSelect
                      id="ix-type"
                      value={ixType}
                      onValueChange={setIxType}
                      options={INTERACTION_TYPES.map((code) => ({
                        value: code,
                        label: translateInteractionType(code, t),
                      }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ix-opp">{t('crm.interactions.opportunityOptional')}</Label>
                    <FormSelect
                      id="ix-opp"
                      value={ixOppId}
                      onValueChange={setIxOppId}
                      allowEmpty
                      emptyLabel={t('crm.interactions.noOpp')}
                      placeholder={t('crm.interactions.noOpp')}
                      options={clientOpportunities.map((o) => ({
                        value: o.id,
                        label: `${translateOpportunityStage(o.stage, t)} (${translateOpportunityStatus(o.status, t)})`,
                      }))}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ix-sum">{t('crm.interactions.summary')}</Label>
                  <textarea
                    id="ix-sum"
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
            </TabsContent>

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
              {detail.held_products.length === 0 ? (
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
                    {detail.held_products.map((h) => (
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
                  <Label htmlFor="held-product">{t('crm.portfolio.catalogProduct')}</Label>
                  <FormSelect
                    id="held-product"
                    value={selectedProduct}
                    onValueChange={setSelectedProduct}
                    allowEmpty
                    emptyLabel={t('crm.portfolio.optionalProduct')}
                    placeholder={t('crm.portfolio.optionalProduct')}
                    options={products.map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="held-insurer">{t('crm.portfolio.insurerOptional')}</Label>
                  <Input
                    id="held-insurer"
                    value={insurer}
                    onChange={(ev) => setInsurer(ev.target.value)}
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

            <TabsContent value="audit" className="mt-6 space-y-6 outline-none">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-start gap-4 pb-2">
              <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                <ScrollText className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg tracking-tight">{t('crm.audit.title')}</CardTitle>
                <p className="text-muted-foreground text-sm">{t('crm.audit.subtitle')}</p>
              </div>
            </CardHeader>
            <CardContent>
              {auditEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('crm.audit.empty')}</p>
              ) : (
                <div className="max-h-[min(28rem,55vh)] overflow-auto rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('crm.table.date')}</TableHead>
                        <TableHead>{t('crm.table.entity')}</TableHead>
                        <TableHead>{t('crm.table.action')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('crm.table.field')}</TableHead>
                        <TableHead className="hidden xl:table-cell">{t('crm.table.change')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditEvents.map((ev) => (
                        <TableRow key={ev.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {new Date(ev.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            {auditEnumLabel('crm.audit.entity', ev.entity_type, t)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {auditEnumLabel('crm.audit.action', ev.action, t)}
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden font-mono text-xs lg:table-cell">
                            {ev.field_name ?? '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden max-w-[14rem] break-all text-xs xl:table-cell">
                            {ev.old_value != null || ev.new_value != null
                              ? `${ev.old_value ?? '—'} → ${ev.new_value ?? '—'}`
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>
          </TabsRoot>
        </>
      ) : null}
    </div>
  )
}
