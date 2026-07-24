import { Suspense } from 'react'
import { DirectionProvider } from '@radix-ui/react-direction'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { Toaster } from '@/components/ui/toaster'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { useSessionWatcher } from '@/hooks/useSessionWatcher'
import { ROLE_HOME } from '@/lib/roleHome'
import LandingPage from '@/pages/landing/LandingPage'
import ServicesPage from '@/pages/landing/ServicesPage'
import SpecialtyDetailPage from '@/pages/landing/SpecialtyDetailPage'
import FacilitiesPage from '@/pages/landing/FacilitiesPage'
import PatientInfoPage from '@/pages/landing/PatientInfoPage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import SetupPasswordPage from '@/pages/auth/SetupPasswordPage'
import QueueTrackerPage from '@/pages/public/QueueTrackerPage'
import PatientKioskPage from '@/pages/public/PatientKioskPage'
import AdminDashboard from '@/pages/dashboard/AdminDashboard'
import DoctorDashboard from '@/pages/dashboard/DoctorDashboard'
import PatientDashboard from '@/pages/dashboard/PatientDashboard'
import SuperAdminDashboard from '@/pages/dashboard/SuperAdminDashboard'
import AppointmentsPage from '@/pages/appointments/AppointmentsPage'
import ServicesCatalogPage from '@/pages/catalog/ServicesCatalogPage'
import DoctorAvailabilityPage from '@/pages/doctors/DoctorAvailabilityPage'
import TodaysVisitsPage from '@/pages/visits/TodaysVisitsPage'
import ConsultationPage from '@/pages/visits/ConsultationPage'
import BillVisitPage from '@/pages/visits/BillVisitPage'
import InvoicePage from '@/pages/visits/InvoicePage'
import PatientLookupPage from '@/pages/patients/PatientLookupPage'
import PatientProfilePage from '@/pages/patients/PatientProfilePage'
import MyInvoicesPage from '@/pages/invoices/MyInvoicesPage'
import BillingReportPage from '@/pages/invoices/BillingReportPage'
import BillingReportInvoicesPage from '@/pages/invoices/BillingReportInvoicesPage'
import BillingHistoryPage from '@/pages/billing/BillingHistoryPage'
import FinancialAnalyticsPage from '@/pages/billing/FinancialAnalyticsPage'
import MedicalRecordsPage from '@/pages/records/MedicalRecordsPage'
import RecordDetailPage from '@/pages/records/RecordDetailPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import UserManagementPage from '@/pages/settings/UserManagementPage'
import DepartmentsPage from '@/pages/departments/DepartmentsPage'

/** Root `/` and any unmatched path: authenticated users go to their own dashboard, everyone else see the public landing page. */
function RoleAwareRedirect() {
  const { isAuthenticated, role } = useAuth()

  if (isAuthenticated && role) {
    return <Navigate to={ROLE_HOME[role]} replace />
  }

  return <LandingPage />
}

function App() {
  const { isRtl } = useLanguage()
  useSessionWatcher()

  return (
    // Radix primitives (Select, DropdownMenu, Tabs, ...) default to LTR
    // arrow-key/orientation behavior unless explicitly told the current
    // direction — the global `dir="rtl"` on <html> (set by lib/i18n.ts)
    // handles visual mirroring via CSS, but NOT Radix's internal keyboard
    // navigation logic. Without this provider, Select dropdowns etc. would
    // look mirrored but navigate backwards when a user presses arrow keys
    // in Arabic. Keep this in sync with the same language state everything
    // else reads from (react-i18next via useLanguage), not a separate one.
    <DirectionProvider dir={isRtl ? 'rtl' : 'ltr'}>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center text-muted-foreground">
              Loading…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<RoleAwareRedirect />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/specialties/:slug" element={<SpecialtyDetailPage />} />
            <Route path="/facilities" element={<FacilitiesPage />} />
            <Route path="/patient-info" element={<PatientInfoPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/setup-password" element={<SetupPasswordPage />} />
            <Route path="/queue-tracker" element={<QueueTrackerPage />} />
            <Route path="/kiosk" element={<PatientKioskPage />} />

            <Route
              path="/dashboard/superadmin"
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <AppShell>
                    <SuperAdminDashboard />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/doctor"
              element={
                <ProtectedRoute allowedRoles={['doctor']}>
                  <AppShell>
                    <DoctorDashboard />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AppShell>
                    <AdminDashboard />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/patient"
              element={
                <ProtectedRoute allowedRoles={['patient']}>
                  <AppShell>
                    <PatientDashboard />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/patients"
              element={
                <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                  <AppShell>
                    <PatientLookupPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/patients/:patientId"
              element={
                <ProtectedRoute allowedRoles={['doctor', 'admin']}>
                  <AppShell>
                    <PatientProfilePage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/records"
              element={
                <ProtectedRoute allowedRoles={['doctor', 'patient']}>
                  <AppShell>
                    <MedicalRecordsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/records/:recordId"
              element={
                <ProtectedRoute allowedRoles={['doctor', 'patient']}>
                  <AppShell>
                    <RecordDetailPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/invoices"
              element={
                <ProtectedRoute allowedRoles={['patient']}>
                  <AppShell>
                    <MyInvoicesPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/billing-report"
              element={
                <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                  <AppShell>
                    <BillingReportPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing-report/invoices"
              element={
                <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                  <AppShell>
                    <BillingReportInvoicesPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing-history"
              element={
                <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                  <AppShell>
                    <BillingHistoryPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/appointments"
              element={
                <ProtectedRoute allowedRoles={['doctor', 'admin', 'patient']}>
                  <AppShell>
                    <AppointmentsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/visits"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AppShell>
                    <TodaysVisitsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/visits/:visitId/consult"
              element={
                <ProtectedRoute allowedRoles={['doctor']}>
                  <AppShell>
                    <ConsultationPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/visits/:visitId/bill"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AppShell>
                    <BillVisitPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/visits/:visitId/invoice"
              element={
                <ProtectedRoute allowedRoles={['admin', 'superadmin', 'doctor', 'patient']}>
                  <AppShell>
                    <InvoicePage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/catalog"
              element={
                <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                  <AppShell>
                    <ServicesCatalogPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'doctor', 'admin', 'patient']}>
                  <AppShell>
                    <SettingsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <AppShell>
                    <UserManagementPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/financial-analytics"
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <AppShell>
                    <FinancialAnalyticsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/departments"
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <AppShell>
                    <DepartmentsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctors/:doctorId/availability"
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <AppShell>
                    <DoctorAvailabilityPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<RoleAwareRedirect />} />
          </Routes>
        </Suspense>
        <Toaster />
      </BrowserRouter>
    </DirectionProvider>
  )
}

export default App
