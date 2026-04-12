import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Collapsible } from 'radix-ui'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiUpload } from '@/lib/api'
import { cn } from '@/lib/utils'

type ImportRowError = {
  row_number: number
  message: string
}

type PreviewResponse = {
  file_sha256: string
  source_format: string
  total_data_rows: number
  valid_row_count: number
  error_count: number
  errors: ImportRowError[]
  preview_rows: Record<string, string | number | null | undefined>[]
}

type CommitResponse = {
  batch_id: string
  row_count: number
  inserted_count: number
  updated_count: number
}

export function ClientImportPage() {
  const { t } = useTranslation('common')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingCommit, setLoadingCommit] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPickFile = (f: File | null) => {
    setFile(f)
    setPreview(null)
    setCommitResult(null)
    setError(null)
  }

  const onPreview = async () => {
    if (!file) {
      return
    }
    setLoadingPreview(true)
    setError(null)
    setCommitResult(null)
    try {
      const res = await apiUpload<PreviewResponse>('/v1/clients/import/preview', file)
      setPreview(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoadingPreview(false)
    }
  }

  const onCommit = async () => {
    if (!file || !preview || preview.error_count > 0) {
      return
    }
    setLoadingCommit(true)
    setError(null)
    try {
      const res = await apiUpload<CommitResponse>('/v1/clients/import/commit', file)
      setCommitResult(res)
      toast.success(t('crm.import.toastCommitted'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoadingCommit(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ to: '/clients', label: t('crm.clients.back') }}
        title={t('crm.import.title')}
        description={t('crm.import.subtitle')}
      />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <Collapsible.Root defaultOpen={false}>
          <CardHeader className="pb-2">
            <Collapsible.Trigger
              type="button"
              className={cn(
                'group hover:bg-muted/50 -mx-2 flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left outline-none',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              )}
            >
              <span className="font-heading text-base leading-snug font-medium">
                {t('crm.import.guide.title')}
              </span>
              <ChevronDown
                className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </Collapsible.Trigger>
          </CardHeader>
          <Collapsible.Content>
            <CardContent className="space-y-4 pt-0 text-muted-foreground">
              <p>{t('crm.import.guide.intro')}</p>
              <div className="space-y-2">
                <h3 className="text-foreground text-sm font-medium">
                  {t('crm.import.guide.requiredHeading')}
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>{t('crm.import.guide.required1')}</li>
                  <li>{t('crm.import.guide.required2')}</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="text-foreground text-sm font-medium">
                  {t('crm.import.guide.optionalHeading')}
                </h3>
                <p>{t('crm.import.guide.optionalIntro')}</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>{t('crm.import.guide.optPhone')}</li>
                  <li>{t('crm.import.guide.optNotes')}</li>
                  <li>{t('crm.import.guide.optOwner')}</li>
                  <li>{t('crm.import.guide.optKind')}</li>
                  <li>{t('crm.import.guide.optMarketing')}</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="text-foreground text-sm font-medium">{t('crm.import.guide.heldHeading')}</h3>
                <p>{t('crm.import.guide.heldBody')}</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-foreground text-sm font-medium">
                  {t('crm.import.guide.advancedHeading')}
                </h3>
                <p>{t('crm.import.guide.advancedBody')}</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-foreground text-sm font-medium">{t('crm.import.guide.tipsHeading')}</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>{t('crm.import.guide.tips1')}</li>
                  <li>{t('crm.import.guide.tips2')}</li>
                  <li>{t('crm.import.guide.tips3')}</li>
                </ul>
              </div>
            </CardContent>
          </Collapsible.Content>
        </Collapsible.Root>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('crm.import.uploadTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-file">{t('crm.import.fileLabel')}</Label>
            <Input
              id="import-file"
              type="file"
              accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(ev) => onPickFile(ev.target.files?.[0] ?? null)}
            />
            <p className="text-muted-foreground text-sm">{t('crm.import.fileHint')}</p>
            <Button variant="outline" size="sm" className="w-fit" asChild>
              <a
                href={`${import.meta.env.BASE_URL}templates/importacao-clientes-modelo.xlsx`}
                download="importacao-clientes-modelo.xlsx"
                className="no-underline"
              >
                {t('crm.import.downloadTemplate')}
              </a>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!file || loadingPreview} onClick={() => void onPreview()}>
              {loadingPreview ? t('crm.import.previewing') : t('crm.import.preview')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!file || !preview || preview.error_count > 0 || loadingCommit}
              onClick={() => void onCommit()}
            >
              {loadingCommit ? t('crm.import.committing') : t('crm.import.commit')}
            </Button>
            {commitResult ? (
              <Button variant="outline" asChild>
                <Link to="/clients">{t('crm.import.backToList')}</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('crm.import.summaryTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t('crm.import.format')}</dt>
                <dd>{preview.source_format}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('crm.import.rowsTotal')}</dt>
                <dd>{preview.total_data_rows}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('crm.import.rowsValid')}</dt>
                <dd>{preview.valid_row_count}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('crm.import.rowsErrors')}</dt>
                <dd>{preview.error_count}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{t('crm.import.fileHash')}</dt>
                <dd className="font-mono text-xs break-all">{preview.file_sha256}</dd>
              </div>
            </dl>

            {preview.errors.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">{t('crm.import.errorsTitle')}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('crm.import.colRow')}</TableHead>
                      <TableHead>{t('crm.import.colMessage')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.errors.map((err, i) => (
                      <TableRow key={`${err.row_number}-${i}`}>
                        <TableCell>{err.row_number}</TableCell>
                        <TableCell>{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {preview.preview_rows.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">{t('crm.import.previewTableTitle')}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(preview.preview_rows[0]).map((k) => (
                        <TableHead key={k}>{k}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview_rows.map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).map((v, j) => (
                          <TableCell key={j}>{v === null || v === undefined ? '' : String(v)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {commitResult ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('crm.import.resultTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{t('crm.import.resultInserted', { count: commitResult.inserted_count })}</p>
            <p>{t('crm.import.resultUpdated', { count: commitResult.updated_count })}</p>
            <p className="text-muted-foreground mt-2 font-mono text-xs">{commitResult.batch_id}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
