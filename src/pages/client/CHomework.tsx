import { useState } from 'react'
import { ClipboardCheck, CheckCircle2, CalendarClock, Repeat } from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard } from '@/components/brand'
import { Pill, EmptyState } from '@/components/widgets'
import { trpc, useHomeworkList } from '@/lib/store'
import { homeworkStatusLabel } from '@/lib/data'

export default function CHomework() {
  const homeworkQ = useHomeworkList()
  const visible = (homeworkQ.data ?? []).filter((h) => h.approved && h.status !== 'cancelled')
  const [reflectionFor, setReflectionFor] = useState<string | null>(null)
  const [reflectionText, setReflectionText] = useState('')

  const utils = trpc.useUtils()
  const completeMut = trpc.homework.complete.useMutation({
    onSuccess: () => {
      setReflectionFor(null)
      setReflectionText('')
      void utils.homework.list.invalidate()
    },
  })

  return (
    <AppShell role="client">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-brand-deep">Мои задания</h1>
        <p className="mt-1 text-brand-mute">
          Задания — это приглашение, а не обязанность. Если что-то не подошло, это тоже важная информация.
        </p>
      </div>

      {homeworkQ.data && visible.length === 0 && (
        <EmptyState title="Заданий пока нет" hint="Когда терапевт подтвердит новое задание, оно появится здесь." />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {visible.map((h) => (
          <GlassCard key={h.id} className={h.status === 'done' ? 'opacity-90' : ''}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-lav to-brand-violet shadow-soft">
                  <ClipboardCheck className="h-5 w-5 text-white" />
                </span>
                <p className="pt-2 font-bold text-brand-ink">{h.title}</p>
              </div>
              <Pill tone={h.status === 'done' ? 'success' : h.status === 'in_progress' ? 'violet' : 'muted'}>
                {homeworkStatusLabel[h.status]}
              </Pill>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-brand-ink">{h.description}</p>

            <div className="mt-3 rounded-2xl bg-brand-softpink/30 px-4 py-3">
              <p className="text-xs font-bold text-brand-deep">Зачем это</p>
              <p className="mt-0.5 text-sm text-brand-ink">{h.purpose}</p>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-brand-mute">
              <span className="flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5" /> {h.frequency}</span>
              <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> срок: {h.dueDate}</span>
            </div>

            {h.status === 'done' && h.reflection && (
              <div className="mt-4 rounded-2xl bg-brand-success/15 px-4 py-3">
                <p className="text-xs font-bold text-emerald-800">Ваша заметка после выполнения</p>
                <p className="mt-1 text-sm italic text-emerald-900">«{h.reflection}»</p>
              </div>
            )}

            {h.status !== 'done' && (
              <div className="mt-5">
                {reflectionFor === h.id ? (
                  <div>
                    <textarea
                      value={reflectionText}
                      onChange={(e) => setReflectionText(e.target.value)}
                      rows={3}
                      placeholder="Как это было? Что вы заметили? Пара слов — если хочется."
                      className="w-full rounded-2xl border border-brand-softpink/60 bg-white/80 p-4 text-sm text-brand-ink outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav"
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => completeMut.mutate({ id: Number(h.id), reflection: reflectionText.trim() })}
                        disabled={completeMut.isPending}
                        className="btn-3d rounded-xl px-5 py-2.5 text-xs font-bold text-white"
                      >
                        Сохранить
                      </button>
                      <button onClick={() => setReflectionFor(null)} className="btn-soft rounded-xl px-5 py-2.5 text-xs font-bold text-brand-deep">
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setReflectionFor(h.id)}
                    className="btn-3d flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Отметить выполнение
                  </button>
                )}
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </AppShell>
  )
}
