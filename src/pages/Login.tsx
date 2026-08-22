import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { Heart, ArrowLeft, Loader2, KeyRound, Mail, UserRound, Ticket } from 'lucide-react'
import { Logo, Blobs, GlassCard } from '@/components/brand'
import { trpc, useApp } from '@/lib/store'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'therapist' | 'client'

const inputCls =
  'w-full rounded-2xl border border-brand-softpink/60 bg-white/80 px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav'

export default function Login() {
  const navigate = useNavigate()
  const { refreshAll } = useApp()
  const [mode, setMode] = useState<Mode>('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '', inviteCode: '', aiConsent: false,
  })

  const utils = trpc.useUtils()
  const go = (role: string) => {
    refreshAll()
    void utils.invalidate()
    navigate(role === 'therapist' ? '/t' : role === 'client' ? '/c' : '/a')
  }

  const loginMut = trpc.auth.login.useMutation({
    onSuccess: (u) => go(u.role),
    onError: (e) => { setError(e.message); setBusy(false) },
  })
  const regTMut = trpc.auth.registerTherapist.useMutation({
    onSuccess: (u) => go(u.role),
    onError: (e) => { setError(e.message); setBusy(false) },
  })
  const regCMut = trpc.auth.registerClient.useMutation({
    onSuccess: (u) => go(u.role),
    onError: (e) => { setError(e.message); setBusy(false) },
  })

  const submit = () => {
    setError('')
    setBusy(true)
    const email = form.email.trim()
    if (mode === 'login') loginMut.mutate({ email, password: form.password })
    if (mode === 'therapist')
      regTMut.mutate({ email, password: form.password, firstName: form.firstName, lastName: form.lastName })
    if (mode === 'client')
      regCMut.mutate({
        inviteCode: form.inviteCode, email, password: form.password,
        firstName: form.firstName, lastName: form.lastName, aiConsent: form.aiConsent as true,
      })
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  return (
    <div className="flex min-h-screen flex-col bg-brand-bg">
      <Blobs />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Link to="/" className="flex items-center gap-1.5 text-sm font-semibold text-brand-mute hover:text-brand-deep">
          <ArrowLeft className="h-4 w-4" /> На главную
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl btn-3d text-white">
            <Heart className="h-7 w-7 fill-white/90" />
          </span>
          <h1 className="text-2xl font-extrabold text-brand-deep">
            {mode === 'login' ? 'С возвращением' : mode === 'therapist' ? 'Регистрация терапевта' : 'Вход по приглашению'}
          </h1>
          <p className="mt-2 text-sm text-brand-mute">
            {mode === 'login'
              ? 'Демо: anna@yabolshe.demo · maria@yabolshe.demo · admin@yabolshe.demo — пароль demo1234'
              : mode === 'therapist'
                ? 'Создайте кабинет и приглашайте клиентов кодом'
                : 'Терапевт дал вам код приглашения? Введите его здесь'}
          </p>
        </div>

        <div className="mb-5 flex rounded-2xl bg-white/70 p-1.5 shadow-soft">
          {([
            ['login', 'Вход', KeyRound],
            ['therapist', 'Я терапевт', UserRound],
            ['client', 'Я клиент', Ticket],
          ] as const).map(([m, label, Icon]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold transition-all',
                mode === m ? 'btn-3d text-white' : 'text-brand-mute hover:text-brand-deep',
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <GlassCard deep>
          <div className="space-y-3.5">
            {mode === 'client' && (
              <input className={inputCls} placeholder="Код приглашения (например, DEMO2026)" value={form.inviteCode} onChange={set('inviteCode')} />
            )}
            {mode !== 'login' && (
              <div className="flex gap-3">
                <input className={inputCls} placeholder="Имя" value={form.firstName} onChange={set('firstName')} />
                <input className={inputCls} placeholder="Фамилия" value={form.lastName} onChange={set('lastName')} />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mute/60" />
              <input className={cn(inputCls, 'pl-11')} type="email" placeholder="Email" value={form.email} onChange={set('email')} />
            </div>
            <input className={inputCls} type="password" placeholder={mode === 'login' ? 'Пароль' : 'Пароль (минимум 8 символов)'} value={form.password} onChange={set('password')}
              onKeyDown={(e) => e.key === 'Enter' && submit()} />

            {mode === 'client' && (
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-lav/10 p-4 text-xs leading-relaxed text-brand-ink">
                <input type="checkbox" checked={form.aiConsent} onChange={set('aiConsent')} className="mt-0.5 h-4 w-4 accent-brand-violet" />
                <span>
                  Я даю согласие на обработку персональных данных и на AI-обработку записей моих сессий
                  (расшифровка и черновой анализ). Понимаю, что клиентские материалы публикуются только после
                  подтверждения терапевтом. Согласие можно отозвать в любой момент.
                </span>
              </label>
            )}

            {error && (
              <p className="rounded-2xl bg-brand-danger/10 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={busy}
              className={cn('btn-3d flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white', busy && 'opacity-60')}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </button>
          </div>
        </GlassCard>

        <p className="mt-6 text-center text-xs leading-relaxed text-brand-mute">
          Портал не является медицинской услугой и не заменяет терапию. В экстренной ситуации — 112.
        </p>
      </main>
    </div>
  )
}
