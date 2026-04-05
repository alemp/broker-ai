import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { apiFetch } from '@/lib/api'
import { CAMPAIGN_KIND_VALUES, type CampaignKindValue } from '@/lib/campaignKinds'
import { translateCampaignKind } from '@/lib/crmEnumLabels'

export function CampaignNewPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CampaignKindValue>('BIRTHDAY')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          kind,
          template_body: body.trim(),
          segment_criteria: { marketing_opt_in: true },
          active: true,
        },
      })
      toast.success(t('toast.campaignCreated'))
      void navigate('/campaigns', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ to: '/campaigns', label: t('crm.campaigns.back') }}
        title={t('crm.campaigns.add')}
        description={t('crm.campaigns.subtitle')}
      />

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
                <FormSelect
                  id="c-kind"
                  value={kind}
                  onValueChange={(v) => setKind(v as CampaignKindValue)}
                  options={CAMPAIGN_KIND_VALUES.map((k) => ({
                    value: k,
                    label: translateCampaignKind(k, t),
                  }))}
                />
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
    </div>
  )
}
