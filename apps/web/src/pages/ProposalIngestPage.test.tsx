import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProposalIngestPage } from '@/pages/ProposalIngestPage'

const apiFetch = vi.fn()
const apiPostFormData = vi.fn()

vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  apiPostFormData: (...args: unknown[]) => apiPostFormData(...args),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'broker@example.com',
      full_name: 'Broker',
      role: 'BROKER',
      active: true,
      organization: { id: 'o1', name: 'Org', slug: 'org', currency: 'BRL' },
    },
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

describe('ProposalIngestPage', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    apiPostFormData.mockReset()
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/v1/clients') {
        return [{ id: 'c1', full_name: 'Cliente Um' }]
      }
      if (path === '/v1/leads') {
        return []
      }
      throw new Error(`unexpected apiFetch: ${path}`)
    })
  })

  it('loads parties and shows wizard sections', async () => {
    render(
      <MemoryRouter>
        <ProposalIngestPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/v1/clients')
    })
    expect(apiFetch).toHaveBeenCalledWith('/v1/leads')
    expect(screen.getByText('proposalIngest.title')).toBeInTheDocument()
    expect(screen.getByText('proposalIngest.step1Title')).toBeInTheDocument()
    expect(screen.getByText('proposalIngest.step2Title')).toBeInTheDocument()
    expect(screen.getByText('proposalIngest.step3Title')).toBeInTheDocument()
  })
})
