import { Link } from 'react-router'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl btn-3d text-white transition-transform group-hover:scale-105">
        <Heart className="h-5 w-5 fill-white/90 text-white" />
      </span>
      {!compact && (
        <span className="text-xl font-extrabold tracking-tight text-brand-deep">
          Я&nbsp;Больше<span className="text-brand-pink">!</span>
        </span>
      )}
    </Link>
  )
}

export function Blobs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="blob blob-pink h-[480px] w-[480px] -top-32 -left-32 opacity-70" />
      <div className="blob blob-lav h-[520px] w-[520px] top-1/3 -right-40 opacity-60" />
      <div className="blob blob-cream h-[400px] w-[400px] -bottom-32 left-1/4 opacity-50" />
    </div>
  )
}

export function GlassCard({
  children,
  className,
  deep = false,
}: {
  children: ReactNode
  className?: string
  deep?: boolean
}) {
  return (
    <div className={cn('rounded-3xl p-6', deep ? 'glass-deep' : 'glass', className)}>
      {children}
    </div>
  )
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-brand-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-brand-mute">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Avatar({ initials, hue, size = 'md' }: { initials: string; hue: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-xl' }
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-2xl font-bold text-white shadow-soft',
        sizes[size],
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 75% 78%), hsl(${(hue + 40) % 360} 70% 68%))`,
        boxShadow: `inset 0 1.5px 0 rgba(255,255,255,.5), 0 8px 16px -8px hsl(${hue} 70% 60% / .5)`,
      }}
    >
      {initials}
    </span>
  )
}
