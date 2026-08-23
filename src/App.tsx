import { Routes, Route, Navigate, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { AppProvider, useApp } from '@/lib/store'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import TDashboard from '@/pages/therapist/TDashboard'
import Clients from '@/pages/therapist/Clients'
import ClientDetail from '@/pages/therapist/ClientDetail'
import Upload from '@/pages/therapist/Upload'
import SessionDetail from '@/pages/therapist/SessionDetail'
import RoadmapPage from '@/pages/therapist/RoadmapPage'
import CDashboard from '@/pages/client/CDashboard'
import CInsights from '@/pages/client/CInsights'
import CHomework from '@/pages/client/CHomework'
import CAgreements from '@/pages/client/CAgreements'
import CProgress from '@/pages/client/CProgress'
import CCheckIn from '@/pages/client/CCheckIn'
import CSafety from '@/pages/client/CSafety'
import Admin from '@/pages/admin/Admin'

function Guard({ role, children }: { role: 'therapist' | 'client' | 'admin'; children: ReactNode }) {
  const { me } = useApp()
  const location = useLocation()
  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg">
        <div className="h-12 w-12 animate-pulse rounded-3xl bg-gradient-to-br from-brand-pink to-brand-violet" />
      </div>
    )
  }
  if (!me) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  const allowed = me.role === role || (role === 'admin' && (me.role === 'owner' || me.isPlatformOwner))
  if (!allowed) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AppProvider>
      <Routes>
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
      </Routes>
    </AppProvider>
  )
}
