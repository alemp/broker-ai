import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch, apiPostFormData } from '@/lib/api'
import {
  INSURANCE_LINE_VALUES,
  insuranceLineSupportsProposalPdfExtract,
  type InsuranceLineValue,
  type ProposalDocumentUploadResponse,
  type ProposalExtractResponse,
} from '@/lib/proposalIngest'
import { translateProductCategory } from '@/lib/crmEnumLabels'

type ClientRow = { id: string; full_name: string }
type LeadRow = { id: string; full_name: string; converted_client_id: string | null }
type PartyKind = 'client' | 'lead'

type CreatedOpportunity = { id: string }

export function ProposalIngestPage() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [partyKind, setPartyKind] = useState<PartyKind>('client')
  const [clientId, setClientId] = useState('')
  const [leadId, setLeadId] = useState('')
  const [insuranceLine, setInsuranceLine] = useState<InsuranceLineValue>('AUTO_INSURANCE')
  const [loadingParties, setLoadingParties] = useState(true)
  const [creating, setCreating] = useState(false)
  const [opportunityId, setOpportunityId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractResult, setExtractResult] = useState<ProposalExtractResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadingParties(true)
      try {
        const [cl, ld] = await Promise.all([
          apiFetch<ClientRow[]>('/v1/clients'),
          apiFetch<LeadRow[]>('/v1/leads'),
        ])
        if (!cancelled) {
          setClients(cl)
          setLeads(ld.filter((l) => !l.converted_client_id))
        }
      } catch {
        if (!cancelled) {
          setError(t('crm.error.generic'))
        }
      } finally {
        setLoadingParties(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const pdfExtractSupported = insuranceLineSupportsProposalPdfExtract(insuranceLine)

  const onCreateOpportunity = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!user) {
      return
    }
    if (partyKind === 'client' && !clientId) {
      setError(t('proposalIngest.selectParty'))
      return
    }
    if (partyKind === 'lead' && !leadId) {
      setError(t('proposalIngest.selectParty'))
      return
    }
    setCreating(true)
    setError(null)
    try {
      const partyPayload = partyKind === 'client' ? { client_id: clientId } : { lead_id: leadId }
      const created = await apiFetch<CreatedOpportunity>('/v1/opportunities', {
        method: 'POST',
        json: {
          ...partyPayload,
          owner_id: user.id,
          insurance_line: insuranceLine,
          stage: 'LEAD',
          status: 'OPEN',
          closing_probability: 10,
          next_action: t('proposalIngest.defaultNextAction'),
        },
      })
      setOpportunityId(created.id)
      toast.success(t('toast.opportunityCreated'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setCreating(false)
    }
  }

  const onUpload = async () => {
    if (!opportunityId || !file) {
      return
    }
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('document_type', 'PROPOSAL')
      form.append('opportunity_id', opportunityId)
      form.append('file', file)
      await apiPostFormData<ProposalDocumentUploadResponse>('/v1/documents', form)
      toast.success(t('toast.proposalUploaded'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setUploading(false)
    }
  }

  const onExtract = async () => {
    if (!opportunityId) {
      return
    }
    setExtracting(true)
    setError(null)
    try {
      const res = await apiFetch<ProposalExtractResponse>(
        `/v1/opportunities/${opportunityId}/proposal-extract?dry_run=false`,
        { method: 'POST' },
      )
      setExtractResult(res)
      toast.success(t('toast.proposalExtracted'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader
        back={{ to: '/opportunities', label: t('crm.opportunities.back') }}
        title={t('proposalIngest.title')}
        description={t('proposalIngest.subtitle')}
      />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('proposalIngest.step1Title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onCreateOpportunity}>
            <div className="grid gap-2 sm:max-w-md">
              <Label htmlFor="pi-party-kind">{t('crm.opportunities.partyKind')}</Label>
              <FormSelect
                id="pi-party-kind"
                value={partyKind}
                onValueChange={(v) => setPartyKind(v as PartyKind)}
                disabled={loadingParties || !user || !!opportunityId}
                options={[
                  { value: 'client', label: t('crm.opportunities.partyClient') },
                  { value: 'lead', label: t('crm.opportunities.partyLead') },
                ]}
              />
            </div>
            {partyKind === 'client' ? (
              <div className="grid flex-1 gap-2 sm:max-w-md">
                <Label htmlFor="pi-client">{t('crm.opportunities.client')}</Label>
                <FormSelect
                  id="pi-client"
                  value={clientId}
                  onValueChange={setClientId}
                  allowEmpty
                  emptyLabel={t('crm.opportunities.selectClient')}
                  placeholder={t('crm.opportunities.selectClient')}
                  disabled={loadingParties || !user || !!opportunityId}
                  options={clients.map((c) => ({ value: c.id, label: c.full_name }))}
                />
              </div>
            ) : (
              <div className="grid flex-1 gap-2 sm:max-w-md">
                <Label htmlFor="pi-lead">{t('crm.opportunities.lead')}</Label>
                <FormSelect
                  id="pi-lead"
                  value={leadId}
                  onValueChange={setLeadId}
                  allowEmpty
                  emptyLabel={t('crm.opportunities.selectLead')}
                  placeholder={t('crm.opportunities.selectLead')}
                  disabled={loadingParties || !user || !!opportunityId}
                  options={leads.map((l) => ({ value: l.id, label: l.full_name }))}
                />
              </div>
            )}
            <div className="grid gap-2 sm:max-w-md">
              <Label htmlFor="pi-line">{t('crm.opportunities.insuranceLine')}</Label>
              <FormSelect
                id="pi-line"
                value={insuranceLine}
                onValueChange={(v) => setInsuranceLine(v as InsuranceLineValue)}
                disabled={!!opportunityId}
                options={INSURANCE_LINE_VALUES.map((v) => ({
                  value: v,
                  label: translateProductCategory(v, t),
                }))}
              />
              <p className="text-muted-foreground text-xs">{t('proposalIngest.lineHint')}</p>
            </div>
            <Button type="submit" disabled={creating || !user || !!opportunityId}>
              {creating ? t('proposalIngest.creating') : t('proposalIngest.createOpp')}
            </Button>
            {opportunityId ? (
              <p className="text-muted-foreground text-sm">
                {t('proposalIngest.oppCreated')}{' '}
                <Link className="text-primary font-medium hover:underline" to={`/opportunities/${opportunityId}`}>
                  {opportunityId}
                </Link>
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('proposalIngest.step2Title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {opportunityId && !pdfExtractSupported ? (
            <p className="text-muted-foreground text-sm">{t('proposalIngest.pdfArchiveHint')}</p>
          ) : null}
          <div className="grid gap-2 sm:max-w-md">
            <Label htmlFor="pi-file">{t('proposalIngest.pdfLabel')}</Label>
            <input
              id="pi-file"
              type="file"
              accept="application/pdf,.pdf"
              disabled={!opportunityId}
              className="border-input bg-background text-foreground w-full max-w-md rounded-md border px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
              onChange={(ev) => {
                const f = ev.target.files?.[0] ?? null
                setFile(f)
              }}
            />
          </div>
          <Button type="button" disabled={!opportunityId || !file || uploading} onClick={() => void onUpload()}>
            {uploading ? t('proposalIngest.uploading') : t('proposalIngest.upload')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('proposalIngest.step3Title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pdfExtractSupported ? (
            <p className="text-muted-foreground text-sm">{t('proposalIngest.pdfExtractUnavailable')}</p>
          ) : null}
          <Button
            type="button"
            disabled={!opportunityId || extracting || !pdfExtractSupported}
            onClick={() => void onExtract()}
          >
            {extracting ? t('proposalIngest.extracting') : t('proposalIngest.extract')}
          </Button>
          {extractResult ? (
            <div className="space-y-2">
              <p className="text-sm">
                <span className="text-muted-foreground">{t('proposalIngest.resultApplied')}</span>{' '}
                <span className="font-medium">{extractResult.applied ? t('crm.profile.yes') : t('crm.profile.no')}</span>
                {' · '}
                <span className="text-muted-foreground">{t('proposalIngest.resultReview')}</span>{' '}
                <span className="font-medium">
                  {extractResult.requires_review ? t('crm.profile.yes') : t('crm.profile.no')}
                </span>
              </p>
              {extractResult.validation_errors.length > 0 ? (
                <ul className="text-destructive list-inside list-disc text-xs">
                  {extractResult.validation_errors.map((err, idx) => (
                    <li key={idx}>{typeof err.msg === 'string' ? err.msg : JSON.stringify(err)}</li>
                  ))}
                </ul>
              ) : null}
              <pre className="bg-muted max-h-[28rem] overflow-auto rounded-md border p-3 text-xs">
                {JSON.stringify(extractResult.payload, null, 2)}
              </pre>
              {opportunityId ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/opportunities/${opportunityId}`}>{t('proposalIngest.openOpp')}</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
