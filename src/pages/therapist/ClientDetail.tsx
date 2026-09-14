import { Link, useParams, useSearchParams } from 'react-router'
import { useState } from 'react'
import {
  ArrowLeft, UploadCloud, X, Archive, Mail, Pencil, Plus, Tag, StickyNote,
} from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard, Avatar, SectionHeader } from '@/components/brand'
import { Pill, EmptyState } from '@/components/widgets'
import { trpc, useClients, useSessions, useClientAnalysis, useNotes } from '@/lib/store'
import { sessionStatusMeta } from '@/lib/data'
import { cn } from '@/lib/utils'

const tabs = [
  { key: 'sessions', label: 'Сессии' },
  { key: 'dynamics', label: 'Динамика' },
  { key: 'portrait', label: 'Портрет' },
  { key: 'notes', label: 'Заметки' },
] as const

const inputCls =
  'w-full rounded-2xl border border-brand-softpink/60 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav'

export default function ClientDetail() {
  const { id = '1' } = useParams()
  const clientId = Number(id)
  const [params] = useSearchParams()
  const [tab, setTab] = useState<string>(params.get('tab') ?? 'sessions')

  const utils = trpc.useUtils()
  const clientsQ = useClients()
  const sessionsQ = useSessions()
  const analysisQ = useClientAnalysis(clientId)
  const notesQ = useNotes(clientId)

  const client = (clientsQ.data ?? []).find((c) => c.id === id)
  const clientSessions = (sessionsQ.data ?? []).filter((s) => s.clientId === id)
  const analysis = analysisQ.data
  const notes = notesQ.data ?? []

  const [editingEmail, setEditingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [newNote, setNewNote] = useState('')

  const archiveMut = trpc.clients.archive.useMutation({
    onSuccess: () => void utils.clients.list.invalidate(),
  })
  const emailMut = trpc.clients.updateContactEmail.useMutation({
    onSuccess: () => { setEditingEmail(false); void utils.clients.list.invalidate() },
  })
  const noteMut = trpc.notes.create.useMutation({
    onSuccess: () => { setNewNote(''); void utils.notes.list.invalidate() },
  })

  if (clientsQ.data && !client) {
    return (
      <AppShell role="therapist">
        <EmptyState title="Клиент не найден" hint="Возможно, карточка была удалена или это не ваш клиент." />
      </AppShell>
    )
  }

  const progressHint = analysis
    ? analysis.totalAnalyzedSessions === 0
      ? 'Появится после того как будет проанализировано 4 сессии.'
      : analysis.hasData
        ? `Учтено сессий: ${analysis.sessionsAnalyzed}${analysis.updatedAt ? ` · обновлено ${analysis.updatedAt}` : ''} · до следующего обновления: ${analysis.sessionsUntilNextUpdate} сесс.`
        : `Проанализировано сессий: ${analysis.totalAnalyzedSessions} из 4 нужных для первого обновления.`
    : ''

  return (
    <AppShell role="therapist">
      <Link to="/t/clients" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-mute hover:text-brand-deep">
        <ArrowLeft className="h-4 w-4" /> Все клиенты
      </Link>

      {/* Header card */}
      <GlassCard deep className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar initials={client?.initials ?? '…'} hue={client?.avatarHue ?? 320} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold text-brand-deep">{client?.name ?? '…'}</h1>
            <p className="text-sm text-brand-mute">
              в терапии с {client?.since} · сессий: {client?.sessionsCount ?? 0}
            </p>
            <p className="mt-1 text-sm font-semibold text-brand-ink">Фокус: {client?.focus || '—'}</p>
            <div className="mt-2 flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-brand-mute" />
              {editingEmail ? (
                <>
                  <input
                    type="email"
                    autoFocus
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    placeholder="email@example.com"
                    className="rounded-xl border border-brand-softpink/60 bg-white/80 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-lav"
                  />
                  <button
                    onClick={() => emailMut.mutate({ clientId, contactEmail: emailDraft.trim() })}
                    disabled={emailMut.isPending}
                    className="btn-3d rounded-lg px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Сохранить
                  </button>
                  <button onClick={() => setEditingEmail(false)} className="btn-soft rounded-lg p-1.5">
                    <X className="h-3.5 w-3.5 text-brand-deep" />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs text-brand-mute">{client?.contactEmail || 'почта не указана'}</span>
                  <button
                    onClick={() => { setEmailDraft(client?.contactEmail ?? ''); setEditingEmail(true) }}
                    className="btn-soft flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand-deep"
                  >
                    <Pencil className="h-3 w-3" /> {client?.contactEmail ? 'изменить' : 'добавить'}
                  </button>
                </>
              )}
            </div>
            {emailMut.error && <p className="mt-1 text-xs font-semibold text-red-700">{emailMut.error.message}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/t/upload?client=${id}`} className="btn-3d flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold text-white">
              <UploadCloud className="h-4 w-4" /> Загрузить сессию
            </Link>
            <button
              onClick={() => archiveMut.mutate({ clientId })}
              className="btn-soft flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold text-brand-mute"
            >
              <Archive className="h-4 w-4" /> {client?.status === 'archived' ? 'Вернуть из архива' : 'В архив'}
            </button>
          </div>
        </div>
        {client?.riskFlag && (
          <div className="mt-4 rounded-2xl border border-brand-warning/50 bg-brand-warning/15 px-4 py-3 text-sm font-semibold text-amber-800">
            {client.riskFlag.label}. Это не диагноз — повод для вашего профессионального внимания.
          </div>
        )}
      </GlassCard>

      {/* Tabs */}
      <div className="mb-6 flex gap-1.5 overflow-x-auto rounded-2xl bg-white/70 p-1.5 shadow-soft">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-all',
              tab === t.key ? 'btn-3d text-white' : 'text-brand-mute hover:text-brand-deep',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sessions */}
      {tab === 'sessions' && (
        <div className="space-y-3">
          {clientSessions.length === 0 && <EmptyState title="Пока нет сессий" hint="Загрузите первую запись, и здесь появится история встреч." />}
          {clientSessions.map((s) => {
            const meta = sessionStatusMeta[s.status]
            return (
              <Link key={s.id} to={`/t/sessions/${s.id}`}>
                <GlassCard className="mb-3 flex flex-wrap items-center gap-4 transition-all hover:-translate-y-0.5 hover:shadow-pink">
                  <div className="flex-1">
                    <p className="font-bold text-brand-ink">{s.title}</p>
                    <p className="mt-0.5 text-xs text-brand-mute">
                      {s.date} · {s.durationMin} мин {s.hasMedia ? '· есть запись' : '· без записи'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.insights.length > 0 && <Pill tone="violet">инсайты: {s.insights.length}</Pill>}
                    {s.riskFlags.length > 0 && <Pill tone="warning">риск</Pill>}
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                  </div>
                </GlassCard>
              </Link>
            )
          })}
        </div>
      )}

      {/* Динамика клиента — накопительная, обновляется каждые 4 сессии */}
      {tab === 'dynamics' && (
        <div className="space-y-5">
          <p className="text-xs text-brand-mute">Обновляется каждые 4 проанализированные сессии по итогам всех предыдущих встреч.{progressHint && <> {progressHint}</>}</p>
          {!analysis || !analysis.hasData ? (
            <EmptyState title="Динамика ещё не готова" hint="Появится после того как будет проанализировано 4 сессии." />
          ) : (
            <>
              <GlassCard>
                <SectionHeader title="Куда движется терапия" subtitle="накопительная динамика по всем сессиям — только для вас" />
                <p className="whitespace-pre-line text-sm leading-relaxed text-brand-ink">{analysis.dynamicsSummary || '—'}</p>
              </GlassCard>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { title: 'Повторяющиеся темы', items: analysis.recurringThemes, tone: 'bg-brand-violet/10 text-brand-deep' },
                  { title: 'Избегает клиент', items: analysis.avoidedByClient, tone: 'bg-brand-warning/15 text-amber-900' },
                  { title: 'Не подсвечено терапевтом', items: analysis.avoidedByTherapist, tone: 'bg-brand-danger/10 text-red-900' },
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
            </>
          )}
        </div>
      )}

      {/* Портрет клиента — подробный психологический портрет, обновляется каждые 4 сессии */}
      {tab === 'portrait' && (
        <div className="space-y-5">
          <p className="text-xs text-brand-mute">Обновляется каждые 4 проанализированные сессии по итогам всех предыдущих встреч.{progressHint && <> {progressHint}</>}</p>
          {!analysis || !analysis.hasData ? (
            <EmptyState title="Портрет ещё не готов" hint="Появится после того как будет проанализировано 4 сессии." />
          ) : (
            <GlassCard className="border-2 border-brand-violet/30">
              <SectionHeader title="Психологический портрет" subtitle="подробный анализ личности клиента — только для вас" />
              <p className="whitespace-pre-line text-sm leading-relaxed text-brand-ink">{analysis.portraitSummary || '—'}</p>
            </GlassCard>
          )}
        </div>
      )}

      {/* Заметки — свободные пометки терапевта о клиенте, клиент их никогда не видит */}
      {tab === 'notes' && (
        <div className="mx-auto max-w-3xl">
          <GlassCard deep className="mb-5 border-2 border-brand-violet/20">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-brand-deep">
              <StickyNote className="h-4 w-4" />
              Заметки от руки — клиент их никогда не видит
            </p>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Заметка для себя: наблюдения, гипотезы, план к следующей сессии…"
              rows={3}
              className={inputCls}
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => noteMut.mutate({ clientId, text: newNote.trim() })}
                disabled={!newNote.trim() || noteMut.isPending}
                className="btn-3d flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Сохранить заметку
              </button>
            </div>
          </GlassCard>
          {notes.length === 0 && <EmptyState title="Заметок пока нет" hint="Первая заметка появится здесь после сохранения." />}
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="glass rounded-3xl p-5">
                <p className="whitespace-pre-line text-sm leading-relaxed text-brand-ink">{n.text}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {n.tags.map((t) => (
                    <span key={t} className="flex items-center gap-1 rounded-full bg-brand-lav/25 px-2.5 py-1 text-xs font-semibold text-brand-deep">
                      <Tag className="h-3 w-3" /> {t}
                    </span>
                  ))}
                  <span className="ml-auto text-xs text-brand-mute">{n.createdAt}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  )
}
