import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch, getApiBaseUrl, getStoredAccessToken } from '@/lib/api'

type DocumentRow = {
  id: string
  document_type: string
  original_filename: string
  content_type: string
  size_bytes: number
  sha256: string
  storage_key: string
  product_id: string | null
  created_at: string
  updated_at: string
  current_version: number
  uploaded_by_user: { id: string; email: string; full_name: string | null }
}

type ProductOption = { id: string; name: string }

const documentTypeOptions = [
  { value: 'GENERAL_CONDITIONS', label: 'Condições gerais' },
  { value: 'POLICY', label: 'Apólice' },
  { value: 'PROPOSAL', label: 'Proposta' },
  { value: 'ENDORSEMENT', label: 'Endosso' },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function downloadWithAuth(path: string): Promise<void> {
  const token = getStoredAccessToken()
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Download failed (${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = 'document.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function DocumentsPage() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [rows, setRows] = useState<DocumentRow[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [documentType, setDocumentType] = useState('GENERAL_CONDITIONS')
  const [productId, setProductId] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.name })),
    [products],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [docs, prods] = await Promise.all([
        apiFetch<DocumentRow[]>('/v1/documents'),
        apiFetch<ProductOption[]>('/v1/products?active_only=false'),
      ])
      setRows(docs)
      setProducts(prods)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onUpload = async () => {
    if (!file || !isAdmin) return
    setUploading(true)
    setError(null)
    try {
      const token = getStoredAccessToken()
      const headers = new Headers()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      const body = new FormData()
      body.append('document_type', documentType)
      if (productId.trim()) body.append('product_id', productId.trim())
      body.append('file', file)
      const res = await fetch(`${getApiBaseUrl()}/v1/documents`, {
        method: 'POST',
        headers,
        body,
      })
      const text = await res.text()
      if (!res.ok) {
        throw new Error(text || `Upload failed (${res.status})`)
      }
      toast.success('Documento enviado.')
      setFile(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader title="Documentos" description="Upload, extração e normalização (administração)." />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload de PDF</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="doc-type">Tipo do documento</Label>
              <FormSelect
                id="doc-type"
                value={documentType}
                onValueChange={setDocumentType}
                options={documentTypeOptions}
                disabled={!isAdmin}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="doc-product">Produto (opcional)</Label>
              <FormSelect
                id="doc-product"
                value={productId}
                onValueChange={setProductId}
                options={productOptions}
                allowEmpty
                emptyLabel="—"
                disabled={!isAdmin}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="doc-file">Arquivo PDF</Label>
            <Input
              id="doc-file"
              type="file"
              accept="application/pdf,.pdf"
              disabled={!isAdmin}
              onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
            />
            <p className="text-muted-foreground text-sm">PDF até 100MB (validação por magic bytes).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!isAdmin || uploading || !file} onClick={() => void onUpload()}>
              {uploading ? 'A enviar…' : 'Enviar'}
            </Button>
            <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}>
              {t('action.refresh')}
            </Button>
          </div>
          {!isAdmin ? (
            <p className="text-muted-foreground text-sm">Somente administradores podem enviar documentos.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos enviados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum documento encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link className="text-primary hover:underline" to={`/documents/${r.id}`}>
                        {r.original_filename}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.document_type}</TableCell>
                    <TableCell className="text-muted-foreground">{r.product_id ? 'Vinculado' : '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{formatBytes(r.size_bytes)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.current_version}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void downloadWithAuth(`/v1/documents/${r.id}/download`)}
                        >
                          Baixar
                        </Button>
                        <Button asChild type="button" variant="ghost" size="sm">
                          <Link to={`/documents/${r.id}`}>Detalhes</Link>
                        </Button>
                      </div>
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

