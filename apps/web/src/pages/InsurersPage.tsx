import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'

type InsurerDto = {
  id: string
  name: string
  code: string | null
  active: boolean
  notes: string | null
}

export function InsurersPage() {
  const { t } = useTranslation('common')
  const [rows, setRows] = useState<InsurerDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<InsurerDto[]>('/v1/insurers?active_only=false')
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
      setName('')
      setCode('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('nav.insurers')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('crm.insurers.subtitle')}</p>
      </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.insurers.list')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.insurers.empty')}</p>
          ) : (
            <ul className="divide-y text-sm">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground">
                    {r.code ?? '—'} · {r.active ? t('crm.insurers.active') : t('crm.insurers.inactive')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
