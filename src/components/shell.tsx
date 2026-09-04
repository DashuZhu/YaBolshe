import { NavLink, useNavigate } from 'react-router'
import {
  LayoutDashboard, Users, UploadCloud, Map, Heart, Lightbulb, ClipboardCheck,
  Handshake, TrendingUp, ClipboardList, ShieldCheck, Shield, LogOut, Bell,
} from 'lucide-react'
import { Logo, Blobs, Avatar } from './brand'
import { useApp, trpc } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { LegalLinks } from './legal'

const navByRole = {
  therapist: [
    { to: '/t', icon: LayoutDashboard, label: 'Дашборд', end: true },
    { to: '/t/clients', icon: Users, label: 'Клиенты' },
    { to: '/t/upload', icon: UploadCloud, label: 'Загрузить сессию' },
    { to: '/t/roadmap', icon: Map, label: 'Дорожная карта' },
  ],
  client: [
    { to: '/c', icon: Heart, label: 'Мой путь', end: true },
    { to: '/c/insights', icon: Lightbulb, label: 'Инсайты' },
    { to: '/c/homework', icon: ClipboardCheck, label: 'Задания' },
    { to: '/c/agreements', icon: Handshake, label: 'Договорённости' },
    { to: '/c/progress', icon: TrendingUp, label: 'Прогресс' },
    { to: '/c/checkin', icon: ClipboardList, label: 'Чек-ин' },
    { to: '/c/safety', icon: ShieldCheck, label: 'Поддержка' },
  ],
  admin: [
    { to: '/a', icon: Shield, label: 'Админ-панель', end: true },
  ],
} as const

const roleNames = { therapist: 'Терапевт', client: 'Клиент', admin: 'Администратор' }

export function AppShell({ children, role }: { children: ReactNode; role: 'therapist' | 'client' | 'admin' }) {
  const { me, refreshAll } = useApp()
  const navigate = useNavigate()
  const logoutMut = trpc.auth.logout.useMutation({
    onSettled: () => {
      refreshAll()
      navigate('/login')
    },
  })
  const nav = [...navByRole[role]] as Array<{
    to: string
    icon: typeof LayoutDashboard
    label: string
    end?: boolean
  }>
  if (role === 'therapist' && me?.isPlatformOwner) {
    nav.push({ to: '/a', icon: Shield, label: 'Управление платформой' })
  }
  if (role === 'admin' && me?.role === 'therapist') {
    nav.push({ to: '/t', icon: Heart, label: 'Кабинет терапевта', end: true })
  }

  const initials = me ? ((me.firstName[0] ?? '') + (me.lastName[0] ?? '')).toUpperCase() : '…'

  return (
    <div className="min-h-screen bg-brand-bg">
      <Blobs />
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/70 bg-white/60 px-4 py-6 backdrop-blur-xl lg:flex">
        <div className="mb-8 px-2">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col gap-1.5">
          {nav.map(({ to, icon: Icon, label, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all',
                  isActive
                    ? 'btn-3d text-white shadow-pink'
                    : 'text-brand-mute hover:bg-brand-softpink/30 hover:text-brand-deep',
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2.5">
            <Avatar initials={initials} hue={320} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-brand-ink">
                {me ? `${me.firstName} ${me.lastName}`.trim() : '…'}
              </p>
              <p className="truncate text-[10px] text-brand-mute">{me?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logoutMut.mutate()}
            className="flex w-full items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold text-brand-mute hover:text-brand-danger"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
          <LegalLinks className="px-2 text-[9px] leading-relaxed text-brand-mute" />
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/70 bg-white/70 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo />
        <div className="flex gap-1 overflow-x-auto">
          {nav.slice(0, 5).map(({ to, icon: Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest}
              className={({ isActive }) =>
                cn(
                  'rounded-xl p-2.5 transition-colors',
                  isActive ? 'bg-brand-pink/30 text-brand-deep' : 'text-brand-mute',
                )
              }
              aria-label="nav"
            >
              <Icon className="h-5 w-5" />
            </NavLink>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 hidden items-center justify-end gap-3 border-b border-white/60 bg-brand-bg/70 px-8 py-3.5 backdrop-blur-xl lg:flex">
          <span className="rounded-full bg-brand-lav/30 px-3 py-1 text-xs font-bold text-brand-deep">
            {me?.isPlatformOwner || me?.role === 'owner' ? 'Владелец платформы' : roleNames[role]}
          </span>
          <button className="btn-soft relative rounded-2xl p-2.5" aria-label="Уведомления">
            <Bell className="h-5 w-5 text-brand-deep" />
          </button>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  )
}
