import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch, getApiBaseUrl, getStoredAccessToken } from '@/lib/api'

type DocumentOut = {
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

type DocumentVersionOut = {
  id: string
  document_id: string
  version: number
  content_type: string
  size_bytes: number
  sha256: string
  storage_key: string
  created_at: string
  uploaded_by_user: { id: string; email: string; full_name: string | null }
}

type ExtractionRun = {
  id: string
  document_id: string
  confidence: number
  requires_review: boolean
  extracted_data: Record<string, unknown>
  normalized_data: Record<string, unknown>
  confirmed_at: string | null
  created_at: string
  created_by_user: { id: string; email: string; full_name: string | null }
  confirmed_by_user: { id: string; email: string; full_name: string | null } | null
}

type JobRun = {
  id: string
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | string
  finished_at: string | null
  error_message: string | null
}

async function downloadWithAuth(path: string, filename: string): Promise<void> {
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
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function DocumentDetailPage() {
  const { t } = useTranslation('common')
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [doc, setDoc] = useState<DocumentOut | null>(null)
  const [runs, setRuns] = useState<ExtractionRun[]>([])
  const [versions, setVersions] = useState<DocumentVersionOut[]>([])
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [extractJobId, setExtractJobId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [uploadingVersion, setUploadingVersion] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null)

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const selectedRun = useMemo(
    () => runs.find((r) => r.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  )
  const [extractedText, setExtractedText] = useState('')
  const [normalizedText, setNormalizedText] = useState('')

  const load = useCallback(async () => {
    if (!documentId) return
    setLoading(true)
    setError(null)
    try {
      const [d, r] = await Promise.all([
        apiFetch<DocumentOut>(`/v1/documents/${documentId}`),
        apiFetch<ExtractionRun[]>(`/v1/documents/${documentId}/extractions`),
      ])
      setDoc(d)
      setRuns(r)
      const v = await apiFetch<DocumentVersionOut[]>(`/v1/documents/${documentId}/versions`)
      setVersions(v)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setLoading(false)
    }
  }, [documentId, t])

  useEffect(() => {
    void load()
  }, [load])

  const onUploadNewVersion = async () => {
    if (!isAdmin || !doc || !newVersionFile) return
    setUploadingVersion(true)
    setError(null)
    try {
      const token = getStoredAccessToken()
      const headers = new Headers()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      const body = new FormData()
      body.append('document_type', doc.document_type)
      if (doc.product_id) body.append('product_id', doc.product_id)
      body.append('file', newVersionFile, doc.original_filename)
      const res = await fetch(`${getApiBaseUrl()}/v1/documents`, {
        method: 'POST',
        headers,
        body,
      })
      const text = await res.text()
      if (!res.ok) throw new Error(text || `Upload failed (${res.status})`)
      toast.success('Nova versão enviada.')
      setNewVersionFile(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setUploadingVersion(false)
    }
  }

  useEffect(() => {
    if (!selectedRun) return
    setExtractedText(prettyJson(selectedRun.extracted_data))
    setNormalizedText(prettyJson(selectedRun.normalized_data))
  }, [selectedRun])

  const onExtract = async () => {
    if (!documentId || !isAdmin) return
    setExtracting(true)
    setError(null)
    try {
      const job = await apiFetch<JobRun>(`/v1/documents/${documentId}/extract`, { method: 'POST' })
      setExtractJobId(job.id)
      toast.message('Extração em processamento. Você pode continuar usando a tela.')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setExtracting(false)
    }
  }

  useEffect(() => {
    if (!extractJobId) return
    let cancelled = false
    const poll = async () => {
      try {
        const job = await apiFetch<JobRun>(`/v1/jobs/${extractJobId}`)
        if (cancelled) return
        if (job.status === 'RUNNING') {
          setTimeout(poll, 1200)
          return
        }
        if (job.status === 'SUCCESS') {
          toast.success('Extração concluída.')
          setExtractJobId(null)
          await load()
          return
        }
        toast.error(job.error_message ? `Falha na extração: ${job.error_message}` : 'Falha na extração.')
        setExtractJobId(null)
      } catch {
        if (cancelled) return
        setTimeout(poll, 2000)
      }
    }
    void poll()
    return () => {
      cancelled = true
    }
  }, [extractJobId, load])

  const onConfirm = async () => {
    if (!selectedRun || !isAdmin) return
    setConfirming(true)
    setError(null)
    try {
      const extracted = JSON.parse(extractedText) as Record<string, unknown>
      const normalized = JSON.parse(normalizedText) as Record<string, unknown>
      await apiFetch(`/v1/documents/extractions/${selectedRun.id}/confirm`, {
        method: 'PATCH',
        json: { extracted_data: extracted, normalized_data: normalized },
      })
      toast.success('Extração confirmada.')
      setSelectedRunId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON inválido ou falha ao confirmar.')
    } finally {
      setConfirming(false)
    }
  }

  if (!documentId) return null

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader back={{ to: '/documents', label: 'Voltar' }} title={doc?.original_filename ?? 'Documento'} />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || !doc ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
          ) : (
            <>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Tipo</dt>
                  <dd className="font-medium">{doc.document_type}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">SHA256</dt>
                  <dd className="font-mono text-xs">{doc.sha256}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Versão atual</dt>
                  <dd className="font-medium">{doc.current_version}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Criado</dt>
                  <dd className="font-medium">{new Date(doc.created_at).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Atualizado</dt>
                  <dd className="font-medium">{new Date(doc.updated_at).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Enviado por</dt>
                  <dd className="font-medium">{doc.uploaded_by_user.email}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void downloadWithAuth(`/v1/documents/${doc.id}/download`, doc.original_filename)}
                >
                  Baixar PDF
                </Button>
                <Button type="button" disabled={!isAdmin || extracting} onClick={() => void onExtract()}>
                  {extracting ? 'A extrair…' : 'Executar extração'}
                </Button>
                <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
                  {t('action.refresh')}
                </Button>
                {!isAdmin ? (
                  <Button type="button" variant="ghost" onClick={() => void navigate('/profile')}>
                    Somente admin pode extrair
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de versões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAdmin ? (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Enviar nova versão</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={uploadingVersion}
                  onChange={(ev) => setNewVersionFile(ev.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  disabled={uploadingVersion || !newVersionFile}
                  onClick={() => void onUploadNewVersion()}
                >
                  {uploadingVersion ? 'A enviar…' : 'Enviar versão'}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                O documento será atualizado e o histórico de versões será preservado.
              </p>
            </div>
          ) : null}
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
          ) : versions.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma versão registrada.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {versions.map((v) => (
                <div key={v.id} className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">v{v.version}</p>
                    <p className="text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()} • {v.uploaded_by_user.email}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">{v.sha256}</p>
                  </div>
                  <div className="text-muted-foreground">{(v.size_bytes / (1024 * 1024)).toFixed(1)} MB</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Execuções de extração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma extração executada ainda.</p>
          ) : (
            <ul className="space-y-3">
              {runs.map((r) => (
                <li key={r.id} className="border-border/80 rounded-xl border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {new Date(r.created_at).toLocaleString()} · Confiança: {r.confidence}%
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {r.requires_review ? 'Requer revisão' : r.confirmed_at ? 'Confirmado' : 'OK'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedRunId(r.id)}>
                        Abrir
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectedRun ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revisão / confirmação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Extraído (JSON)</p>
                <Textarea value={extractedText} onChange={(e) => setExtractedText(e.target.value)} rows={14} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Normalizado (JSON)</p>
                <Textarea value={normalizedText} onChange={(e) => setNormalizedText(e.target.value)} rows={14} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!isAdmin || confirming} onClick={() => void onConfirm()}>
                {confirming ? 'A confirmar…' : 'Confirmar'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelectedRunId(null)} disabled={confirming}>
                Fechar
              </Button>
            </div>
            {!isAdmin ? (
              <p className="text-muted-foreground text-sm">Somente administradores podem confirmar extrações.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

