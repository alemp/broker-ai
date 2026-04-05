import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  ClipboardList,
  IdCard,
  Megaphone,
  ScrollText,
  UserCircle,
} from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { apiFetch } from '@/lib/api'
import { translateLeadStatus } from '@/lib/crmEnumLabels'
import { marketingChannelSummaryLabel } from '@/lib/marketingChannels'

type UserBrief = {
  id: string
  email: string
  full_name: string | null
}

type LeadDetail = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
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
  created_at: string
  updated_at: string
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

  add('contact', t('crm.clientDetail.summary.sectionContact'), UserCircle, [
    { label: t('crm.clientDetail.summary.name'), value: lead.full_name?.trim() || null },
    { label: t('crm.clientDetail.summary.email'), value: lead.email?.trim() || null },
    { label: t('crm.clientDetail.summary.phone'), value: lead.phone?.trim() || null },
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

  return sections
}

type ProductBrief = {
  id: string
  name: string
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

  const load = useCallback(async () => {
    if (!leadId) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [l, me, plist, users] = await Promise.all([
        apiFetch<LeadDetail>(`/v1/leads/${leadId}`),
        apiFetch<{ user: { id: string } }>('/v1/me'),
        apiFetch<ProductBrief[]>('/v1/products'),
        apiFetch<UserBrief[]>('/v1/org/users'),
      ])
      setLead(l)
      setMeId(me.user.id)
      setOppOwnerId(me.user.id)
      setProducts(plist)
      setOrgUsers(users)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
      setLead(null)
    } finally {
      setLoading(false)
    }
  }, [leadId, t])

  useEffect(() => {
    void load()
  }, [load])

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

  if (!leadId) {
    return null
  }

  const leadDescription = lead
    ? [
        translateLeadStatus(lead.status, t),
        lead.email,
        lead.owner ? lead.owner.full_name ?? lead.owner.email : '',
      ]
        .filter(Boolean)
        .join(' · ')
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
        title={lead?.full_name ?? ''}
        description={leadDescription}
      />
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
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-start gap-4 pb-2">
            <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
              <ScrollText className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg tracking-tight">
                {t('crm.clientDetail.summary.title')}
              </CardTitle>
              <p className="text-muted-foreground text-sm">{t('crm.leads.summary.subtitle')}</p>
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
      ) : null}

      {lead && !lead.converted_client_id ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('crm.leads.convertTitle')}</CardTitle>
            <p className="text-muted-foreground text-sm">{t('crm.leads.convertSubtitle')}</p>
          </CardHeader>
          <CardContent>
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
      ) : null}
    </div>
  )
}
