import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { CrmListCardHeader } from '@/components/CrmListCardHeader'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FormSelect } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePersistedListViewMode } from '@/hooks/usePersistedListViewMode'
import { apiFetch } from '@/lib/api'

const LIST_VIEW_STORAGE_KEY = 'ai-copilot:list-view:products'

type ProductRow = {
  id: string
  name: string
  product_line: string | null
  category: string
  active: boolean
  insurer: { id: string; name: string; code: string | null } | null
}

const ALL_CATEGORIES_VALUE = '__all__'

export function ProductsPage() {
  const { t } = useTranslation('common')
  const [rows, setRows] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listSearch, setListSearch] = useState('')
  const debouncedListSearch = useDebouncedValue(listSearch, 350)
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES_VALUE)
  const [viewMode, setViewMode] = usePersistedListViewMode(LIST_VIEW_STORAGE_KEY)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('active_only', 'false')
      const q = debouncedListSearch.trim()
      if (q) {
        params.set('q', q)
      }
      if (categoryFilter !== ALL_CATEGORIES_VALUE) {
        params.set('category', categoryFilter)
      }
      const data = await apiFetch<ProductRow[]>(`/v1/products?${params.toString()}`)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoading(false)
    }
  }, [debouncedListSearch, categoryFilter, t])

  useEffect(() => {
    void load()
  }, [load])

  const categoryLabelByCode: Record<string, string> = {
    AUTO_INSURANCE: t('crm.catalog.category.AUTO_INSURANCE'),
    GENERAL_INSURANCE: t('crm.catalog.category.GENERAL_INSURANCE'),
    LIFE_INSURANCE: t('crm.catalog.category.LIFE_INSURANCE'),
    HEALTH_INSURANCE: t('crm.catalog.category.HEALTH_INSURANCE'),
  }

  const categoryFilterOptions = [
    { value: ALL_CATEGORIES_VALUE, label: t('crm.catalog.filterAllCategories') },
    { value: 'AUTO_INSURANCE', label: t('crm.catalog.category.AUTO_INSURANCE') },
    { value: 'GENERAL_INSURANCE', label: t('crm.catalog.category.GENERAL_INSURANCE') },
    { value: 'LIFE_INSURANCE', label: t('crm.catalog.category.LIFE_INSURANCE') },
    { value: 'HEALTH_INSURANCE', label: t('crm.catalog.category.HEALTH_INSURANCE') },
  ]

  const categoryLabel = (code: string) => categoryLabelByCode[code] ?? code

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader title={t('nav.products')} description={t('crm.catalog.subtitle')}>
        <Button asChild>
          <Link to="/products/new">{t('crm.catalog.newProduct')}</Link>
        </Button>
      </PageHeader>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[200px] gap-2">
          <label className="text-sm font-medium" htmlFor="products-cat-filter">
            {t('crm.catalog.filterByLine')}
          </label>
          <FormSelect
            id="products-cat-filter"
            value={categoryFilter}
            onValueChange={setCategoryFilter}
            options={categoryFilterOptions}
          />
        </div>
      </div>

      <Card>
        <CrmListCardHeader
          listTitle={t('crm.catalog.list')}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={load}
          loading={loading}
          searchId="products-list-search"
          searchValue={listSearch}
          onSearchChange={setListSearch}
          searchPlaceholder={t('crm.catalog.listSearch')}
          searchAriaLabel={t('crm.catalog.listSearchAria')}
        />
        <CardContent>
          {loading ? (
            viewMode === 'table' ? (
              <div className="space-y-2" aria-busy="true" aria-label={t('auth.loading')}>
                <div className="flex gap-2 border-b px-3 py-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-2 border-b px-3 py-3 last:border-0">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                aria-busy="true"
                aria-label={t('auth.loading')}
              >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="border-border/80 flex flex-col gap-3 rounded-xl border p-4">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            )
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('crm.catalog.empty')}</p>
          ) : viewMode === 'table' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('crm.catalog.fields.name')}</TableHead>
                  <TableHead>{t('crm.catalog.fields.productLine')}</TableHead>
                  <TableHead>{t('crm.catalog.fields.category')}</TableHead>
                  <TableHead>{t('crm.table.insurer')}</TableHead>
                  <TableHead>{t('crm.opportunities.filterStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link className="text-primary hover:underline" to={`/products/${r.id}`}>
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.product_line?.trim() ? r.product_line : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{categoryLabel(r.category)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.insurer?.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.active ? t('crm.insurers.active') : t('crm.insurers.inactive')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <li key={r.id}>
                  <Card className="border-border/80 h-full shadow-sm transition-shadow hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <Link
                        className="text-foreground line-clamp-2 text-base font-semibold hover:underline"
                        to={`/products/${r.id}`}
                      >
                        {r.name}
                      </Link>
                      <dl className="text-muted-foreground space-y-1 text-sm">
                        {r.product_line?.trim() ? (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-foreground/80 font-medium">
                              {t('crm.catalog.fields.productLine')}
                            </dt>
                            <dd>{r.product_line}</dd>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-foreground/80 font-medium">
                            {t('crm.catalog.fields.category')}
                          </dt>
                          <dd>{categoryLabel(r.category)}</dd>
                        </div>
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-foreground/80 font-medium">{t('crm.table.insurer')}</dt>
                          <dd>{r.insurer?.name ?? '—'}</dd>
                        </div>
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-foreground/80 font-medium">
                            {t('crm.opportunities.filterStatus')}
                          </dt>
                          <dd>{r.active ? t('crm.insurers.active') : t('crm.insurers.inactive')}</dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
