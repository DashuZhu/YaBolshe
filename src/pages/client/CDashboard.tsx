import { Link } from 'react-router'
import {
  CalendarHeart, Lightbulb, ClipboardCheck, Handshake, ArrowRight,
  ShieldCheck, Heart,
} from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard, SectionHeader } from '@/components/brand'
import { Pill, Ring, EmptyState } from '@/components/widgets'
import { useInsightsForClient, useHomeworkList, useAgreementsList, useRoadmap, useMyProfile, useSessions } from '@/lib/store'
import { homeworkStatusLabel } from '@/lib/data'

export default function CDashboard() {
  const profileQ = useMyProfile()
  const sessionsQ = useSessions()
  const insightsQ = useInsightsForClient()
  const homeworkQ = useHomeworkList()
  const agreementsQ = useAgreementsList()
  const roadmapQ = useRoadmap()

  const profile = profileQ.data
  const approvedInsights = (insightsQ.data ?? []).filter((i) => i.approved)
  const visibleHomework = (homeworkQ.data ?? []).filter((h) => h.approved && h.status !== 'cancelled')
  const visibleAgreements = (agreementsQ.data ?? []).filter((a) => a.approved && a.status !== 'completed')
  const roadmap = roadmapQ.data
  const avgProgress = roadmap && roadmap.goals.length > 0
    ? Math.round(roadmap.goals.reduce((a, g) => a + g.progress, 0) / roadmap.goals.length)
    : 0
  const sentSessions = (sessionsQ.data ?? []).length

  return (
    <AppShell role="client">
      {/* Greeting */}
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-extrabold text-brand-deep">
          Здравствуйте{profile ? `, ${profile.name}` : ''}
        </h1>
        <p className="mt-1 text-brand-mute">Ваш путь продолжается — маленькие шаги тоже считаются.</p>
      </div>

      {/* Next session + progress */}
      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <GlassCard deep className="lg:col-span-2">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl btn-3d text-white">
              <CalendarHeart className="h-7 w-7" />
            </span>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-pink">ваша терапия</p>
              <p className="mt-1 text-xl font-extrabold text-brand-ink">
                с {profile?.therapistName ?? 'терапевтом'}
              </p>
              <p className="mt-1 text-sm text-brand-mute">встреч в общем архиве: {sentSessions}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/c/checkin" className="btn-3d rounded-xl px-4 py-2 text-xs font-bold text-white">
                  Заполнить чек-ин перед встречей
                </Link>
              </div>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="flex items-center justify-center">
          <Ring
            value={avgProgress}
            max={100}
            label="Мой прогресс"
            caption="среднее по целям пути"
            gradient={['#F2A7C3', '#C9B8F3']}
          />
        </GlassCard>
      </div>

      {/* What matters now */}
      {roadmap?.currentFocus && (
        <GlassCard className="mb-6 border-2 border-brand-pink/25">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-softpink to-brand-lav">
              <Heart className="h-6 w-6 text-brand-deep" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-brand-pink">что важного</p>
              <p className="mt-1 text-lg font-bold leading-snug text-brand-ink">{roadmap.currentFocus}</p>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Insights */}
        <GlassCard>
          <SectionHeader
            title="Инсайты"
            subtitle="то, что вы открыли о себе"
            action={
              <Link to="/c/insights" className="flex items-center gap-1 text-sm font-bold text-brand-violet">
                все <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          {approvedInsights.length === 0 && (
            <EmptyState title="Пока здесь тихо" hint="Инсайты появятся после того, как терапевт подтвердит материалы ближайшей сессии." />
          )}
          <ul className="space-y-3">
            {approvedInsights.slice(0, 2).map((i) => (
              <li key={i.id} className="rounded-2xl bg-white/70 p-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-brand-pink" />
                  <div>
                    <p className="text-sm font-bold text-brand-ink">{i.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-brand-mute">{i.description}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>

        {/* Homework */}
        <GlassCard>
          <SectionHeader
            title="Мои задания"
            subtitle="по желанию, без давления"
            action={
              <Link to="/c/homework" className="flex items-center gap-1 text-sm font-bold text-brand-violet">
                все <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          {visibleHomework.length === 0 && (
            <EmptyState title="Заданий пока нет" hint="Когда терапевт подтвердит новое задание, оно появится здесь." />
          )}
          <ul className="space-y-3">
            {visibleHomework.slice(0, 2).map((h) => (
              <li key={h.id} className="rounded-2xl bg-white/70 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-violet" />
                    <div>
                      <p className="text-sm font-bold text-brand-ink">{h.title}</p>
                      <p className="mt-0.5 text-xs text-brand-mute">{h.frequency} · срок: {h.dueDate}</p>
                    </div>
                  </div>
                  <Pill tone={h.status === 'done' ? 'success' : 'violet'}>{homeworkStatusLabel[h.status]}</Pill>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      {/* Agreements */}
      {visibleAgreements.length > 0 && (
        <div className="mt-5">
          <GlassCard>
            <SectionHeader
              title="Мои договорённости с собой"
              action={
                <Link to="/c/agreements" className="flex items-center gap-1 text-sm font-bold text-brand-violet">
                  все <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleAgreements.map((a) => (
                <div key={a.id} className="rounded-2xl bg-gradient-to-br from-brand-softpink/40 to-brand-lav/25 p-4">
                  <Handshake className="mb-2 h-5 w-5 text-brand-deep" />
                  <p className="text-sm font-semibold leading-snug text-brand-ink">«{a.text}»</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Safety */}
      <Link to="/c/safety">
        <div className="mt-5 flex items-center gap-4 rounded-3xl border border-brand-success/40 bg-brand-success/10 p-5 transition-all hover:-translate-y-0.5">
          <ShieldCheck className="h-8 w-8 shrink-0 text-emerald-700" />
          <div>
            <p className="font-bold text-brand-ink">Безопасность и поддержка</p>
            <p className="text-sm text-brand-mute">
              Если сейчас тяжело или опасно — здесь короткие опоры и кризисные контакты.
            </p>
          </div>
          <ArrowRight className="ml-auto h-5 w-5 text-emerald-700" />
        </div>
      </Link>
    </AppShell>
  )
}
