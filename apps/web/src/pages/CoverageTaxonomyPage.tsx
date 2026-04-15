import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api'

type TaxonomyRow = {
  id: string
  code: string
  label: string
  synonyms: unknown[]
  active: boolean
  created_at: string
}

function parseSynonyms(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function formatSynonyms(value: unknown[]): string {
  return value
    .map((v) => (typeof v === 'string' ? v : ''))
    .filter(Boolean)
    .join(', ')
}

export function CoverageTaxonomyPage() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [rows, setRows] = useState<TaxonomyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [synonyms, setSynonyms] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const editingRow = useMemo(
    () => rows.find((r) => r.id === editingId) ?? null,
    [rows, editingId],
  )
  const [editLabel, setEditLabel] = useState('')
  const [editSynonyms, setEditSynonyms] = useState('')
  const [editActive, setEditActive] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<TaxonomyRow[]>('/v1/coverage-taxonomy')
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

  useEffect(() => {
    if (!editingRow) return
    setEditLabel(editingRow.label)
    setEditSynonyms(formatSynonyms(editingRow.synonyms))
    setEditActive(editingRow.active)
  }, [editingRow])

  const onCreate = async () => {
    if (!isAdmin || !code.trim() || !label.trim()) return
    setSaving(true)
    setError(null)
    try {
      await apiFetch('/v1/coverage-taxonomy', {
        method: 'POST',
        json: { code: code.trim(), label: label.trim(), synonyms: parseSynonyms(synonyms), active: true },
      })
      toast.success('Cobertura canônica criada.')
      setCode('')
      setLabel('')
      setSynonyms('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSaving(false)
    }
  }

  const onSaveEdit = async () => {
    if (!isAdmin || !editingRow) return
    setSaving(true)
    setError(null)
    try {
      await apiFetch(`/v1/coverage-taxonomy/${editingRow.id}`, {
        method: 'PATCH',
        json: { label: editLabel.trim(), synonyms: parseSynonyms(editSynonyms), active: editActive },
      })
      toast.success('Cobertura canônica atualizada.')
      setEditingId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        title="Taxonomia de coberturas"
        description="Mapa canônico usado para normalizar textos das seguradoras."
      />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova cobertura canônica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="tax-code">Código</Label>
              <Input
                id="tax-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex.: AUTO_THEFT"
                disabled={!isAdmin}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tax-label">Nome</Label>
              <Input
                id="tax-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex.: Roubo e furto"
                disabled={!isAdmin}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tax-synonyms">Sinônimos (separados por vírgula)</Label>
            <Input
              id="tax-synonyms"
              value={synonyms}
              onChange={(e) => setSynonyms(e.target.value)}
              placeholder="Ex.: furto, roubo, subtração"
              disabled={!isAdmin}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!isAdmin || saving || !code.trim() || !label.trim()} onClick={() => void onCreate()}>
              {saving ? 'A salvar…' : 'Criar'}
            </Button>
            <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}>
              {t('action.refresh')}
            </Button>
          </div>
          {!isAdmin ? (
            <p className="text-muted-foreground text-sm">Somente administradores podem editar a taxonomia.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coberturas canônicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-muted-foreground text-sm">{t('auth.loading')}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma cobertura cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Sinônimos</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell className="text-muted-foreground">{formatSynonyms(r.synonyms)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.active ? 'Sim' : 'Não'}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="outline" size="sm" disabled={!isAdmin} onClick={() => setEditingId(r.id)}>
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {editingRow ? (
            <div className="border-border/80 space-y-4 rounded-xl border p-4">
              <p className="text-sm font-medium">Editar: {editingRow.code}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Nome</Label>
                  <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Ativo</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={editActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditActive(true)}
                    >
                      Sim
                    </Button>
                    <Button
                      type="button"
                      variant={!editActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditActive(false)}
                    >
                      Não
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Sinônimos</Label>
                <Input value={editSynonyms} onChange={(e) => setEditSynonyms(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={!isAdmin || saving || !editLabel.trim()} onClick={() => void onSaveEdit()}>
                  {saving ? 'A salvar…' : 'Salvar'}
                </Button>
                <Button type="button" variant="outline" disabled={saving} onClick={() => setEditingId(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

