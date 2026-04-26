import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import {
  ProductCatalogEditorBody,
  buildProductJsonBody,
  emptyProductCatalogDraft,
  type InsurerOption,
  type ProductCatalogDraft,
} from '@/components/ProductCatalogEditorBody'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'

type CreatedProduct = { id: string }

export function ProductNewPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetInsurerId = searchParams.get('insurer_id') ?? ''

  const [draft, setDraft] = useState<ProductCatalogDraft>(() => {
    const d = emptyProductCatalogDraft()
    if (presetInsurerId) {
      d.insurer_id = presetInsurerId
    }
    return d
  })
  const [insurers, setInsurers] = useState<InsurerOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const params = new URLSearchParams()
        params.set('active_only', 'true')
        const list = await apiFetch<{ id: string; name: string }[]>(`/v1/insurers?${params.toString()}`)
        if (!cancelled) {
          setInsurers(list.map((r) => ({ id: r.id, name: r.name })))
        }
      } catch {
        if (!cancelled) {
          setInsurers([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!presetInsurerId) {
      return
    }
    setDraft((d) => ({ ...d, insurer_id: presetInsurerId }))
  }, [presetInsurerId])

  const onCreate = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!draft.name.trim()) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await apiFetch<CreatedProduct>('/v1/products', {
        method: 'POST',
        json: buildProductJsonBody(draft),
      })
      toast.success(t('toast.productCreated'))
      void navigate(`/products/${created.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ to: '/products', label: t('crm.catalog.backToList') }}
        title={t('crm.catalog.newProduct')}
        description={t('crm.catalog.subtitle')}
      />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.catalog.editorTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={onCreate}>
            <ProductCatalogEditorBody draft={draft} setDraft={setDraft} insurers={insurers} />
            <Button type="submit" disabled={saving || !draft.name.trim()}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
              {saving ? t('crm.catalog.saving') : t('crm.catalog.create')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
