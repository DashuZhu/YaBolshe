import { Link } from 'react-router'
import {
  UploadCloud, Users, ClipboardCheck, StickyNote, Map, ArrowRight,
  AlertTriangle, Clock, FileCheck2, Wrench, TrendingUp,
} from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard, SectionHeader, Avatar } from '@/components/brand'
import { Ring, Pill, QuotaBar, EmptyState } from '@/components/widgets'
import { useSessions, useClients, useTherapistStats } from '@/lib/store'
import { sessionStatusMeta } from '@/lib/data'

const quickActions = [
  { to: '/t/upload', icon: UploadCloud, label: 'Загрузить сессию' },
  { to: '/t/clients', icon: Users, label: 'Открыть клиента' },
  { to: '/t/clients', icon: ClipboardCheck, label: 'Создать задание' },
  { to: '/t/clients', icon: StickyNote, label: 'Создать заметку' },
  { to: '/t/roadmap', icon: Map, label: 'Дорожная карта' },
]

export default function TDashboard() {
  const sessionsQ = useSessions()
  const clientsQ = useClients()
  const statsQ = useTherapistStats()

  const sessions = sessionsQ.data ?? []
  const clients = clientsQ.data ?? []
  const stats = statsQ.data

  const inQueue = sessions.filter((s) =>
    ['queued', 'extracting_audio', 'transcribing', 'diarizing', 'analyzing', 'uploaded'].includes(s.status),
  )
  const needsReview = sessions.filter((s) => ['draft_ready', 'therapist_review'].includes(s.status))
  const riskSessions = sessions.filter((s) => s.riskFlags.length > 0 && s.status !== 'sent_to_client')
  const dynamicClients = clients.filter((c) => c.status === 'active' && c.dynamics !== 'stable')
  const failed = sessions.filter((s) => ['failed', 'requires_manual_fix'].includes(s.status))

  return (
    <AppShell role="therapist">
      {/* Greeting */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-1 text-3xl font-extrabold text-brand-deep">
            Здравствуйте{stats ? `, ${stats.firstName}` : ''}
          </h1>
          <p className="mt-1 text-brand-mute">Спокойный день. Вот что важно прямо сейчас.</p>
        </div>
        <Link
          to="/t/upload"
          className="btn-3d flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white"
        >
          <UploadCloud className="h-5 w-5" />
          Загрузить сессию
        </Link>
      </div>

      {/* Limits */}
      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <GlassCard className="flex items-center justify-center">
          <Ring
            value={stats?.activeClients ?? 0}
            max={stats?.maxClients ?? 20}
            label="Активные клиенты"
            caption="из {max} · жёсткий лимит"
          />
        </GlassCard>
        <GlassCard className="flex flex-col justify-center gap-5">
          <QuotaBar
            label="Сессии за месяц"
            value={stats?.monthSessions ?? 0}
            max={stats?.monthSessionsLimit ?? 80}
            soft
          />
          <QuotaBar
            label="Часы записей за месяц"
            value={stats?.monthHours ?? 0}
            max={stats?.monthHoursLimit ?? 120}
            soft
          />
        </GlassCard>
        <GlassCard>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-brand-ink">
            <Wrench className="h-4 w-4 text-brand-violet" /> Требуют внимания
          </h3>
          {failed.length === 0 ? (
            <p className="text-sm text-brand-mute">Ошибок обработки нет — всё идёт хорошо.</p>
          ) : (
            <ul className="space-y-2.5">
              {failed.map((s) => (
                <li key={s.id}>
                  <Link to={`/t/sessions/${s.id}`} className="flex items-center gap-2 rounded-2xl bg-brand-danger/10 px-4 py-3 text-sm font-semibold text-red-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Review queue */}
        <GlassCard>
          <SectionHeader
            title="Требуют подтверждения"
            subtitle="AI подготовил черновики — решение за вами"
          />
          {needsReview.length === 0 ? (
            <p className="text-sm text-brand-mute">Всё подтверждено. Можно выдохнуть.</p>
          ) : (
            <ul className="space-y-3">
              {needsReview.map((s) => {
                const cl = clients.find((c) => c.id === s.clientId)
                const meta = sessionStatusMeta[s.status]
                return (
                  <li key={s.id}>
                    <Link
                      to={`/t/sessions/${s.id}`}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-4 transition-all hover:-translate-y-0.5 hover:shadow-soft"
                    >
                      <div className="flex items-center gap-3">
                        <FileCheck2 className="h-5 w-5 shrink-0 text-brand-pink" />
                        <div>
                          <p className="text-sm font-bold text-brand-ink">{s.title}</p>
                          <p className="text-xs text-brand-mute">
                            {cl?.name} · инсайтов: {s.insights.length} · тем: {s.themes.length}
                            {s.riskFlags.length > 0 && ' · есть сигналы риска'}
                          </p>
                        </div>
                      </div>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {riskSessions.length > 0 && (
            <div className="mt-4 rounded-2xl border border-brand-warning/50 bg-brand-warning/15 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Новые сигналы риска: {riskSessions.length}
              </p>
              <p className="mt-1 text-xs text-amber-800/80">
                Это не диагноз — только сигнал для вашего внимания. Проверьте сессию «{riskSessions[0].title}».
              </p>
            </div>
          )}
        </GlassCard>

        {/* Processing queue */}
        <GlassCard>
          <SectionHeader title="Обработка записей" subtitle="Файл → расшифровка → черновики разделов → дорожная карта" />
          {inQueue.length === 0 ? (
            <div className="rounded-2xl bg-white/60 p-4 text-sm text-brand-mute">
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-lav" />
                Сейчас очередь пуста — новые загрузки появятся здесь с живым статусом.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {inQueue.map((s) => (
                <li key={s.id}>
                  <Link to={`/t/sessions/${s.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-4 text-sm font-semibold text-brand-ink">
                    <span><span className="block">{s.title}</span><span className="mt-1 block text-xs font-normal text-brand-mute">Нажмите, чтобы видеть живой статус</span></span>
                    <Pill tone="violet" className="pulse-soft">{sessionStatusMeta[s.status].label}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5">
            <h3 className="mb-3 text-sm font-bold text-brand-ink">Быстрые действия</h3>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {quickActions.map(({ to, icon: Icon, label }) => (
                <Link
                  key={label}
                  to={to}
                  className="btn-soft flex flex-col items-start gap-2 rounded-2xl p-3.5 text-xs font-bold text-brand-deep"
                >
                  <Icon className="h-5 w-5 text-brand-violet" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Clients with dynamics */}
      <div className="mt-6">
        <SectionHeader
          title="Клиенты с важной динамикой"
          subtitle="На кого стоит взглянуть до следующих встреч"
          action={
            <Link to="/t/clients" className="flex items-center gap-1 text-sm font-bold text-brand-violet hover:text-brand-deep">
              Все клиенты <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        {dynamicClients.length === 0 && (
          <EmptyState title="Пока спокойно" hint="Клиенты с заметной динамикой появятся здесь после анализа новых сессий." />
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dynamicClients.map((c) => (
            <Link key={c.id} to={`/t/clients/${c.id}`}>
              <GlassCard className="h-full transition-all hover:-translate-y-1 hover:shadow-pink">
                <div className="flex items-center gap-3">
                  <Avatar initials={c.initials} hue={c.avatarHue} />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-brand-ink">{c.name}</p>
                    <p className="text-xs text-brand-mute">последняя сессия: {c.lastSession}</p>
                  </div>
                  <span className="ml-auto">
                    {c.dynamics === 'up' ? (
                      <Pill tone="success"><TrendingUp className="h-3.5 w-3.5" /> рост</Pill>
                    ) : (
                      <Pill tone="warning"><AlertTriangle className="h-3.5 w-3.5" /> внимание</Pill>
                    )}
                  </span>
                </div>
                <p className="mt-3 text-sm text-brand-mute">{c.focus}</p>
                {c.riskFlag && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5" /> {c.riskFlag.label}
                  </p>
                )}
                <div className="mt-3 flex gap-2 text-xs text-brand-mute">
                  <span className="rounded-full bg-brand-lav/20 px-2.5 py-1">подтвердить: {c.pendingApprovals}</span>
                  <span className="rounded-full bg-brand-softpink/40 px-2.5 py-1">заданий: {c.homeworkActive}</span>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
