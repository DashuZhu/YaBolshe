import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { TrendingUp, Heart, Zap, CloudRain } from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard, SectionHeader } from '@/components/brand'
import { EmptyState } from '@/components/widgets'
import { useCheckIns, useRoadmap, useMyProfile } from '@/lib/store'

const tooltipStyle = {
  borderRadius: '16px',
  border: '1px solid #F7C6D9',
  background: 'rgba(255,255,255,.95)',
  boxShadow: '0 8px 24px -8px rgba(139,124,246,.3)',
  fontSize: 13,
}

export default function CProgress() {
  const checkInsQ = useCheckIns()
  const roadmapQ = useRoadmap()
  const profileQ = useMyProfile()

  const checkIns = checkInsQ.data ?? []
  const roadmap = roadmapQ.data
  const profile = profileQ.data

  return (
    <AppShell role="client">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-brand-deep">Мой прогресс</h1>
        <p className="mt-1 text-brand-mute">
          Это не оценки и не диагностика — просто отражение вашего пути, чтобы видеть движение.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Heart, label: 'Сессий в архиве', value: profile?.sessionsCount ?? 0 },
          { icon: TrendingUp, label: 'Этап пути', value: roadmap ? `${roadmap.stages.filter((s) => s.status === 'done').length + 1} из ${roadmap.stages.length || 1}` : '—' },
          { icon: Zap, label: 'Чек-инов заполнено', value: checkIns.length },
        ].map(({ icon: Icon, label, value }) => (
          <GlassCard key={label} className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-softpink to-brand-lav shadow-soft">
              <Icon className="h-6 w-6 text-brand-deep" />
            </span>
            <div>
              <p className="text-2xl font-extrabold text-brand-deep">{value}</p>
              <p className="text-xs text-brand-mute">{label}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Mood chart */}
      <GlassCard className="mb-6">
        <SectionHeader title="Как менялось состояние" subtitle="по вашим чек-инам" />
        {checkIns.length < 2 ? (
          <EmptyState title="Пока мало данных" hint="Заполните пару чек-инов — и здесь появится мягкий график вашего состояния." />
        ) : (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={checkIns} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke="#F2D7E4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6F6A7A' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 12, fill: '#6F6A7A' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="mood" name="настроение" stroke="#F2A7C3" strokeWidth={3.5} dot={{ r: 4, fill: '#F2A7C3', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="energy" name="энергия" stroke="#8B7CF6" strokeWidth={3.5} dot={{ r: 4, fill: '#8B7CF6', strokeWidth: 2, stroke: '#fff' }} />
                  <Line type="monotone" dataKey="anxiety" name="тревога" stroke="#C9B8F3" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 3, fill: '#C9B8F3', strokeWidth: 2, stroke: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 flex items-center gap-2 rounded-2xl bg-brand-success/10 px-4 py-3 text-sm text-emerald-900">
              <CloudRain className="h-4 w-4 shrink-0" />
              Бережное наблюдение: график — это просто зеркало ваших отметок, без оценок и выводов.
            </p>
          </>
        )}
      </GlassCard>

      {/* Goals progress */}
      {roadmap && roadmap.goals.length > 0 && (
        <GlassCard>
          <SectionHeader title="Движение по целям пути" subtitle="формулировки из вашей дорожной карты" />
          <div className="space-y-5">
            {roadmap.goals.map((g) => (
              <div key={g.goal}>
                <div className="mb-1.5 flex items-baseline justify-between gap-4">
                  <span className="text-sm font-bold text-brand-ink">{g.goal}</span>
                  <span className="text-sm font-extrabold text-brand-deep">{g.progress}%</span>
                </div>
                <div className="h-3.5 overflow-hidden rounded-full bg-white shadow-inner">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${g.progress}%`, background: 'linear-gradient(90deg,#F7C6D9,#C9B8F3)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </AppShell>
  )
}
