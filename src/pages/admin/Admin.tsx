import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Users, Coins, Gauge, ScrollText, Server, AlertTriangle } from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard, SectionHeader } from '@/components/brand'
import { Pill } from '@/components/widgets'
import { trpc } from '@/lib/store'
import { cn } from '@/lib/utils'

const tabs = [
  { key: 'users', label: 'Пользователи', icon: Users },
  { key: 'usage', label: 'Token usage', icon: Coins },
  { key: 'quotas', label: 'Квоты', icon: Gauge },
  { key: 'audit', label: 'Аудит', icon: ScrollText },
  { key: 'system', label: 'Система', icon: Server },
] as const

export default function Admin() {
  const [tab, setTab] = useState<string>('users')
  const usersQ = trpc.admin.users.useQuery()
  const usageQ = trpc.admin.usage.useQuery()
  const auditQ = trpc.admin.audit.useQuery()
  const pingQ = trpc.ping.useQuery()

  const usage = usageQ.data

  return (
    <AppShell role="admin">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-brand-deep">Админ-панель</h1>
        <p className="mt-1 text-brand-mute">Пользователи, расходы на модели и журнал действий.</p>
      </div>

      <div className="mb-6 flex gap-1.5 overflow-x-auto rounded-2xl bg-white/70 p-1.5 shadow-soft">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-all',
              tab === key ? 'btn-3d text-white' : 'text-brand-mute hover:text-brand-deep',
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* Users */}
      {tab === 'users' && (
        <GlassCard>
          <SectionHeader title="Пользователи системы" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-brand-mute">
                  <th className="pb-3 pr-4 font-bold">Имя</th>
                  <th className="pb-3 pr-4 font-bold">Email</th>
                  <th className="pb-3 pr-4 font-bold">Роль</th>
                  <th className="pb-3 pr-4 font-bold">Клиенты</th>
                  <th className="pb-3 pr-4 font-bold">Сессий в месяц</th>
                  <th className="pb-3 font-bold">Статус</th>
                </tr>
              </thead>
              <tbody>
                {(usersQ.data ?? []).map((u) => (
                  <tr key={u.id} className="border-t border-brand-softpink/30">
                    <td className="py-3.5 pr-4 font-bold text-brand-ink">{u.name}</td>
                    <td className="py-3.5 pr-4 text-brand-mute">{u.email}</td>
                    <td className="py-3.5 pr-4 text-brand-mute">{u.role}</td>
                    <td className="py-3.5 pr-4 text-brand-mute">{u.clients}</td>
                    <td className="py-3.5 pr-4 text-brand-mute">{u.monthSessions}</td>
                    <td className="py-3.5">
                      {u.status === 'blocked' ? (
                        <Pill tone="danger"><AlertTriangle className="h-3.5 w-3.5" /> заблокирован</Pill>
                      ) : (
                        <Pill tone="success">активен</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Token usage */}
      {tab === 'usage' && (
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Токенов всего', value: usage ? `${(usage.totalTokens / 1000).toFixed(1)}k` : '…' },
              { label: 'Оценка стоимости', value: usage ? `$${usage.totalCost.toFixed(2)}` : '…' },
              { label: 'AI-режим', value: pingQ.data?.aiEnabled ? 'реальный' : 'mock (нет ключа)' },
            ].map((s) => (
              <GlassCard key={s.label} className="text-center">
                <p className="text-2xl font-extrabold text-brand-deep">{s.value}</p>
                <p className="mt-1 text-xs text-brand-mute">{s.label}</p>
              </GlassCard>
            ))}
          </div>
          <GlassCard>
            <SectionHeader title="Потребление токенов по дням" subtitle="все AI-вызовы логируются: модель, версия промпта, токены, стоимость" />
            {(usage?.series.length ?? 0) === 0 ? (
              <p className="text-sm text-brand-mute">Пока не было AI-вызовов — загрузите первую сессию.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={usage!.series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tok" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C9B8F3" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#F7C6D9" stopOpacity={0.15} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="#F2D7E4" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6F6A7A' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#6F6A7A' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid #F7C6D9' }} formatter={(v: number, name: string) => (name === 'tokens' ? [`${(v / 1000).toFixed(1)}k токенов`, 'Токены'] : [`$${v}`, 'Стоимость'])} />
                    <Area type="monotone" dataKey="tokens" stroke="#8B7CF6" strokeWidth={3} fill="url(#tok)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Quotas */}
      {tab === 'quotas' && (
        <GlassCard>
          <SectionHeader title="Лимиты и квоты" subtitle="значения по умолчанию из конфигурации" />
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { label: 'Активные клиенты на терапевта', value: '20', type: 'жёсткий лимит', hint: 'можно архивировать клиентов' },
              { label: 'Сессий в месяц', value: '80', type: 'мягкий лимит', hint: 'предупреждение при приближении' },
              { label: 'Размер файла загрузки', value: '250 МБ', type: 'локальный Whisper', hint: 'env: MAX_UPLOAD_MB' },
              { label: 'Часов медиа в месяц', value: '120 ч', type: 'мягкий лимит', hint: 'настраивается в профиле терапевта' },
              { label: 'Срок сессии входа', value: '14 дней', type: 'безопасность', hint: 'httpOnly cookie' },
              { label: 'Срок жизни приглашения', value: '30 дней', type: 'настраиваемый', hint: 'код одноразовый' },
            ].map((q) => (
              <div key={q.label} className="flex items-center justify-between gap-4 rounded-2xl bg-white/70 p-4">
                <div>
                  <p className="text-sm font-bold text-brand-ink">{q.label}</p>
                  <p className="text-xs text-brand-mute">{q.hint}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-brand-deep">{q.value}</p>
                  <Pill tone={q.type.includes('жёсткий') ? 'pink' : q.type.includes('мягкий') ? 'violet' : 'muted'}>{q.type}</Pill>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Audit */}
      {tab === 'audit' && (
        <GlassCard>
          <SectionHeader title="Журнал аудита" subtitle="входы, загрузки, подтверждения и отправки материалов" />
          {(auditQ.data ?? []).length === 0 ? (
            <p className="text-sm text-brand-mute">Журнал пока пуст.</p>
          ) : (
            <ul className="space-y-2.5">
              {(auditQ.data ?? []).map((a, i) => (
                <li key={i} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 text-sm">
                  <span className="w-32 shrink-0 text-xs text-brand-mute">{a.time}</span>
                  <span className="font-bold text-brand-ink">{a.actor}</span>
                  <code className="rounded-lg bg-brand-lav/20 px-2 py-0.5 text-xs font-semibold text-brand-deep">{a.action}</code>
                  <span className="text-xs text-brand-mute">{a.entity} {a.meta && `· ${a.meta}`}</span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      )}

      {/* System */}
      {tab === 'system' && (
        <GlassCard>
          <SectionHeader title="Состояние системы" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/70 p-5">
              <p className="text-sm font-bold text-brand-ink">Сервер API</p>
              <p className="mt-1 text-xs text-brand-mute">{pingQ.data ? 'работает' : 'нет связи'}</p>
              <Pill tone={pingQ.data ? 'success' : 'danger'} className="mt-2">{pingQ.data ? 'online' : 'offline'}</Pill>
            </div>
            <div className="rounded-2xl bg-white/70 p-5">
              <p className="text-sm font-bold text-brand-ink">Расшифровка</p>
              <p className="mt-1 text-xs text-brand-mute">
                {pingQ.data?.transcriptionMode === 'local'
                  ? 'Локальный Whisper Medium — аудио не уходит во внешний API'
                  : pingQ.data?.transcriptionMode === 'openai'
                    ? 'Расшифровка через OpenAI API'
                    : 'Демо-расшифровка'}
              </p>
              <Pill tone={pingQ.data?.transcriptionEnabled ? 'success' : 'warning'} className="mt-2">
                {pingQ.data?.transcriptionEnabled ? 'реальный режим' : 'mock mode'}
              </Pill>
            </div>
            <div className="rounded-2xl bg-white/70 p-5">
              <p className="text-sm font-bold text-brand-ink">Анализ текста</p>
              <p className="mt-1 text-xs text-brand-mute">
                {pingQ.data?.aiEnabled ? 'OPENAI_API_KEY задан — GPT-анализ включён' : 'Ключ не задан — анализ в демо-режиме'}
              </p>
              <Pill tone={pingQ.data?.aiEnabled ? 'success' : 'warning'} className="mt-2">
                {pingQ.data?.aiEnabled ? 'GPT включён' : 'демо-анализ'}
              </Pill>
            </div>
          </div>
        </GlassCard>
      )}
    </AppShell>
  )
}
