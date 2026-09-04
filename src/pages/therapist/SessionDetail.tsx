import { useParams, Link } from 'react-router'
import { useState } from 'react'
import {
  ArrowLeft, CheckCircle2, Send, Mic, User, HelpCircle, AlertTriangle,
  BrainCircuit, Quote, ShieldAlert, CircleHelp, RotateCcw, Loader2, Map,
} from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard, SectionHeader } from '@/components/brand'
import { Pill, ConfidenceDots, EmptyState } from '@/components/widgets'
import { trpc, useSession, useClients } from '@/lib/store'
import { sessionStatusMeta, clientActionLabel, confidenceLabel } from '@/lib/data'
import { cn } from '@/lib/utils'

const analysisTabs = [
  { key: 'summary', label: 'Резюме' },
  { key: 'insights', label: 'Инсайты и темы' },
  { key: 'states', label: 'Чувства и потребности' },
  { key: 'patterns', label: 'Паттерны' },
  { key: 'dynamics', label: 'Динамика' },
  { key: 'questions', label: 'Вопросы и гипотезы' },
] as const

export default function SessionDetail() {
  const { id = '0' } = useParams()
  const sessionId = Number(id)
  const sessionQ = useSession(sessionId)
  const clientsQ = useClients()
  const [tab, setTab] = useState<string>('summary')
  const [view, setView] = useState<'analysis' | 'transcript'>('analysis')

  const utils = trpc.useUtils()
  const invalidate = () => {
    void utils.sessions.get.invalidate({ id: sessionId })
    void utils.sessions.list.invalidate()
    void utils.clients.list.invalidate()
  }

  const approveMut = trpc.sessions.approveAll.useMutation({ onSuccess: invalidate })
  const sendMut = trpc.sessions.sendToClient.useMutation({ onSuccess: invalidate })
  const toggleInsightMut = trpc.sessions.toggleInsight.useMutation({ onSuccess: invalidate })
  const toggleThemeMut = trpc.sessions.toggleTheme.useMutation({ onSuccess: invalidate })
  const reprocessMut = trpc.sessions.reprocess.useMutation({ onSuccess: invalidate })
  const segmentMut = trpc.sessions.updateSegment.useMutation({ onSuccess: invalidate })

  const session = sessionQ.data
  if (sessionQ.isLoading) {
    return (
      <AppShell role="therapist">
        <div className="flex justify-center pt-20"><div className="h-12 w-12 animate-pulse rounded-3xl bg-gradient-to-br from-brand-pink to-brand-violet" /></div>
      </AppShell>
    )
  }
  if (!session) {
    return (
      <AppShell role="therapist">
        <EmptyState title="Сессия не найдена" hint="Возможно, она была удалена или это не ваша сессия." />
      </AppShell>
    )
  }

  const client = (clientsQ.data ?? []).find((c) => c.id === session.clientId)
  const meta = sessionStatusMeta[session.status]
  const isDraft = ['draft_ready', 'therapist_review'].includes(session.status)
  const isProcessing = ['uploaded', 'queued', 'extracting_audio', 'transcribing', 'diarizing', 'analyzing'].includes(session.status)
  const failed = ['failed', 'requires_manual_fix'].includes(session.status)
  const approvedInsights = session.insights.filter((i) => i.approved).length
  const totalTokens = session.tokens.input + session.tokens.output

  return (
    <AppShell role="therapist">
      <Link to={`/t/clients/${session.clientId}`} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-mute hover:text-brand-deep">
        <ArrowLeft className="h-4 w-4" /> {client?.name ?? 'Клиент'}
      </Link>

      {/* Header */}
      <GlassCard deep className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold text-brand-deep">{session.title}</h1>
              <Pill tone={meta.tone}>{meta.label}</Pill>
            </div>
            <p className="mt-1.5 text-sm text-brand-mute">
              {session.date} · {session.durationMin} мин · {client?.name}
              {session.model !== '—' && totalTokens > 0 && (
                <> · модель: <b>{session.model}</b> · {totalTokens.toLocaleString('ru-RU')} tokens</>
              )}
            </p>
            {session.approvedAt && <p className="mt-1 text-xs text-emerald-700">Подтверждено: {session.approvedAt}{session.sentAt && ` · отправлено клиенту: ${session.sentAt}`}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {failed && (
              <button
                onClick={() => reprocessMut.mutate({ id: sessionId })}
                className="btn-soft flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold text-brand-deep"
              >
                <RotateCcw className="h-4 w-4" /> Повторить обработку
              </button>
            )}
            {isDraft && (
              <button
                onClick={() => approveMut.mutate({ sessionId })}
                disabled={approveMut.isPending}
                className="btn-3d flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold text-white"
              >
                <CheckCircle2 className="h-4 w-4" /> Подтвердить всё
              </button>
            )}
            {session.status === 'approved' && (
              <button
                onClick={() => sendMut.mutate({ sessionId })}
                disabled={sendMut.isPending}
                className="btn-3d flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold text-white"
              >
                <Send className="h-4 w-4" /> Отправить клиенту
              </button>
            )}
          </div>
        </div>
        {isDraft && (
          <p className="mt-4 rounded-2xl bg-brand-lav/15 px-4 py-3 text-sm text-brand-deep">
            Это черновик по расшифровке. Проверьте и при необходимости скорректируйте материалы — клиент увидит только то,
            что вы подтвердите. Сейчас подтверждено инсайтов: {approvedInsights} из {session.insights.length}.
          </p>
        )}
        {failed && session.processingError && (
          <p className="mt-4 rounded-2xl bg-brand-danger/10 px-4 py-3 text-sm text-red-800">
            Ошибка обработки: {session.processingError}
          </p>
        )}
      </GlassCard>

      {isProcessing && (
        <GlassCard className="mb-6 border-2 border-brand-lav/40">
          <div className="flex items-start gap-4">
            <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-brand-violet" />
            <div className="flex-1">
              <p className="font-bold text-brand-deep">
                {session.status === 'analyzing' ? 'Расшифровка готова — собираем черновики' : 'Запись расшифровывается'}
              </p>
              <p className="mt-1 text-sm text-brand-mute">
                Страница обновляется сама. Её можно закрыть: обработка продолжится на сервере, а готовый результат появится в дашборде.
              </p>
              <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                <span className="rounded-xl bg-brand-success/15 px-3 py-2 font-semibold text-emerald-800">1. Файл сохранён</span>
                <span className={cn('rounded-xl px-3 py-2 font-semibold', session.status === 'analyzing' ? 'bg-brand-success/15 text-emerald-800' : 'bg-brand-lav/20 text-brand-deep')}>2. Расшифровка</span>
                <span className="rounded-xl bg-white/70 px-3 py-2 font-semibold text-brand-mute">3. Черновики и маршрут</span>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {isDraft && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <button onClick={() => setView('analysis')} className="btn-soft flex items-center justify-between rounded-2xl px-5 py-4 text-left text-sm font-bold text-brand-deep">
            Проверить результаты <BrainCircuit className="h-5 w-5 text-brand-violet" />
          </button>
          <Link to={`/t/roadmap?client=${session.clientId}`} className="btn-soft flex items-center justify-between rounded-2xl px-5 py-4 text-sm font-bold text-brand-deep">
            Открыть дорожную карту <Map className="h-5 w-5 text-brand-violet" />
          </Link>
        </div>
      )}

      {/* Risk flags */}
      {session.riskFlags.length > 0 && (
        <div className="mb-6 rounded-3xl border-2 border-brand-warning/60 bg-brand-warning/15 p-5">
          <p className="flex items-center gap-2 font-bold text-amber-900">
            <ShieldAlert className="h-5 w-5" /> Сигналы риска (видны только вам)
          </p>
          {session.riskFlags.map((r, i) => (
            <div key={i} className="mt-3 rounded-2xl bg-white/70 p-4">
              <Pill tone={r.severity === 'high' ? 'danger' : 'warning'}>
                <AlertTriangle className="h-3.5 w-3.5" /> {r.type} · {r.severity}
              </Pill>
              <p className="mt-2 text-sm text-brand-ink">{r.recommendedAction}</p>
              <p className="mt-1 text-xs text-brand-mute">Это не диагноз. Опора на фрагменты: {(r.evidence ?? []).join(', ') || '—'}</p>
            </div>
          ))}
        </div>
      )}

      {/* View switcher */}
      <div className="mb-6 flex gap-1.5 rounded-2xl bg-white/70 p-1.5 shadow-soft">
        <button
          onClick={() => setView('analysis')}
          className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all', view === 'analysis' ? 'btn-3d text-white' : 'text-brand-mute hover:text-brand-deep')}
        >
          <BrainCircuit className="h-4 w-4" /> Разбор записи
        </button>
        <button
          onClick={() => setView('transcript')}
          className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all', view === 'transcript' ? 'btn-3d text-white' : 'text-brand-mute hover:text-brand-deep')}
        >
          <Quote className="h-4 w-4" /> Расшифровка
        </button>
      </div>

      {/* Transcript */}
      {view === 'transcript' && (
        <div className="space-y-3">
          {session.transcript.length === 0 && (
            <EmptyState title="Нет расшифровки" hint="Эта сессия создана вручную без медиафайла или обработка ещё идёт." />
          )}
          {session.transcript.length > 0 && (
            <p className="rounded-2xl bg-white/60 px-4 py-2.5 text-xs text-brand-mute">
              Сырая расшифровка доступна только вам. Whisper не разделяет голоса — отметьте, кто говорит, одним нажатием.
            </p>
          )}
          {session.transcript.map((seg) => (
            <div key={seg.id} className="glass flex gap-4 rounded-3xl p-5">
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                  seg.speaker === 'therapist'
                    ? 'bg-gradient-to-br from-brand-violet to-brand-lav text-white'
                    : seg.speaker === 'client'
                      ? 'bg-gradient-to-br from-brand-pink to-brand-softpink text-white'
                      : 'bg-black/10 text-brand-mute',
                )}
              >
                {seg.speaker === 'therapist' ? <Mic className="h-5 w-5" /> : <User className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-brand-mute">
                  <b className="text-brand-deep">{seg.speaker === 'therapist' ? 'Терапевт' : seg.speaker === 'client' ? 'Клиент' : 'Кто говорит?'}</b>
                  <span>{seg.start} – {seg.end}</span>
                  <span>уверенность {Math.round(seg.confidence * 100)}%</span>
                  <span className="ml-auto flex gap-1.5">
                    {(['therapist', 'client'] as const).map((sp) => (
                      <button
                        key={sp}
                        onClick={() => segmentMut.mutate({ sessionId, segmentId: seg.id, speaker: seg.speaker === sp ? 'unknown' : sp })}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[10px] font-bold transition-all',
                          seg.speaker === sp ? 'bg-brand-violet text-white' : 'bg-white/80 text-brand-mute hover:text-brand-deep',
                        )}
                      >
                        {sp === 'therapist' ? 'терапевт' : 'клиент'}
                      </button>
                    ))}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-ink">{seg.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Analysis */}
      {view === 'analysis' && (
        <div>
          <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-2xl bg-white/70 p-1.5 shadow-soft">
            {analysisTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn('whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all', tab === t.key ? 'bg-brand-lav/40 text-brand-deep' : 'text-brand-mute hover:text-brand-deep')}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'summary' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <GlassCard>
                <SectionHeader title="Короткое резюме" subtitle="для вашей быстрой ориентации" />
                <p className="text-sm leading-relaxed text-brand-ink">{session.summaryShort || 'Появится после обработки.'}</p>
              </GlassCard>
              <GlassCard className="border-2 border-brand-pink/30">
                <SectionHeader title="Резюме для клиента" subtitle="мягким языком, без жаргона — черновик" />
                {session.clientFriendlySummary ? (
                  <p className="text-sm leading-relaxed text-brand-ink">{session.clientFriendlySummary}</p>
                ) : (
                  <p className="text-sm text-brand-mute">Будет сформировано после анализа.</p>
                )}
              </GlassCard>
            </div>
          )}

          {tab === 'insights' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <GlassCard>
                <SectionHeader title="Инсайты" subtitle="нажмите, чтобы подтвердить или оставить черновиком" />
                <ul className="space-y-3">
                  {session.insights.length === 0 && <p className="text-sm text-brand-mute">Инсайтов нет.</p>}
                  {session.insights.map((i) => (
                    <li key={i.id} className={cn('rounded-2xl p-4 transition-all', i.approved ? 'bg-brand-success/10 ring-1 ring-brand-success/40' : 'bg-white/70')}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-brand-ink">{i.title}</p>
                        <ConfidenceDots level={i.confidence} />
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-brand-mute">{i.description}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs font-semibold text-brand-violet">{clientActionLabel[i.clientAction]} · опора: {(i.evidence ?? []).join(', ') || '—'}</span>
                        <button
                          onClick={() => toggleInsightMut.mutate({ insightId: Number(i.id) })}
                          className="btn-soft rounded-xl px-3 py-1.5 text-xs font-bold text-brand-deep"
                        >
                          {i.approved ? 'Снять подтверждение' : 'Подтвердить'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </GlassCard>
              <GlassCard>
                <SectionHeader title="Темы сессии" subtitle="с опорой на фрагменты расшифровки" />
                <ul className="space-y-3">
                  {session.themes.length === 0 && <p className="text-sm text-brand-mute">Тем нет.</p>}
                  {session.themes.map((t) => (
                    <li key={t.id} className={cn('rounded-2xl p-4', t.approved ? 'bg-brand-success/10 ring-1 ring-brand-success/40' : 'bg-white/70')}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-brand-ink">{t.title}</p>
                        <ConfidenceDots level={t.confidence} />
                      </div>
                      <p className="mt-1 text-xs text-brand-mute">{t.description}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-brand-mute">фрагменты: {(t.evidence ?? []).join(', ') || '—'}</span>
                        <button
                          onClick={() => toggleThemeMut.mutate({ themeId: Number(t.id) })}
                          className="btn-soft rounded-xl px-3 py-1.5 text-xs font-bold text-brand-deep"
                        >
                          {t.approved ? 'Снять' : 'Подтвердить'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </div>
          )}

          {tab === 'states' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <GlassCard>
                <SectionHeader title="Чувства" subtitle="черновик по тексту сессии" />
                <ul className="space-y-3">
                  {session.emotions.map((e, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-4">
                      <div>
                        <p className="text-sm font-bold text-brand-ink">{e.label}</p>
                        <p className="text-xs text-brand-mute">{e.context}</p>
                      </div>
                      <Pill tone={e.intensity === 'high' ? 'pink' : e.intensity === 'medium' ? 'violet' : 'muted'}>
                        {e.intensity === 'high' ? 'сильно' : e.intensity === 'medium' ? 'умеренно' : 'слабо'}
                      </Pill>
                    </li>
                  ))}
                </ul>
              </GlassCard>
              <GlassCard>
                <SectionHeader title="Потребности" subtitle="что может стоять за чувствами" />
                <ul className="space-y-3">
                  {session.needs.map((n, i) => (
                    <li key={i} className="rounded-2xl bg-white/70 p-4">
                      <p className="text-sm font-bold text-brand-ink">{n.label}</p>
                      <p className="mt-1 text-xs text-brand-mute">{n.description}</p>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </div>
          )}

          {tab === 'patterns' && (
            <div className="grid gap-4 lg:grid-cols-2">
              {session.patterns.length === 0 && <EmptyState title="Паттерны не выделены" hint="AI не нашёл устойчивых паттернов в этой сессии." />}
              {session.patterns.map((p) => (
                <GlassCard key={p.id}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-brand-ink">{p.title}</p>
                    <ConfidenceDots level={p.confidence} />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-brand-mute">{p.description}</p>
                  <p className="mt-2 text-xs text-brand-mute">уверенность: {confidenceLabel[p.confidence]} · опора: {(p.evidence ?? []).join(', ') || '—'}</p>
                </GlassCard>
              ))}
            </div>
          )}

          {tab === 'dynamics' && (
            <GlassCard>
              <SectionHeader title="Динамика относительно прошлых сессий" subtitle="черновик, только для вас" />
              <p className="mb-5 text-sm leading-relaxed text-brand-ink">{session.dynamics.summary || '—'}</p>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { title: 'Стало лучше', items: session.dynamics.improved ?? [], tone: 'bg-brand-success/15 text-emerald-900' },
                  { title: 'Остаётся устойчивым', items: session.dynamics.stable ?? [], tone: 'bg-brand-lav/20 text-brand-deep' },
                  { title: 'Новые темы', items: session.dynamics.newTopics ?? [], tone: 'bg-brand-softpink/40 text-brand-deep' },
                ].map((col) => (
                  <div key={col.title} className={cn('rounded-2xl p-4', col.tone)}>
                    <p className="mb-2 text-sm font-bold">{col.title}</p>
                    {col.items.length === 0 ? (
                      <p className="text-xs opacity-70">—</p>
                    ) : (
                      <ul className="space-y-1.5 text-xs">
                        {col.items.map((it) => <li key={it}>· {it}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {tab === 'questions' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <GlassCard>
              <SectionHeader title="Вопросы к следующей сессии" subtitle="предложения по записи — на ваше усмотрение" />
                <ul className="space-y-3">
                  {session.therapistQuestions.map((q, i) => (
                    <li key={i} className="flex gap-3 rounded-2xl bg-white/70 p-4 text-sm text-brand-ink">
                      <HelpCircle className="h-5 w-5 shrink-0 text-brand-violet" />
                      {q}
                    </li>
                  ))}
                </ul>
              </GlassCard>
              <GlassCard>
                <SectionHeader title="Что нужно проверить" subtitle="честные пометки неопределённости" />
                {session.uncertainties.length === 0 ? (
                  <p className="text-sm text-brand-mute">Явных неопределённостей не отмечено.</p>
                ) : (
                  <ul className="space-y-3">
                    {session.uncertainties.map((u, i) => (
                      <li key={i} className="flex gap-3 rounded-2xl bg-brand-warning/15 p-4 text-sm text-amber-900">
                        <CircleHelp className="h-5 w-5 shrink-0" />
                        {u}
                      </li>
                    ))}
                  </ul>
                )}
              </GlassCard>
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
