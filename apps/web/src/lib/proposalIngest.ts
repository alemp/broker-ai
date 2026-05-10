/** Types and constants for proposal PDF ingest (API Phases 2–3). */

export const INSURANCE_LINE_VALUES = [
  'LIFE_INSURANCE',
  'HEALTH_INSURANCE',
  'AUTO_INSURANCE',
  'GENERAL_INSURANCE',
] as const

export type InsuranceLineValue = (typeof INSURANCE_LINE_VALUES)[number]

/** PDF `proposal-extract`: Bradesco auto + Tokio Marine PME vida heuristics. */
export function insuranceLineSupportsProposalPdfExtract(line: InsuranceLineValue): boolean {
  return line === 'AUTO_INSURANCE' || line === 'LIFE_INSURANCE'
}

export type ProposalDocumentUploadResponse = {
  id: string
  document_type: string
  opportunity_id: string | null
  original_filename: string
}

export type ProposalExtractResponse = {
  opportunity_id: string
  party_id: string | null
  party_kind: 'client' | 'lead' | null
  document_id: string | null
  extraction_run_id: string | null
  proposal_source: string
  payload: unknown
  confidence: number
  requires_review: boolean
  validation_errors: { loc: unknown[]; msg?: string; type?: string }[]
  extraction_meta: Record<string, unknown>
  applied: boolean
}
