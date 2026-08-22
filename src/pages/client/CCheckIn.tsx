import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CheckCircle2, SkipForward } from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard } from '@/components/brand'
import { trpc } from '@/lib/store'
import { cn } from '@/lib/utils'

function Scale({
  label, hint, value, onChange,
}: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="font-bold text-brand-ink">{label}</p>
        <span className="text-sm font-extrabold text-brand-violet">{value} / 10</span>
      </div>
      <p className="mb-3 text-xs text-brand-mute">{hint}</p>
      <div className="flex gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            aria-label={`${label}: ${n}`}
            className={cn(
              'h-9 flex-1 rounded-xl transition-all',
              n <= value
                ? 'bg-gradient-to-t from-brand-pink to-brand-lav shadow-soft'
                : 'bg-white shadow-inner hover:bg-brand-softpink/30',
            )}
          />
        ))}
      </div>
    </div>
  )
}

export default function CCheckIn() {
  const navigate = useNavigate()
  const utils = trpc.useUtils()
  const [mood, setMood] = useState(7)
  const [energy, setEnergy] = useState(6)
  const [anxiety, setAnxiety] = useState(4)
  const [body, setBody] = useState('')
  const [request, setRequest] = useState('')
  const [sent, setSent] = useState(false)

  const createMut = trpc.checkins.create.useMutation({
    onSuccess: () => {
      void utils.checkins.list.invalidate()
      setSent(true)
    },
  })

  if (sent) {
    return (
      <AppShell role="client">
        <div className="mx-auto max-w-xl pt-10 text-center">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-success/25">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </span>
          <h1 className="text-2xl font-extrabold text-brand-deep">Спасибо, чек-ин сохранён</h1>
          <p className="mt-2 text-brand-mute">
            Терапевт увидит ваши ответы перед встречей. Это поможет начать с того, что важно именно вам.
          </p>
          <button onClick={() => navigate('/c')} className="btn-3d mt-6 rounded-2xl px-8 py-3 text-sm font-bold text-white">
            Вернуться на мой путь
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell role="client">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-brand-deep">Чек-ин перед встречей</h1>
          <p className="mt-1 text-brand-mute">
            Пара минут для себя. Это не тест и не диагностика — ответов «правильно» здесь нет.
          </p>
        </div>

        <GlassCard deep className="space-y-8">
          <Scale label="Настроение" hint="Как вы в целом себя чувствуете эти дни?" value={mood} onChange={setMood} />
          <Scale label="Энергия" hint="Сколько сил сейчас есть?" value={energy} onChange={setEnergy} />
          <Scale label="Тревога" hint="Насколько тревожно внутри? Если неактуально — можно оставить как есть." value={anxiety} onChange={setAnxiety} />

          <div>
            <p className="mb-1 font-bold text-brand-ink">Что замечаете в теле?</p>
            <p className="mb-3 text-xs text-brand-mute">Напряжение, тепло, тяжесть — любые ощущения, можно своими словами.</p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              placeholder="Например: плечи поджаты, дышу поверхностно…"
              className="w-full rounded-2xl border border-brand-softpink/60 bg-white/80 p-4 text-sm outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav"
            />
          </div>

          <div>
            <p className="mb-1 font-bold text-brand-ink">Что важно обсудить на встрече?</p>
            <p className="mb-3 text-xs text-brand-mute">Ваш запрос — терапевт увидит его заранее.</p>
            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              rows={2}
              placeholder="Хочу поговорить о…"
              className="w-full rounded-2xl border border-brand-softpink/60 bg-white/80 p-4 text-sm outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => createMut.mutate({ mood, energy, anxiety, bodyNotes: body, request })}
              disabled={createMut.isPending}
              className="btn-3d rounded-2xl px-8 py-3.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {createMut.isPending ? 'Сохраняем…' : 'Отправить чек-ин'}
            </button>
            <button onClick={() => navigate('/c')} className="btn-soft flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-brand-deep">
              <SkipForward className="h-4 w-4" /> Пропустить — это тоже ок
            </button>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  )
}
