import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'

type CampaignDto = {
  id: string
  name: string
  kind: string
  active: boolean
  template_body: string
  segment_criteria: Record<string, unknown>
}

export function CampaignsPage() {
  const { t } = useTranslation('common')
  const [rows, setRows] = useState<CampaignDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState('birthday')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<CampaignDto[]>('/v1/campaigns?limit=100')
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onCreate = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!name.trim() || !body.trim()) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiFetch('/v1/campaigns', {
        method: 'POST',
        json: {
          name: name.trim(),
          kind: kind.trim() || 'custom',
          template_body: body.trim(),
          segment_criteria: { marketing_opt_in: true },
          active: true,
        },
      })
      setName('')
      setBody('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSaving(false)
    }
  }

  const onRefresh = async (id: string) => {
    setRefreshingId(id)
    setError(null)
    try {
      await apiFetch(`/v1/campaigns/${id}/segment-refresh`, {
        method: 'POST',
        json: { channel: 'EMAIL' },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setRefreshingId(null)
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.campaigns')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('crm.campaigns.subtitle')}</p>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.campaigns.add')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={onCreate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="c-name">{t('crm.campaigns.name')}</Label>
                <Input id="c-name" value={name} onChange={(ev) => setName(ev.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="c-kind">{t('crm.campaigns.kind')}</Label>
                <Input id="c-kind" value={kind} onChange={(ev) => setKind(ev.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-body">{t('crm.campaigns.template')}</Label>
              <textarea
                id="c-body"
                className="border-input bg-background min-h-[100px] w-full rounded-md border px-3 py-2 text-sm"
                value={body}
                onChange={(ev) => setBody(ev.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving || !name.trim() || !body.trim()}>
              {saving ? t('crm.campaigns.saving') : t('crm.campaigns.create')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.campaigns.list')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.campaigns.empty')}</p>
          ) : (
            <ul className="space-y-4 text-sm">
              {rows.map((r) => (
                <li key={r.id} className="border-b pb-4 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{r.name}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={refreshingId === r.id}
                      onClick={() => onRefresh(r.id)}
                    >
                      {refreshingId === r.id
                        ? t('crm.campaigns.refreshing')
                        : t('crm.campaigns.segmentRefresh')}
                    </Button>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {r.kind} · {r.active ? t('crm.insurers.active') : t('crm.insurers.inactive')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
