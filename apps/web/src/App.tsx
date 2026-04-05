import { Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { CampaignNewPage } from '@/pages/CampaignNewPage'
import { CampaignsPage } from '@/pages/CampaignsPage'
import { ClientCreatePage } from '@/pages/ClientCreatePage'
import { ClientDetailPage } from '@/pages/ClientDetailPage'
import { ClientImportPage } from '@/pages/ClientImportPage'
import { ClientsPage } from '@/pages/ClientsPage'
import { InsurerNewPage } from '@/pages/InsurerNewPage'
import { InsurersPage } from '@/pages/InsurersPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { LeadCreatePage } from '@/pages/LeadCreatePage'
import { LeadDetailPage } from '@/pages/LeadDetailPage'
import { LeadsPage } from '@/pages/LeadsPage'
import { OpportunityCreatePage } from '@/pages/OpportunityCreatePage'
import { OpportunityDetailPage } from '@/pages/OpportunityDetailPage'
import { OpportunitiesPage } from '@/pages/OpportunitiesPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ReleaseNotesPage } from '@/pages/ReleaseNotesPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/import" element={<ClientImportPage />} />
        <Route path="/clients/new" element={<ClientCreatePage />} />
        <Route path="/clients/:clientId" element={<ClientDetailPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/new" element={<LeadCreatePage />} />
        <Route path="/leads/:leadId" element={<LeadDetailPage />} />
        <Route path="/opportunities" element={<OpportunitiesPage />} />
        <Route path="/opportunities/new" element={<OpportunityCreatePage />} />
        <Route path="/opportunities/:opportunityId" element={<OpportunityDetailPage />} />
        <Route path="/insurers" element={<InsurersPage />} />
        <Route path="/insurers/new" element={<InsurerNewPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/campaigns/new" element={<CampaignNewPage />} />
        <Route path="/release-notes" element={<ReleaseNotesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
