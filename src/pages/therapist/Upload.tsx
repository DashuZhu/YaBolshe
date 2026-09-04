import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { UploadCloud, FileVideo, CheckCircle2, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { AppShell } from '@/components/shell'
import { GlassCard } from '@/components/brand'
import { trpc } from '@/lib/store'
import { Link } from 'react-router'

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024

type Recording = {
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

function uploadRecording(file: File, sessionId: number, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/upload?sessionId=${sessionId}`)
    xhr.withCredentials = true
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name))
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

export default function Upload() {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [error, setError] = useState('')
  const [recordingConsent, setRecordingConsent] = useState(false)

  const createClientMut = trpc.clients.createManual.useMutation()
  const createSessionMut = trpc.sessions.createForUpload.useMutation()
  const utils = trpc.useUtils()

  const updateRecording = (index: number, patch: Partial<Recording>) => {
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
    const prepared: Recording[] = valid.map((file) => ({
      file,
      clientName: clientNameFromFile(file.name),
      progress: 0,
      status: 'ready',
    }))
    setRecordings(prepared)
    if (tooLarge.length > 0) setError(`${tooLarge.length} файл(а) больше 250 МБ и не добавлены.`)
    if (prepared.length > 0) void start(prepared)
  }

  async function start(batch: Recording[]) {
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

        await uploadRecording(item.file, sessionId, (progress) => updateRecording(index, { progress }))
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

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-brand-success/40 bg-brand-success/10 px-4 py-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <p className="text-sm text-emerald-900">
            Одинаковые имена файлов попадут в карточку одного клиента. Исходный файл удалится после успешной обработки.
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
            accept=".mp3,.wav,.m4a,.aac,.flac,.opus,.ogg,.mp4,.mov,.mkv,.avi,.mpeg,.mpga,.webm,.3gp,.3g2,.ts,.mts,.m2ts,audio/*,video/*"
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
            <p className="mt-1 text-sm text-brand-mute">до 250 МБ каждая · аудио и видео</p>
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
                      {item.status === 'processing' && <p className="mt-2 text-xs font-semibold text-emerald-700">Запись сохранена. Открываем живой экран обработки…</p>}
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
