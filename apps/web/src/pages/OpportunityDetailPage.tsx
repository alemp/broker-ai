import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'

const STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'] as const

type OpportunityDetail = {
  id: string
  stage: string
  status: string
  closing_probability: number
  estimated_value: string | null
  client: { id: string; full_name: string; email: string | null }
  next_action: string | null
}

export function OpportunityDetailPage() {
  const { t } = useTranslation('common')
  const { opportunityId } = useParams<{ opportunityId: string }>()
  const [detail, setDetail] = useState<OpportunityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyStage, setBusyStage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!opportunityId) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const d = await apiFetch<OpportunityDetail>(`/v1/opportunities/${opportunityId}`)
      setDetail(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [opportunityId, t])

  useEffect(() => {
    void load()
  }, [load])

  const setStage = async (stage: string) => {
    if (!opportunityId) {
      return
    }
    setBusyStage(stage)
    setError(null)
    try {
      const d = await apiFetch<OpportunityDetail>(`/v1/opportunities/${opportunityId}/stage`, {
        method: 'POST',
        json: { stage },
      })
      setDetail(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setBusyStage(null)
    }
  }

  if (!opportunityId) {
    return null
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <Link to="/opportunities" className="text-muted-foreground hover:text-foreground text-sm">
          ← {t('crm.opportunities.back')}
        </Link>
        {loading ? (
          <p className="text-muted-foreground mt-4 text-sm">{t('auth.loading')}</p>
        ) : detail ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">{detail.client.full_name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('crm.opportunities.pipeline')}: {detail.stage} · {detail.status}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('crm.opportunities.probability')}: {detail.closing_probability}%
              {detail.estimated_value ? ` · ${detail.estimated_value}` : ''}
            </p>
            {detail.next_action ? (
              <p className="mt-2 text-sm">{detail.next_action}</p>
            ) : null}
            <p className="mt-2 text-sm">
              <Link to={`/clients/${detail.client.id}`} className="text-primary hover:underline">
                {t('crm.opportunities.openClient')}
              </Link>
            </p>
          </>
        ) : (
          <p className="text-destructive mt-4 text-sm">{error ?? t('crm.error.notFound')}</p>
        )}
      </div>

      {error && detail ? <p className="text-destructive text-sm">{error}</p> : null}

      {detail ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('crm.opportunities.stageActions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={detail.stage === s ? 'default' : 'secondary'}
                  disabled={busyStage !== null}
                  onClick={() => void setStage(s)}
                >
                  {busyStage === s ? t('crm.opportunities.updating') : s}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  )
}
