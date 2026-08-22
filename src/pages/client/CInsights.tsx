import { useState } from 'react'
import { Lightbulb, FlaskConical, MessageCircleHeart } from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard } from '@/components/brand'
import { Pill, EmptyState } from '@/components/widgets'
import { useInsightsForClient, useHomeworkList } from '@/lib/store'
import { clientActionLabel } from '@/lib/data'
import { cn } from '@/lib/utils'

const statusOptions = [
  { key: 'new', label: 'новое' },
  { key: 'exploring', label: 'исследую' },
  { key: 'applying', label: 'применяю' },
  { key: 'integrated', label: 'интегрировано' },
  { key: 'discuss', label: 'обсудить с терапевтом' },
] as const

export default function CInsights() {
  const insightsQ = useInsightsForClient()
  const homeworkQ = useHomeworkList()
  const approvedInsights = (insightsQ.data ?? []).filter((i) => i.approved)
  const homework = homeworkQ.data ?? []
  const [statuses, setStatuses] = useState<Record<string, string>>({})

  return (
    <AppShell role="client">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-brand-deep">Мои инсайты</h1>
        <p className="mt-1 text-brand-mute">
          Открытия, которые вы сделали вместе с терапевтом. Отмечайте статус так, как чувствуете.
        </p>
      </div>

      {insightsQ.data && approvedInsights.length === 0 && (
        <EmptyState title="Пока здесь тихо" hint="Инсайты появятся после того, как терапевт подтвердит материалы ближайшей сессии." />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {approvedInsights.map((i) => {
          const relatedHw = homework.find((h) => h.insightTitle === i.title && h.approved)
          const status = statuses[i.id] ?? 'new'
          return (
            <GlassCard key={i.id}>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-pink to-brand-lav shadow-soft">
                  <Lightbulb className="h-5 w-5 text-white" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="pt-2 font-bold leading-snug text-brand-ink">{i.title}</p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-brand-ink">{i.description}</p>

              <div className="mt-4 rounded-2xl bg-brand-lav/15 px-4 py-3">
                <p className="text-xs font-bold text-brand-deep">Что с этим можно делать</p>
                <p className="mt-1 text-sm text-brand-ink">
                  {i.clientAction === 'discuss'
                    ? 'Это хорошая тема для разговора с терапевтом на ближайшей встрече.'
                    : i.clientAction === 'integrate'
                      ? 'Просто замечайте, как это проявляется в жизни. Ничего специально делать не нужно.'
                      : `Можно мягко ${clientActionLabel[i.clientAction]} — в своём темпе.`}
                </p>
              </div>

              {relatedHw && (
                <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-brand-softpink/30 px-4 py-3 text-sm">
                  <FlaskConical className="h-4 w-4 shrink-0 text-brand-deep" />
                  <span className="text-brand-ink">Связанное задание: <b>{relatedHw.title}</b></span>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-1.5">
                {statusOptions.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setStatuses((prev) => ({ ...prev, [i.id]: s.key }))}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-bold transition-all',
                      status === s.key
                        ? 'btn-3d text-white'
                        : 'bg-white/70 text-brand-mute hover:text-brand-deep',
                    )}
                  >
                    {s.key === 'discuss' && <MessageCircleHeart className="mr-1 inline h-3.5 w-3.5" />}
                    {s.label}
                  </button>
                ))}
              </div>
              {status === 'discuss' && (
                <p className="mt-3">
                  <Pill tone="violet">вы отметили, что хотите это обсудить — статусы сохраняются у вас в кабинете</Pill>
                </p>
              )}
            </GlassCard>
          )
        })}
      </div>
    </AppShell>
  )
}
