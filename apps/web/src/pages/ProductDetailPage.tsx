import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import {
  ProductCatalogEditorBody,
  buildProductJsonBody,
  draftFromApiProduct,
  emptyProductCatalogDraft,
  type InsurerOption,
  type ProductCatalogDraft,
} from '@/components/ProductCatalogEditorBody'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'

export function ProductDetailPage() {
  const { t } = useTranslation('common')
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()

  const [draft, setDraft] = useState<ProductCatalogDraft>(emptyProductCatalogDraft)
  const [insurers, setInsurers] = useState<InsurerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!productId) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [p, insList] = await Promise.all([
        apiFetch<Record<string, unknown>>(`/v1/products/${productId}`),
        apiFetch<{ id: string; name: string }[]>('/v1/insurers?active_only=false'),
      ])
      setDraft(draftFromApiProduct(p))
      setInsurers(insList.map((r) => ({ id: r.id, name: r.name })))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoading(false)
    }
  }, [productId, t])

  useEffect(() => {
    void load()
  }, [load])

  const onSave = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!productId || !draft.name.trim()) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiFetch(`/v1/products/${productId}`, {
        method: 'PATCH',
        json: buildProductJsonBody(draft),
      })
      toast.success(t('toast.productSaved'))
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSaving(false)
    }
  }

  const onDeactivate = async () => {
    if (!productId) {
      return
    }
    if (!window.confirm(t('crm.catalog.confirmDeactivate'))) {
      return
    }
    setDeactivating(true)
    setError(null)
    try {
      await apiFetch(`/v1/products/${productId}`, { method: 'DELETE' })
      toast.success(t('toast.productDeactivated'))
      void navigate('/products', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setDeactivating(false)
    }
  }

  if (!productId) {
    return null
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ to: '/products', label: t('crm.catalog.backToList') }}
        title={draft.name.trim() || t('crm.catalog.detailTitle')}
        description={t('crm.catalog.subtitle')}
      />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.catalog.editorTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
          ) : (
            <form className="space-y-6" onSubmit={onSave}>
              <ProductCatalogEditorBody draft={draft} setDraft={setDraft} insurers={insurers} />
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saving || !draft.name.trim()}>
                  {saving ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
                  {saving ? t('crm.catalog.saving') : t('crm.catalog.save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={deactivating || !draft.active}
                  onClick={() => void onDeactivate()}
                >
                  {deactivating ? t('crm.catalog.deactivating') : t('crm.catalog.deactivate')}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
