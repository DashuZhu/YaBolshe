import { createContext, useContext, type ReactNode } from 'react'
import { trpc } from '@/providers/trpc'

// Real API-backed app state. All data comes from the server via tRPC.

type Me = {
  id: number
  email: string
  role: 'therapist' | 'client' | 'admin' | 'owner'
  isPlatformOwner: boolean
  firstName: string
  lastName: string
}

interface AppState {
  me: Me | null | undefined // undefined = loading
  role: Me['role'] | null
  isLoading: boolean
  refreshAll: () => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils()
  const meQuery = trpc.auth.me.useQuery(undefined, { staleTime: 30_000, retry: false })

  const me = meQuery.data === undefined ? undefined : (meQuery.data as Me | null)

  const value: AppState = {
    me,
    role: me?.role ?? null,
    isLoading: meQuery.isLoading,
    refreshAll: () => void utils.invalidate(),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

// ---- data hooks (thin wrappers over tRPC) ----

export function useSessions() {
  return trpc.sessions.list.useQuery(undefined, { refetchInterval: 8000 })
}

export function useSession(id: number) {
  return trpc.sessions.get.useQuery({ id }, { refetchInterval: 8000 })
}

export function useClients() {
  return trpc.clients.list.useQuery(undefined, { refetchInterval: 15_000 })
}

export function useTherapistStats() {
  return trpc.clients.stats.useQuery(undefined, { refetchInterval: 30_000 })
}

export function useMyProfile() {
  return trpc.clients.myProfile.useQuery()
}

export function useHomeworkList(clientId?: number) {
  return trpc.homework.list.useQuery({ clientId })
}

export function useAgreementsList(clientId?: number) {
  return trpc.agreements.list.useQuery({ clientId })
}

export function useRoadmap(clientId?: number) {
  return trpc.roadmap.get.useQuery({ clientId })
}

export function useNotes(clientId: number) {
  return trpc.notes.list.useQuery({ clientId })
}

export function useCheckIns(clientId?: number) {
  return trpc.checkins.list.useQuery({ clientId })
}

export function useInsightsForClient() {
  return trpc.insights.listForClient.useQuery()
}

export { trpc }
