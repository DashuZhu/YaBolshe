import { useState } from 'react'
import { Link } from 'react-router'

export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Юридическая информация" className={`flex flex-wrap justify-center gap-x-4 gap-y-2 ${className}`}>
      <Link className="underline decoration-brand-pink/50 underline-offset-4 hover:text-brand-deep" to="/privacy">Политика конфиденциальности</Link>
      <Link className="underline decoration-brand-pink/50 underline-offset-4 hover:text-brand-deep" to="/consent">Согласие на обработку данных</Link>
      <Link className="underline decoration-brand-pink/50 underline-offset-4 hover:text-brand-deep" to="/terms">Пользовательское соглашение</Link>
    </nav>
  )
}

export function CookieNotice() {
  const [visible, setVisible] = useState(() => localStorage.getItem('technical-cookie-notice') !== 'seen')
  if (!visible) return null
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-3xl items-center gap-4 rounded-2xl border border-brand-softpink/60 bg-white/95 p-4 text-xs leading-relaxed text-brand-mute shadow-soft backdrop-blur">
      <p className="flex-1">Сайт использует только технические cookie, необходимые для безопасного входа и работы кабинета. Рекламных и аналитических cookie нет.{' '}
        <Link className="font-bold text-brand-deep underline underline-offset-4" to="/privacy">Подробнее</Link>
      </p>
      <button type="button" className="btn-soft shrink-0 rounded-xl px-4 py-2 font-bold text-brand-deep" onClick={() => {
        localStorage.setItem('technical-cookie-notice', 'seen')
        setVisible(false)
      }}>Понятно</button>
    </div>
  )
}
