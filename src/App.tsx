import { Routes, Route, Navigate, useLocation } from 'react-router'
import { lazy, Suspense, type ReactNode } from 'react'
import { AppProvider, useApp } from '@/lib/store'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'

const TDashboard = lazy(() => import('@/pages/therapist/TDashboard'))
const Clients = lazy(() => import('@/pages/therapist/Clients'))
const ClientDetail = lazy(() => import('@/pages/therapist/ClientDetail'))
const Upload = lazy(() => import('@/pages/therapist/Upload'))
const SessionDetail = lazy(() => import('@/pages/therapist/SessionDetail'))
const RoadmapPage = lazy(() => import('@/pages/therapist/RoadmapPage'))
const CDashboard = lazy(() => import('@/pages/client/CDashboard'))
const CInsights = lazy(() => import('@/pages/client/CInsights'))
const CHomework = lazy(() => import('@/pages/client/CHomework'))
const CAgreements = lazy(() => import('@/pages/client/CAgreements'))
const CProgress = lazy(() => import('@/pages/client/CProgress'))
const CCheckIn = lazy(() => import('@/pages/client/CCheckIn'))
const CSafety = lazy(() => import('@/pages/client/CSafety'))
const Admin = lazy(() => import('@/pages/admin/Admin'))

function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg">
      <div className="h-12 w-12 animate-pulse rounded-3xl bg-gradient-to-br from-brand-pink to-brand-violet" />
    </div>
  )
}

function Guard({ role, children }: { role: 'therapist' | 'client' | 'admin'; children: ReactNode }) {
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

        {/* Therapist */}
        <Route path="/t" element={<Guard role="therapist"><TDashboard /></Guard>} />
        <Route path="/t/clients" element={<Guard role="therapist"><Clients /></Guard>} />
        <Route path="/t/clients/:id" element={<Guard role="therapist"><ClientDetail /></Guard>} />
        <Route path="/t/upload" element={<Guard role="therapist"><Upload /></Guard>} />
        <Route path="/t/sessions/:id" element={<Guard role="therapist"><SessionDetail /></Guard>} />
        <Route path="/t/roadmap" element={<Guard role="therapist"><RoadmapPage /></Guard>} />

        {/* Client */}
        <Route path="/c" element={<Guard role="client"><CDashboard /></Guard>} />
        <Route path="/c/insights" element={<Guard role="client"><CInsights /></Guard>} />
        <Route path="/c/homework" element={<Guard role="client"><CHomework /></Guard>} />
        <Route path="/c/agreements" element={<Guard role="client"><CAgreements /></Guard>} />
        <Route path="/c/progress" element={<Guard role="client"><CProgress /></Guard>} />
        <Route path="/c/checkin" element={<Guard role="client"><CCheckIn /></Guard>} />
        <Route path="/c/safety" element={<Guard role="client"><CSafety /></Guard>} />

        {/* Admin */}
        <Route path="/a" element={<Guard role="admin"><Admin /></Guard>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></Suspense>
    </AppProvider>
  )
}
