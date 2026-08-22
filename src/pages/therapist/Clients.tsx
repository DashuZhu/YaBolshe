import { Link } from 'react-router'
import { useState } from 'react'
import { UserPlus, Archive, Search, Copy, Check, X } from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard, Avatar } from '@/components/brand'
import { Pill } from '@/components/widgets'
import { useClients, useTherapistStats, trpc } from '@/lib/store'
import { cn } from '@/lib/utils'

export default function Clients() {
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [query, setQuery] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [focus, setFocus] = useState('')
  const [inviteCode, setInviteCode] = useState<{ code: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const clientsQ = useClients()
  const statsQ = useTherapistStats()
  const inviteMut = trpc.clients.createInvite.useMutation({
    onSuccess: (r) => setInviteCode(r),
  })

  const list = (clientsQ.data ?? [])
    .filter((c) => c.status === tab)
    .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))

  const copy = async () => {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <AppShell role="therapist">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-deep">Клиенты</h1>
          <p className="mt-1 text-brand-mute">
            Активные: {statsQ.data?.activeClients ?? '…'} / {statsQ.data?.maxClients ?? 20} · можно архивировать, чтобы освободить место
          </p>
        </div>
        <button
          onClick={() => { setInviteOpen(true); setInviteCode(null) }}
          className="btn-3d flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white"
        >
          <UserPlus className="h-5 w-5" />
          Пригласить клиента
        </button>
      </div>

      {/* Invite modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-deep/30 p-4 backdrop-blur-sm" onClick={() => setInviteOpen(false)}>
          <GlassCard deep className="w-full max-w-md" >
            <div onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-brand-deep">Приглашение клиента</h2>
                  <p className="mt-1 text-sm text-brand-mute">
                    Передайте код клиенту — он введёт его при регистрации и сразу даст согласие на AI-обработку.
                  </p>
                </div>
                <button onClick={() => setInviteOpen(false)} className="btn-soft rounded-xl p-2" aria-label="Закрыть">
                  <X className="h-4 w-4 text-brand-deep" />
                </button>
              </div>
              {!inviteCode ? (
                <div>
                  <input
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder="Запрос / фокус (необязательно): например, «тревога»"
                    className="w-full rounded-2xl border border-brand-softpink/60 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav"
                  />
                  <button
                    onClick={() => inviteMut.mutate({ focus })}
                    disabled={inviteMut.isPending}
                    className="btn-3d mt-4 w-full rounded-2xl py-3 text-sm font-bold text-white"
                  >
                    {inviteMut.isPending ? 'Создаём…' : 'Создать код приглашения'}
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-mute">код приглашения</p>
                  <p className="mt-2 rounded-2xl bg-brand-lav/20 py-4 text-3xl font-extrabold tracking-[0.3em] text-brand-deep">
                    {inviteCode.code}
                  </p>
                  <p className="mt-2 text-xs text-brand-mute">действует до {inviteCode.expiresAt}</p>
                  <button onClick={copy} className="btn-soft mx-auto mt-4 flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-bold text-brand-deep">
                    {copied ? <Check className="h-4 w-4 text-brand-success" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Скопировано' : 'Скопировать код'}
                  </button>
                </div>
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
          {tab === 'active' ? 'Пока нет активных клиентов — пригласите первого кодом выше.' : 'Архив пуст.'}
        </p>
      )}
    </AppShell>
  )
}
