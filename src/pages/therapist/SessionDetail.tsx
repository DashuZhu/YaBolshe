import { useParams, Link } from 'react-router'
import { useState } from 'react'
import {
  ArrowLeft, Send, Mic, User, HelpCircle, AlertTriangle,
  BrainCircuit, Quote, ShieldAlert, CircleHelp, RotateCcw, Loader2, Copy, Check, Pencil,
} from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard, SectionHeader } from '@/components/brand'
import { Pill, ConfidenceDots, EmptyState } from '@/components/widgets'
import { trpc, useSession, useClients, useHomeworkList } from '@/lib/store'
import { sessionStatusMeta, confidenceLabel } from '@/lib/data'
import { cn } from '@/lib/utils'

const analysisTabs = [
  { key: 'summary', label: 'Для клиента' },
  { key: 'themes', label: 'Темы и гипотезы' },
  { key: 'states', label: 'Чувства и потребности' },
  { key: 'patterns', label: 'Паттерны' },
  { key: 'questions', label: 'Анализ случая на 360°' },
] as const

const inputCls =
  'w-full rounded-2xl border border-brand-softpink/60 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav'

export default function SessionDetail() {
  const { id = '0' } = useParams()
  const sessionId = Number(id)
  const sessionQ = useSession(sessionId)
  const clientsQ = useClients()
  const [tab, setTab] = useState<string>('summary')
  const [view, setView] = useState<'analysis' | 'transcript'>('analysis')
  const [copied, setCopied] = useState(false)

  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [editingDynamics, setEditingDynamics] = useState(false)
  const [dynamicsDraft, setDynamicsDraft] = useState('')
  const [editingInsightId, setEditingInsightId] = useState<string | null>(null)
  const [insightDraft, setInsightDraft] = useState({ title: '', description: '' })

  const utils = trpc.useUtils()
  const invalidate = () => {
    void utils.sessions.get.invalidate({ id: sessionId })
    void utils.sessions.list.invalidate()
    void utils.clients.list.invalidate()
  }

  const finalizeSendMut = trpc.sessions.finalizeAndSend.useMutation({ onSuccess: invalidate })
  const updateSummaryMut = trpc.sessions.updateSummary.useMutation({
    onSuccess: () => { setEditingSummary(false); invalidate() },
  })
  const updateDynamicsMut = trpc.sessions.updateClientDynamicsNote.useMutation({
    onSuccess: () => { setEditingDynamics(false); invalidate() },
  })
  const updateInsightMut = trpc.sessions.updateInsight.useMutation({
    onSuccess: () => { setEditingInsightId(null); invalidate() },
  })
  const reprocessMut = trpc.sessions.reprocess.useMutation({ onSuccess: invalidate })
  const segmentMut = trpc.sessions.updateSegment.useMutation({ onSuccess: invalidate })

  const session = sessionQ.data
  const homeworkQ = useHomeworkList(session ? Number(session.clientId) : undefined)

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
  const readyToSend = ['draft_ready', 'therapist_review', 'approved'].includes(session.status)
  const isProcessing = ['uploaded', 'queued', 'extracting_audio', 'transcribing', 'diarizing', 'analyzing'].includes(session.status)
  const failed = ['failed', 'requires_manual_fix'].includes(session.status)
  const totalTokens = session.tokens.input + session.tokens.output
  const sessionHomework = (homeworkQ.data ?? []).filter((h) => h.sessionId === session.id)

  const copyTranscript = async () => {
    const text = session.transcript
      .map((seg) => `[${seg.start}–${seg.end}] ${seg.speaker === 'therapist' ? 'Терапевт' : seg.speaker === 'client' ? 'Клиент' : 'Кто говорит?'}: ${seg.text}`)
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable */ }
  }

  const startEditSummary = () => { setSummaryDraft(session.clientFriendlySummary); setEditingSummary(true) }
  const startEditDynamics = () => { setDynamicsDraft(session.clientDynamicsNote); setEditingDynamics(true) }
  const startEditInsight = (i: typeof session.insights[number]) => {
    setInsightDraft({ title: i.title, description: i.description })
    setEditingInsightId(i.id)
  }

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
              {session.model !== '—' && (
                <> · модель: <b>{session.model}</b>{totalTokens > 0 && <> · {totalTokens.toLocaleString('ru-RU')} tokens</>}</>
              )}
            </p>
            {session.sentAt && <p className="mt-1 text-xs text-emerald-700">Отправлено клиенту: {session.sentAt}</p>}
          </div>
          {(failed || session.model === 'local-structured-draft-v1') && (session.hasMedia || session.transcript.length > 0) && (
            <button
              onClick={() => reprocessMut.mutate({ id: sessionId })}
              className="btn-soft flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold text-brand-deep"
            >
              <RotateCcw className="h-4 w-4" /> Повторить обработку
            </button>
          )}
        </div>
        {readyToSend && (
          <p className="mt-4 rounded-2xl bg-brand-lav/15 px-4 py-3 text-sm text-brand-deep">
            Проверьте и при необходимости отредактируйте вкладку «Для клиента» — клиент увидит только то, что там показано. Остальные вкладки видите только вы.
          </p>
        )}
        {session.model === 'local-structured-draft-v1' && (
          <p className="mt-4 rounded-2xl border border-brand-warning/50 bg-brand-warning/15 px-4 py-3 text-sm font-semibold text-amber-900">
            Этот разбор собран локальным заменителем без обращения к настоящей AI-модели (нет рабочего OPENAI_API_KEY на
            сервере) — темы и инсайты ниже основаны на частоте слов, а не на смысловом анализе. Настройте ключ и
            нажмите «Повторить обработку», чтобы получить полноценный разбор.
          </p>
        )}
        {failed && session.processingError && (
          <p className="mt-4 rounded-2xl bg-brand-danger/10 px-4 py-3 text-sm text-red-800">
            Ошибка обработки: {session.processingError}{!session.hasMedia && session.transcript.length === 0 && ' Запись уже удалена для защиты данных — загрузите её ещё раз.'}
          </p>
        )}
      </GlassCard>

      {isProcessing && (
        <GlassCard className="mb-6 border-2 border-brand-lav/40">
          <div className="flex items-start gap-4">
            <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-brand-violet" />
            <div className="flex-1">
              <p className="font-bold text-brand-deep">
                {session.status === 'analyzing' ? 'Расшифровка готова — собираем материалы' : 'Запись расшифровывается'}
              </p>
              <p className="mt-1 text-sm text-brand-mute">
                Страница обновляется сама. Её можно закрыть: обработка продолжится на сервере, а готовый результат появится в дашборде.
              </p>
              <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                <span className="rounded-xl bg-brand-success/15 px-3 py-2 font-semibold text-emerald-800">1. Файл принят временно</span>
                <span className={cn('rounded-xl px-3 py-2 font-semibold', session.status === 'analyzing' ? 'bg-brand-success/15 text-emerald-800' : 'bg-brand-lav/20 text-brand-deep')}>2. Расшифровка</span>
                <span className="rounded-xl bg-white/70 px-3 py-2 font-semibold text-brand-mute">3. Материалы и маршрут</span>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {readyToSend && (
        <div className="mb-6">
          <button onClick={() => setView('analysis')} className="btn-soft flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left text-sm font-bold text-brand-deep">
            Проверить результаты <BrainCircuit className="h-5 w-5 text-brand-violet" />
          </button>
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
        {session.transcript.length > 0 && (
          <button
            onClick={() => setView('transcript')}
            className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all', view === 'transcript' ? 'btn-3d text-white' : 'text-brand-mute hover:text-brand-deep')}
          >
            <Quote className="h-4 w-4" /> Расшифровка
          </button>
        )}
      </div>

      {/* Transcript */}
      {view === 'transcript' && (
        <div className="space-y-3">
          {session.transcript.length === 0 && (
            <EmptyState title="Нет расшифровки" hint="Эта сессия создана вручную без медиафайла или обработка ещё идёт." />
          )}
          {session.transcript.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/60 px-4 py-2.5">
              <p className="text-xs text-brand-mute">
                Дословная расшифровка доступна только вам. Модель не всегда разделяет голоса верно — отметьте, кто говорит, одним нажатием.
              </p>
              <button
                onClick={() => void copyTranscript()}
                className="btn-soft flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-brand-deep"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-brand-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Скопировано' : 'Скопировать расшифровку'}
              </button>
            </div>
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

          {/* Для клиента */}
          {tab === 'summary' && (
            <div className="space-y-5">
              <GlassCard>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <SectionHeader title="Конспект" subtitle="максимально подробно — это уйдёт клиенту как есть" />
                  {!editingSummary && (
                    <button onClick={startEditSummary} className="btn-soft flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-brand-deep">
                      <Pencil className="h-3.5 w-3.5" /> Редактировать
                    </button>
                  )}
                </div>
                {editingSummary ? (
                  <div>
                    <textarea
                      className={cn(inputCls, 'min-h-[220px]')}
                      value={summaryDraft}
                      onChange={(e) => setSummaryDraft(e.target.value)}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button onClick={() => setEditingSummary(false)} className="btn-soft rounded-xl px-4 py-2 text-xs font-bold text-brand-deep">Отмена</button>
                      <button
                        onClick={() => updateSummaryMut.mutate({ sessionId, clientFriendlySummary: summaryDraft })}
                        disabled={updateSummaryMut.isPending || !summaryDraft.trim()}
                        className="btn-3d rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Сохранить
                      </button>
                    </div>
                  </div>
                ) : session.clientFriendlySummary ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-brand-ink">{session.clientFriendlySummary}</p>
                ) : (
                  <p className="text-sm text-brand-mute">Появится после обработки.</p>
                )}
              </GlassCard>

              <GlassCard className="border-2 border-brand-pink/30">
                <SectionHeader title="Инсайты сессии" subtitle="главное, что клиент понял или заметил" />
                <ul className="mt-2 space-y-3">
                  {session.insights.length === 0 && <p className="text-sm text-brand-mute">Инсайтов нет.</p>}
                  {session.insights.map((i) => (
                    <li key={i.id} className="rounded-2xl bg-white/70 p-4">
                      {editingInsightId === i.id ? (
                        <div className="space-y-2">
                          <input
                            className={inputCls}
                            value={insightDraft.title}
                            onChange={(e) => setInsightDraft((d) => ({ ...d, title: e.target.value }))}
                            placeholder="Заголовок инсайта"
                          />
                          <textarea
                            className={cn(inputCls, 'min-h-[90px]')}
                            value={insightDraft.description}
                            onChange={(e) => setInsightDraft((d) => ({ ...d, description: e.target.value }))}
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingInsightId(null)} className="btn-soft rounded-xl px-3 py-1.5 text-xs font-bold text-brand-deep">Отмена</button>
                            <button
                              onClick={() => updateInsightMut.mutate({ insightId: Number(i.id), title: insightDraft.title, description: insightDraft.description })}
                              disabled={updateInsightMut.isPending || !insightDraft.title.trim() || !insightDraft.description.trim()}
                              className="btn-3d rounded-xl px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                            >
                              Сохранить
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-brand-ink">{i.title}</p>
                            <button onClick={() => startEditInsight(i)} className="btn-soft flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold text-brand-deep">
                              <Pencil className="h-3.5 w-3.5" /> Редактировать
                            </button>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-brand-mute">{i.description}</p>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </GlassCard>

              <GlassCard>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <SectionHeader title="Динамика" subtitle="тёплая заметка о том, что меняется — тоже уходит клиенту" />
                  {!editingDynamics && (
                    <button onClick={startEditDynamics} className="btn-soft flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-brand-deep">
                      <Pencil className="h-3.5 w-3.5" /> Редактировать
                    </button>
                  )}
                </div>
                {editingDynamics ? (
                  <div>
                    <textarea
                      className={cn(inputCls, 'min-h-[120px]')}
                      value={dynamicsDraft}
                      onChange={(e) => setDynamicsDraft(e.target.value)}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button onClick={() => setEditingDynamics(false)} className="btn-soft rounded-xl px-4 py-2 text-xs font-bold text-brand-deep">Отмена</button>
                      <button
                        onClick={() => updateDynamicsMut.mutate({ sessionId, clientDynamicsNote: dynamicsDraft })}
                        disabled={updateDynamicsMut.isPending}
                        className="btn-3d rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Сохранить
                      </button>
                    </div>
                  </div>
                ) : session.clientDynamicsNote ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-brand-ink">{session.clientDynamicsNote}</p>
                ) : (
                  <p className="text-sm text-brand-mute">Появится после обработки.</p>
                )}
              </GlassCard>

              <GlassCard>
                <SectionHeader title="Между встречами" subtitle="практики — редактируются на карточке клиента, вкладка «Задания»" />
                {sessionHomework.length === 0 ? (
                  <p className="text-sm text-brand-mute">Заданий нет.</p>
                ) : (
                  <ul className="space-y-3">
                    {sessionHomework.map((h) => (
                      <li key={h.id} className="rounded-2xl bg-white/70 p-4">
                        <p className="text-sm font-bold text-brand-ink">{h.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-brand-mute">{h.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassCard>

              {readyToSend && (
                <div>
                  {client?.contactEmail ? (
                    <p className="mb-2 text-center text-xs text-brand-mute">Уйдёт на почту: <b>{client.contactEmail}</b></p>
                  ) : (
                    <p className="mb-2 text-center text-xs font-semibold text-red-700">
                      У клиента не указана почта — добавьте её на <Link to={`/t/clients/${session.clientId}`} className="underline">карточке клиента</Link>, чтобы отправить.
                    </p>
                  )}
                  <button
                    onClick={() => finalizeSendMut.mutate({ sessionId })}
                    disabled={finalizeSendMut.isPending || !client?.contactEmail}
                    className="btn-3d flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" /> {finalizeSendMut.isPending ? 'Отправляем…' : 'Отправить клиенту на почту'}
                  </button>
                  {finalizeSendMut.error && (
                    <p className="mt-2 rounded-2xl bg-brand-danger/10 px-4 py-3 text-sm font-semibold text-red-700">
                      {finalizeSendMut.error.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Темы и гипотезы */}
          {tab === 'themes' && (
            <div className="grid gap-4 lg:grid-cols-2">
              {session.themes.length === 0 && <EmptyState title="Тем нет" hint="Появятся после обработки записи." />}
              {session.themes.map((t) => (
                <GlassCard key={t.id}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-brand-ink">{t.title}</p>
                    <ConfidenceDots level={t.confidence} />
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-brand-mute">{t.description}</p>
                  <p className="mt-3 text-xs text-brand-mute">фрагменты: {(t.evidence ?? []).join(', ') || '—'}</p>
                </GlassCard>
              ))}
            </div>
          )}

          {tab === 'states' && (
            <GlassCard>
              <SectionHeader title="Чувства и потребности" subtitle="только для вас — что предъявлялось, что стояло за этим, что вы затронули, а что нет" />
              {session.emotionsNeedsAnalysis ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-brand-ink">{session.emotionsNeedsAnalysis}</p>
              ) : (
                <p className="text-sm text-brand-mute">Появится после обработки.</p>
              )}
            </GlassCard>
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
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-brand-mute">{p.description}</p>
                  <p className="mt-2 text-xs text-brand-mute">уверенность: {confidenceLabel[p.confidence]} · опора: {(p.evidence ?? []).join(', ') || '—'}</p>
                </GlassCard>
              ))}
            </div>
          )}

          {/* Анализ случая на 360° */}
          {tab === 'questions' && (
            <div className="space-y-5">
              <GlassCard className="border-2 border-brand-violet/30">
                <SectionHeader title="Анализ случая на 360°" subtitle="синтез — только для вас" />
                {session.caseAnalysis ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-brand-ink">{session.caseAnalysis}</p>
                ) : (
                  <p className="text-sm text-brand-mute">Появится после обработки.</p>
                )}
              </GlassCard>
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
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
