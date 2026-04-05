import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid, RefreshCw, Table2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ListViewMode } from '@/hooks/usePersistedListViewMode'
import { cn } from '@/lib/utils'

export type CrmListCardHeaderProps = {
  listTitle: string
  viewMode: ListViewMode
  onViewModeChange: (mode: ListViewMode) => void
  onRefresh: () => void
  loading: boolean
  searchId: string
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  searchAriaLabel: string
  /** Renders between the title/toolbar row and the search (e.g. opportunity filters). */
  beforeSearch?: ReactNode
}

export function CrmListCardHeader({
  listTitle,
  viewMode,
  onViewModeChange,
  onRefresh,
  loading,
  searchId,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  beforeSearch,
}: CrmListCardHeaderProps) {
  const { t } = useTranslation('common')

  return (
    <CardHeader className="flex w-full flex-col items-stretch gap-4 space-y-0">
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <CardTitle className="text-base min-w-0 shrink">{listTitle}</CardTitle>
        <div className="ms-auto flex shrink-0 flex-wrap items-center gap-2">
          <div
            className="border-border flex rounded-lg border p-0.5"
            role="group"
            aria-label={t('crm.list.viewModeLabel')}
          >
            <Button
              type="button"
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('gap-1.5', viewMode === 'table' && 'shadow-sm')}
              aria-pressed={viewMode === 'table'}
              aria-label={t('crm.list.viewTable')}
              onClick={() => onViewModeChange('table')}
            >
              <Table2 className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{t('crm.list.viewTable')}</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('gap-1.5', viewMode === 'cards' && 'shadow-sm')}
              aria-pressed={viewMode === 'cards'}
              aria-label={t('crm.list.viewCards')}
              onClick={() => onViewModeChange('cards')}
            >
              <LayoutGrid className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{t('crm.list.viewCards')}</span>
            </Button>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            onClick={() => void onRefresh()}
            disabled={loading}
            aria-label={t('action.refresh')}
            title={t('action.refresh')}
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} aria-hidden />
          </Button>
        </div>
      </div>
      {beforeSearch ? <div className="w-full">{beforeSearch}</div> : null}
      <div className="w-full">
        <Label htmlFor={searchId} className="sr-only">
          {searchAriaLabel}
        </Label>
        <Input
          id={searchId}
          type="search"
          value={searchValue}
          onChange={(ev) => onSearchChange(ev.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
          autoComplete="off"
        />
      </div>
    </CardHeader>
  )
}
