import { Handshake, Sparkles, CalendarClock } from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard } from '@/components/brand'
import { Pill, EmptyState } from '@/components/widgets'
import { useAgreementsList } from '@/lib/store'
import { agreementTypeLabel } from '@/lib/data'

export default function CAgreements() {
  const agreementsQ = useAgreementsList()
  const visible = (agreementsQ.data ?? []).filter((a) => a.approved)

  return (
    <AppShell role="client">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-brand-deep">Мои договорённости</h1>
        <p className="mt-1 text-brand-mute">
          Установки, намерения и эксперименты, которые вы сформулировали вместе с терапевтом.
        </p>
      </div>

      {agreementsQ.data && visible.length === 0 && (
        <EmptyState title="Пока пусто" hint="Договорённости появятся после подтверждения материалов терапевтом." />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {visible.map((a, i) => (
          <GlassCard key={a.id} deep={i === 0}>
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-softpink to-brand-lav shadow-soft">
                {a.type === 'experiment' ? (
                  <Sparkles className="h-5 w-5 text-brand-deep" />
                ) : (
                  <Handshake className="h-5 w-5 text-brand-deep" />
                )}
              </span>
              <Pill tone={a.status === 'review' ? 'warning' : 'violet'}>
                {agreementTypeLabel[a.type]}
              </Pill>
            </div>
            <p className="mt-4 text-lg font-bold leading-snug text-brand-ink">«{a.text}»</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-brand-mute">
              <CalendarClock className="h-3.5 w-3.5" />
              вернёмся к этому: {a.reviewDate || 'по договорённости'}
              {a.status === 'review' && (
                <Pill tone="pink" className="ml-auto">пора пересмотреть</Pill>
              )}
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="mt-6">
        <p className="text-sm leading-relaxed text-brand-mute">
          Договорённости — это не правила, за которые бывает стыдно. Это бережные напоминания о том,
          что для вас важно. Любую из них можно пересмотреть вместе с терапевтом — это нормальная часть пути.
        </p>
      </GlassCard>
    </AppShell>
  )
}
