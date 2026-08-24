import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { UploadCloud, FileVideo, CheckCircle2, Loader2, ShieldCheck, Info, AlertTriangle } from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard } from '@/components/brand'
import { Pill } from '@/components/widgets'
import { trpc, useClients, useSession } from '@/lib/store'
import { sessionStatusMeta, type SessionStatus } from '@/lib/data'
import { cn } from '@/lib/utils'

const pipelineStages: SessionStatus[] = ['queued', 'transcribing', 'analyzing', 'draft_ready']
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024

export default function Upload() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const clientsQ = useClients()
  const clients = clientsQ.data ?? []

  const [clientId, setClientId] = useState(params.get('client') ?? '')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing' | 'error'>('idle')
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  // live status while processing
  const sessionQ = useSession(sessionId ?? 0)
  const liveSession = sessionId ? sessionQ.data : undefined

  const createMut = trpc.sessions.createForUpload.useMutation()

  const effectiveClientId = clientId || (clients[0]?.id ?? '')
  const client = clients.find((c) => c.id === effectiveClientId)
  const hasActiveClients = clients.some((c) => c.status === 'active')

  const chooseFile = (selected: File | null) => {
    setError('')
    if (!selected) {
      setFile(null)
      return
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setFile(null)
      setError('Файл больше 250 МБ. Сожмите видео или сохраните только аудиодорожку.')
      return
    }
    setFile(selected)
  }

  const start = async () => {
    if (!file || !effectiveClientId || phase === 'uploading') return
    setError('')
    setPhase('uploading')
    try {
      const { id } = await createMut.mutateAsync({
        clientId: Number(effectiveClientId),
        title: title.trim() || `Сессия · ${new Date().toLocaleDateString('ru-RU')}`,
      })
      setSessionId(id)

      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/upload?sessionId=${id}`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'Ошибка загрузки')
      }
      setPhase('processing')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить файл')
      setPhase('error')
    }
  }

  const currentStatus = liveSession?.status
  const done = currentStatus === 'draft_ready'
  const failed = currentStatus === 'failed' || currentStatus === 'requires_manual_fix'

  const stageState = (stage: SessionStatus) => {
    if (!currentStatus) return 'pending'
    const order = ['uploaded', 'queued', 'transcribing', 'analyzing', 'draft_ready']
    const cur = order.indexOf(currentStatus === 'failed' ? 'draft_ready' : currentStatus)
    const mine = order.indexOf(stage)
    if (done || failed) return mine <= 2 ? 'done' : done ? 'done' : 'pending'
    if (mine < cur) return 'done'
    if (mine === cur) return 'active'
    return 'pending'
  }

  return (
    <AppShell role="therapist">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold text-brand-deep">Загрузка сессии</h1>
        <p className="mt-1 text-brand-mute">
          Аудио или видео до 250 МБ. Расшифровка выполняется локально на защищённом сервере.
        </p>

        {clientsQ.data && !hasActiveClients && (
          <div className="mt-6 rounded-2xl border border-brand-pink/40 bg-brand-softpink/20 px-5 py-4">
            <p className="font-bold text-brand-deep">Сначала добавьте клиента</p>
            <p className="mt-1 text-sm text-brand-mute">
              Запись обязательно привязывается к клиенту и загружается только после его согласия на обработку.
            </p>
            <Link to="/t/clients" className="btn-3d mt-3 inline-flex rounded-xl px-5 py-2.5 text-sm font-bold text-white">
              Пригласить клиента
            </Link>
          </div>
        )}

        {/* Consent notice */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-brand-success/40 bg-brand-success/10 px-4 py-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <p className="text-sm text-emerald-900">
            {client
              ? <>Клиент <b>{client.name}</b> дал согласие на AI-обработку сессий при регистрации. Файл хранится в приватной директории сервера и недоступен извне.</>
              : 'Согласие клиента проверяется при загрузке. Файл хранится приватно на сервере.'}
          </p>
        </div>

        <GlassCard deep className="mt-6">
          {/* Client select */}
          <label className="mb-2 block text-sm font-bold text-brand-ink">Клиент</label>
          <select
            value={effectiveClientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={phase !== 'idle'}
            className="mb-4 w-full rounded-2xl border border-brand-softpink/60 bg-white/80 px-4 py-3 text-sm font-semibold text-brand-ink outline-none focus:ring-2 focus:ring-brand-lav"
          >
            {!hasActiveClients && <option value="">Нет активных клиентов</option>}
            {clients.filter((c) => c.status === 'active').map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.focus ? ` — ${c.focus}` : ''}</option>
            ))}
          </select>

          <label className="mb-2 block text-sm font-bold text-brand-ink">Название сессии</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={phase !== 'idle'}
            placeholder="Например: Сессия 25 · тема встречи"
            className="mb-5 w-full rounded-2xl border border-brand-softpink/60 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav"
          />

          {/* Dropzone */}
          <input
            ref={fileInput}
            type="file"
            accept=".mp3,.wav,.m4a,.aac,.flac,.opus,.ogg,.mp4,.mov,.mkv,.avi,.mpeg,.mpga,.webm,.3gp,.3g2,.ts,.mts,.m2ts,audio/*,video/*"
            className="hidden"
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={() => phase === 'idle' && fileInput.current?.click()}
            className={cn(
              'flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-all',
              file
                ? 'border-brand-success/60 bg-brand-success/10'
                : 'border-brand-pink/50 bg-white/60 hover:border-brand-pink hover:bg-brand-softpink/20',
            )}
          >
            {file ? (
              <>
                <FileVideo className="mb-3 h-10 w-10 text-emerald-600" />
                <p className="font-bold text-brand-ink">{file.name}</p>
                <p className="mt-1 text-sm text-brand-mute">{(file.size / 1024 / 1024).toFixed(1)} МБ</p>
              </>
            ) : (
              <>
                <UploadCloud className="mb-3 h-10 w-10 text-brand-pink" />
                <p className="font-bold text-brand-ink">Выберите файл записи сессии</p>
                <p className="mt-1 text-sm text-brand-mute">до 250 МБ · mp3, wav, m4a, mp4, mov, webm и другие</p>
              </>
            )}
          </button>

          {/* Pipeline stages */}
          {phase === 'processing' && (
            <div className="mt-6 space-y-2.5">
              {pipelineStages.map((st) => {
                const state = stageState(st)
                return (
                  <div
                    key={st}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 transition-all',
                      state === 'done' ? 'bg-brand-success/10' : state === 'active' ? 'bg-brand-lav/20' : 'bg-white/50 opacity-50',
                    )}
                  >
                    {state === 'done' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : state === 'active' ? (
                      <Loader2 className="h-5 w-5 animate-spin text-brand-violet" />
                    ) : (
                      <span className="h-5 w-5 rounded-full border-2 border-brand-lav/50" />
                    )}
                    <span className={cn('text-sm font-semibold', state !== 'pending' ? 'text-brand-ink' : 'text-brand-mute')}>
                      {sessionStatusMeta[st].label}
                    </span>
                    {state === 'active' && <span className="ml-auto text-xs text-brand-mute pulse-soft">обработка…</span>}
                    {state === 'done' && <Pill tone="success" className="ml-auto">готово</Pill>}
                  </div>
                )
              })}
              {failed && (
                <div className="flex items-start gap-2 rounded-2xl bg-brand-danger/10 px-4 py-3 text-sm text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Обработка не удалась: {liveSession?.processingError ?? 'неизвестная ошибка'}. Откройте сессию и нажмите «Повторить».</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-2xl bg-brand-danger/10 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {phase === 'idle' || phase === 'error' ? (
              !hasActiveClients ? (
                <Link to="/t/clients" className="btn-3d rounded-2xl px-8 py-3.5 text-sm font-bold text-white">
                  Сначала пригласить клиента
                </Link>
              ) : (
                <button
                  onClick={start}
                  disabled={!file || !effectiveClientId || createMut.isPending}
                  className={cn(
                    'btn-3d rounded-2xl px-8 py-3.5 text-sm font-bold text-white',
                    (!file || !effectiveClientId) && 'cursor-not-allowed opacity-50',
                  )}
                >
                  {createMut.isPending ? 'Подготовка…' : phase === 'error' ? 'Попробовать снова' : 'Загрузить и обработать'}
                </button>
              )
            ) : phase === 'uploading' ? (
              <span className="btn-3d flex items-center gap-2 rounded-2xl px-8 py-3.5 text-sm font-bold text-white opacity-70">
                <Loader2 className="h-4 w-4 animate-spin" /> Загружаем файл…
              </span>
            ) : done ? (
              <button
                onClick={() => navigate(`/t/sessions/${sessionId}`)}
                className="btn-3d rounded-2xl px-8 py-3.5 text-sm font-bold text-white"
              >
                Открыть черновик анализа
              </button>
            ) : failed ? (
              <button
                onClick={() => navigate(`/t/sessions/${sessionId}`)}
                className="btn-soft rounded-2xl px-8 py-3.5 text-sm font-bold text-brand-deep"
              >
                Открыть сессию
              </button>
            ) : (
              <span className="text-sm text-brand-mute">Идёт обработка — страницу можно не закрывать</span>
            )}
            <p className="flex items-center gap-1.5 text-xs text-brand-mute">
              <Info className="h-3.5 w-3.5" />
              Расшифровка: локальный Parakeet · резерв: Whisper Medium · решения принимаете вы
            </p>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  )
}
