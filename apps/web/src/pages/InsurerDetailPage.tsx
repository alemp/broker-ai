import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiFetch } from '@/lib/api'

type InsurerDto = {
  id: string
  name: string
  code: string | null
  active: boolean
  notes: string | null
}

type ProductBriefRow = {
  id: string
  name: string
  product_line: string | null
  category: string
  active: boolean
}

export function InsurerDetailPage() {
  const { t } = useTranslation('common')
  const { insurerId } = useParams<{ insurerId: string }>()

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [notes, setNotes] = useState('')
  const [active, setActive] = useState(true)
  const [products, setProducts] = useState<ProductBriefRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touchedName, setTouchedName] = useState(false)

  const nameError = (touchedName || name !== '') && !name.trim() ? t('crm.validation.required') : null

  const load = useCallback(async () => {
    if (!insurerId) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [ins, plist] = await Promise.all([
        apiFetch<InsurerDto>(`/v1/insurers/${insurerId}`),
        apiFetch<ProductBriefRow[]>(`/v1/insurers/${insurerId}/products?active_only=false`),
      ])
      setName(ins.name)
      setCode(ins.code ?? '')
      setNotes(ins.notes ?? '')
      setActive(ins.active)
      setProducts(plist)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoading(false)
    }
  }, [insurerId, t])

  useEffect(() => {
    void load()
  }, [load])

  const onSave = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!insurerId || !name.trim()) {
      setTouchedName(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiFetch(`/v1/insurers/${insurerId}`, {
        method: 'PATCH',
        json: {
          name: name.trim(),
          code: code.trim() || null,
          notes: notes.trim() || null,
          active,
        },
      })
      toast.success(t('toast.insurerSaved'))
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSaving(false)
    }
  }

  if (!insurerId) {
    return null
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ to: '/insurers', label: t('crm.insurers.back') }}
        title={name.trim() || t('crm.insurers.detailTitle')}
        description={t('crm.insurers.subtitle')}
      >
        <Button asChild variant="outline">
          <Link to={`/products/new?insurer_id=${encodeURIComponent(insurerId)}`}>
            {t('crm.insurers.addProduct')}
          </Link>
        </Button>
      </PageHeader>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.insurers.editSection')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
          ) : (
            <form className="space-y-4" onSubmit={onSave}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="id-name">{t('crm.insurers.name')}</Label>
                  <Input
                    id="id-name"
                    value={name}
                    onChange={(ev) => setName(ev.target.value)}
                    onBlur={() => setTouchedName(true)}
                    aria-invalid={nameError ? true : undefined}
                    required
                  />
                  {nameError ? <p className="text-destructive text-xs">{nameError}</p> : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="id-code">{t('crm.insurers.code')}</Label>
                  <Input id="id-code" value={code} onChange={(ev) => setCode(ev.target.value)} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    id="id-active"
                    type="checkbox"
                    className="border-input size-4 rounded border"
                    checked={active}
                    onChange={(ev) => setActive(ev.target.checked)}
                  />
                  <Label htmlFor="id-active" className="font-normal">
                    {t('crm.insurers.active')}
                  </Label>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="id-notes">{t('crm.clientDetail.summary.notes')}</Label>
                  <textarea
                    id="id-notes"
                    className="border-input bg-background min-h-[88px] w-full rounded-md border px-3 py-2 text-sm"
                    value={notes}
                    onChange={(ev) => setNotes(ev.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
                {saving ? t('crm.insurers.saving') : t('crm.insurers.save')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.insurers.productsSection')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
          ) : products.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.insurers.productsEmpty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('crm.catalog.fields.name')}</TableHead>
                  <TableHead>{t('crm.catalog.fields.productLine')}</TableHead>
                  <TableHead>{t('crm.opportunities.filterStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link className="text-primary hover:underline" to={`/products/${p.id}`}>
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.product_line?.trim() ? p.product_line : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.active ? t('crm.insurers.active') : t('crm.insurers.inactive')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
