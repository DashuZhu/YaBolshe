import { Link } from 'react-router'
import {
  ArrowRight, AudioLines, BrainCircuit, CheckCircle2, Heart, Lock,
  Map, Sparkles, UserCheck, ShieldCheck,
} from 'lucide-react'
import { Logo, Blobs, GlassCard } from '@/components/brand'
import { LegalLinks } from '@/components/legal'

const features = [
  {
    icon: AudioLines,
    title: 'Записи сессий → текст',
    text: 'Загрузите аудио или видео до 90 минут. Система расшифрует речь, разделит голоса терапевта и клиента, сохранит временные метки.',
  },
  {
    icon: BrainCircuit,
    title: 'AI-анализ как черновик',
    text: 'Модель выделяет темы, чувства, потребности, паттерны и гипотезы — всегда с опорой на фрагменты расшифровки и пометкой уверенности.',
  },
  {
    icon: UserCheck,
    title: 'Терапевт — главный',
    text: 'Ничего не уходит клиенту автоматически. Каждый материал терапевт читает, редактирует и лично подтверждает.',
  },
  {
    icon: Map,
    title: 'Живой трек терапии',
    text: 'Инсайты, договорённости, домашние задания и дорожная карта обновляются после каждой сессии — бережно и понятно.',
  },
  {
    icon: Lock,
    title: 'Приватность по умолчанию',
    text: 'Клиент не видит сырую расшифровку, черновики AI и внутренние заметки. Все действия фиксируются в журнале аудита.',
  },
  {
    icon: Heart,
    title: 'Гештальт-подход',
    text: 'Осознавание, контакт, потребности, телесные маркеры — профессиональная глубина для терапевта и простой язык для клиента.',
  },
]

const steps = [
  { n: '01', title: 'Загрузите сессию', text: 'Видео или аудио до 90 минут, с прогрессом и возобновлением загрузки.' },
  { n: '02', title: 'Получите черновик', text: 'Расшифровка и структурированный AI-анализ — темы, инсайты, задания, риски.' },
  { n: '03', title: 'Подтвердите', text: 'Отредактируйте и подтвердите материалы. Только после этого их увидит клиент.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Blobs />

      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-soft rounded-2xl px-5 py-2.5 text-sm font-bold text-brand-deep">
            Войти
          </Link>
          <Link to="/login" className="btn-3d rounded-2xl px-5 py-2.5 text-sm font-bold text-white">
            Начать
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 text-center sm:pt-16">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand-pink/30 bg-white/70 px-4 py-1.5 text-xs font-bold text-brand-deep backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-brand-pink" />
          Портал для гештальт-терапевтов и их клиентов
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-[1.1] text-brand-deep sm:text-6xl">
          Терапия продолжается{' '}
          <span className="bg-gradient-to-r from-brand-pink via-brand-violet to-brand-lav bg-clip-text text-transparent">
            между сессиями
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-brand-mute">
          «Я Больше!» превращает записи сессий в понятный терапевтический трек: расшифровка,
          AI-черновик анализа, инсайты, задания и дорожная карта. AI помогает — терапевт решает.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/login"
            className="btn-3d flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-bold text-white"
          >
            Войти в портал
            <ArrowRight className="h-5 w-5" />
          </Link>
          <a
            href="#how"
            className="btn-soft rounded-2xl px-8 py-4 text-base font-bold text-brand-deep"
          >
            Как это работает
          </a>
        </div>

        {/* Floating preview card */}
        <div className="relative mx-auto mt-16 max-w-3xl">
          <div className="animate-float-slow">
            <GlassCard deep className="text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-pink to-brand-violet text-sm font-bold text-white">
                    МЛ
                  </span>
                  <div>
                    <p className="font-bold text-brand-ink">Сессия 24 · Границы с мамой</p>
                    <p className="text-xs text-brand-mute">55 минут · расшифрована · черновик AI готов</p>
                  </div>
                </div>
                <span className="rounded-full bg-brand-warning/25 px-3 py-1 text-xs font-bold text-amber-800">
                  на проверке
                </span>
              </div>
              <div className="mt-5 rounded-2xl bg-white/70 p-4">
                <p className="text-sm italic leading-relaxed text-brand-ink">
                  «Сжались плечи… как будто тело знало „нет“ раньше, чем я»
                </p>
                <p className="mt-2 text-xs text-brand-mute">00:02:11 · Клиент · уверенность 96%</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {['инсайты: 3', 'темы: 3', 'задание: 1', 'риски: 0'].map((t) => (
                  <span key={t} className="rounded-full bg-brand-lav/25 px-3 py-1 text-xs font-semibold text-brand-deep">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3">
                <span className="btn-3d flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white">
                  <CheckCircle2 className="h-4 w-4" /> Подтвердить и отправить клиенту
                </span>
                <span className="text-xs text-brand-mute">клиент увидит только после подтверждения</span>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-10 text-center text-3xl font-extrabold text-brand-deep">
          Всё важное — в одном мягком пространстве
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <GlassCard key={title} className="transition-transform hover:-translate-y-1">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-softpink to-brand-lav shadow-soft">
                <Icon className="h-6 w-6 text-brand-deep" />
              </span>
              <h3 className="mb-2 font-bold text-brand-ink">{title}</h3>
              <p className="text-sm leading-relaxed text-brand-mute">{text}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-10 text-center text-3xl font-extrabold text-brand-deep">Как это работает</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {steps.map((s) => (
            <GlassCard key={s.n} className="relative overflow-hidden">
              <span className="absolute -right-3 -top-6 text-[96px] font-extrabold text-brand-softpink/50">
                {s.n}
              </span>
              <h3 className="relative mb-2 text-lg font-bold text-brand-deep">{s.title}</h3>
              <p className="relative text-sm leading-relaxed text-brand-mute">{s.text}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Ethics */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <GlassCard deep className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-success/50 to-brand-lav/40">
            <ShieldCheck className="h-7 w-7 text-brand-deep" />
          </span>
          <div>
            <h3 className="font-bold text-brand-ink">AI не является терапевтом</h3>
            <p className="mt-1 text-sm leading-relaxed text-brand-mute">
              AI не ставит диагнозы, не даёт медицинских рекомендаций и не заменяет специалиста.
              Он только готовит черновики, а терапевт подтверждает каждый материал перед отправкой клиенту.
              Портал не является медицинской услугой. В экстренной ситуации обратитесь в экстренные службы — 112.
            </p>
          </div>
        </GlassCard>
      </section>

      <footer className="border-t border-brand-softpink/40 px-6 py-8 text-center text-xs text-brand-mute">
        <p>«Я Больше!» · терапевт решает, что становится доступно клиенту · сделано с теплом</p>
        <LegalLinks className="mt-4" />
      </footer>
    </div>
  )
}
