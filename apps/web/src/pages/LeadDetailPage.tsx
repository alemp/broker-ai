import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

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

      {lead ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('crm.leads.detailCardTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">{t('crm.core.kind')}: </span>
              {lead.client_kind === 'COMPANY'
                ? t('crm.core.kindCompany')
                : t('crm.core.kindIndividual')}
            </p>
            {lead.phone ? (
              <p>
                <span className="text-muted-foreground">{t('crm.clientDetail.summary.phone')}: </span>
                {lead.phone}
              </p>
            ) : null}
            {lead.external_id ? (
              <p>
                <span className="text-muted-foreground">{t('crm.leads.detail.externalId')}: </span>
                {lead.external_id}
              </p>
            ) : null}
            {lead.client_kind === 'COMPANY' ? (
              <>
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">{t('crm.core.companyLegal')}: </span>
                  {lead.company_legal_name ?? '—'}
                </p>
                {lead.company_tax_id ? (
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">{t('crm.core.companyTax')}: </span>
                    {lead.company_tax_id}
                  </p>
                ) : null}
              </>
            ) : null}
            <p>
              <span className="text-muted-foreground">{t('crm.leads.field.marketingOptIn')}: </span>
              {lead.marketing_opt_in ? t('crm.leads.yes') : t('crm.leads.no')}
            </p>
            {(() => {
              const channelLabel = marketingChannelSummaryLabel(lead.preferred_marketing_channel, t)
              return channelLabel ? (
                <p>
                  <span className="text-muted-foreground">{t('crm.core.marketingChannel')}: </span>
                  {channelLabel}
                </p>
              ) : null
            })()}
          </CardContent>
        </Card>
      ) : null}

      {lead?.converted_client_id ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">{t('crm.leads.convertedHint')}</p>
            <Button asChild className="mt-3" variant="secondary">
              <Link to={`/clients/${lead.converted_client_id}`}>{t('crm.leads.openClient')}</Link>
            </Button>
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
