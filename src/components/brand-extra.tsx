import { Map } from 'lucide-react'
import { GlassCard, SectionHeader } from '@/components/brand'

export { GlassCard, SectionHeader }

export function EmptyRoadmapHint() {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-softpink to-brand-lav shadow-soft">
        <Map className="h-7 w-7 text-brand-deep" />
      </span>
      <p className="font-bold text-brand-ink">Дорожной карты пока нет</p>
      <p className="mt-1 max-w-sm text-sm text-brand-mute">
        Создайте карту вручную или подтвердите черновик AI после первой проанализированной сессии.
      </p>
    </div>
  )
}
