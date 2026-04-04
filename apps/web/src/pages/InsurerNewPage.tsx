import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'

export function InsurerNewPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onCreate = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!name.trim()) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiFetch('/v1/insurers', {
        method: 'POST',
        json: { name: name.trim(), code: code.trim() || undefined, active: true },
      })
      toast.success(t('toast.insurerCreated'))
      void navigate('/insurers', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ to: '/insurers', label: t('crm.insurers.back') }}
        title={t('crm.insurers.add')}
        description={t('crm.insurers.subtitle')}
      />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.insurers.add')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={onCreate}>
            <div className="grid min-w-[200px] flex-1 gap-2">
              <Label htmlFor="ins-name">{t('crm.insurers.name')}</Label>
              <Input id="ins-name" value={name} onChange={(ev) => setName(ev.target.value)} />
            </div>
            <div className="grid w-32 gap-2">
              <Label htmlFor="ins-code">{t('crm.insurers.code')}</Label>
              <Input id="ins-code" value={code} onChange={(ev) => setCode(ev.target.value)} />
            </div>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? t('crm.insurers.saving') : t('crm.insurers.create')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
