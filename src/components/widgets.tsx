import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

// Soft 3D progress ring
export function Ring({
  value,
  max,
  size = 92,
  stroke = 9,
  label,
  caption,
  gradient = ['#F2A7C3', '#8B7CF6'],
}: {
  value: number
  max: number
  size?: number
  stroke?: number
  label: string
  caption: string
  gradient?: [string, string]
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(value / max, 1)
  const id = `grad-${label.replace(/\s/g, '')}`
  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="100%" stopColor={gradient[1]} />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ring-track" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-extrabold text-brand-deep">{value}</span>
        </div>
      </div>
      <div>
        <div className="text-sm font-bold text-brand-ink">{label}</div>
        <div className="text-xs text-brand-mute">
          {caption.replace('{max}', String(max))}
        </div>
      </div>
    </div>
  )
}

const toneClasses: Record<string, string> = {
  pink: 'bg-brand-softpink/60 text-brand-deep border-brand-pink/40',
  violet: 'bg-brand-lav/40 text-brand-deep border-brand-violet/30',
  success: 'bg-brand-success/20 text-emerald-800 border-brand-success/40',
  warning: 'bg-brand-warning/25 text-amber-800 border-brand-warning/50',
  danger: 'bg-brand-danger/20 text-red-700 border-brand-danger/40',
  muted: 'bg-black/5 text-brand-mute border-black/10',
}

export function Pill({ tone = 'muted', children, className }: { tone?: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function QuotaBar({
  label,
  value,
  max,
  soft = false,
}: {
  label: string
  value: number
  max: number
  soft?: boolean
}) {
  const pct = Math.min((value / max) * 100, 100)
  const warn = pct > 85
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-brand-ink">{label}</span>
        <span className="text-brand-mute">
          <b className="text-brand-deep">{value}</b> / {max}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white shadow-inner">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: warn
              ? 'linear-gradient(90deg,#F2C879,#E88A8A)'
              : 'linear-gradient(90deg,#F2A7C3,#8B7CF6)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)',
          }}
        />
      </div>
      {warn && (
        <p className="mt-1 text-xs text-amber-700">
          {soft ? 'Мягкий лимит почти достигнут — можно продолжать, но стоит следить' : 'Близко к лимиту'}
        </p>
      )}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-brand-softpink/70 bg-white/50 px-6 py-12 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-softpink/40">
        <Sparkles className="h-6 w-6 text-brand-pink" />
      </span>
      <p className="font-bold text-brand-ink">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-brand-mute">{hint}</p>
    </div>
  )
}

export function ConfidenceDots({ level }: { level: 'low' | 'medium' | 'high' }) {
  const n = level === 'high' ? 3 : level === 'medium' ? 2 : 1
  const label = level === 'high' ? 'высокая уверенность' : level === 'medium' ? 'средняя уверенность' : 'низкая уверенность'
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn('h-1.5 w-1.5 rounded-full', i < n ? 'bg-brand-violet' : 'bg-brand-lav/40')}
        />
      ))}
    </span>
  )
}
