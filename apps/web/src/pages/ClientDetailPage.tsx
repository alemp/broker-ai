import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const PROFILE_SELECT_CLASS =
  'border-input bg-background h-9 w-full rounded-md border px-2 text-sm'

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

  const loadAll = useCallback(async () => {
    if (!clientId) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [d, catalog, plist, ixList, oppList, users, audits] = await Promise.all([
        apiFetch<ClientDetail>(`/v1/clients/${clientId}`),
        apiFetch<LineOfBusinessDto[]>('/v1/lines-of-business'),
        apiFetch<ProductBrief[]>('/v1/products'),
        apiFetch<InteractionDto[]>(`/v1/interactions?client_id=${clientId}&limit=100`),
        apiFetch<ClientOppRow[]>(`/v1/opportunities?client_id=${clientId}&limit=50`),
        apiFetch<UserBrief[]>('/v1/org/users'),
        apiFetch<AuditEventDto[]>(`/v1/clients/${clientId}/audit-events?limit=100`),
      ])
      setInteractions(ixList)
      setClientOpportunities(oppList)
      setDetail(d)
      setOrgUsers(users)
      setAuditEvents(audits)
      setCrmOwnerId(d.owner_id ?? '')
      setCrmKind(d.client_kind)
      setCrmLegal(d.company_legal_name ?? '')
      setCrmTax(d.company_tax_id ?? '')
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
      await apiFetch(`/v1/clients/${clientId}/profile`, {
        method: 'PATCH',
        json,
      })
      await loadAll()
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
        },
      })
      await loadAll()
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
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setAddingIx(false)
    }
  }

  if (!clientId) {
    return null
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <Link to="/clients" className="text-muted-foreground hover:text-foreground text-sm">
          ← {t('crm.clients.back')}
        </Link>
        {loading ? (
          <p className="text-muted-foreground mt-4 text-sm">{t('auth.loading')}</p>
        ) : detail ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">{detail.full_name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {[detail.email, detail.phone].filter(Boolean).join(' · ') || t('crm.clients.noContact')}
            </p>
          </>
        ) : (
          <p className="text-destructive mt-4 text-sm">{error ?? t('crm.error.notFound')}</p>
        )}
      </div>

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
                  <select
                    id="crm-owner"
                    className={PROFILE_SELECT_CLASS}
                    value={crmOwnerId}
                    onChange={(ev) => setCrmOwnerId(ev.target.value)}
                  >
                    <option value="">{t('crm.core.noOwner')}</option>
                    {orgUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name ?? u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="crm-kind">{t('crm.core.kind')}</Label>
                  <select
                    id="crm-kind"
                    className={PROFILE_SELECT_CLASS}
                    value={crmKind}
                    onChange={(ev) => setCrmKind(ev.target.value)}
                  >
                    <option value="INDIVIDUAL">{t('crm.core.kindIndividual')}</option>
                    <option value="COMPANY">{t('crm.core.kindCompany')}</option>
                  </select>
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
                  <select
                    id="ins-rel"
                    className={PROFILE_SELECT_CLASS}
                    value={insuredRelation}
                    onChange={(ev) => setInsuredRelation(ev.target.value)}
                  >
                    <option value="HOLDER">{t('crm.insured.relationHolder')}</option>
                    <option value="DEPENDENT">{t('crm.insured.relationDependent')}</option>
                    <option value="OTHER">{t('crm.insured.relationOther')}</option>
                  </select>
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
                  <select
                    id="pf-life"
                    className={PROFILE_SELECT_CLASS}
                    value={lifeStage}
                    onChange={(ev) => setLifeStage(ev.target.value)}
                  >
                    <option value="">{t('crm.profile.selectPlaceholder')}</option>
                    {lifeStage &&
                    !LIFE_STAGE_OPTIONS.some((o) => o.value === lifeStage) ? (
                      <option value={lifeStage}>{lifeStage}</option>
                    ) : null}
                    {LIFE_STAGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {t(`crm.profile.lifeStageOption.${o.value}`)}
                      </option>
                    ))}
                  </select>
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
                  <select
                    id="pf-owns-prop"
                    className={PROFILE_SELECT_CLASS}
                    value={ownsProperty}
                    onChange={(ev) => setOwnsProperty(ev.target.value)}
                  >
                    <option value="">—</option>
                    <option value="yes">{t('crm.profile.yes')}</option>
                    <option value="no">{t('crm.profile.no')}</option>
                  </select>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pf-prop-type">{t('crm.profile.propertyType')}</Label>
                  <select
                    id="pf-prop-type"
                    className={PROFILE_SELECT_CLASS}
                    value={propertyType}
                    onChange={(ev) => setPropertyType(ev.target.value)}
                  >
                    <option value="">{t('crm.profile.selectPlaceholder')}</option>
                    {propertyType &&
                    !PROPERTY_TYPE_OPTIONS.some((o) => o.value === propertyType) ? (
                      <option value={propertyType}>{propertyType}</option>
                    ) : null}
                    {PROPERTY_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {t(`crm.profile.propertyTypeOption.${o.value}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-owns-veh">{t('crm.profile.ownsVehicle')}</Label>
                  <select
                    id="pf-owns-veh"
                    className={PROFILE_SELECT_CLASS}
                    value={ownsVehicle}
                    onChange={(ev) => setOwnsVehicle(ev.target.value)}
                  >
                    <option value="">—</option>
                    <option value="yes">{t('crm.profile.yes')}</option>
                    <option value="no">{t('crm.profile.no')}</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pf-veh-use">{t('crm.profile.vehicleUse')}</Label>
                  <select
                    id="pf-veh-use"
                    className={PROFILE_SELECT_CLASS}
                    value={vehicleUse}
                    onChange={(ev) => setVehicleUse(ev.target.value)}
                  >
                    <option value="">{t('crm.profile.selectPlaceholder')}</option>
                    {vehicleUse &&
                    !VEHICLE_PRIMARY_USE_OPTIONS.some((o) => o.value === vehicleUse) ? (
                      <option value={vehicleUse}>{vehicleUse}</option>
                    ) : null}
                    {VEHICLE_PRIMARY_USE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {t(`crm.profile.vehicleUseOption.${o.value}`)}
                      </option>
                    ))}
                  </select>
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
                    <select
                      id="ix-type"
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
                    <Label htmlFor="ix-opp">{t('crm.interactions.opportunityOptional')}</Label>
                    <select
                      id="ix-opp"
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      value={ixOppId}
                      onChange={(ev) => setIxOppId(ev.target.value)}
                    >
                      <option value="">{t('crm.interactions.noOpp')}</option>
                      {clientOpportunities.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.stage} ({o.status})
                        </option>
                      ))}
                    </select>
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
                  <select
                    id="add-lob"
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={selectedLob}
                    onChange={(ev) => setSelectedLob(ev.target.value)}
                  >
                    <option value="">{t('crm.portfolio.selectLob')}</option>
                    {lobs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} — {l.name}
                      </option>
                    ))}
                  </select>
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
                  <select
                    id="held-product"
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={selectedProduct}
                    onChange={(ev) => setSelectedProduct(ev.target.value)}
                  >
                    <option value="">{t('crm.portfolio.optionalProduct')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
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
    </main>
  )
}
