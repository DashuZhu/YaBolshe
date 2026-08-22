import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { CheckCircle2, GitBranch, Sparkles, Compass, Mountain, Footprints, FlaskConical, CalendarClock, PencilLine } from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard, SectionHeader, EmptyRoadmapHint } from '@/components/brand-extra'
import { Pill } from '@/components/widgets'
import { trpc, useClients, useRoadmap } from '@/lib/store'
import { cn } from '@/lib/utils'

export default function RoadmapPage() {
  const [params] = useSearchParams()
  const clientsQ = useClients()
  const clients = clientsQ.data ?? []
  const [clientId, setClientId] = useState(params.get('client') ?? '')
  const effectiveId = Number(clientId || clients[0]?.id || 0)
  const roadmapQ = useRoadmap(effectiveId || undefined)
  const roadmap = roadmapQ.data ?? null
  const client = clients.find((c) => Number(c.id) === effectiveId)

  const utils = trpc.useUtils()
  const approveMut = trpc.roadmap.approveDraft.useMutation({
    onSuccess: () => void utils.roadmap.get.invalidate(),
  })
  const upsertMut = trpc.roadmap.upsert.useMutation({
    onSuccess: () => { setEditing(false); void utils.roadmap.get.invalidate() },
  })

  const [editing, setEditing] = useState(false)
  const [focus, setFocus] = useState('')

  return (
    <AppShell role="therapist">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-deep">Дорожная карта терапии</h1>
          {roadmap && (
            <p className="mt-1 text-brand-mute">
              {client?.name} · версия {roadmap.version} · пересмотр: {roadmap.reviewDate || '—'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={String(effectiveId || '')}
            onChange={(e) => setClientId(e.target.value)}
            className="rounded-2xl border border-brand-softpink/60 bg-white/80 px-4 py-2.5 text-sm font-semibold text-brand-ink outline-none focus:ring-2 focus:ring-brand-lav"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {roadmap?.draftPending && (
            <button
              onClick={() => approveMut.mutate({ clientId: effectiveId })}
              className="btn-3d flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white"
            >
              <CheckCircle2 className="h-5 w-5" /> Подтвердить обновление
            </button>
          )}
        </div>
      </div>

      {!roadmap && !roadmapQ.isLoading && (
        <div className="glass rounded-3xl p-10 text-center">
          <EmptyRoadmapHint />
          {clients.length > 0 && (
            <button
              onClick={() => { setFocus(''); setEditing(true) }}
              className="btn-3d mx-auto mt-5 flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white"
            >
              <PencilLine className="h-4 w-4" /> Создать карту
            </button>
          )}
        </div>
      )}

      {roadmap?.draftPending && (
        <div className="mb-6 flex items-start gap-3 rounded-3xl border-2 border-brand-violet/30 bg-brand-lav/15 p-5">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-violet" />
          <div>
            <p className="font-bold text-brand-deep">Есть черновик обновления от AI</p>
            <p className="mt-1 text-sm text-brand-mute">
              Клиент увидит изменения только после вашего подтверждения.
            </p>
          </div>
        </div>
      )}

      {editing && (
        <GlassCard deep className="mb-6">
          <SectionHeader title={roadmap ? 'Редактировать фокус' : 'Новая дорожная карта'} />
          <textarea
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            rows={3}
            placeholder="Текущий фокус работы: например, «Границы в близких отношениях…»"
            className="w-full rounded-2xl border border-brand-softpink/60 bg-white/80 p-4 text-sm outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="btn-soft rounded-xl px-5 py-2.5 text-xs font-bold text-brand-deep">Отмена</button>
            <button
              onClick={() =>
                upsertMut.mutate({
                  clientId: effectiveId,
                  currentFocus: focus,
                  goals: roadmap?.goals ?? [],
                  stages: roadmap?.stages ?? [{ title: 'Запрос и первичная карта тем', status: 'current' }],
                  resources: roadmap?.resources ?? [],
                  obstacles: roadmap?.obstacles ?? [],
                  nextSteps: roadmap?.nextSteps ?? [],
                  experiments: roadmap?.experiments ?? [],
                  reviewDate: roadmap?.reviewDate ?? '',
                })
              }
              disabled={!focus.trim() || upsertMut.isPending}
              className="btn-3d rounded-xl px-6 py-2.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </GlassCard>
      )}

      {roadmap && (
        <>
          {/* Current focus */}
          <GlassCard deep className="mb-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl btn-3d text-white">
                <Compass className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-pink">текущий фокус</p>
                <p className="mt-1 text-lg font-bold leading-snug text-brand-ink">{roadmap.currentFocus || '—'}</p>
              </div>
              <button
                onClick={() => { setFocus(roadmap.currentFocus ?? ''); setEditing(true) }}
                className="btn-soft flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-brand-deep"
              >
                <PencilLine className="h-3.5 w-3.5" /> править
              </button>
            </div>
          </GlassCard>

          {/* Goals */}
          {roadmap.goals.length > 0 && (
            <GlassCard className="mb-6">
              <SectionHeader title="Цели и прогресс" subtitle="мягкая визуализация, без оценочных суждений" />
              <div className="space-y-5">
                {roadmap.goals.map((g) => (
                  <div key={g.goal}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-4">
                      <span className="text-sm font-bold text-brand-ink">{g.goal}</span>
                      <span className="text-sm font-extrabold text-brand-deep">{g.progress}%</span>
                    </div>
                    <div className="h-3.5 overflow-hidden rounded-full bg-white shadow-inner">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${g.progress}%`, background: 'linear-gradient(90deg,#F7C6D9,#C9B8F3,#8B7CF6)' }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-brand-mute">{g.note}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Stages timeline */}
          {roadmap.stages.length > 0 && (
            <GlassCard className="mb-6">
              <SectionHeader title="Этапы" />
              <ul>
                {roadmap.stages.map((s) => (
                  <li key={s.title} className="timeline-dot relative flex items-center gap-4 pb-6">
                    <span
                      className={cn(
                        'z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-4 border-brand-bg',
                        s.status === 'done' && 'bg-brand-success',
                        s.status === 'current' && 'bg-gradient-to-br from-brand-pink to-brand-violet shadow-pink',
                        s.status === 'next' && 'bg-brand-lav/50',
                      )}
                    />
                    <span className={cn('text-sm', s.status === 'current' ? 'font-extrabold text-brand-deep' : s.status === 'done' ? 'font-semibold text-brand-mute line-through decoration-brand-softpink' : 'font-semibold text-brand-mute')}>
                      {s.title}
                    </span>
                    {s.status === 'current' && <Pill tone="pink">сейчас здесь</Pill>}
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <GlassCard>
              <SectionHeader title="Опоры и ресурсы" />
              {roadmap.resources.length === 0 && <p className="text-sm text-brand-mute">—</p>}
              <ul className="space-y-2.5">
                {roadmap.resources.map((r) => (
                  <li key={r} className="flex items-center gap-2.5 rounded-2xl bg-brand-success/10 px-4 py-3 text-sm font-semibold text-emerald-900">
                    <Mountain className="h-4 w-4 shrink-0" /> {r}
                  </li>
                ))}
              </ul>
              {roadmap.obstacles.length > 0 && (
                <>
                  <h3 className="mb-3 mt-6 text-sm font-bold text-brand-ink">Препятствия</h3>
                  <ul className="space-y-2.5">
                    {roadmap.obstacles.map((o) => (
                      <li key={o} className="rounded-2xl bg-brand-warning/15 px-4 py-3 text-sm font-semibold text-amber-900">
                        {o}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </GlassCard>
            <GlassCard>
              <SectionHeader title="Следующие шаги" />
              {roadmap.nextSteps.length === 0 && <p className="text-sm text-brand-mute">—</p>}
              <ul className="space-y-2.5">
                {roadmap.nextSteps.map((n) => (
                  <li key={n} className="flex items-center gap-2.5 rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold text-brand-ink">
                    <Footprints className="h-4 w-4 shrink-0 text-brand-violet" /> {n}
                  </li>
                ))}
              </ul>
              {roadmap.experiments.length > 0 && (
                <>
                  <h3 className="mb-3 mt-6 flex items-center gap-2 text-sm font-bold text-brand-ink">
                    <FlaskConical className="h-4 w-4 text-brand-pink" /> Активные эксперименты
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {roadmap.experiments.map((e) => <Pill key={e} tone="violet">{e}</Pill>)}
                  </div>
                </>
              )}
              <div className="mt-6 flex items-center gap-2 rounded-2xl bg-brand-lav/15 px-4 py-3 text-xs font-semibold text-brand-deep">
                <CalendarClock className="h-4 w-4" /> Пересмотр карты: {roadmap.reviewDate || '—'}
                <span className="ml-auto flex items-center gap-1 text-brand-mute"><GitBranch className="h-3.5 w-3.5" /> история версий сохраняется</span>
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </AppShell>
  )
}
