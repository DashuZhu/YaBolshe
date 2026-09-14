import { Routes, Route, Navigate, useLocation } from 'react-router'
import { lazy, Suspense, type ReactNode } from 'react'
import { AppProvider, useApp } from '@/lib/store'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import LegalPage from '@/pages/LegalPage'
import { CookieNotice } from '@/components/legal'

const TDashboard = lazy(() => import('@/pages/therapist/TDashboard'))
const Clients = lazy(() => import('@/pages/therapist/Clients'))
const ClientDetail = lazy(() => import('@/pages/therapist/ClientDetail'))
const Upload = lazy(() => import('@/pages/therapist/Upload'))
const SessionDetail = lazy(() => import('@/pages/therapist/SessionDetail'))
const Admin = lazy(() => import('@/pages/admin/Admin'))

function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg">
      <div className="h-12 w-12 animate-pulse rounded-3xl bg-gradient-to-br from-brand-pink to-brand-violet" />
    </div>
  )
}

function Guard({ role, children }: { role: 'therapist' | 'admin'; children: ReactNode }) {
  const { me } = useApp()
  const location = useLocation()
  if (me === undefined) {
    return <PageLoading />
  }
  if (!me) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  const allowed = me.role === role || (role === 'admin' && (me.role === 'owner' || me.isPlatformOwner))
  if (!allowed) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AppProvider>
      <Suspense fallback={<PageLoading />}><Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/privacy" element={<LegalPage />} />
        <Route path="/consent" element={<LegalPage />} />
        <Route path="/terms" element={<LegalPage />} />

        {/* Therapist */}
        <Route path="/t" element={<Guard role="therapist"><TDashboard /></Guard>} />
        <Route path="/t/clients" element={<Guard role="therapist"><Clients /></Guard>} />
        <Route path="/t/clients/:id" element={<Guard role="therapist"><ClientDetail /></Guard>} />
        <Route path="/t/upload" element={<Guard role="therapist"><Upload /></Guard>} />
        <Route path="/t/sessions/:id" element={<Guard role="therapist"><SessionDetail /></Guard>} />
        {/* Admin */}
        <Route path="/a" element={<Guard role="admin"><Admin /></Guard>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></Suspense>
      <CookieNotice />
    </AppProvider>
  )
}
