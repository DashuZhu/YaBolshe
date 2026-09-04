import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router'
import { Heart, ArrowLeft, Loader2, KeyRound, Mail, UserRound, Ticket } from 'lucide-react'
import { Logo, Blobs, GlassCard } from '@/components/brand'
import { trpc } from '@/lib/store'
import { cn } from '@/lib/utils'
import { friendlyApiError } from '@/lib/errors'

type Mode = 'login' | 'invited' | 'client'
type AuthenticatedUser = {
  id: number
  email: string
  role: 'therapist' | 'client' | 'admin' | 'owner'
  isPlatformOwner: boolean
  firstName: string
  lastName: string
}

const inputCls =
  'w-full rounded-2xl border border-brand-softpink/60 bg-white/80 px-4 py-3 text-sm text-brand-ink outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialInvite = searchParams.get('invite')?.trim().toUpperCase() ?? ''
  const initialMode: Mode = searchParams.get('mode') === 'client'
    ? 'client'
    : initialInvite
      ? 'invited'
      : 'login'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '', inviteCode: initialInvite,
    privacyConsent: false, termsConsent: false, aiConsent: false,
  })

  const utils = trpc.useUtils()
  const go = (user: AuthenticatedUser) => {
    // The login response already contains the authenticated user. Put it into
    // the cache before navigation so Guard never sees the stale logged-out value.
    utils.auth.me.setData(undefined, user)
    navigate(user.role === 'therapist' ? '/t' : user.role === 'client' ? '/c' : '/a', { replace: true })
    void utils.invalidate()
  }

  const loginMut = trpc.auth.login.useMutation({
    onSuccess: go,
    onError: (e) => { setError(friendlyApiError(e.message)); setBusy(false) },
  })
  const regInvitedMut = trpc.auth.registerInvited.useMutation({
    onSuccess: go,
    onError: (e) => { setError(friendlyApiError(e.message)); setBusy(false) },
  })
  const regCMut = trpc.auth.registerClient.useMutation({
    onSuccess: go,
    onError: (e) => { setError(friendlyApiError(e.message)); setBusy(false) },
  })

  const submit = () => {
    if (busy) return
    setError('')
    setBusy(true)
    const email = form.email.trim()
    if (mode === 'login') loginMut.mutate({ email, password: form.password })
    if (mode === 'invited')
      regInvitedMut.mutate({
        inviteCode: form.inviteCode, email, password: form.password,
        firstName: form.firstName, lastName: form.lastName,
        privacyConsent: form.privacyConsent as true, termsConsent: form.termsConsent as true,
      })
    if (mode === 'client')
      regCMut.mutate({
        inviteCode: form.inviteCode, email, password: form.password,
        firstName: form.firstName, lastName: form.lastName,
        privacyConsent: form.privacyConsent as true, termsConsent: form.termsConsent as true,
        aiConsent: form.aiConsent as true,
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
            {mode === 'login' ? 'С возвращением' : mode === 'invited' ? 'Регистрация по приглашению' : 'Кабинет клиента'}
          </h1>
          <p className="mt-2 text-sm text-brand-mute">
            {mode === 'login'
              ? 'Введите почту и пароль от вашего кабинета'
              : mode === 'invited'
                ? 'Код приглашения определит вашу роль и доступ'
                : 'Регистрация клиента доступна только по приглашению его терапевта'}
          </p>
        </div>

        <div className="mb-5 flex rounded-2xl bg-white/70 p-1.5 shadow-soft">
          {([
            ['login', 'Вход', KeyRound],
            ['invited', 'По приглашению', UserRound],
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
            {mode !== 'login' && (
              <input className={inputCls} placeholder="Код приглашения" value={form.inviteCode} onChange={set('inviteCode')} />
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

            {mode !== 'login' && (
              <div className="space-y-2 rounded-2xl bg-white/60 p-4 text-xs leading-relaxed text-brand-ink">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={form.privacyConsent} onChange={set('privacyConsent')} className="mt-0.5 h-4 w-4 accent-brand-violet" />
                  <span>Я даю отдельное согласие на обработку персональных данных на условиях <Link className="font-bold underline" to="/consent">Согласия</Link> и <Link className="font-bold underline" to="/privacy">Политики</Link>.</span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={form.termsConsent} onChange={set('termsConsent')} className="mt-0.5 h-4 w-4 accent-brand-violet" />
                  <span>Я принимаю <Link className="font-bold underline" to="/terms">Пользовательское соглашение</Link>.</span>
                </label>
              </div>
            )}

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
          {mode === 'login' && <>Продолжая вход, вы подтверждаете, что ознакомились с <Link className="underline" to="/privacy">Политикой</Link> и <Link className="underline" to="/terms">условиями сервиса</Link>.<br /></>}
          Портал не является медицинской услугой и не заменяет терапию. В экстренной ситуации — 112.
        </p>
      </main>
    </div>
  )
}
