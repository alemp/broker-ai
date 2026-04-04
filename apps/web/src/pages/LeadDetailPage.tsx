import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'

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
  notes: string | null
  status: string
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

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <Link to="/leads" className="text-muted-foreground hover:text-foreground text-sm">
          ← {t('crm.leads.back')}
        </Link>
        {loading ? (
          <p className="text-muted-foreground mt-4 text-sm">{t('auth.loading')}</p>
        ) : lead ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">{lead.full_name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {lead.status}
              {lead.email ? ` · ${lead.email}` : ''}
              {lead.owner ? ` · ${lead.owner.full_name ?? lead.owner.email}` : ''}
            </p>
          </>
        ) : (
          <p className="text-destructive mt-4 text-sm">{error ?? t('crm.error.notFound')}</p>
        )}
      </div>

      {error && lead ? <p className="text-destructive text-sm">{error}</p> : null}

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
                    <select
                      id="conv-owner"
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      value={oppOwnerId}
                      onChange={(ev) => setOppOwnerId(ev.target.value)}
                    >
                      {orgUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name ?? u.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="conv-prod">{t('crm.portfolio.catalogProduct')}</Label>
                    <select
                      id="conv-prod"
                      className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                      value={oppProductId}
                      onChange={(ev) => setOppProductId(ev.target.value)}
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
    </main>
  )
}
