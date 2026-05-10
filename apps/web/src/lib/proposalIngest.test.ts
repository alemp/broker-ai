import { describe, expect, it } from 'vitest'

import { insuranceLineSupportsProposalPdfExtract } from '@/lib/proposalIngest'

describe('insuranceLineSupportsProposalPdfExtract', () => {
  it('returns true for auto and life (PDF extract implemented)', () => {
    expect(insuranceLineSupportsProposalPdfExtract('AUTO_INSURANCE')).toBe(true)
    expect(insuranceLineSupportsProposalPdfExtract('LIFE_INSURANCE')).toBe(true)
    expect(insuranceLineSupportsProposalPdfExtract('HEALTH_INSURANCE')).toBe(false)
    expect(insuranceLineSupportsProposalPdfExtract('GENERAL_INSURANCE')).toBe(false)
  })
})
