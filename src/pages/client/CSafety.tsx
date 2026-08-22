import { Phone, HeartHandshake, Wind, ShieldCheck } from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard } from '@/components/brand'

const grounding = [
  { title: '5–4–3–2–1', text: 'Найдите вокруг 5 вещей, которые видите, 4 — которые слышите, 3 — которые можете потрогать, 2 запаха, 1 вкус.' },
  { title: 'Дыхание с опорой', text: 'Почувствуйте опору под стопами. Медленный вдох на 4 счёта, выдох на 6. Несколько циклов, без усилия.' },
  { title: 'Тёплый контакт', text: 'Положите ладонь на грудь или обхватите себя. Просто побудьте так минуту, замечая тепло рук.' },
]

export default function CSafety() {
  return (
    <AppShell role="client">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-brand-deep">Безопасность и поддержка</h1>
        <p className="mt-1 text-brand-mute">Короткие опоры на случай, если сейчас тяжело.</p>
      </div>

      {/* Emergency */}
      <div className="mb-6 rounded-3xl border-2 border-brand-danger/40 bg-brand-danger/10 p-6">
        <p className="flex items-center gap-2.5 text-lg font-extrabold text-red-800">
          <Phone className="h-6 w-6" />
          Если вам опасно прямо сейчас
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-red-900/90">
          Пожалуйста, не оставайтесь с этим в одиночку. Обратитесь в экстренные службы — <b>112</b> (Россия).
          Если вы в другой стране — позвоните в местную экстренную службу. Вы имеете право на помощь.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Grounding */}
        <GlassCard>
          <h2 className="mb-4 flex items-center gap-2 font-bold text-brand-ink">
            <Wind className="h-5 w-5 text-brand-violet" /> Техники самоподдержки
          </h2>
          <ul className="space-y-3">
            {grounding.map((g) => (
              <li key={g.title} className="rounded-2xl bg-white/70 p-4">
                <p className="text-sm font-bold text-brand-deep">{g.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-brand-mute">{g.text}</p>
              </li>
            ))}
          </ul>
        </GlassCard>

        {/* Contacts */}
        <GlassCard>
          <h2 className="mb-4 flex items-center gap-2 font-bold text-brand-ink">
            <HeartHandshake className="h-5 w-5 text-brand-pink" /> Куда можно обратиться
          </h2>
          <ul className="space-y-3 text-sm">
            <li className="rounded-2xl bg-white/70 p-4">
              <p className="font-bold text-brand-ink">Ваш терапевт — Анна Соколова</p>
              <p className="mt-1 text-brand-mute">Написать можно через раздел напоминаний; ответ в рабочие часы.</p>
            </li>
            <li className="rounded-2xl bg-white/70 p-4">
              <p className="font-bold text-brand-ink">Телефон доверия — 8 800 2000 122</p>
              <p className="mt-1 text-brand-mute">Бесплатно, круглосуточно, анонимно (Россия).</p>
            </li>
            <li className="rounded-2xl bg-white/70 p-4">
              <p className="font-bold text-brand-ink">Экстренные службы — 112</p>
              <p className="mt-1 text-brand-mute">При непосредственной угрозе безопасности.</p>
            </li>
          </ul>
        </GlassCard>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-3xl bg-brand-lav/15 p-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-deep" />
        <p className="text-sm leading-relaxed text-brand-mute">
          Портал «Я Больше!» не является медицинской услугой, не заменяет терапию, диагностику
          или консультацию специалиста. Материалы в вашем кабинете подтверждены вашим терапевтом лично.
        </p>
      </div>
    </AppShell>
  )
}
