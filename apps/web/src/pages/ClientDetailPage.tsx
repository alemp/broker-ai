import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import {
  Briefcase,
  Building2,
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
import { cn } from '@/lib/utils'

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

const LIFE_STAGE_OPTIONS = [
  { value: 'young_single' },
  { value: 'couple_no_children' },
  { value: 'young_family' },
  { value: 'family_with_teens' },
  { value: 'empty_nest' },
  { value: 'retired' },
  { value: 'entrepreneur' },
  { value: 'other' },
] as const

const PROPERTY_TYPE_OPTIONS = [
  { value: 'owned' },
  { value: 'financed' },
  { value: 'rented' },
] as const

const VEHICLE_PRIMARY_USE_OPTIONS = [
  { value: 'commute_work' },
  { value: 'personal_leisure' },
  { value: 'business_commercial' },
  { value: 'ride_hailing' },
  { value: 'long_distance' },
  { value: 'urban_only' },
  { value: 'other' },
] as const

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'CLT' },
  { value: 'self_employed' },
  { value: 'business_owner' },
  { value: 'public_servant' },
  { value: 'liberal_professional' },
  { value: 'other' },
] as const

const HEALTH_PLAN_TYPE_OPTIONS = [
  { value: 'individual' },
  { value: 'family' },
  { value: 'corporate' },
  { value: 'other' },
] as const

const CONTACT_CHANNEL_OPTIONS = [
  { value: 'phone' },
  { value: 'whatsapp' },
  { value: 'email' },
  { value: 'in_person' },
  { value: 'other' },
] as const

const VET_USAGE_OPTIONS = [
  { value: 'rarely' },
  { value: 'yearly_checkups' },
  { value: 'frequent' },
  { value: 'other' },
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

type ProfileInsuranceBlockProps = {
  title: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  children: ReactNode
  className?: string
}

function ProfileInsuranceBlock({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: ProfileInsuranceBlockProps) {
  return (
    <section
      className={cn(
        'border-border/60 from-muted/15 space-y-4 rounded-xl border bg-gradient-to-br to-transparent p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <div className="flex items-start gap-3 border-border/40 border-b pb-3">
        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>
          {subtitle ? (
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function profileStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function profileIntStr(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
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

  add('personal', t('crm.clientDetail.summary.sectionPersonal'), Home, [
    {
      label: t('crm.profile.lifeStage'),
      value:
        typeof per?.life_stage === 'string' && per.life_stage
          ? i18nProfileOption('crm.profile.lifeStageOption', per.life_stage, t)
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
      label: t('crm.profile.ownsVehicle'),
      value: triBoolToLabel(mob?.owns_vehicle, t),
    },
    {
      label: t('crm.profile.vehicleUse'),
      value:
        typeof mob?.vehicle_primary_use === 'string' && mob.vehicle_primary_use
          ? i18nProfileOption('crm.profile.vehicleUseOption', mob.vehicle_primary_use, t)
          : null,
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
  const [lifeStage, setLifeStage] = useState('')
  const [numChildren, setNumChildren] = useState('')
  const [ownsProperty, setOwnsProperty] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [ownsVehicle, setOwnsVehicle] = useState('')
  const [vehicleUse, setVehicleUse] = useState('')
  const [profProfession, setProfProfession] = useState('')
  const [profEmployment, setProfEmployment] = useState('')
  const [profIncomeBand, setProfIncomeBand] = useState('')
  const [profIncomeStability, setProfIncomeStability] = useState('')
  const [profWealthBand, setProfWealthBand] = useState('')
  const [profHasStake, setProfHasStake] = useState('')
  const [hlthHasPlan, setHlthHasPlan] = useState('')
  const [hlthPlanType, setHlthPlanType] = useState('')
  const [hlthLives, setHlthLives] = useState('')
  const [hlthDependentsAge, setHlthDependentsAge] = useState('')
  const [hlthSatisfaction, setHlthSatisfaction] = useState('')
  const [hlthInterest, setHlthInterest] = useState('')
  const [busOwns, setBusOwns] = useState('')
  const [busSegment, setBusSegment] = useState('')
  const [busRevenueBand, setBusRevenueBand] = useState('')
  const [busEmployees, setBusEmployees] = useState('')
  const [busBids, setBusBids] = useState('')
  const [busGuarantee, setBusGuarantee] = useState('')
  const [busBond, setBusBond] = useState('')
  const [petHas, setPetHas] = useState('')
  const [petSpecies, setPetSpecies] = useState('')
  const [petBreed, setPetBreed] = useState('')
  const [petAge, setPetAge] = useState('')
  const [petCount, setPetCount] = useState('')
  const [petVetFreq, setPetVetFreq] = useState('')
  const [behChannel, setBehChannel] = useState('')
  const [behTime, setBehTime] = useState('')
  const [behTeam, setBehTeam] = useState('')
  const [behDates, setBehDates] = useState('')
  const [behComm, setBehComm] = useState('')
  const [behLifeEvents, setBehLifeEvents] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [interactions, setInteractions] = useState<InteractionDto[]>([])
  const [clientOpportunities, setClientOpportunities] = useState<ClientOppRow[]>([])
  const [ixType, setIxType] = useState<string>('CALL')
  const [ixSummary, setIxSummary] = useState('')
  const [ixOppId, setIxOppId] = useState('')
  const [addingIx, setAddingIx] = useState(false)
  const [orgUsers, setOrgUsers] = useState<UserBrief[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEventDto[]>([])
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
      setCrmOwnerId(d.owner_id ?? '')
      setCrmKind(d.client_kind)
      setCrmLegal(d.company_legal_name ?? '')
      setCrmTax(d.company_tax_id ?? '')
      setCrmMarketingOptIn(d.marketing_opt_in ? 'yes' : 'no')
      setCrmMarketingChannel(d.preferred_marketing_channel ?? '')
      const per = d.profile.personal as Record<string, unknown> | null | undefined
      const res = d.profile.residence as Record<string, unknown> | null | undefined
      const mob = d.profile.mobility as Record<string, unknown> | null | undefined
      setLifeStage(typeof per?.life_stage === 'string' ? per.life_stage : '')
      setNumChildren(
        typeof per?.number_of_children === 'number' ? String(per.number_of_children) : '',
      )
      if (res?.owns_property === true) {
        setOwnsProperty('yes')
      } else if (res?.owns_property === false) {
        setOwnsProperty('no')
      } else {
        setOwnsProperty('')
      }
      setPropertyType(typeof res?.property_type === 'string' ? res.property_type : '')
      if (mob?.owns_vehicle === true) {
        setOwnsVehicle('yes')
      } else if (mob?.owns_vehicle === false) {
        setOwnsVehicle('no')
      } else {
        setOwnsVehicle('')
      }
      setVehicleUse(typeof mob?.vehicle_primary_use === 'string' ? mob.vehicle_primary_use : '')
      const pro = d.profile.professional as Record<string, unknown> | null | undefined
      setProfProfession(profileStr(pro?.profession))
      setProfEmployment(profileStr(pro?.employment_type))
      setProfIncomeBand(profileStr(pro?.approximate_income_band))
      setProfIncomeStability(profileStr(pro?.income_stability))
      setProfWealthBand(profileStr(pro?.wealth_band))
      if (pro?.has_company_stake === true) {
        setProfHasStake('yes')
      } else if (pro?.has_company_stake === false) {
        setProfHasStake('no')
      } else {
        setProfHasStake('')
      }
      const hlth = d.profile.health as Record<string, unknown> | null | undefined
      if (hlth?.has_health_plan === true) {
        setHlthHasPlan('yes')
      } else if (hlth?.has_health_plan === false) {
        setHlthHasPlan('no')
      } else {
        setHlthHasPlan('')
      }
      setHlthPlanType(profileStr(hlth?.health_plan_type))
      setHlthLives(profileIntStr(hlth?.health_lives_count))
      setHlthDependentsAge(profileStr(hlth?.dependents_age_band))
      setHlthSatisfaction(profileStr(hlth?.health_plan_satisfaction))
      setHlthInterest(profileStr(hlth?.health_plan_interest))
      const bus = d.profile.business as Record<string, unknown> | null | undefined
      if (bus?.owns_business === true) {
        setBusOwns('yes')
      } else if (bus?.owns_business === false) {
        setBusOwns('no')
      } else {
        setBusOwns('')
      }
      setBusSegment(profileStr(bus?.business_segment))
      setBusRevenueBand(profileStr(bus?.estimated_revenue_band))
      setBusEmployees(profileIntStr(bus?.employee_count))
      if (bus?.participates_bids === true) {
        setBusBids('yes')
      } else if (bus?.participates_bids === false) {
        setBusBids('no')
      } else {
        setBusBids('')
      }
      if (bus?.contracts_require_guarantee === true) {
        setBusGuarantee('yes')
      } else if (bus?.contracts_require_guarantee === false) {
        setBusGuarantee('no')
      } else {
        setBusGuarantee('')
      }
      if (bus?.needs_performance_bond === true) {
        setBusBond('yes')
      } else if (bus?.needs_performance_bond === false) {
        setBusBond('no')
      } else {
        setBusBond('')
      }
      const pet = d.profile.pet as Record<string, unknown> | null | undefined
      if (pet?.has_pet === true) {
        setPetHas('yes')
      } else if (pet?.has_pet === false) {
        setPetHas('no')
      } else {
        setPetHas('')
      }
      setPetSpecies(profileStr(pet?.pet_species))
      setPetBreed(profileStr(pet?.pet_breed))
      setPetAge(profileStr(pet?.pet_age))
      setPetCount(profileIntStr(pet?.pet_count))
      setPetVetFreq(profileStr(pet?.vet_usage_frequency))
      const beh = d.profile.behavior as Record<string, unknown> | null | undefined
      setBehChannel(profileStr(beh?.preferred_contact_channel))
      setBehTime(profileStr(beh?.preferred_contact_time))
      setBehTeam(profileStr(beh?.football_team))
      setBehDates(profileStr(beh?.relevant_dates_note))
      setBehComm(profileStr(beh?.communication_preferences))
      setBehLifeEvents(profileStr(beh?.life_events_note))
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

  const onSaveProfile = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!clientId) {
      return
    }
    setSavingProfile(true)
    setError(null)
    try {
      const personal: Record<string, unknown> = {}
      if (lifeStage.trim()) {
        personal.life_stage = lifeStage.trim()
      }
      if (numChildren.trim() !== '') {
        const n = parseInt(numChildren, 10)
        if (!Number.isNaN(n)) {
          personal.number_of_children = n
        }
      }
      const residence: Record<string, unknown> = {}
      if (ownsProperty === 'yes') {
        residence.owns_property = true
      }
      if (ownsProperty === 'no') {
        residence.owns_property = false
      }
      if (propertyType.trim()) {
        residence.property_type = propertyType.trim()
      }
      const mobility: Record<string, unknown> = {}
      if (ownsVehicle === 'yes') {
        mobility.owns_vehicle = true
      }
      if (ownsVehicle === 'no') {
        mobility.owns_vehicle = false
      }
      if (vehicleUse.trim()) {
        mobility.vehicle_primary_use = vehicleUse.trim()
      }
      const professional: Record<string, unknown> = {}
      if (profProfession.trim()) {
        professional.profession = profProfession.trim()
      }
      if (profEmployment.trim()) {
        professional.employment_type = profEmployment.trim()
      }
      if (profIncomeBand.trim()) {
        professional.approximate_income_band = profIncomeBand.trim()
      }
      if (profIncomeStability.trim()) {
        professional.income_stability = profIncomeStability.trim()
      }
      if (profWealthBand.trim()) {
        professional.wealth_band = profWealthBand.trim()
      }
      if (profHasStake === 'yes') {
        professional.has_company_stake = true
      }
      if (profHasStake === 'no') {
        professional.has_company_stake = false
      }
      const health: Record<string, unknown> = {}
      if (hlthHasPlan === 'yes') {
        health.has_health_plan = true
      }
      if (hlthHasPlan === 'no') {
        health.has_health_plan = false
      }
      if (hlthPlanType.trim()) {
        health.health_plan_type = hlthPlanType.trim()
      }
      if (hlthLives.trim() !== '') {
        const n = parseInt(hlthLives, 10)
        if (!Number.isNaN(n)) {
          health.health_lives_count = n
        }
      }
      if (hlthDependentsAge.trim()) {
        health.dependents_age_band = hlthDependentsAge.trim()
      }
      if (hlthSatisfaction.trim()) {
        health.health_plan_satisfaction = hlthSatisfaction.trim()
      }
      if (hlthInterest.trim()) {
        health.health_plan_interest = hlthInterest.trim()
      }
      const business: Record<string, unknown> = {}
      if (busOwns === 'yes') {
        business.owns_business = true
      }
      if (busOwns === 'no') {
        business.owns_business = false
      }
      if (busSegment.trim()) {
        business.business_segment = busSegment.trim()
      }
      if (busRevenueBand.trim()) {
        business.estimated_revenue_band = busRevenueBand.trim()
      }
      if (busEmployees.trim() !== '') {
        const n = parseInt(busEmployees, 10)
        if (!Number.isNaN(n)) {
          business.employee_count = n
        }
      }
      if (busBids === 'yes') {
        business.participates_bids = true
      }
      if (busBids === 'no') {
        business.participates_bids = false
      }
      if (busGuarantee === 'yes') {
        business.contracts_require_guarantee = true
      }
      if (busGuarantee === 'no') {
        business.contracts_require_guarantee = false
      }
      if (busBond === 'yes') {
        business.needs_performance_bond = true
      }
      if (busBond === 'no') {
        business.needs_performance_bond = false
      }
      const petBlock: Record<string, unknown> = {}
      if (petHas === 'yes') {
        petBlock.has_pet = true
      }
      if (petHas === 'no') {
        petBlock.has_pet = false
      }
      if (petSpecies.trim()) {
        petBlock.pet_species = petSpecies.trim()
      }
      if (petBreed.trim()) {
        petBlock.pet_breed = petBreed.trim()
      }
      if (petAge.trim()) {
        petBlock.pet_age = petAge.trim()
      }
      if (petCount.trim() !== '') {
        const n = parseInt(petCount, 10)
        if (!Number.isNaN(n)) {
          petBlock.pet_count = n
        }
      }
      if (petVetFreq.trim()) {
        petBlock.vet_usage_frequency = petVetFreq.trim()
      }
      const behavior: Record<string, unknown> = {}
      if (behChannel.trim()) {
        behavior.preferred_contact_channel = behChannel.trim()
      }
      if (behTime.trim()) {
        behavior.preferred_contact_time = behTime.trim()
      }
      if (behTeam.trim()) {
        behavior.football_team = behTeam.trim()
      }
      if (behDates.trim()) {
        behavior.relevant_dates_note = behDates.trim()
      }
      if (behComm.trim()) {
        behavior.communication_preferences = behComm.trim()
      }
      if (behLifeEvents.trim()) {
        behavior.life_events_note = behLifeEvents.trim()
      }
      const json: Record<string, Record<string, unknown>> = {}
      if (Object.keys(personal).length > 0) {
        json.personal = personal
      }
      if (Object.keys(residence).length > 0) {
        json.residence = residence
      }
      if (Object.keys(mobility).length > 0) {
        json.mobility = mobility
      }
      if (Object.keys(professional).length > 0) {
        json.professional = professional
      }
      if (Object.keys(health).length > 0) {
        json.health = health
      }
      if (Object.keys(business).length > 0) {
        json.business = business
      }
      if (Object.keys(petBlock).length > 0) {
        json.pet = petBlock
      }
      if (Object.keys(behavior).length > 0) {
        json.behavior = behavior
      }
      await apiFetch(`/v1/clients/${clientId}/profile`, {
        method: 'PATCH',
        json,
      })
      await loadAll()
      toast.success(t('toast.saved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSavingProfile(false)
    }
  }

  const onSaveCrmCore = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!clientId) {
      return
    }
    setSavingCrm(true)
    setError(null)
    try {
      await apiFetch(`/v1/clients/${clientId}`, {
        method: 'PATCH',
        json: {
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border-border/80 from-card to-muted/15 flex items-center gap-3 rounded-xl border bg-gradient-to-br px-4 py-3 shadow-sm">
              <div className="bg-primary/15 text-primary rounded-lg p-2">
                <ClipboardCheck className="size-5 shrink-0" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {t('crm.clientDetail.statsCompleteness')}
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {detail.profile_completeness_score}%
                </p>
              </div>
            </div>
            <div className="border-border/80 from-card to-muted/15 flex items-center gap-3 rounded-xl border bg-gradient-to-br px-4 py-3 shadow-sm">
              <div className="bg-primary/15 text-primary rounded-lg p-2">
                <Users className="size-5 shrink-0" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {t('crm.clientDetail.statsInsured')}
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {detail.insured_persons.length}
                </p>
              </div>
            </div>
            <div className="border-border/80 from-card to-muted/15 flex items-center gap-3 rounded-xl border bg-gradient-to-br px-4 py-3 shadow-sm">
              <div className="bg-primary/15 text-primary rounded-lg p-2">
                <MessageSquare className="size-5 shrink-0" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {t('crm.clientDetail.statsInteractions')}
                </p>
                <p className="text-2xl font-semibold tabular-nums">{interactions.length}</p>
              </div>
            </div>
          </div>

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
              className="h-auto w-full flex-wrap justify-start gap-1"
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
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-start gap-4 pb-2">
              <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                <UserCircle className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg tracking-tight">{t('crm.profile.title')}</CardTitle>
                <p className="text-muted-foreground text-sm">{t('crm.profile.subtitle')}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-border/60 from-primary/5 space-y-4 rounded-xl border bg-gradient-to-br to-transparent p-4 sm:p-5">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t('crm.profile.insuranceIntro')}
                </p>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{t('crm.profile.completeness')}</span>
                    <span className="font-semibold tabular-nums">{detail.profile_completeness_score}%</span>
                  </div>
                  <div
                    className="bg-muted h-2.5 w-full max-w-md overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuenow={detail.profile_completeness_score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('crm.profile.completeness')}
                  >
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, detail.profile_completeness_score))}%` }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                    {t('crm.profile.alerts')}
                  </p>
                  {detail.profile_alerts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t('crm.profile.noAlerts')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {detail.profile_alerts.map((code) => (
                        <span
                          key={code}
                          className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-950 dark:text-amber-100"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <form className="space-y-6" onSubmit={onSaveProfile}>
                <ProfileInsuranceBlock
                  title={t('crm.profile.insuranceSection.personal')}
                  subtitle={t('crm.profile.insuranceSection.personalHint')}
                  icon={Home}
                >
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pf-life">{t('crm.profile.lifeStage')}</Label>
                  <FormSelect
                    id="pf-life"
                    value={lifeStage}
                    onValueChange={setLifeStage}
                    allowEmpty
                    emptyLabel={t('crm.profile.selectPlaceholder')}
                    placeholder={t('crm.profile.selectPlaceholder')}
                    extraOptions={
                      lifeStage &&
                      !LIFE_STAGE_OPTIONS.some((o) => o.value === lifeStage)
                        ? [{ value: lifeStage, label: lifeStage }]
                        : undefined
                    }
                    options={LIFE_STAGE_OPTIONS.map((o) => ({
                      value: o.value,
                      label: t(`crm.profile.lifeStageOption.${o.value}`),
                    }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-children">{t('crm.profile.children')}</Label>
                  <Input
                    id="pf-children"
                    type="number"
                    min={0}
                    value={numChildren}
                    onChange={(ev) => setNumChildren(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-owns-prop">{t('crm.profile.ownsProperty')}</Label>
                  <FormSelect
                    id="pf-owns-prop"
                    value={ownsProperty}
                    onValueChange={setOwnsProperty}
                    allowEmpty
                    emptyLabel="—"
                    options={[
                      { value: 'yes', label: t('crm.profile.yes') },
                      { value: 'no', label: t('crm.profile.no') },
                    ]}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pf-prop-type">{t('crm.profile.propertyType')}</Label>
                  <FormSelect
                    id="pf-prop-type"
                    value={propertyType}
                    onValueChange={setPropertyType}
                    allowEmpty
                    emptyLabel={t('crm.profile.selectPlaceholder')}
                    placeholder={t('crm.profile.selectPlaceholder')}
                    extraOptions={
                      propertyType &&
                      !PROPERTY_TYPE_OPTIONS.some((o) => o.value === propertyType)
                        ? [{ value: propertyType, label: propertyType }]
                        : undefined
                    }
                    options={PROPERTY_TYPE_OPTIONS.map((o) => ({
                      value: o.value,
                      label: t(`crm.profile.propertyTypeOption.${o.value}`),
                    }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-owns-veh">{t('crm.profile.ownsVehicle')}</Label>
                  <FormSelect
                    id="pf-owns-veh"
                    value={ownsVehicle}
                    onValueChange={setOwnsVehicle}
                    allowEmpty
                    emptyLabel="—"
                    options={[
                      { value: 'yes', label: t('crm.profile.yes') },
                      { value: 'no', label: t('crm.profile.no') },
                    ]}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-veh-use">{t('crm.profile.vehicleUse')}</Label>
                  <FormSelect
                    id="pf-veh-use"
                    value={vehicleUse}
                    onValueChange={setVehicleUse}
                    allowEmpty
                    emptyLabel={t('crm.profile.selectPlaceholder')}
                    placeholder={t('crm.profile.selectPlaceholder')}
                    extraOptions={
                      vehicleUse &&
                      !VEHICLE_PRIMARY_USE_OPTIONS.some((o) => o.value === vehicleUse)
                        ? [{ value: vehicleUse, label: vehicleUse }]
                        : undefined
                    }
                    options={VEHICLE_PRIMARY_USE_OPTIONS.map((o) => ({
                      value: o.value,
                      label: t(`crm.profile.vehicleUseOption.${o.value}`),
                    }))}
                  />
                </div>
                </ProfileInsuranceBlock>

                <ProfileInsuranceBlock
                  title={t('crm.profile.insuranceSection.professional')}
                  subtitle={t('crm.profile.insuranceSection.professionalHint')}
                  icon={Briefcase}
                >
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pf-prof">{t('crm.profile.profession')}</Label>
                  <Input
                    id="pf-prof"
                    value={profProfession}
                    onChange={(ev) => setProfProfession(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-emp">{t('crm.profile.employmentType')}</Label>
                  <FormSelect
                    id="pf-emp"
                    value={profEmployment}
                    onValueChange={setProfEmployment}
                    allowEmpty
                    emptyLabel={t('crm.profile.selectPlaceholder')}
                    placeholder={t('crm.profile.selectPlaceholder')}
                    extraOptions={
                      profEmployment &&
                      !EMPLOYMENT_TYPE_OPTIONS.some((o) => o.value === profEmployment)
                        ? [{ value: profEmployment, label: profEmployment }]
                        : undefined
                    }
                    options={EMPLOYMENT_TYPE_OPTIONS.map((o) => ({
                      value: o.value,
                      label: t(`crm.profile.employmentTypeOption.${o.value}`),
                    }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-inc">{t('crm.profile.incomeBand')}</Label>
                  <Input
                    id="pf-inc"
                    value={profIncomeBand}
                    onChange={(ev) => setProfIncomeBand(ev.target.value)}
                    placeholder={t('crm.profile.incomeBandHint')}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-stab">{t('crm.profile.incomeStability')}</Label>
                  <Input
                    id="pf-stab"
                    value={profIncomeStability}
                    onChange={(ev) => setProfIncomeStability(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-wealth">{t('crm.profile.wealthBand')}</Label>
                  <Input
                    id="pf-wealth"
                    value={profWealthBand}
                    onChange={(ev) => setProfWealthBand(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-stake">{t('crm.profile.hasCompanyStake')}</Label>
                  <FormSelect
                    id="pf-stake"
                    value={profHasStake}
                    onValueChange={setProfHasStake}
                    allowEmpty
                    emptyLabel="—"
                    options={[
                      { value: 'yes', label: t('crm.profile.yes') },
                      { value: 'no', label: t('crm.profile.no') },
                    ]}
                  />
                </div>
                </ProfileInsuranceBlock>

                <ProfileInsuranceBlock
                  title={t('crm.profile.insuranceSection.health')}
                  subtitle={t('crm.profile.insuranceSection.healthHint')}
                  icon={HeartPulse}
                >
                <div className="grid gap-2">
                  <Label htmlFor="pf-hlth-plan">{t('crm.profile.hasHealthPlan')}</Label>
                  <FormSelect
                    id="pf-hlth-plan"
                    value={hlthHasPlan}
                    onValueChange={setHlthHasPlan}
                    allowEmpty
                    emptyLabel="—"
                    options={[
                      { value: 'yes', label: t('crm.profile.yes') },
                      { value: 'no', label: t('crm.profile.no') },
                    ]}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-hlth-type">{t('crm.profile.healthPlanType')}</Label>
                  <FormSelect
                    id="pf-hlth-type"
                    value={hlthPlanType}
                    onValueChange={setHlthPlanType}
                    allowEmpty
                    emptyLabel={t('crm.profile.selectPlaceholder')}
                    placeholder={t('crm.profile.selectPlaceholder')}
                    extraOptions={
                      hlthPlanType &&
                      !HEALTH_PLAN_TYPE_OPTIONS.some((o) => o.value === hlthPlanType)
                        ? [{ value: hlthPlanType, label: hlthPlanType }]
                        : undefined
                    }
                    options={HEALTH_PLAN_TYPE_OPTIONS.map((o) => ({
                      value: o.value,
                      label: t(`crm.profile.healthPlanTypeOption.${o.value}`),
                    }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-hlth-lives">{t('crm.profile.healthLivesCount')}</Label>
                  <Input
                    id="pf-hlth-lives"
                    type="number"
                    min={0}
                    value={hlthLives}
                    onChange={(ev) => setHlthLives(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-hlth-age">{t('crm.profile.dependentsAgeBand')}</Label>
                  <Input
                    id="pf-hlth-age"
                    value={hlthDependentsAge}
                    onChange={(ev) => setHlthDependentsAge(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-hlth-sat">{t('crm.profile.healthSatisfaction')}</Label>
                  <Input
                    id="pf-hlth-sat"
                    value={hlthSatisfaction}
                    onChange={(ev) => setHlthSatisfaction(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pf-hlth-int">{t('crm.profile.healthInterest')}</Label>
                  <Input
                    id="pf-hlth-int"
                    value={hlthInterest}
                    onChange={(ev) => setHlthInterest(ev.target.value)}
                  />
                </div>
                </ProfileInsuranceBlock>

                <ProfileInsuranceBlock
                  title={t('crm.profile.insuranceSection.business')}
                  subtitle={t('crm.profile.insuranceSection.businessHint')}
                  icon={Building2}
                >
                <div className="grid gap-2">
                  <Label htmlFor="pf-bus-own">{t('crm.profile.ownsBusiness')}</Label>
                  <FormSelect
                    id="pf-bus-own"
                    value={busOwns}
                    onValueChange={setBusOwns}
                    allowEmpty
                    emptyLabel="—"
                    options={[
                      { value: 'yes', label: t('crm.profile.yes') },
                      { value: 'no', label: t('crm.profile.no') },
                    ]}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pf-bus-seg">{t('crm.profile.businessSegment')}</Label>
                  <Input
                    id="pf-bus-seg"
                    value={busSegment}
                    onChange={(ev) => setBusSegment(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-bus-rev">{t('crm.profile.revenueBand')}</Label>
                  <Input
                    id="pf-bus-rev"
                    value={busRevenueBand}
                    onChange={(ev) => setBusRevenueBand(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-bus-emp">{t('crm.profile.employeeCount')}</Label>
                  <Input
                    id="pf-bus-emp"
                    type="number"
                    min={0}
                    value={busEmployees}
                    onChange={(ev) => setBusEmployees(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-bus-bids">{t('crm.profile.participatesBids')}</Label>
                  <FormSelect
                    id="pf-bus-bids"
                    value={busBids}
                    onValueChange={setBusBids}
                    allowEmpty
                    emptyLabel="—"
                    options={[
                      { value: 'yes', label: t('crm.profile.yes') },
                      { value: 'no', label: t('crm.profile.no') },
                    ]}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-bus-guar">{t('crm.profile.contractsGuarantee')}</Label>
                  <FormSelect
                    id="pf-bus-guar"
                    value={busGuarantee}
                    onValueChange={setBusGuarantee}
                    allowEmpty
                    emptyLabel="—"
                    options={[
                      { value: 'yes', label: t('crm.profile.yes') },
                      { value: 'no', label: t('crm.profile.no') },
                    ]}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-bus-bond">{t('crm.profile.needsPerformanceBond')}</Label>
                  <FormSelect
                    id="pf-bus-bond"
                    value={busBond}
                    onValueChange={setBusBond}
                    allowEmpty
                    emptyLabel="—"
                    options={[
                      { value: 'yes', label: t('crm.profile.yes') },
                      { value: 'no', label: t('crm.profile.no') },
                    ]}
                  />
                </div>
                </ProfileInsuranceBlock>

                <ProfileInsuranceBlock
                  title={t('crm.profile.insuranceSection.pet')}
                  subtitle={t('crm.profile.insuranceSection.petHint')}
                  icon={PawPrint}
                >
                <div className="grid gap-2">
                  <Label htmlFor="pf-pet-has">{t('crm.profile.hasPet')}</Label>
                  <FormSelect
                    id="pf-pet-has"
                    value={petHas}
                    onValueChange={setPetHas}
                    allowEmpty
                    emptyLabel="—"
                    options={[
                      { value: 'yes', label: t('crm.profile.yes') },
                      { value: 'no', label: t('crm.profile.no') },
                    ]}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-pet-spec">{t('crm.profile.petSpecies')}</Label>
                  <Input
                    id="pf-pet-spec"
                    value={petSpecies}
                    onChange={(ev) => setPetSpecies(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-pet-breed">{t('crm.profile.petBreed')}</Label>
                  <Input
                    id="pf-pet-breed"
                    value={petBreed}
                    onChange={(ev) => setPetBreed(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-pet-age">{t('crm.profile.petAge')}</Label>
                  <Input
                    id="pf-pet-age"
                    value={petAge}
                    onChange={(ev) => setPetAge(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-pet-count">{t('crm.profile.petCount')}</Label>
                  <Input
                    id="pf-pet-count"
                    type="number"
                    min={0}
                    value={petCount}
                    onChange={(ev) => setPetCount(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pf-pet-vet">{t('crm.profile.vetUsage')}</Label>
                  <FormSelect
                    id="pf-pet-vet"
                    value={petVetFreq}
                    onValueChange={setPetVetFreq}
                    allowEmpty
                    emptyLabel={t('crm.profile.selectPlaceholder')}
                    placeholder={t('crm.profile.selectPlaceholder')}
                    extraOptions={
                      petVetFreq && !VET_USAGE_OPTIONS.some((o) => o.value === petVetFreq)
                        ? [{ value: petVetFreq, label: petVetFreq }]
                        : undefined
                    }
                    options={VET_USAGE_OPTIONS.map((o) => ({
                      value: o.value,
                      label: t(`crm.profile.vetUsageOption.${o.value}`),
                    }))}
                  />
                </div>
                </ProfileInsuranceBlock>

                <ProfileInsuranceBlock
                  title={t('crm.profile.insuranceSection.behavior')}
                  subtitle={t('crm.profile.insuranceSection.behaviorHint')}
                  icon={Contact}
                >
                <div className="grid gap-2">
                  <Label htmlFor="pf-beh-ch">{t('crm.profile.preferredChannel')}</Label>
                  <FormSelect
                    id="pf-beh-ch"
                    value={behChannel}
                    onValueChange={setBehChannel}
                    allowEmpty
                    emptyLabel={t('crm.profile.selectPlaceholder')}
                    placeholder={t('crm.profile.selectPlaceholder')}
                    extraOptions={
                      behChannel && !CONTACT_CHANNEL_OPTIONS.some((o) => o.value === behChannel)
                        ? [{ value: behChannel, label: behChannel }]
                        : undefined
                    }
                    options={CONTACT_CHANNEL_OPTIONS.map((o) => ({
                      value: o.value,
                      label: t(`crm.profile.contactChannelOption.${o.value}`),
                    }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-beh-time">{t('crm.profile.preferredTime')}</Label>
                  <Input
                    id="pf-beh-time"
                    value={behTime}
                    onChange={(ev) => setBehTime(ev.target.value)}
                    placeholder={t('crm.profile.preferredTimeHint')}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pf-beh-team">{t('crm.profile.footballTeam')}</Label>
                  <Input
                    id="pf-beh-team"
                    value={behTeam}
                    onChange={(ev) => setBehTeam(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pf-beh-dates">{t('crm.profile.relevantDates')}</Label>
                  <textarea
                    id="pf-beh-dates"
                    className="border-input bg-background min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
                    value={behDates}
                    onChange={(ev) => setBehDates(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pf-beh-comm">{t('crm.profile.communicationPrefs')}</Label>
                  <textarea
                    id="pf-beh-comm"
                    className="border-input bg-background min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
                    value={behComm}
                    onChange={(ev) => setBehComm(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pf-beh-life">{t('crm.profile.lifeEvents')}</Label>
                  <textarea
                    id="pf-beh-life"
                    className="border-input bg-background min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
                    value={behLifeEvents}
                    onChange={(ev) => setBehLifeEvents(ev.target.value)}
                  />
                </div>
                </ProfileInsuranceBlock>

                <div className="border-border flex justify-start border-t pt-2">
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? t('crm.profile.saving') : t('crm.profile.save')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
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
