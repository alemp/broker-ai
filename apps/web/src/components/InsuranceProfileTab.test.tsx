import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InsuranceProfileTab } from '@/components/InsuranceProfileTab'

vi.mock('react-i18next', () => {
  return {
    useTranslation: () => ({
      t: (k: string) => k,
    }),
  }
})

describe('InsuranceProfileTab', () => {
  it('shows company profile block and hides individual blocks for COMPANY', () => {
    render(
      <InsuranceProfileTab
        apiBasePath="/v1/clients/1"
        profile={{}}
        profileCompletenessScore={0}
        profileAlerts={[]}
        clientKind="COMPANY"
        reloadKey="k1"
      />,
    )

    expect(screen.getByText('crm.profile.generalInsuranceCompany.title')).toBeInTheDocument()
    expect(screen.queryByText('crm.profile.insuranceSection.family')).not.toBeInTheDocument()
  })

  it('shows individual blocks and hides company block for INDIVIDUAL', () => {
    render(
      <InsuranceProfileTab
        apiBasePath="/v1/clients/1"
        profile={{}}
        profileCompletenessScore={0}
        profileAlerts={[]}
        clientKind="INDIVIDUAL"
        reloadKey="k2"
      />,
    )

    expect(screen.getByText('crm.profile.insuranceSection.family')).toBeInTheDocument()
    expect(screen.queryByText('crm.profile.generalInsuranceCompany.title')).not.toBeInTheDocument()
  })
})

