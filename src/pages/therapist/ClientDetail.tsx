import { Link, useParams, useSearchParams } from 'react-router'
import { useState } from 'react'
import {
  ArrowLeft, UploadCloud, Map, Plus, Tag, Check, X, Sparkles, StickyNote, Archive,
} from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard, Avatar, SectionHeader } from '@/components/brand'
import { Pill, ConfidenceDots, EmptyState } from '@/components/widgets'
import { trpc, useClients, useSessions, useHomeworkList, useAgreementsList, useNotes } from '@/lib/store'
import {
  sessionStatusMeta, homeworkStatusLabel, agreementTypeLabel, clientActionLabel,
} from '@/lib/data'
import { cn } from '@/lib/utils'

const tabs = [
  { key: 'sessions', label: 'Сессии' },
  { key: 'materials', label: 'Материалы' },
  { key: 'homework', label: 'Задания' },
  { key: 'agreements', label: 'Договорённости' },
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
  const homeworkQ = useHomeworkList(clientId)
  const agreementsQ = useAgreementsList(clientId)
  const notesQ = useNotes(clientId)

  const client = (clientsQ.data ?? []).find((c) => c.id === id)
  const clientSessions = (sessionsQ.data ?? []).filter((s) => s.clientId === id)
  const clientHomework = homeworkQ.data ?? []
  const clientAgreements = agreementsQ.data ?? []
  const notes = notesQ.data ?? []
  const allInsights = clientSessions.flatMap((s) => s.insights.map((i) => ({ ...i, session: s })))
  const allThemes = clientSessions.flatMap((s) => s.themes.map((t) => ({ ...t, session: s })))

  const [newNote, setNewNote] = useState('')
  const [hwForm, setHwForm] = useState<{ open: boolean; title: string; description: string; purpose: string; frequency: string; dueDate: string }>(
    { open: false, title: '', description: '', purpose: '', frequency: '', dueDate: '' },
  )

  const invalidate = () => {
    void utils.homework.list.invalidate()
    void utils.clients.list.invalidate()
    void utils.notes.list.invalidate()
  }

  const noteMut = trpc.notes.create.useMutation({
    onSuccess: () => { setNewNote(''); void utils.notes.list.invalidate() },
  })
  const hwCreateMut = trpc.homework.create.useMutation({
    onSuccess: () => {
      setHwForm({ open: false, title: '', description: '', purpose: '', frequency: '', dueDate: '' })
      invalidate()
    },
  })
  const hwToggleMut = trpc.homework.toggleApproval.useMutation({ onSuccess: invalidate })
  const archiveMut = trpc.clients.archive.useMutation({
    onSuccess: () => void utils.clients.list.invalidate(),
  })

  if (clientsQ.data && !client) {
    return (
      <AppShell role="therapist">
        <EmptyState title="Клиент не найден" hint="Возможно, карточка была удалена или это не ваш клиент." />
      </AppShell>
    )
  }

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
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/t/upload?client=${id}`} className="btn-3d flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold text-white">
              <UploadCloud className="h-4 w-4" /> Загрузить сессию
            </Link>
            <Link to={`/t/roadmap?client=${id}`} className="btn-soft flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold text-brand-deep">
              <Map className="h-4 w-4" /> Roadmap
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

      {/* Materials */}
      {tab === 'materials' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <GlassCard>
            <SectionHeader title="Инсайты" subtitle="из AI-анализов сессий" />
            {allInsights.length === 0 && <EmptyState title="Инсайтов пока нет" hint="Они появятся после обработки первой сессии." />}
            <ul className="space-y-3">
              {allInsights.map((i) => (
                <li key={i.id} className="rounded-2xl bg-white/70 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-brand-ink">{i.title}</p>
                    <ConfidenceDots level={i.confidence} />
                  </div>
                  <p className="mt-1 text-xs text-brand-mute">{i.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-brand-violet">{clientActionLabel[i.clientAction]} · {i.session.date}</span>
                    <Pill tone={i.approved ? 'success' : 'warning'}>{i.approved ? 'подтверждён' : 'черновик'}</Pill>
                  </div>
                </li>
              ))}
            </ul>
          </GlassCard>
          <GlassCard>
            <SectionHeader title="Темы и паттерны" subtitle="что звучит между сессиями" />
            <ul className="space-y-3">
              {allThemes.map((t) => (
                <li key={t.id} className="rounded-2xl bg-white/70 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-brand-ink">{t.title}</p>
                    <ConfidenceDots level={t.confidence} />
                  </div>
                  <p className="mt-1 text-xs text-brand-mute">{t.description}</p>
                </li>
              ))}
              {clientSessions.flatMap((s) => s.patterns).map((p) => (
                <li key={p.id} className="rounded-2xl bg-brand-lav/15 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-brand-deep">Паттерн: {p.title}</p>
                    <ConfidenceDots level={p.confidence} />
                  </div>
                  <p className="mt-1 text-xs text-brand-mute">{p.description}</p>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      )}

      {/* Homework */}
      {tab === 'homework' && (
        <div>
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => setHwForm((f) => ({ ...f, open: !f.open }))}
              className="btn-3d flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4" /> Создать задание
            </button>
          </div>
          {hwForm.open && (
            <GlassCard deep className="mb-5">
              <div className="grid gap-3">
                <input className={inputCls} placeholder="Название задания" value={hwForm.title} onChange={(e) => setHwForm((f) => ({ ...f, title: e.target.value }))} />
                <textarea className={inputCls} rows={2} placeholder="Описание: что попробовать" value={hwForm.description} onChange={(e) => setHwForm((f) => ({ ...f, description: e.target.value }))} />
                <input className={inputCls} placeholder="Зачем (мягко, по-человечески)" value={hwForm.purpose} onChange={(e) => setHwForm((f) => ({ ...f, purpose: e.target.value }))} />
                <div className="flex gap-3">
                  <input className={inputCls} placeholder="Частота" value={hwForm.frequency} onChange={(e) => setHwForm((f) => ({ ...f, frequency: e.target.value }))} />
                  <input className={inputCls} placeholder="Срок" value={hwForm.dueDate} onChange={(e) => setHwForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => hwCreateMut.mutate({ clientId, title: hwForm.title, description: hwForm.description, purpose: hwForm.purpose, frequency: hwForm.frequency, dueDate: hwForm.dueDate })}
                    disabled={!hwForm.title || !hwForm.description || hwCreateMut.isPending}
                    className="btn-3d rounded-xl px-6 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Сохранить и показать клиенту
                  </button>
                </div>
              </div>
            </GlassCard>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {clientHomework.map((h) => (
              <GlassCard key={h.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-brand-ink">{h.title}</p>
                  <Pill tone={h.status === 'done' ? 'success' : h.status === 'in_progress' ? 'violet' : 'muted'}>
                    {homeworkStatusLabel[h.status]}
                  </Pill>
                </div>
                <p className="mt-2 text-sm text-brand-mute">{h.description}</p>
                <p className="mt-2 rounded-xl bg-brand-lav/15 px-3 py-2 text-xs text-brand-deep">
                  <b>Зачем:</b> {h.purpose}
                </p>
                <p className="mt-2 text-xs text-brand-mute">{h.frequency} · срок: {h.dueDate}</p>
                {h.reflection && (
                  <p className="mt-2 rounded-xl bg-brand-success/15 px-3 py-2 text-xs italic text-emerald-900">
                    Рефлексия клиента: «{h.reflection}»
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <Pill tone={h.approved ? 'success' : 'warning'}>{h.approved ? 'видно клиенту' : 'черновик'}</Pill>
                  <button
                    onClick={() => hwToggleMut.mutate({ id: Number(h.id) })}
                    className="btn-soft flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-brand-deep"
                  >
                    {h.approved ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    {h.approved ? 'Скрыть' : 'Подтвердить'}
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* Agreements */}
      {tab === 'agreements' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {clientAgreements.length === 0 && <EmptyState title="Договорённостей пока нет" hint="Они появятся из AI-анализа сессий после вашего подтверждения." />}
          {clientAgreements.map((a) => (
            <GlassCard key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <Sparkles className="h-5 w-5 shrink-0 text-brand-pink" />
                <Pill tone="violet">{agreementTypeLabel[a.type]}</Pill>
              </div>
              <p className="mt-3 text-base font-semibold leading-relaxed text-brand-ink">«{a.text}»</p>
              <p className="mt-2 text-xs text-brand-mute">пересмотр: {a.reviewDate || '—'}</p>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Notes */}
      {tab === 'notes' && (
        <div className="mx-auto max-w-3xl">
          <GlassCard deep className="mb-5 border-2 border-brand-violet/20">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-brand-deep">
              <StickyNote className="h-4 w-4" />
              Внутренние заметки — клиент их никогда не видит
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
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="glass rounded-3xl p-5">
                <p className="text-sm leading-relaxed text-brand-ink">{n.text}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {n.tags.map((t) => (
                    <span key={t} className="flex items-center gap-1 rounded-full bg-brand-lav/25 px-2.5 py-1 text-xs font-semibold text-brand-deep">
                      <Tag className="h-3 w-3" /> {t}
                    </span>
                  ))}
                  <span className="ml-auto text-xs text-brand-mute">{n.createdAt}</span>
                  <Pill tone={n.useAsAiContext ? 'violet' : 'muted'}>
                    {n.useAsAiContext ? 'используется как контекст для AI' : 'не отправляется в AI'}
                  </Pill>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  )
}
