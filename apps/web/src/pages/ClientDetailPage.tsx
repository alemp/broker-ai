import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { apiFetch } from '@/lib/api'

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

function profileStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function profileIntStr(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
}

type LineOfBusinessDto = {
  id: string
  code: string
  name: string
}

type LobLinkDto = {
  id: string
  line_of_business_id: string
  ingestion_source: string
  line_of_business: LineOfBusinessDto
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
  lines_of_business: LobLinkDto[]
  held_products: HeldDto[]
  insured_persons: InsuredDto[]
  profile: Record<string, ProfileBlock>
  profile_completeness_score: number
  profile_alerts: string[]
}

type InteractionDto = {
  id: string
  interaction_type: string
  summary: string
  occurred_at: string
  opportunity_id: string | null
  created_by: { email: string; full_name: string | null }
}

type ClientOppRow = {
  id: string
  stage: string
  status: string
}

export function ClientDetailPage() {
  const { t } = useTranslation('common')
  const { clientId } = useParams<{ clientId: string }>()
  const [detail, setDetail] = useState<ClientDetail | null>(null)
  const [lobs, setLobs] = useState<LineOfBusinessDto[]>([])
  const [products, setProducts] = useState<ProductBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLob, setSelectedLob] = useState('')
  const [addingLob, setAddingLob] = useState(false)
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

  const loadAll = useCallback(async () => {
    if (!clientId) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [d, catalog, plist, ixList, oppList, users, audits, adeq, recRuns] =
        await Promise.all([
          apiFetch<ClientDetail>(`/v1/clients/${clientId}`),
          apiFetch<LineOfBusinessDto[]>('/v1/lines-of-business'),
          apiFetch<ProductBrief[]>('/v1/products'),
          apiFetch<InteractionDto[]>(`/v1/interactions?client_id=${clientId}&limit=100`),
          apiFetch<ClientOppRow[]>(`/v1/opportunities?client_id=${clientId}&limit=50`),
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
      setClientOpportunities(oppList)
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
      setLobs(catalog)
      setProducts(plist)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [clientId, t])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const onAddLob = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!clientId || !selectedLob) {
      return
    }
    setAddingLob(true)
    setError(null)
    try {
      await apiFetch(`/v1/clients/${clientId}/lines-of-business`, {
        method: 'POST',
        json: { line_of_business_id: selectedLob, ingestion_source: 'internal_crm' },
      })
      setSelectedLob('')
      await loadAll()
      toast.success(t('toast.lobAdded'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setAddingLob(false)
    }
  }

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
      />
      {!loading && !detail ? (
        <p className="text-destructive text-sm">{error ?? t('crm.error.notFound')}</p>
      ) : null}

      {error && detail ? <p className="text-destructive text-sm">{error}</p> : null}

      {detail ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('crm.core.title')}</CardTitle>
              <p className="text-muted-foreground text-sm">{t('crm.core.subtitle')}</p>
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
                  <Input
                    id="crm-mkt-ch"
                    value={crmMarketingChannel}
                    onChange={(ev) => setCrmMarketingChannel(ev.target.value)}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('crm.intel.title')}</CardTitle>
              <p className="text-muted-foreground text-sm">{t('crm.intel.subtitle')}</p>
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
              <Button
                type="button"
                disabled={runRecLoading || !clientId}
                onClick={() => void onRunRecommendation()}
              >
                {runRecLoading ? t('crm.intel.running') : t('crm.intel.runRecommendation')}
              </Button>
              {recommendationRuns.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-muted-foreground text-sm">{t('crm.intel.recentRuns')}</p>
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
                                ({it.product_category}) · {t('crm.intel.itemPriority')}:{' '}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('crm.insured.title')}</CardTitle>
              <p className="text-muted-foreground text-sm">{t('crm.insured.subtitle')}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {detail.insured_persons.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('crm.insured.empty')}</p>
              ) : (
                <ul className="text-sm">
                  {detail.insured_persons.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0"
                    >
                      <div>
                        <span className="font-medium">{p.full_name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{p.relation}</span>
                        {p.notes ? (
                          <p className="text-muted-foreground mt-1 text-xs">{p.notes}</p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void onDeleteInsured(p.id)}
                      >
                        {t('crm.insured.remove')}
                      </Button>
                    </li>
                  ))}
                </ul>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('crm.audit.title')}</CardTitle>
              <p className="text-muted-foreground text-sm">{t('crm.audit.subtitle')}</p>
            </CardHeader>
            <CardContent>
              {auditEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('crm.audit.empty')}</p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto text-xs">
                  {auditEvents.map((ev) => (
                    <li key={ev.id} className="border-b pb-2 font-mono last:border-0">
                      <span className="text-muted-foreground">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>{' '}
                      · {ev.entity_type} · {ev.action}
                      {ev.field_name ? (
                        <>
                          {' '}
                          · {ev.field_name}
                        </>
                      ) : null}
                      {ev.old_value != null || ev.new_value != null ? (
                        <div className="text-muted-foreground mt-1 break-all">
                          {ev.old_value ?? '—'} → {ev.new_value ?? '—'}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('crm.profile.title')}</CardTitle>
              <p className="text-muted-foreground text-sm">{t('crm.profile.subtitle')}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                <span className="text-muted-foreground">{t('crm.profile.completeness')}: </span>
                <span className="font-medium">{detail.profile_completeness_score}%</span>
              </p>
              <div>
                <p className="text-muted-foreground mb-2 text-sm">{t('crm.profile.alerts')}</p>
                {detail.profile_alerts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t('crm.profile.noAlerts')}</p>
                ) : (
                  <ul className="list-inside list-disc text-sm">
                    {detail.profile_alerts.map((code) => (
                      <li key={code}>{code}</li>
                    ))}
                  </ul>
                )}
              </div>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSaveProfile}>
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

                <div className="grid gap-2 sm:col-span-2">
                  <p className="text-muted-foreground border-border mt-2 border-t pt-4 text-sm font-medium">
                    {t('crm.profile.sectionB')}
                  </p>
                </div>
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

                <div className="grid gap-2 sm:col-span-2">
                  <p className="text-muted-foreground border-border mt-2 border-t pt-4 text-sm font-medium">
                    {t('crm.profile.sectionE')}
                  </p>
                </div>
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

                <div className="grid gap-2 sm:col-span-2">
                  <p className="text-muted-foreground border-border mt-2 border-t pt-4 text-sm font-medium">
                    {t('crm.profile.sectionF')}
                  </p>
                </div>
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

                <div className="grid gap-2 sm:col-span-2">
                  <p className="text-muted-foreground border-border mt-2 border-t pt-4 text-sm font-medium">
                    {t('crm.profile.sectionG')}
                  </p>
                </div>
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

                <div className="grid gap-2 sm:col-span-2">
                  <p className="text-muted-foreground border-border mt-2 border-t pt-4 text-sm font-medium">
                    {t('crm.profile.sectionH')}
                  </p>
                </div>
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

                <div className="sm:col-span-2">
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? t('crm.profile.saving') : t('crm.profile.save')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('crm.interactions.title')}</CardTitle>
              <p className="text-muted-foreground text-sm">{t('crm.interactions.subtitle')}</p>
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
                        {row.opportunity_id ? ` · ${t('crm.interactions.linkedOpp')}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
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
                        label: code,
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
                        label: `${o.stage} (${o.status})`,
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('crm.portfolio.lobTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {detail.lines_of_business.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('crm.portfolio.lobEmpty')}</p>
              ) : (
                <ul className="text-sm">
                  {detail.lines_of_business.map((l) => (
                    <li key={l.id} className="border-b py-2 last:border-0">
                      <span className="font-medium">{l.line_of_business.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({l.line_of_business.code}) · {l.ingestion_source}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onAddLob}>
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="add-lob">{t('crm.portfolio.addLob')}</Label>
                  <FormSelect
                    id="add-lob"
                    value={selectedLob}
                    onValueChange={setSelectedLob}
                    allowEmpty
                    emptyLabel={t('crm.portfolio.selectLob')}
                    placeholder={t('crm.portfolio.selectLob')}
                    options={lobs.map((l) => ({
                      value: l.id,
                      label: `${l.code} — ${l.name}`,
                    }))}
                  />
                </div>
                <Button type="submit" disabled={addingLob || !selectedLob}>
                  {addingLob ? t('crm.portfolio.adding') : t('crm.action.add')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('crm.portfolio.heldTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {detail.held_products.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t('crm.portfolio.heldEmpty')}</p>
              ) : (
                <ul className="text-sm">
                  {detail.held_products.map((h) => (
                    <li key={h.id} className="border-b py-2 last:border-0">
                      <span className="font-medium">{h.product?.name ?? t('crm.portfolio.unlinkedProduct')}</span>
                      {h.insurer_name ? (
                        <span className="text-muted-foreground ml-2 text-xs">{h.insurer_name}</span>
                      ) : null}
                      <div className="text-muted-foreground text-xs">{h.ingestion_source}</div>
                    </li>
                  ))}
                </ul>
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
        </>
      ) : null}
    </div>
  )
}
