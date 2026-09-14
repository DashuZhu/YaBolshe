import { Link, useNavigate } from 'react-router'
import { useState } from 'react'
import { UserRoundPlus, Archive, Search, X, Sparkles } from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard, Avatar } from '@/components/brand'
import { Pill } from '@/components/widgets'
import { useClients, useTherapistStats, trpc } from '@/lib/store'
import { cn } from '@/lib/utils'
import { friendlyApiError } from '@/lib/errors'

export default function Clients() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [query, setQuery] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newFocus, setNewFocus] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newConsent, setNewConsent] = useState(false)

  const [reprocessConfirmOpen, setReprocessConfirmOpen] = useState(false)
  const [reprocessResult, setReprocessResult] = useState<{ queued: number; skippedSent: number; skippedProcessing: number; skippedNoMaterial: number } | null>(null)

  const clientsQ = useClients()
  const statsQ = useTherapistStats()
  const utils = trpc.useUtils()
  const addClientMut = trpc.clients.createManual.useMutation({
    onSuccess: (r) => {
      void utils.clients.list.invalidate()
      void utils.clients.stats.invalidate()
      setAddOpen(false)
      setNewName('')
      setNewFocus('')
      setNewEmail('')
      setNewConsent(false)
      navigate(`/t/clients/${r.id}`)
    },
  })
  const reprocessAllMut = trpc.sessions.reprocessAllEligible.useMutation({
    onSuccess: (r) => {
      setReprocessConfirmOpen(false)
      setReprocessResult(r)
      void utils.sessions.list.invalidate()
      void utils.clients.list.invalidate()
    },
  })

  const list = (clientsQ.data ?? [])
    .filter((c) => c.status === tab)
    .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <AppShell role="therapist">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-deep">Клиенты</h1>
          <p className="mt-1 text-brand-mute">
            Активные: {statsQ.data?.activeClients ?? '…'} / {statsQ.data?.maxClients ?? 20} · можно архивировать, чтобы освободить место
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="btn-3d flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white"
          >
            <UserRoundPlus className="h-5 w-5" />
            Добавить клиента
          </button>
          <button
            onClick={() => { setReprocessConfirmOpen(true); setReprocessResult(null) }}
            className="btn-soft flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-brand-deep"
          >
            <Sparkles className="h-5 w-5" />
            Переанализировать по новым промптам
          </button>
        </div>
      </div>

      {reprocessResult && (
        <div className="mb-6 rounded-2xl border border-brand-lav/40 bg-brand-lav/10 px-4 py-3 text-sm text-brand-deep">
          Отправлено на переанализ: {reprocessResult.queued}.
          {reprocessResult.skippedSent > 0 && ` Пропущено (уже у клиента): ${reprocessResult.skippedSent}.`}
          {reprocessResult.skippedProcessing > 0 && ` Уже в обработке: ${reprocessResult.skippedProcessing}.`}
          {reprocessResult.skippedNoMaterial > 0 && ` Без исходного материала (запись удалена для приватности): ${reprocessResult.skippedNoMaterial}.`}
        </div>
      )}

      {/* Reprocess-all confirm modal */}
      {reprocessConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-deep/30 p-4 backdrop-blur-sm" onClick={() => setReprocessConfirmOpen(false)}>
          <GlassCard deep className="w-full max-w-md">
            <div onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between">
                <h2 className="text-lg font-extrabold text-brand-deep">Переанализировать сессии?</h2>
                <button onClick={() => setReprocessConfirmOpen(false)} className="btn-soft rounded-xl p-2" aria-label="Закрыть">
                  <X className="h-4 w-4 text-brand-deep" />
                </button>
              </div>
              <p className="text-sm leading-relaxed text-brand-mute">
                Все сессии, которые ещё не отправлены клиентам и у которых сохранился исходный материал, будут заново
                разобраны AI по обновлённому промпту. Текущие инсайты, темы, задания и договорённости этих сессий
                будут удалены и пересозданы как неподтверждённые черновики — их снова нужно будет проверить и подтвердить.
                Уже отправленные клиентам сессии не трогаются.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setReprocessConfirmOpen(false)} className="btn-soft rounded-2xl px-5 py-2.5 text-sm font-bold text-brand-deep">
                  Отмена
                </button>
                <button
                  onClick={() => reprocessAllMut.mutate()}
                  disabled={reprocessAllMut.isPending}
                  className="btn-3d rounded-2xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {reprocessAllMut.isPending ? 'Запускаем…' : 'Да, переанализировать'}
                </button>
              </div>
              {reprocessAllMut.error && (
                <p className="mt-3 rounded-2xl bg-brand-danger/10 px-4 py-3 text-sm font-semibold text-red-700">
                  {friendlyApiError(reprocessAllMut.error.message)}
                </p>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Add client modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-deep/30 p-4 backdrop-blur-sm" onClick={() => setAddOpen(false)}>
          <GlassCard deep className="w-full max-w-md">
            <div onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-brand-deep">Новый клиент</h2>
                  <p className="mt-1 text-sm text-brand-mute">
                    Заведите карточку клиента, а затем прикрепите к ней записи и материалы сессий.
                  </p>
                </div>
                <button onClick={() => setAddOpen(false)} className="btn-soft rounded-xl p-2" aria-label="Закрыть">
                  <X className="h-4 w-4 text-brand-deep" />
                </button>
              </div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Имя клиента"
                className="mb-3 w-full rounded-2xl border border-brand-softpink/60 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav"
              />
              <input
                value={newFocus}
                onChange={(e) => setNewFocus(e.target.value)}
                placeholder="Запрос / фокус (необязательно): например, «тревога»"
                className="mb-3 w-full rounded-2xl border border-brand-softpink/60 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav"
              />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Почта клиента (куда отправлять материалы сессий)"
                className="w-full rounded-2xl border border-brand-softpink/60 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav"
              />
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-lav/10 p-4 text-xs leading-relaxed text-brand-ink">
                <input
                  type="checkbox"
                  checked={newConsent}
                  onChange={(e) => setNewConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-brand-violet"
                />
                <span>Клиент согласился на обработку записей сессий и создание черновых материалов.</span>
              </label>
              <button
                onClick={() => addClientMut.mutate({ name: newName.trim(), focus: newFocus.trim(), contactEmail: newEmail.trim(), aiConsent: true })}
                disabled={!newName.trim() || !newConsent || addClientMut.isPending}
                className="btn-3d mt-4 w-full rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {addClientMut.isPending ? 'Создаём…' : 'Добавить клиента'}
              </button>
              {addClientMut.error && (
                <p className="mt-3 rounded-2xl bg-brand-danger/10 px-4 py-3 text-sm font-semibold text-red-700">
                  {friendlyApiError(addClientMut.error.message)}
                </p>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-2xl bg-white/70 p-1 shadow-soft">
          {(['active', 'archived'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-xl px-5 py-2 text-sm font-bold transition-all',
                tab === t ? 'btn-3d text-white' : 'text-brand-mute hover:text-brand-deep',
              )}
            >
              {t === 'active' ? 'Активные' : 'Архив'}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени…"
            className="rounded-2xl border border-white bg-white/80 py-2.5 pl-10 pr-4 text-sm text-brand-ink shadow-soft outline-none placeholder:text-brand-mute/70 focus:ring-2 focus:ring-brand-lav"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <GlassCard key={c.id} className="flex h-full flex-col transition-all hover:-translate-y-1">
            <div className="flex items-center gap-3">
              <Avatar initials={c.initials} hue={c.avatarHue} />
              <div>
                <p className="font-bold text-brand-ink">{c.name}</p>
                <p className="text-xs text-brand-mute">
                  с {c.since} · сессий: {c.sessionsCount}
                </p>
              </div>
            </div>
            <div className="mt-4 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-pink">текущий фокус</p>
              <p className="mt-1 text-sm text-brand-ink">{c.focus || '—'}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.pendingApprovals > 0 && <Pill tone="pink">подтвердить: {c.pendingApprovals}</Pill>}
              {c.status === 'archived' && (
                <Pill tone="muted"><Archive className="h-3.5 w-3.5" /> в архиве</Pill>
              )}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link
                to={`/t/clients/${c.id}`}
                className="btn-3d rounded-xl px-3 py-2 text-center text-xs font-bold text-white"
              >
                Открыть
              </Link>
              <Link
                to={`/t/upload?client=${c.id}`}
                className="btn-soft rounded-xl px-3 py-2 text-center text-xs font-bold text-brand-deep"
              >
                Загрузить сессию
              </Link>
            </div>
          </GlassCard>
        ))}
      </div>
      {clientsQ.data && list.length === 0 && (
        <p className="mt-8 text-center text-sm text-brand-mute">
          {tab === 'active' ? 'Пока нет клиентов — добавьте первого или загрузите запись сессии.' : 'Архив пуст.'}
        </p>
      )}
    </AppShell>
  )
}
