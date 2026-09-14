import { Link } from 'react-router'
import { ArrowRight, Sparkles, AudioLines, BrainCircuit, UserCheck } from 'lucide-react'
import { Logo, Blobs } from '@/components/brand'
import { LegalLinks } from '@/components/legal'

const bullets = [
  { icon: BrainCircuit, text: 'AI превращает запись сессии в понятный терапевтический трек' },
  { icon: AudioLines, text: 'Расшифровка аудио на сайте' },
  { icon: Sparkles, text: 'Анализ 360° работы с клиентом' },
  { icon: UserCheck, text: 'AI помогает, терапевт решает' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Blobs />

      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Link to="/login" className="btn-3d flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white">
          Войти в портал
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-10 text-center sm:pt-20">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-pink/30 bg-white/70 px-4 py-1.5 text-xs font-bold text-brand-deep backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-brand-pink" />
          Портал для гештальт-терапевтов
        </div>
        <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.1] text-brand-deep sm:text-5xl">
          Анализ сессий.{' '}
          <span className="bg-gradient-to-r from-brand-pink via-brand-violet to-brand-lav bg-clip-text text-transparent">
            Отслеживание динамики.
          </span>
        </h1>

        <ul className="mt-9 flex w-full max-w-md flex-col gap-3.5 text-left">
          {bullets.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3.5 shadow-soft backdrop-blur">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-softpink to-brand-lav">
                <Icon className="h-4.5 w-4.5 text-brand-deep" />
              </span>
              <span className="text-sm font-semibold text-brand-ink">{text}</span>
            </li>
          ))}
        </ul>

        <Link
          to="/login"
          className="btn-3d mt-10 flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-bold text-white"
        >
          Войти в портал
          <ArrowRight className="h-5 w-5" />
        </Link>
      </section>

      <footer className="border-t border-brand-softpink/40 px-6 py-8 text-center text-xs text-brand-mute">
        <p>«Я Больше!» · инструмент терапевта · сделано с теплом</p>
        <LegalLinks className="mt-4" />
      </footer>
    </div>
  )
}
