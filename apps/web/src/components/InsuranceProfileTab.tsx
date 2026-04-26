import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Briefcase,
  Building2,
  Car,
  Contact,
  HeartPulse,
  Loader2,
  PawPrint,
  UserCircle,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch, getApiBaseUrl, getStoredAccessToken } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/money'


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
      <div className="grid min-w-0 grid-cols-2 gap-4">{children}</div>
    </section>
  )
}

function profileStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function profileIntStr(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
}

async function downloadWithAuth(path: string, filename: string): Promise<void> {
  const token = getStoredAccessToken()
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Download failed (${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

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

const PROPERTY_USE_OPTIONS = [
  { value: 'primary_residence' },
  { value: 'rental_income' },
  { value: 'vacation' },
] as const

const PROPERTY_STYLE_OPTIONS = [
  { value: 'condo' },
  { value: 'house' },
] as const

const MARITAL_STATUS_OPTIONS = [
  { value: 'single' },
  { value: 'married' },
  { value: 'civil_union' },
  { value: 'divorced' },
  { value: 'widowed' },
  { value: 'other' },
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


export type InsuranceProfileShape = Record<string, Record<string, unknown> | null | undefined | null>

export type InsuranceProfileTabProps = {
  /** e.g. `/v1/clients/${id}` or `/v1/leads/${id}` */
  apiBasePath: string
  profile: InsuranceProfileShape
  profileCompletenessScore: number
  profileAlerts: string[]
  clientKind?: string
  /** When this value changes, form fields reset from `profile` */
  reloadKey: string
  readOnly?: boolean
  onAfterSave?: () => void | Promise<void>
}


export function InsuranceProfileTab({
  apiBasePath,
  profile,
  profileCompletenessScore,
  profileAlerts,
  clientKind,
  reloadKey,
  readOnly = false,
  onAfterSave,
}: InsuranceProfileTabProps) {
  const { t, i18n } = useTranslation('common')
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [lifeStage, setLifeStage] = useState('')
  const [numChildren, setNumChildren] = useState('')
  const [ownsProperty, setOwnsProperty] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [ownsVehicle, setOwnsVehicle] = useState('')
  const [vehicleUse, setVehicleUse] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [childrenAgesSummary, setChildrenAgesSummary] = useState('')
  const [financialDependents, setFinancialDependents] = useState('')
  const [mainIncomeProvider, setMainIncomeProvider] = useState('')
  const [hasPartner, setHasPartner] = useState('')
  const [propertyUse, setPropertyUse] = useState('')
  const [propertyValueBand, setPropertyValueBand] = useState('')
  const [propertyLocation, setPropertyLocation] = useState('')
  const [propertyStyle, setPropertyStyle] = useState('')
  const [highValueItems, setHighValueItems] = useState('')
  const [vehicleCount, setVehicleCount] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [primaryDriver, setPrimaryDriver] = useState('')
  const [hasGarage, setHasGarage] = useState('')
  const [circulationCity, setCirculationCity] = useState('')
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
  const [giActivity, setGiActivity] = useState('')
  const [giHasInsurance, setGiHasInsurance] = useState('')
  const [giPoliciesNote, setGiPoliciesNote] = useState('')
  const [giPolicyDocIds, setGiPolicyDocIds] = useState<string[]>([])
  const [giPolicyDocOptions, setGiPolicyDocOptions] = useState<
    { id: string; label: string; original_filename: string }[]
  >([])
  const [giPolicyUploadFile, setGiPolicyUploadFile] = useState<File | null>(null)
  const [giPolicyUploading, setGiPolicyUploading] = useState(false)

  const [giIndHasInsurance, setGiIndHasInsurance] = useState('')
  const [giIndPoliciesNote, setGiIndPoliciesNote] = useState('')
  const [giIndPolicyDocIds, setGiIndPolicyDocIds] = useState<string[]>([])
  const [giIndPolicyUploadFile, setGiIndPolicyUploadFile] = useState<File | null>(null)
  const [giIndPolicyUploading, setGiIndPolicyUploading] = useState(false)
  const [giValBuilding, setGiValBuilding] = useState('')
  const [giValMmu, setGiValMmu] = useState('')
  const [giValMmp, setGiValMmp] = useState('')
  const [giFireExtinguishers, setGiFireExtinguishers] = useState(false)
  const [giFireHydrants, setGiFireHydrants] = useState(false)
  const [giFireSprinklers, setGiFireSprinklers] = useState(false)
  const [giFireBrigade, setGiFireBrigade] = useState(false)
  const [giFireDetectors, setGiFireDetectors] = useState(false)
  const [giFireReserveLiters, setGiFireReserveLiters] = useState('')
  const [giTheftCctv, setGiTheftCctv] = useState(false)
  const [giTheftAlarm, setGiTheftAlarm] = useState(false)
  const [giTheftSensors, setGiTheftSensors] = useState(false)
  const [giTheftPanicButton, setGiTheftPanicButton] = useState(false)
  const [giTheftGuardsArmed, setGiTheftGuardsArmed] = useState(false)
  const [giTheftGuardsUnarmed, setGiTheftGuardsUnarmed] = useState(false)
  const [giClaimsNote, setGiClaimsNote] = useState('')
  const [giClaimsRows, setGiClaimsRows] = useState<
    { occurred_at: string; claimed_amount: string; paid_amount: string; status: string; notes: string }[]
  >([])
  const [giCurrentInsurer, setGiCurrentInsurer] = useState('')
  const [giCurrentAnnualPremium, setGiCurrentAnnualPremium] = useState('')
  const [giTargetPremium, setGiTargetPremium] = useState('')
  const [giTargetCommission, setGiTargetCommission] = useState('')

  const money = {
    locale: i18n.resolvedLanguage ?? 'pt',
    currency: user?.organization.currency ?? 'BRL',
  }
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const isCompany = clientKind === 'COMPANY'
  const showIndividualBlocks = !isCompany

  const loadPolicyDocs = async (cancelledRef: { cancelled: boolean }) => {
    try {
      const docs = await apiFetch<
        { id: string; document_type: string; original_filename: string; updated_at: string }[]
      >('/v1/documents')
      if (cancelledRef.cancelled) return
      const policies = docs
        .filter((d) => d.document_type === 'POLICY')
        .map((d) => ({
          id: d.id,
          original_filename: d.original_filename,
          label: `${d.original_filename} · ${new Date(d.updated_at).toLocaleDateString(
            i18n.resolvedLanguage ?? 'pt',
          )}`,
        }))
      setGiPolicyDocOptions(policies)
    } catch {
      if (!cancelledRef.cancelled) setGiPolicyDocOptions([])
    }
  }

  useEffect(() => {
    const ref = { cancelled: false }
    void loadPolicyDocs(ref)
    return () => {
      ref.cancelled = true
    }
  }, [i18n.resolvedLanguage])

  const uploadPolicyDoc = async (file: File) => {
    const token = getStoredAccessToken()
    const headers = new Headers()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const body = new FormData()
    body.append('document_type', 'POLICY')
    body.append('file', file)
    const res = await fetch(`${getApiBaseUrl()}/v1/documents`, {
      method: 'POST',
      headers,
      body,
    })
    const text = await res.text()
    if (!res.ok) {
      throw new Error(text || `Upload failed (${res.status})`)
    }
    const data = JSON.parse(text) as { id: string; original_filename: string }
    return data
  }

  const onUploadCompanyPolicy = async () => {
    if (!isAdmin || !giPolicyUploadFile) return
    setGiPolicyUploading(true)
    try {
      const up = await uploadPolicyDoc(giPolicyUploadFile)
      toast.success('Documento enviado.')
      setGiPolicyUploadFile(null)
      const ref = { cancelled: false }
      await loadPolicyDocs(ref)
      setGiPolicyDocIds((prev) => (prev.includes(up.id) ? prev : [...prev, up.id]))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setGiPolicyUploading(false)
    }
  }

  const onUploadIndividualPolicy = async () => {
    if (!isAdmin || !giIndPolicyUploadFile) return
    setGiIndPolicyUploading(true)
    try {
      const up = await uploadPolicyDoc(giIndPolicyUploadFile)
      toast.success('Documento enviado.')
      setGiIndPolicyUploadFile(null)
      const ref = { cancelled: false }
      await loadPolicyDocs(ref)
      setGiIndPolicyDocIds((prev) => (prev.includes(up.id) ? prev : [...prev, up.id]))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setGiIndPolicyUploading(false)
    }
  }

  useEffect(() => {
      const per = profile.personal as Record<string, unknown> | null | undefined
      const res = profile.residence as Record<string, unknown> | null | undefined
      const mob = profile.mobility as Record<string, unknown> | null | undefined
      setLifeStage(typeof per?.life_stage === 'string' ? per.life_stage : '')
      setNumChildren(
        typeof per?.number_of_children === 'number' ? String(per.number_of_children) : '',
      )
      setMaritalStatus(typeof per?.marital_status === 'string' ? per.marital_status : '')
      setChildrenAgesSummary(profileStr(per?.children_ages_summary))
      setFinancialDependents(
        typeof per?.financial_dependents === 'number' ? String(per.financial_dependents) : '',
      )
      setMainIncomeProvider(profileStr(per?.main_income_provider))
      if (per?.has_partner === true) {
        setHasPartner('yes')
      } else if (per?.has_partner === false) {
        setHasPartner('no')
      } else {
        setHasPartner('')
      }
      if (res?.owns_property === true) {
        setOwnsProperty('yes')
      } else if (res?.owns_property === false) {
        setOwnsProperty('no')
      } else {
        setOwnsProperty('')
      }
      setPropertyType(typeof res?.property_type === 'string' ? res.property_type : '')
      setPropertyUse(typeof res?.property_use === 'string' ? res.property_use : '')
      setPropertyValueBand(profileStr(res?.property_value_band))
      setPropertyLocation(profileStr(res?.property_location))
      setPropertyStyle(typeof res?.property_style === 'string' ? res.property_style : '')
      if (res?.high_value_items === true) {
        setHighValueItems('yes')
      } else if (res?.high_value_items === false) {
        setHighValueItems('no')
      } else {
        setHighValueItems('')
      }
      if (mob?.owns_vehicle === true) {
        setOwnsVehicle('yes')
      } else if (mob?.owns_vehicle === false) {
        setOwnsVehicle('no')
      } else {
        setOwnsVehicle('')
      }
      setVehicleUse(typeof mob?.vehicle_primary_use === 'string' ? mob.vehicle_primary_use : '')
      setVehicleCount(
        typeof mob?.vehicle_count === 'number' ? String(mob.vehicle_count) : '',
      )
      setVehicleType(profileStr(mob?.vehicle_type))
      setVehicleYear(typeof mob?.vehicle_year === 'number' ? String(mob.vehicle_year) : '')
      setPrimaryDriver(profileStr(mob?.primary_driver))
      if (mob?.has_garage === true) {
        setHasGarage('yes')
      } else if (mob?.has_garage === false) {
        setHasGarage('no')
      } else {
        setHasGarage('')
      }
      setCirculationCity(profileStr(mob?.circulation_city))
      const pro = profile.professional as Record<string, unknown> | null | undefined
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
      const hlth = profile.health as Record<string, unknown> | null | undefined
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
      const bus = profile.business as Record<string, unknown> | null | undefined
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
      const pet = profile.pet as Record<string, unknown> | null | undefined
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
      const beh = profile.behavior as Record<string, unknown> | null | undefined
      setBehChannel(profileStr(beh?.preferred_contact_channel))
      setBehTime(profileStr(beh?.preferred_contact_time))
      setBehTeam(profileStr(beh?.football_team))
      setBehDates(profileStr(beh?.relevant_dates_note))
      setBehComm(profileStr(beh?.communication_preferences))
      setBehLifeEvents(profileStr(beh?.life_events_note))

      const gi = profile.general_insurance_company as Record<string, unknown> | null | undefined
      setGiActivity(profileStr(gi?.activity))
      if (gi?.has_existing_insurance === true) {
        setGiHasInsurance('yes')
      } else if (gi?.has_existing_insurance === false) {
        setGiHasInsurance('no')
      } else {
        setGiHasInsurance('')
      }
      setGiPoliciesNote(profileStr(gi?.existing_policies_note))
      {
        const ids = gi?.existing_policies_document_ids
        setGiPolicyDocIds(Array.isArray(ids) ? (ids.filter((x) => typeof x === 'string') as string[]) : [])
      }

      const giInd = profile.general_insurance_individual as Record<string, unknown> | null | undefined
      if (giInd?.has_existing_insurance === true) {
        setGiIndHasInsurance('yes')
      } else if (giInd?.has_existing_insurance === false) {
        setGiIndHasInsurance('no')
      } else {
        setGiIndHasInsurance('')
      }
      setGiIndPoliciesNote(profileStr(giInd?.existing_policies_note))
      {
        const ids = giInd?.existing_policies_document_ids
        setGiIndPolicyDocIds(
          Array.isArray(ids) ? (ids.filter((x) => typeof x === 'string') as string[]) : [],
        )
      }

      const varisk = (gi?.values_at_risk as Record<string, unknown> | null | undefined) ?? null
      setGiValBuilding(typeof varisk?.building === 'number' ? String(varisk.building) : '')
      setGiValMmu(typeof varisk?.mmu === 'number' ? String(varisk.mmu) : '')
      setGiValMmp(typeof varisk?.mmp === 'number' ? String(varisk.mmp) : '')

      const fire = (gi?.fire_protections as Record<string, unknown> | null | undefined) ?? null
      setGiFireExtinguishers(Boolean(fire?.extinguishers ?? false))
      setGiFireHydrants(Boolean(fire?.hydrants ?? false))
      setGiFireSprinklers(Boolean(fire?.sprinklers ?? false))
      setGiFireBrigade(Boolean(fire?.trained_fire_brigade ?? false))
      setGiFireDetectors(Boolean(fire?.detectors_alarms ?? false))
      setGiFireReserveLiters(
        typeof fire?.fire_technical_reserve_liters === 'number' ? String(fire.fire_technical_reserve_liters) : '',
      )

      const theft = (gi?.theft_protections as Record<string, unknown> | null | undefined) ?? null
      setGiTheftCctv(Boolean(theft?.cctv ?? false))
      setGiTheftAlarm(Boolean(theft?.alarm ?? false))
      setGiTheftSensors(Boolean(theft?.sensors ?? false))
      setGiTheftPanicButton(Boolean(theft?.panic_button ?? false))
      setGiTheftGuardsArmed(Boolean(theft?.armed_guards_24h ?? false))
      setGiTheftGuardsUnarmed(Boolean(theft?.unarmed_guards_24h ?? false))

      setGiClaimsNote(profileStr(gi?.claims_last_5y_note))
      {
        const rows = gi?.claims_last_5y
        if (Array.isArray(rows)) {
          setGiClaimsRows(
            rows
              .map((r) =>
                r && typeof r === 'object'
                  ? {
                      occurred_at:
                        typeof (r as { occurred_at?: unknown }).occurred_at === 'string'
                          ? String((r as { occurred_at?: unknown }).occurred_at)
                          : '',
                      claimed_amount:
                        typeof (r as { claimed_amount?: unknown }).claimed_amount === 'number'
                          ? String((r as { claimed_amount?: unknown }).claimed_amount)
                          : '',
                      paid_amount:
                        typeof (r as { paid_amount?: unknown }).paid_amount === 'number'
                          ? String((r as { paid_amount?: unknown }).paid_amount)
                          : '',
                      status:
                        typeof (r as { status?: unknown }).status === 'string'
                          ? String((r as { status?: unknown }).status)
                          : '',
                      notes:
                        typeof (r as { notes?: unknown }).notes === 'string'
                          ? String((r as { notes?: unknown }).notes)
                          : '',
                    }
                  : null,
              )
              .filter((x): x is NonNullable<typeof x> => x != null),
          )
        } else {
          setGiClaimsRows([])
        }
      }
      setGiCurrentInsurer(profileStr(gi?.current_insurer))
      setGiCurrentAnnualPremium(typeof gi?.current_annual_premium === 'number' ? String(gi.current_annual_premium) : '')
      setGiTargetPremium(typeof gi?.target_premium === 'number' ? String(gi.target_premium) : '')
      setGiTargetCommission(typeof gi?.target_commission === 'number' ? String(gi.target_commission) : '')
    // profile comes from parent; reloadKey bumps after refetch (e.g. updated_at)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])

  const onSaveProfile = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!apiBasePath || readOnly) {
      return
    }
    setSavingProfile(true)
    setProfileError(null)
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
      if (maritalStatus.trim()) {
        personal.marital_status = maritalStatus.trim()
      }
      if (childrenAgesSummary.trim()) {
        personal.children_ages_summary = childrenAgesSummary.trim()
      }
      if (financialDependents.trim() !== '') {
        const n = parseInt(financialDependents, 10)
        if (!Number.isNaN(n)) {
          personal.financial_dependents = n
        }
      }
      if (mainIncomeProvider.trim()) {
        personal.main_income_provider = mainIncomeProvider.trim()
      }
      if (hasPartner === 'yes') {
        personal.has_partner = true
      }
      if (hasPartner === 'no') {
        personal.has_partner = false
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
      if (propertyUse.trim()) {
        residence.property_use = propertyUse.trim()
      }
      if (propertyValueBand.trim()) {
        residence.property_value_band = propertyValueBand.trim()
      }
      if (propertyLocation.trim()) {
        residence.property_location = propertyLocation.trim()
      }
      if (propertyStyle.trim()) {
        residence.property_style = propertyStyle.trim()
      }
      if (highValueItems === 'yes') {
        residence.high_value_items = true
      }
      if (highValueItems === 'no') {
        residence.high_value_items = false
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
      if (vehicleCount.trim() !== '') {
        const n = parseInt(vehicleCount, 10)
        if (!Number.isNaN(n)) {
          mobility.vehicle_count = n
        }
      }
      if (vehicleType.trim()) {
        mobility.vehicle_type = vehicleType.trim()
      }
      if (vehicleYear.trim() !== '') {
        const y = parseInt(vehicleYear, 10)
        if (!Number.isNaN(y)) {
          mobility.vehicle_year = y
        }
      }
      if (primaryDriver.trim()) {
        mobility.primary_driver = primaryDriver.trim()
      }
      if (hasGarage === 'yes') {
        mobility.has_garage = true
      }
      if (hasGarage === 'no') {
        mobility.has_garage = false
      }
      if (circulationCity.trim()) {
        mobility.circulation_city = circulationCity.trim()
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

      const generalInsuranceCompany: Record<string, unknown> = {}
      if (isCompany) {
        if (giActivity.trim()) {
          generalInsuranceCompany.activity = giActivity.trim()
        }
        if (giHasInsurance === 'yes') {
          generalInsuranceCompany.has_existing_insurance = true
        }
        if (giHasInsurance === 'no') {
          generalInsuranceCompany.has_existing_insurance = false
        }
        if (giPoliciesNote.trim()) {
          generalInsuranceCompany.existing_policies_note = giPoliciesNote.trim()
        }
        if (giPolicyDocIds.length > 0) {
          generalInsuranceCompany.existing_policies_document_ids = giPolicyDocIds
        }

        const valuesAtRisk: Record<string, unknown> = {}
        const parseNum = (s: string) => {
          const n = Number(s)
          return Number.isFinite(n) ? n : null
        }
        const b = parseNum(giValBuilding)
        const mmu = parseNum(giValMmu)
        const mmp = parseNum(giValMmp)
        if (b != null) valuesAtRisk.building = b
        if (mmu != null) valuesAtRisk.mmu = mmu
        if (mmp != null) valuesAtRisk.mmp = mmp
        const total = (b ?? 0) + (mmu ?? 0) + (mmp ?? 0)
        if (Object.keys(valuesAtRisk).length > 0) {
          valuesAtRisk.total = total
          generalInsuranceCompany.values_at_risk = valuesAtRisk
        }

        const fire: Record<string, unknown> = {
          extinguishers: giFireExtinguishers,
          hydrants: giFireHydrants,
          sprinklers: giFireSprinklers,
          trained_fire_brigade: giFireBrigade,
          detectors_alarms: giFireDetectors,
        }
        const rLit = parseInt(giFireReserveLiters, 10)
        if (!Number.isNaN(rLit)) {
          fire.fire_technical_reserve_liters = rLit
        }
        if (Object.values(fire).some((v) => v !== false && v !== undefined && v !== null)) {
          generalInsuranceCompany.fire_protections = fire
        }

        const theft: Record<string, unknown> = {
          cctv: giTheftCctv,
          alarm: giTheftAlarm,
          sensors: giTheftSensors,
          panic_button: giTheftPanicButton,
          armed_guards_24h: giTheftGuardsArmed,
          unarmed_guards_24h: giTheftGuardsUnarmed,
        }
        if (Object.values(theft).some((v) => v !== false && v !== undefined && v !== null)) {
          generalInsuranceCompany.theft_protections = theft
        }

        const claimsRows = giClaimsRows
          .map((r) => ({
            occurred_at: r.occurred_at.trim() || null,
            claimed_amount: parseNum(r.claimed_amount),
            paid_amount: parseNum(r.paid_amount),
            status: r.status.trim() || null,
            notes: r.notes.trim() || null,
          }))
          .filter(
            (r) =>
              r.occurred_at ||
              r.claimed_amount != null ||
              r.paid_amount != null ||
              r.status ||
              r.notes,
          )
          .map((r) => ({
            ...(r.occurred_at ? { occurred_at: r.occurred_at } : {}),
            ...(r.claimed_amount != null ? { claimed_amount: r.claimed_amount } : {}),
            ...(r.paid_amount != null ? { paid_amount: r.paid_amount } : {}),
            ...(r.status ? { status: r.status } : {}),
            ...(r.notes ? { notes: r.notes } : {}),
          }))
        if (claimsRows.length > 0) {
          generalInsuranceCompany.claims_last_5y = claimsRows
        }
        if (giClaimsNote.trim()) {
          generalInsuranceCompany.claims_last_5y_note = giClaimsNote.trim()
        }
        if (giCurrentInsurer.trim()) {
          generalInsuranceCompany.current_insurer = giCurrentInsurer.trim()
        }
        const curPrem = parseNum(giCurrentAnnualPremium)
        if (curPrem != null) {
          generalInsuranceCompany.current_annual_premium = curPrem
        }
        const tgtPrem = parseNum(giTargetPremium)
        if (tgtPrem != null) {
          generalInsuranceCompany.target_premium = tgtPrem
        }
        const tgtCom = parseNum(giTargetCommission)
        if (tgtCom != null) {
          generalInsuranceCompany.target_commission = tgtCom
        }
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
      if (Object.keys(generalInsuranceCompany).length > 0) {
        json.general_insurance_company = generalInsuranceCompany
      }

      const generalInsuranceIndividual: Record<string, unknown> = {}
      if (showIndividualBlocks) {
        if (giIndHasInsurance === 'yes') {
          generalInsuranceIndividual.has_existing_insurance = true
        }
        if (giIndHasInsurance === 'no') {
          generalInsuranceIndividual.has_existing_insurance = false
        }
        if (giIndPoliciesNote.trim()) {
          generalInsuranceIndividual.existing_policies_note = giIndPoliciesNote.trim()
        }
        if (giIndPolicyDocIds.length > 0) {
          generalInsuranceIndividual.existing_policies_document_ids = giIndPolicyDocIds
        }
      }
      if (Object.keys(generalInsuranceIndividual).length > 0) {
        json.general_insurance_individual = generalInsuranceIndividual
      }
      await apiFetch(`${apiBasePath}/profile`, {
        method: 'PATCH',
        json,
      })
      if (onAfterSave) await onAfterSave()
      toast.success(t('toast.saved'))
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <>
      {profileError ? (
        <p className="text-destructive mb-2 text-sm" role="alert">
          {profileError}
        </p>
      ) : null}
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
                    <span className="font-semibold tabular-nums">{profileCompletenessScore}%</span>
                  </div>
                  <div
                    className="bg-muted h-2.5 w-full max-w-md overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuenow={profileCompletenessScore}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('crm.profile.completeness')}
                  >
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, profileCompletenessScore))}%` }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                    {t('crm.profile.alerts')}
                  </p>
                  {profileAlerts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t('crm.profile.noAlerts')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {profileAlerts.map((code) => {
                        const alertKey = `crm.profile.alert.${code}`
                        const alertLabel = t(alertKey)
                        return (
                          <span
                            key={code}
                            className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-950 dark:text-amber-100"
                          >
                            {alertLabel === alertKey ? code : alertLabel}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              <form className="space-y-6" onSubmit={onSaveProfile}>
                {showIndividualBlocks ? (
                  <ProfileInsuranceBlock
                    title={t('crm.profile.insuranceSection.family')}
                    subtitle={t('crm.profile.insuranceSection.familyHint')}
                    icon={Users}
                  >
                    <div className="grid gap-2">
                      <Label htmlFor="pf-life">{t('crm.profile.lifeStage')}</Label>
                      <FormSelect
                        id="pf-life"
                        value={lifeStage}
                        onValueChange={setLifeStage}
                        allowEmpty
                        emptyLabel={t('crm.profile.selectPlaceholder')}
                        placeholder={t('crm.profile.selectPlaceholder')}
                        extraOptions={
                          lifeStage && !LIFE_STAGE_OPTIONS.some((o) => o.value === lifeStage)
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
                      <Label htmlFor="pf-marital">{t('crm.profile.maritalStatus')}</Label>
                      <FormSelect
                        id="pf-marital"
                        value={maritalStatus}
                        onValueChange={setMaritalStatus}
                        allowEmpty
                        emptyLabel={t('crm.profile.selectPlaceholder')}
                        placeholder={t('crm.profile.selectPlaceholder')}
                        extraOptions={
                          maritalStatus && !MARITAL_STATUS_OPTIONS.some((o) => o.value === maritalStatus)
                            ? [{ value: maritalStatus, label: maritalStatus }]
                            : undefined
                        }
                        options={MARITAL_STATUS_OPTIONS.map((o) => ({
                          value: o.value,
                          label: t(`crm.profile.maritalStatusOption.${o.value}`),
                        }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pf-children-ages">{t('crm.profile.childrenAgesSummary')}</Label>
                      <Input
                        id="pf-children-ages"
                        value={childrenAgesSummary}
                        onChange={(ev) => setChildrenAgesSummary(ev.target.value)}
                        placeholder={t('crm.profile.childrenAgesHint')}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pf-fin-dep">{t('crm.profile.financialDependents')}</Label>
                      <Input
                        id="pf-fin-dep"
                        type="number"
                        min={0}
                        value={financialDependents}
                        onChange={(ev) => setFinancialDependents(ev.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pf-main-income">{t('crm.profile.mainIncomeProvider')}</Label>
                      <Input
                        id="pf-main-income"
                        value={mainIncomeProvider}
                        onChange={(ev) => setMainIncomeProvider(ev.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pf-partner">{t('crm.profile.hasPartner')}</Label>
                      <FormSelect
                        id="pf-partner"
                        value={hasPartner}
                        onValueChange={setHasPartner}
                        allowEmpty
                        emptyLabel="—"
                        options={[
                          { value: 'yes', label: t('crm.profile.yes') },
                          { value: 'no', label: t('crm.profile.no') },
                        ]}
                      />
                    </div>
                  </ProfileInsuranceBlock>
                ) : null}

                {showIndividualBlocks ? (
                  <ProfileInsuranceBlock
                    title={t('crm.profile.insuranceSection.property')}
                    subtitle={t('crm.profile.insuranceSection.propertyHint')}
                    icon={Building2}
                  >
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
                <div className="grid gap-2">
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
                  <Label htmlFor="pf-prop-use">{t('crm.profile.propertyUse')}</Label>
                  <FormSelect
                    id="pf-prop-use"
                    value={propertyUse}
                    onValueChange={setPropertyUse}
                    allowEmpty
                    emptyLabel={t('crm.profile.selectPlaceholder')}
                    placeholder={t('crm.profile.selectPlaceholder')}
                    extraOptions={
                      propertyUse &&
                      !PROPERTY_USE_OPTIONS.some((o) => o.value === propertyUse)
                        ? [{ value: propertyUse, label: propertyUse }]
                        : undefined
                    }
                    options={PROPERTY_USE_OPTIONS.map((o) => ({
                      value: o.value,
                      label: t(`crm.profile.propertyUseOption.${o.value}`),
                    }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-prop-val">{t('crm.profile.propertyValueBand')}</Label>
                  <Input
                    id="pf-prop-val"
                    value={propertyValueBand}
                    onChange={(ev) => setPropertyValueBand(ev.target.value)}
                    placeholder={t('crm.profile.propertyValueBandHint')}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-prop-loc">{t('crm.profile.propertyLocation')}</Label>
                  <Input
                    id="pf-prop-loc"
                    value={propertyLocation}
                    onChange={(ev) => setPropertyLocation(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-prop-style">{t('crm.profile.propertyStyle')}</Label>
                  <FormSelect
                    id="pf-prop-style"
                    value={propertyStyle}
                    onValueChange={setPropertyStyle}
                    allowEmpty
                    emptyLabel={t('crm.profile.selectPlaceholder')}
                    placeholder={t('crm.profile.selectPlaceholder')}
                    extraOptions={
                      propertyStyle &&
                      !PROPERTY_STYLE_OPTIONS.some((o) => o.value === propertyStyle)
                        ? [{ value: propertyStyle, label: propertyStyle }]
                        : undefined
                    }
                    options={PROPERTY_STYLE_OPTIONS.map((o) => ({
                      value: o.value,
                      label: t(`crm.profile.propertyStyleOption.${o.value}`),
                    }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-high-val">{t('crm.profile.highValueItems')}</Label>
                  <FormSelect
                    id="pf-high-val"
                    value={highValueItems}
                    onValueChange={setHighValueItems}
                    allowEmpty
                    emptyLabel="—"
                    options={[
                      { value: 'yes', label: t('crm.profile.yes') },
                      { value: 'no', label: t('crm.profile.no') },
                    ]}
                  />
                </div>
                  </ProfileInsuranceBlock>
                ) : null}

                {showIndividualBlocks ? (
                  <ProfileInsuranceBlock
                    title={t('crm.profile.insuranceSection.vehicle')}
                    subtitle={t('crm.profile.insuranceSection.vehicleHint')}
                    icon={Car}
                  >
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
                <div className="grid gap-2">
                  <Label htmlFor="pf-veh-count">{t('crm.profile.vehicleCount')}</Label>
                  <Input
                    id="pf-veh-count"
                    type="number"
                    min={0}
                    value={vehicleCount}
                    onChange={(ev) => setVehicleCount(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-veh-type">{t('crm.profile.vehicleType')}</Label>
                  <Input
                    id="pf-veh-type"
                    value={vehicleType}
                    onChange={(ev) => setVehicleType(ev.target.value)}
                    placeholder={t('crm.profile.vehicleTypeHint')}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-veh-year">{t('crm.profile.vehicleYear')}</Label>
                  <Input
                    id="pf-veh-year"
                    type="number"
                    min={1950}
                    max={2100}
                    value={vehicleYear}
                    onChange={(ev) => setVehicleYear(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-veh-driver">{t('crm.profile.primaryDriver')}</Label>
                  <Input
                    id="pf-veh-driver"
                    value={primaryDriver}
                    onChange={(ev) => setPrimaryDriver(ev.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-veh-garage">{t('crm.profile.hasGarage')}</Label>
                  <FormSelect
                    id="pf-veh-garage"
                    value={hasGarage}
                    onValueChange={setHasGarage}
                    allowEmpty
                    emptyLabel="—"
                    options={[
                      { value: 'yes', label: t('crm.profile.yes') },
                      { value: 'no', label: t('crm.profile.no') },
                    ]}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-veh-city">{t('crm.profile.circulationCity')}</Label>
                  <Input
                    id="pf-veh-city"
                    value={circulationCity}
                    onChange={(ev) => setCirculationCity(ev.target.value)}
                  />
                </div>
                  </ProfileInsuranceBlock>
                ) : null}

                {showIndividualBlocks ? (
                  <ProfileInsuranceBlock
                    title={t('crm.profile.insuranceSection.professional')}
                    subtitle={t('crm.profile.insuranceSection.professionalHint')}
                    icon={Briefcase}
                  >
                <div className="grid gap-2">
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
                ) : null}

                {showIndividualBlocks ? (
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
                <div className="grid gap-2">
                  <Label htmlFor="pf-hlth-int">{t('crm.profile.healthInterest')}</Label>
                  <Input
                    id="pf-hlth-int"
                    value={hlthInterest}
                    onChange={(ev) => setHlthInterest(ev.target.value)}
                  />
                </div>
                  </ProfileInsuranceBlock>
                ) : null}

                {showIndividualBlocks ? (
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
                <div className="grid gap-2">
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
                ) : null}

                {showIndividualBlocks ? (
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
                <div className="grid gap-2">
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
                ) : null}

                {isCompany ? (
                  <ProfileInsuranceBlock
                    title={t('crm.profile.generalInsuranceCompany.title')}
                    subtitle={t('crm.profile.generalInsuranceCompany.subtitle')}
                    icon={Building2}
                    className="border-primary/15"
                  >
                    <div className="grid gap-2 col-span-2">
                      <Label htmlFor="gi-activity">{t('crm.profile.generalInsuranceCompany.activity')}</Label>
                      <Input
                        id="gi-activity"
                        value={giActivity}
                        onChange={(ev) => setGiActivity(ev.target.value)}
                        placeholder={t('crm.profile.generalInsuranceCompany.activityHint')}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gi-has-ins">{t('crm.profile.generalInsuranceCompany.hasInsurance')}</Label>
                      <FormSelect
                        id="gi-has-ins"
                        value={giHasInsurance}
                        onValueChange={setGiHasInsurance}
                        allowEmpty
                        emptyLabel="—"
                        options={[
                          { value: 'yes', label: t('crm.profile.yes') },
                          { value: 'no', label: t('crm.profile.no') },
                        ]}
                      />
                    </div>
                    <div className="grid gap-2 col-span-2">
                      <Label htmlFor="gi-pol">{t('crm.profile.generalInsuranceCompany.policies')}</Label>
                      <textarea
                        id="gi-pol"
                        className="border-input bg-background min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
                        value={giPoliciesNote}
                        onChange={(ev) => setGiPoliciesNote(ev.target.value)}
                        placeholder={t('crm.profile.generalInsuranceCompany.policiesHint')}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="grid gap-2 col-span-2">
                      <Label>{t('crm.profile.generalInsuranceCompany.policiesDocs')}</Label>
                      <div className="grid gap-2 rounded-lg border border-border p-3">
                        <p className="text-muted-foreground text-xs">
                          {t('crm.profile.generalInsuranceCompany.policiesDocsHint')}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            type="file"
                            disabled={!isAdmin || readOnly || giPolicyUploading}
                            onChange={(ev) => setGiPolicyUploadFile(ev.target.files?.[0] ?? null)}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={!isAdmin || readOnly || !giPolicyUploadFile || giPolicyUploading}
                            onClick={() => void onUploadCompanyPolicy()}
                          >
                            {giPolicyUploading ? 'Enviando…' : 'Enviar'}
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {giPolicyDocOptions.length === 0 ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            giPolicyDocOptions.map((d) => (
                              <label key={d.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="border-input size-4 rounded border"
                                  disabled={readOnly}
                                  checked={giPolicyDocIds.includes(d.id)}
                                  onChange={(ev) => {
                                    const checked = ev.target.checked
                                    setGiPolicyDocIds((prev) => {
                                      if (checked) {
                                        return prev.includes(d.id) ? prev : [...prev, d.id]
                                      }
                                      return prev.filter((x) => x !== d.id)
                                    })
                                  }}
                                />
                                <span className="text-muted-foreground">{d.label}</span>
                                <button
                                  type="button"
                                  className="text-primary text-xs underline underline-offset-2"
                                  onClick={() =>
                                    void downloadWithAuth(`/v1/documents/${d.id}/download`, d.original_filename)
                                  }
                                >
                                  Baixar
                                </button>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="gi-bld">{t('crm.profile.generalInsuranceCompany.varBuilding')}</Label>
                      <CurrencyInput
                        id="gi-bld"
                        value={giValBuilding}
                        onValueChange={setGiValBuilding}
                        placeholder="0"
                        money={money}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gi-mmu">{t('crm.profile.generalInsuranceCompany.varMmu')}</Label>
                      <CurrencyInput
                        id="gi-mmu"
                        value={giValMmu}
                        onValueChange={setGiValMmu}
                        placeholder="0"
                        money={money}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gi-mmp">{t('crm.profile.generalInsuranceCompany.varMmp')}</Label>
                      <CurrencyInput
                        id="gi-mmp"
                        value={giValMmp}
                        onValueChange={setGiValMmp}
                        placeholder="0"
                        money={money}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t('crm.profile.generalInsuranceCompany.varTotal')}</Label>
                      <Input
                        value={formatCurrency(
                          (Number(giValBuilding) || 0) + (Number(giValMmu) || 0) + (Number(giValMmp) || 0),
                          money,
                        )}
                        readOnly
                      />
                    </div>

                    <div className="grid gap-2 col-span-2">
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        {t('crm.profile.generalInsuranceCompany.fireProtections')}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[
                          ['gi-fire-ext', giFireExtinguishers, setGiFireExtinguishers, t('crm.profile.generalInsuranceCompany.fire.extinguishers')],
                          ['gi-fire-hyd', giFireHydrants, setGiFireHydrants, t('crm.profile.generalInsuranceCompany.fire.hydrants')],
                          ['gi-fire-spr', giFireSprinklers, setGiFireSprinklers, t('crm.profile.generalInsuranceCompany.fire.sprinklers')],
                          ['gi-fire-brig', giFireBrigade, setGiFireBrigade, t('crm.profile.generalInsuranceCompany.fire.brigade')],
                          ['gi-fire-det', giFireDetectors, setGiFireDetectors, t('crm.profile.generalInsuranceCompany.fire.detectors')],
                        ].map(([id, checked, setChecked, label]) => (
                          <label key={String(id)} className="flex items-center gap-2 text-sm">
                            <input
                              id={String(id)}
                              type="checkbox"
                              className="border-input size-4 rounded border"
                              checked={Boolean(checked)}
                              onChange={(ev) => (setChecked as (v: boolean) => void)(ev.target.checked)}
                            />
                            <span>{String(label)}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 grid gap-2 sm:max-w-sm">
                        <Label htmlFor="gi-fire-lit">{t('crm.profile.generalInsuranceCompany.fire.reserveLiters')}</Label>
                        <Input
                          id="gi-fire-lit"
                          type="number"
                          min={0}
                          value={giFireReserveLiters}
                          onChange={(ev) => setGiFireReserveLiters(ev.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2 col-span-2">
                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        {t('crm.profile.generalInsuranceCompany.theftProtections')}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[
                          ['gi-theft-cctv', giTheftCctv, setGiTheftCctv, t('crm.profile.generalInsuranceCompany.theft.cctv')],
                          ['gi-theft-alarm', giTheftAlarm, setGiTheftAlarm, t('crm.profile.generalInsuranceCompany.theft.alarm')],
                          ['gi-theft-sensors', giTheftSensors, setGiTheftSensors, t('crm.profile.generalInsuranceCompany.theft.sensors')],
                          ['gi-theft-panic', giTheftPanicButton, setGiTheftPanicButton, t('crm.profile.generalInsuranceCompany.theft.panicButton')],
                          ['gi-theft-armed', giTheftGuardsArmed, setGiTheftGuardsArmed, t('crm.profile.generalInsuranceCompany.theft.armed24h')],
                          ['gi-theft-unarmed', giTheftGuardsUnarmed, setGiTheftGuardsUnarmed, t('crm.profile.generalInsuranceCompany.theft.unarmed24h')],
                        ].map(([id, checked, setChecked, label]) => (
                          <label key={String(id)} className="flex items-center gap-2 text-sm">
                            <input
                              id={String(id)}
                              type="checkbox"
                              className="border-input size-4 rounded border"
                              checked={Boolean(checked)}
                              onChange={(ev) => (setChecked as (v: boolean) => void)(ev.target.checked)}
                            />
                            <span>{String(label)}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-2 col-span-2">
                      <Label htmlFor="gi-claims">{t('crm.profile.generalInsuranceCompany.claims')}</Label>
                      <textarea
                        id="gi-claims"
                        className="border-input bg-background min-h-[84px] w-full rounded-md border px-3 py-2 text-sm"
                        value={giClaimsNote}
                        onChange={(ev) => setGiClaimsNote(ev.target.value)}
                        placeholder={t('crm.profile.generalInsuranceCompany.claimsHint')}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="grid gap-2 col-span-2">
                      <Label>{t('crm.profile.generalInsuranceCompany.claimsStructured')}</Label>
                      <div className="space-y-3 rounded-lg border border-border p-3">
                        <p className="text-muted-foreground text-xs">
                          {t('crm.profile.generalInsuranceCompany.claimsStructuredHint')}
                        </p>
                        <div className="space-y-3">
                          {giClaimsRows.length === 0 ? (
                            <p className="text-muted-foreground text-xs">—</p>
                          ) : null}
                          {giClaimsRows.map((row, idx) => (
                            <div key={idx} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
                              <div className="grid gap-2">
                                <Label htmlFor={`gi-claim-date-${idx}`}>{t('crm.profile.claims.date')}</Label>
                                <Input
                                  id={`gi-claim-date-${idx}`}
                                  type="date"
                                  value={row.occurred_at}
                                  disabled={readOnly}
                                  onChange={(ev) =>
                                    setGiClaimsRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, occurred_at: ev.target.value } : r)),
                                    )
                                  }
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor={`gi-claim-status-${idx}`}>{t('crm.profile.claims.status')}</Label>
                                <Input
                                  id={`gi-claim-status-${idx}`}
                                  value={row.status}
                                  disabled={readOnly}
                                  onChange={(ev) =>
                                    setGiClaimsRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, status: ev.target.value } : r)),
                                    )
                                  }
                                  placeholder="PAID / DECLINED / CLAIMED"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label>{t('crm.profile.claims.claimed')}</Label>
                                <CurrencyInput
                                  value={row.claimed_amount}
                                  disabled={readOnly}
                                  onValueChange={(v) =>
                                    setGiClaimsRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, claimed_amount: v } : r)),
                                    )
                                  }
                                  placeholder="0"
                                  money={money}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label>{t('crm.profile.claims.paid')}</Label>
                                <CurrencyInput
                                  value={row.paid_amount}
                                  disabled={readOnly}
                                  onValueChange={(v) =>
                                    setGiClaimsRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, paid_amount: v } : r)),
                                    )
                                  }
                                  placeholder="0"
                                  money={money}
                                />
                              </div>
                              <div className="grid gap-2 sm:col-span-2">
                                <Label htmlFor={`gi-claim-notes-${idx}`}>{t('crm.profile.claims.notes')}</Label>
                                <Input
                                  id={`gi-claim-notes-${idx}`}
                                  value={row.notes}
                                  disabled={readOnly}
                                  onChange={(ev) =>
                                    setGiClaimsRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, notes: ev.target.value } : r)),
                                    )
                                  }
                                />
                              </div>
                              {!readOnly ? (
                                <div className="flex justify-end sm:col-span-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setGiClaimsRows((prev) => prev.filter((_, i) => i !== idx))}
                                  >
                                    {t('crm.action.remove')}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        {!readOnly ? (
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                setGiClaimsRows((prev) => [
                                  ...prev,
                                  { occurred_at: '', claimed_amount: '', paid_amount: '', status: '', notes: '' },
                                ])
                              }
                            >
                              {t('crm.profile.claims.add')}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="gi-cur-ins">{t('crm.profile.generalInsuranceCompany.currentInsurer')}</Label>
                      <Input
                        id="gi-cur-ins"
                        value={giCurrentInsurer}
                        onChange={(ev) => setGiCurrentInsurer(ev.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gi-cur-prem">{t('crm.profile.generalInsuranceCompany.currentPremium')}</Label>
                      <CurrencyInput
                        id="gi-cur-prem"
                        value={giCurrentAnnualPremium}
                        onValueChange={setGiCurrentAnnualPremium}
                        placeholder="0"
                        money={money}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gi-tgt-prem">{t('crm.profile.generalInsuranceCompany.targetPremium')}</Label>
                      <CurrencyInput
                        id="gi-tgt-prem"
                        value={giTargetPremium}
                        onValueChange={setGiTargetPremium}
                        placeholder="0"
                        money={money}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gi-tgt-com">{t('crm.profile.generalInsuranceCompany.targetCommission')}</Label>
                      <CurrencyInput
                        id="gi-tgt-com"
                        value={giTargetCommission}
                        onValueChange={setGiTargetCommission}
                        placeholder="0"
                        money={money}
                        disabled={readOnly}
                      />
                    </div>
                  </ProfileInsuranceBlock>
                ) : null}

                {showIndividualBlocks ? (
                  <ProfileInsuranceBlock
                    title={t('crm.profile.generalInsuranceIndividual.title')}
                    subtitle={t('crm.profile.generalInsuranceIndividual.subtitle')}
                    icon={Briefcase}
                    className="border-primary/15"
                  >
                    <div className="grid gap-2">
                      <Label htmlFor="gi-ind-has-ins">{t('crm.profile.generalInsuranceIndividual.hasInsurance')}</Label>
                      <FormSelect
                        id="gi-ind-has-ins"
                        value={giIndHasInsurance}
                        onValueChange={setGiIndHasInsurance}
                        allowEmpty
                        emptyLabel="—"
                        options={[
                          { value: 'yes', label: t('crm.profile.yes') },
                          { value: 'no', label: t('crm.profile.no') },
                        ]}
                      />
                    </div>
                    <div className="grid gap-2 col-span-2">
                      <Label htmlFor="gi-ind-pol">{t('crm.profile.generalInsuranceIndividual.policies')}</Label>
                      <textarea
                        id="gi-ind-pol"
                        className="border-input bg-background min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
                        value={giIndPoliciesNote}
                        onChange={(ev) => setGiIndPoliciesNote(ev.target.value)}
                        placeholder={t('crm.profile.generalInsuranceIndividual.policiesHint')}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="grid gap-2 col-span-2">
                      <Label>{t('crm.profile.generalInsuranceIndividual.policiesDocs')}</Label>
                      <div className="grid gap-2 rounded-lg border border-border p-3">
                        <p className="text-muted-foreground text-xs">
                          {t('crm.profile.generalInsuranceIndividual.policiesDocsHint')}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            type="file"
                            disabled={!isAdmin || readOnly || giIndPolicyUploading}
                            onChange={(ev) => setGiIndPolicyUploadFile(ev.target.files?.[0] ?? null)}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={!isAdmin || readOnly || !giIndPolicyUploadFile || giIndPolicyUploading}
                            onClick={() => void onUploadIndividualPolicy()}
                          >
                            {giIndPolicyUploading ? 'Enviando…' : 'Enviar'}
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {giPolicyDocOptions.length === 0 ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            giPolicyDocOptions.map((d) => (
                              <label key={d.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="border-input size-4 rounded border"
                                  disabled={readOnly}
                                  checked={giIndPolicyDocIds.includes(d.id)}
                                  onChange={(ev) => {
                                    const checked = ev.target.checked
                                    setGiIndPolicyDocIds((prev) => {
                                      if (checked) {
                                        return prev.includes(d.id) ? prev : [...prev, d.id]
                                      }
                                      return prev.filter((x) => x !== d.id)
                                    })
                                  }}
                                />
                                <span className="text-muted-foreground">{d.label}</span>
                                <button
                                  type="button"
                                  className="text-primary text-xs underline underline-offset-2"
                                  onClick={() =>
                                    void downloadWithAuth(`/v1/documents/${d.id}/download`, d.original_filename)
                                  }
                                >
                                  Baixar
                                </button>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </ProfileInsuranceBlock>
                ) : null}

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
                <div className="grid gap-2">
                  <Label htmlFor="pf-beh-team">{t('crm.profile.footballTeam')}</Label>
                  <Input
                    id="pf-beh-team"
                    value={behTeam}
                    onChange={(ev) => setBehTeam(ev.target.value)}
                  />
                </div>
                <div className="grid min-w-0 gap-2 col-span-2">
                  <Label htmlFor="pf-beh-dates">{t('crm.profile.relevantDates')}</Label>
                  <textarea
                    id="pf-beh-dates"
                    className="border-input bg-background min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
                    value={behDates}
                    onChange={(ev) => setBehDates(ev.target.value)}
                  />
                </div>
                <div className="grid min-w-0 gap-2 col-span-2">
                  <Label htmlFor="pf-beh-comm">{t('crm.profile.communicationPrefs')}</Label>
                  <textarea
                    id="pf-beh-comm"
                    className="border-input bg-background min-h-[72px] w-full rounded-md border px-3 py-2 text-sm"
                    value={behComm}
                    onChange={(ev) => setBehComm(ev.target.value)}
                  />
                </div>
                <div className="grid min-w-0 gap-2 col-span-2">
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
                  <Button type="submit" disabled={savingProfile || readOnly}>
                    {savingProfile ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
                    {savingProfile ? t('crm.profile.saving') : t('crm.profile.save')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
    </>
  )
}
