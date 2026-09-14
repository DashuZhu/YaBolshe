import { Link } from 'react-router'
import { UploadCloud, Users, Clock3, FileCheck2, Send, Gauge } from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard } from '@/components/brand'
import { useTherapistStats } from '@/lib/store'

export default function TDashboard() {
  const statsQ = useTherapistStats()
  const stats = statsQ.data

  const tiles = [
    { icon: Users, label: 'Активных клиентов', value: stats?.activeClients ?? 0 },
    { icon: FileCheck2, label: 'Сессий за месяц', value: stats?.monthSessions ?? 0 },
    { icon: Clock3, label: 'Часов записи за месяц', value: stats?.monthHours ?? 0 },
    { icon: Send, label: 'Отправлено клиентам за месяц', value: stats?.monthSent ?? 0 },
    { icon: Gauge, label: 'Ещё доступно сессий в этом месяце', value: stats?.monthSessionsRemaining ?? 0 },
  ]

  return (
    <AppShell role="therapist">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-deep">
            Здравствуйте{stats ? `, ${stats.firstName}` : ''}
          </h1>
          <p className="mt-1 text-brand-mute">Коротко о вашей работе за этот месяц.</p>
        </div>
        <Link
          to="/t/upload"
          className="btn-3d flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white"
        >
          <UploadCloud className="h-5 w-5" />
          Загрузить сессию
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(({ icon: Icon, label, value }) => (
          <GlassCard key={label} className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-softpink to-brand-lav shadow-soft">
              <Icon className="h-7 w-7 text-brand-deep" />
            </span>
            <div>
              <p className="text-3xl font-extrabold text-brand-deep">{value}</p>
              <p className="text-sm text-brand-mute">{label}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </AppShell>
  )
}
