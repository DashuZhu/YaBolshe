import { useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router'
import {
  UploadCloud, FileVideo, FileText, CheckCircle2, Loader2, ShieldCheck, AlertTriangle, X, ArrowLeft,
} from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard } from '@/components/brand'
import { trpc, useClients } from '@/lib/store'
import { friendlyApiError } from '@/lib/errors'

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024
const AUDIO_VIDEO_ACCEPT = '.mp3,.wav,.m4a,.aac,.flac,.opus,.ogg,.mp4,.mov,.mkv,.avi,.mpeg,.mpga,.webm,.3gp,.3g2,.ts,.mts,.m2ts,audio/*,video/*'
const ANY_ACCEPT = `${AUDIO_VIDEO_ACCEPT},.txt,text/plain`

type SpeakerHint = 'therapist' | 'client' | 'unknown'

function isTextFile(file: File) {
  return file.name.toLowerCase().endsWith('.txt')
}

function uploadFile(
  file: File,
  sessionId: number,
  speakerHint: SpeakerHint,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/upload?sessionId=${sessionId}`)
    xhr.withCredentials = true
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name))
    xhr.setRequestHeader('X-Speaker-Hint', speakerHint)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onerror = () => reject(new Error('Соединение прервалось во время загрузки'))
    xhr.onload = () => {
      let data: { error?: string } | null = null
      try {
        data = JSON.parse(xhr.responseText) as { error?: string }
      } catch {
        // A proxy can return a non-JSON error page.
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(data?.error ?? `Ошибка загрузки (${xhr.status || 'нет ответа сервера'})`))
    }
    xhr.send(file)
  })
}

// ============================================================
// Mode A: add one or several files (audio tracks of one conversation, or one
// ready-made text transcript) to a single named session of a known client.
// ============================================================

type Attachment = {
  file: File
  kind: 'audio_video' | 'text'
  speakerHint: SpeakerHint
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

function ClientSessionUpload({ clientId }: { clientId: string }) {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const clientsQ = useClients()
  const client = (clientsQ.data ?? []).find((c) => c.id === clientId)

  const [title, setTitle] = useState(`Сессия · ${new Date().toLocaleDateString('ru-RU')}`)
  const [consent, setConsent] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [error, setError] = useState('')

  const utils = trpc.useUtils()
  const createSessionMut = trpc.sessions.createForUpload.useMutation()
  const startProcessingMut = trpc.sessions.startProcessing.useMutation()

  const hasText = attachments.some((a) => a.kind === 'text')
  const hasAudio = attachments.some((a) => a.kind === 'audio_video')

  const updateAt = (index: number, patch: Partial<Attachment>) => {
    setAttachments((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const addFiles = (selected: FileList | null) => {
    const files = Array.from(selected ?? [])
    if (files.length === 0) return
    setError('')

    const tooLarge = files.filter((f) => f.size > MAX_UPLOAD_BYTES)
    const valid = files.filter((f) => f.size <= MAX_UPLOAD_BYTES)

    const incomingText = valid.filter(isTextFile)
    const incomingAudio = valid.filter((f) => !isTextFile(f))
    const willHaveAudio = hasAudio || incomingAudio.length > 0
    const willHaveText = hasText || incomingText.length > 0

    if (willHaveAudio && willHaveText) {
      setError('К одной сессии нельзя добавить одновременно аудио/видео и текстовую расшифровку — выберите что-то одно.')
      return
    }

    const prepared: Attachment[] = valid.map((file) => ({
      file,
      kind: isTextFile(file) ? 'text' : 'audio_video',
      speakerHint: 'unknown',
      progress: 0,
      status: 'pending',
    }))
    setAttachments((current) => [...current, ...prepared])
    if (tooLarge.length > 0) setError(`${tooLarge.length} файл(а) больше 500 МБ и не добавлены.`)
  }

  const removeAt = (index: number) => {
    setAttachments((current) => current.filter((_, i) => i !== index))
  }

  async function submit() {
    if (!consent || attachments.length === 0 || !title.trim()) return
    setPhase('uploading')
    setError('')

    try {
      let id = sessionId
      if (!id) {
        const created = await createSessionMut.mutateAsync({ clientId: Number(clientId), title: title.trim() })
        id = created.id
        setSessionId(id)
      }

      let failed = 0
      for (let index = 0; index < attachments.length; index += 1) {
        const item = attachments[index]
        if (item.status === 'done') continue
        updateAt(index, { status: 'uploading', error: undefined })
        try {
          await uploadFile(item.file, id, item.speakerHint, (progress) => updateAt(index, { progress }))
          updateAt(index, { status: 'done', progress: 100 })
        } catch (caught) {
          failed += 1
          updateAt(index, {
            status: 'error',
            error: caught instanceof Error ? caught.message : 'Не удалось загрузить файл',
          })
        }
      }

      if (failed > 0) {
        setError(`Не удалось загрузить ${failed} файл(а). Повторите загрузку неудавшихся файлов.`)
        setPhase('idle')
        return
      }

      await startProcessingMut.mutateAsync({ sessionId: id })
      void utils.sessions.list.invalidate()
      void utils.clients.list.invalidate()
      setPhase('done')
      navigate(`/t/sessions/${id}`)
    } catch (caught) {
      setError(caught instanceof Error ? friendlyApiError(caught.message) : 'Не удалось создать сессию')
      setPhase('idle')
    }
  }

  return (
    <AppShell role="therapist">
      <div className="mx-auto max-w-3xl">
        <Link to={`/t/clients/${clientId}`} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-mute hover:text-brand-deep">
          <ArrowLeft className="h-4 w-4" /> К карточке клиента
        </Link>
        <h1 className="text-3xl font-extrabold text-brand-deep">
          Новая сессия{client ? ` · ${client.name}` : ''}
        </h1>
        <p className="mt-1 text-brand-mute">
          Прикрепите одну или несколько дорожек одной записи (например, отдельные микрофоны терапевта и клиента) или один файл с готовой расшифровкой — всё это будет расшифровано как одна сессия.
        </p>

        <GlassCard deep className="mt-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название сессии, например «Сессия 2»"
            disabled={phase === 'uploading' || attachments.some((a) => a.status === 'done')}
            className="mb-4 w-full rounded-2xl border border-brand-softpink/60 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-brand-mute/60 focus:ring-2 focus:ring-brand-lav disabled:opacity-60"
          />

          <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-lav/10 p-4 text-xs leading-relaxed text-brand-ink">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-violet" />
            <span>Подтверждаю, что все участники записи согласились на её загрузку, расшифровку и создание черновых материалов в соответствии с <Link className="font-bold underline" to="/consent">Согласием на обработку данных</Link>.</span>
          </label>

          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ANY_ACCEPT}
            className="hidden"
            onChange={(event) => { addFiles(event.target.files); if (fileInput.current) fileInput.current.value = '' }}
          />
          <button
            type="button"
            disabled={phase === 'uploading' || !consent}
            onClick={() => { if (phase !== 'uploading' && consent) fileInput.current?.click() }}
            className="flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-brand-pink/50 bg-white/60 px-6 py-10 text-center transition-all hover:border-brand-pink hover:bg-brand-softpink/20 disabled:opacity-50"
          >
            <UploadCloud className="mb-3 h-10 w-10 text-brand-pink" />
            <p className="font-bold text-brand-ink">Добавить файл(ы) к этой сессии</p>
            <p className="mt-1 text-sm text-brand-mute">до 500 МБ каждый · аудио, видео или .txt с расшифровкой</p>
          </button>

          {attachments.length > 0 && (
            <div className="mt-5 space-y-3">
              {attachments.map((item, index) => (
                <div key={`${item.file.name}-${item.file.lastModified}-${index}`} className="rounded-2xl bg-white/70 p-4">
                  <div className="flex items-start gap-3">
                    {item.status === 'done' ? (
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                    ) : item.status === 'uploading' ? (
                      <Loader2 className="mt-1 h-5 w-5 shrink-0 animate-spin text-brand-violet" />
                    ) : item.status === 'error' ? (
                      <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-red-600" />
                    ) : item.kind === 'text' ? (
                      <FileText className="mt-1 h-5 w-5 shrink-0 text-brand-pink" />
                    ) : (
                      <FileVideo className="mt-1 h-5 w-5 shrink-0 text-brand-pink" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-brand-mute">{item.file.name} · {(item.file.size / 1024 / 1024).toFixed(1)} МБ</p>
                      {item.kind === 'audio_video' && item.status === 'pending' && (
                        <select
                          value={item.speakerHint}
                          onChange={(e) => updateAt(index, { speakerHint: e.target.value as SpeakerHint })}
                          className="mt-2 rounded-xl border border-brand-softpink/60 bg-white px-3 py-1.5 text-xs text-brand-ink outline-none focus:ring-2 focus:ring-brand-lav"
                        >
                          <option value="unknown">Дорожка: не указано</option>
                          <option value="therapist">Дорожка: терапевт</option>
                          <option value="client">Дорожка: клиент</option>
                        </select>
                      )}
                      {item.status === 'uploading' && <p className="mt-2 text-xs text-brand-mute">Загрузка: {item.progress}%</p>}
                      {item.error && <p className="mt-2 text-xs font-semibold text-red-700">{item.error}</p>}
                    </div>
                    {item.status === 'pending' && (
                      <button onClick={() => removeAt(index)} className="btn-soft rounded-lg p-1.5" aria-label="Убрать файл">
                        <X className="h-3.5 w-3.5 text-brand-mute" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-4 rounded-2xl bg-brand-danger/10 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

          {phase !== 'done' && (
            <button
              onClick={() => void submit()}
              disabled={!consent || attachments.length === 0 || !title.trim() || phase === 'uploading'}
              className="btn-3d mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-3.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {phase === 'uploading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {phase === 'uploading' ? 'Загружаем…' : 'Отправить на расшифровку'}
            </button>
          )}
        </GlassCard>
      </div>
    </AppShell>
  )
}

// ============================================================
// Mode B (default, no client pre-selected): quick bulk intake — every picked
// file becomes its own client + session, client name guessed from filename.
// ============================================================

type BulkRecording = {
  file: File
  clientName: string
  progress: number
  status: 'ready' | 'uploading' | 'processing' | 'error'
  error?: string
  clientId?: string
  sessionId?: number
}

function clientNameFromFile(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/\s*\(\d+\)$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizedName(name: string) {
  return name.toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ').trim()
}

function BulkUpload() {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [recordings, setRecordings] = useState<BulkRecording[]>([])
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [error, setError] = useState('')
  const [recordingConsent, setRecordingConsent] = useState(false)

  const createClientMut = trpc.clients.createManual.useMutation()
  const createSessionMut = trpc.sessions.createForUpload.useMutation()
  const startProcessingMut = trpc.sessions.startProcessing.useMutation()
  const utils = trpc.useUtils()

  const updateRecording = (index: number, patch: Partial<BulkRecording>) => {
    setRecordings((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  const chooseFiles = (selected: FileList | null) => {
    if (!recordingConsent) {
      setError('Сначала подтвердите согласие участников записи на обработку.')
      return
    }
    setError('')
    setPhase('idle')
    const files = Array.from(selected ?? [])
    const tooLarge = files.filter((file) => file.size > MAX_UPLOAD_BYTES)
    const valid = files.filter((file) => file.size <= MAX_UPLOAD_BYTES)
    const prepared: BulkRecording[] = valid.map((file) => ({
      file,
      clientName: clientNameFromFile(file.name),
      progress: 0,
      status: 'ready',
    }))
    setRecordings(prepared)
    if (tooLarge.length > 0) setError(`${tooLarge.length} файл(а) больше 500 МБ и не добавлены.`)
    if (prepared.length > 0) void start(prepared)
  }

  async function start(batch: BulkRecording[]) {
    if (batch.length === 0 || batch.some((item) => !item.clientName.trim())) return

    setPhase('uploading')
    const clientIds = new Map<string, string>()
    const completedSessionIds: number[] = []
    let failed = 0

    for (let index = 0; index < batch.length; index += 1) {
      const item = batch[index]
      if (item.status === 'processing') continue
      updateRecording(index, { status: 'uploading', error: undefined })

      try {
        const key = normalizedName(item.clientName)
        let clientId = item.clientId ?? clientIds.get(key)
        if (!clientId) {
          const client = await createClientMut.mutateAsync({ name: item.clientName, focus: '', aiConsent: true })
          clientId = client.id
          clientIds.set(key, client.id)
          updateRecording(index, { clientId })
        }

        let sessionId = item.sessionId
        if (!sessionId) {
          const session = await createSessionMut.mutateAsync({
            clientId: Number(clientId),
            title: batch.length > 1
              ? `Запись ${index + 1} · ${new Date().toLocaleDateString('ru-RU')}`
              : `Запись · ${new Date().toLocaleDateString('ru-RU')}`,
          })
          sessionId = session.id
          updateRecording(index, { sessionId })
        }

        await uploadFile(item.file, sessionId, 'unknown', (progress) => updateRecording(index, { progress }))
        await startProcessingMut.mutateAsync({ sessionId })
        updateRecording(index, { status: 'processing', progress: 100 })
        completedSessionIds.push(sessionId)
      } catch (caught) {
        failed += 1
        updateRecording(index, {
          status: 'error',
          error: caught instanceof Error ? caught.message : 'Не удалось загрузить файл',
        })
      }
    }

    void utils.clients.list.invalidate()
    void utils.clients.stats.invalidate()
    void utils.sessions.list.invalidate()
    setPhase('done')
    if (failed > 0) setError(`Не удалось загрузить ${failed} файл(а). Остальные записи отправлены на обработку.`)
    if (failed === 0 && completedSessionIds.length === 1) navigate(`/t/sessions/${completedSessionIds[0]}`)
  }

  return (
    <AppShell role="therapist">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold text-brand-deep">Загрузка записей</h1>
        <p className="mt-1 text-brand-mute">Выберите одну или несколько записей. Имя файла станет именем клиента автоматически.</p>
        <p className="mt-2 text-sm text-brand-mute">
          Чтобы прикрепить несколько дорожек или расшифровку к уже заведённому клиенту одной сессией — откройте карточку клиента и нажмите «Загрузить сессию».
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-brand-success/40 bg-brand-success/10 px-4 py-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <p className="text-sm text-emerald-900">
            Одинаковые имена файлов попадут в карточку одного клиента. Сама аудио/видеозапись удаляется сразу после обработки; текстовая расшифровка сохраняется и доступна вам на странице сессии.
          </p>
        </div>

        <GlassCard deep className="mt-6">
          <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-lav/10 p-4 text-xs leading-relaxed text-brand-ink">
            <input type="checkbox" checked={recordingConsent} onChange={(event) => setRecordingConsent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-violet" />
            <span>Подтверждаю, что все участники записи согласились на её загрузку, расшифровку и создание черновых материалов в соответствии с <Link className="font-bold underline" to="/consent">Согласием на обработку данных</Link>.</span>
          </label>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={AUDIO_VIDEO_ACCEPT}
            className="hidden"
            onChange={(event) => chooseFiles(event.target.files)}
          />
          <button
            type="button"
            disabled={phase === 'uploading' || !recordingConsent}
            onClick={() => {
              if (phase === 'uploading' || !recordingConsent || !fileInput.current) return
              fileInput.current.value = ''
              fileInput.current.click()
            }}
            className="flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-brand-pink/50 bg-white/60 px-6 py-10 text-center transition-all hover:border-brand-pink hover:bg-brand-softpink/20 disabled:opacity-50"
          >
            <UploadCloud className="mb-3 h-10 w-10 text-brand-pink" />
            <p className="font-bold text-brand-ink">Выбрать запись или несколько записей</p>
            <p className="mt-1 text-sm text-brand-mute">до 500 МБ каждая · аудио и видео</p>
          </button>

          {recordings.length > 0 && (
            <div className="mt-5 space-y-3">
              {recordings.map((item, index) => (
                <div key={`${item.file.name}-${item.file.lastModified}-${index}`} className="rounded-2xl bg-white/70 p-4">
                  <div className="flex items-start gap-3">
                    {item.status === 'processing' ? (
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                    ) : item.status === 'uploading' ? (
                      <Loader2 className="mt-1 h-5 w-5 shrink-0 animate-spin text-brand-violet" />
                    ) : item.status === 'error' ? (
                      <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-red-600" />
                    ) : (
                      <FileVideo className="mt-1 h-5 w-5 shrink-0 text-brand-pink" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-brand-mute">{item.file.name} · {(item.file.size / 1024 / 1024).toFixed(1)} МБ</p>
                      <p className="mt-2 text-sm font-bold text-brand-ink">Клиент: {item.clientName}</p>
                      {item.status === 'uploading' && <p className="mt-2 text-xs text-brand-mute">Загрузка: {item.progress}%</p>}
                      {item.status === 'processing' && <p className="mt-2 text-xs font-semibold text-emerald-700">Запись принята во временную обработку…</p>}
                      {item.error && <p className="mt-2 text-xs font-semibold text-red-700">{item.error}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-4 rounded-2xl bg-brand-danger/10 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

          {phase === 'uploading' && (
            <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-brand-deep">
              <Loader2 className="h-4 w-4 animate-spin" /> Записи загружаются автоматически…
            </p>
          )}
          {phase === 'done' && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={() => navigate('/t')} className="btn-3d rounded-2xl px-8 py-3.5 text-sm font-bold text-white">
                Смотреть обработку
              </button>
              <p className="text-xs text-brand-mute">Для повторной попытки выберите неудавшиеся файлы ещё раз.</p>
            </div>
          )}
        </GlassCard>
      </div>
    </AppShell>
  )
}

export default function Upload() {
  const [params] = useSearchParams()
  const clientId = params.get('client')
  return clientId ? <ClientSessionUpload clientId={clientId} /> : <BulkUpload />
}
