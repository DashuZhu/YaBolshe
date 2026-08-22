// ============================================================
// «Я Больше!» — demo data layer (fully synthetic, no real PHI)
// ============================================================

export type Role = 'therapist' | 'client' | 'admin'

export type SessionStatus =
  | 'uploaded'
  | 'queued'
  | 'extracting_audio'
  | 'transcribing'
  | 'diarizing'
  | 'analyzing'
  | 'draft_ready'
  | 'therapist_review'
  | 'approved'
  | 'sent_to_client'
  | 'failed'
  | 'requires_manual_fix'

export type Confidence = 'low' | 'medium' | 'high'
export type RiskSeverity = 'low' | 'medium' | 'high'

export interface Client {
  id: string
  name: string
  initials: string
  age: number
  status: 'active' | 'archived'
  since: string
  lastSession: string
  sessionsCount: number
  focus: string
  nextSession?: string
  dynamics: 'up' | 'stable' | 'attention'
  riskFlag?: { severity: RiskSeverity; label: string }
  pendingApprovals: number
  homeworkActive: number
  avatarHue: number
}

export interface TranscriptSegment {
  id: string
  start: string
  end: string
  speaker: 'therapist' | 'client' | 'unknown'
  text: string
  confidence: number
}

export interface AnalysisInsight {
  id: string
  title: string
  description: string
  clientAction: 'explore' | 'practice' | 'experiment' | 'discuss' | 'integrate'
  confidence: Confidence
  evidence: string[]
  approved: boolean
}

export interface AnalysisTheme {
  id: string
  title: string
  description: string
  confidence: Confidence
  evidence: string[]
  approved: boolean
}

export interface Homework {
  id: string
  clientId: string
  title: string
  description: string
  purpose: string
  frequency: string
  dueDate: string
  status: 'assigned' | 'in_progress' | 'done' | 'skipped' | 'cancelled'
  approved: boolean
  reflection?: string
  insightTitle?: string
}

export interface Agreement {
  id: string
  clientId: string
  text: string
  type: 'installation' | 'agreement' | 'rule' | 'intention' | 'experiment'
  status: 'active' | 'review' | 'completed'
  reviewDate: string
  approved: boolean
}

export interface Session {
  id: string
  clientId: string
  title: string
  date: string
  durationMin: number
  status: SessionStatus
  hasMedia: boolean
  summaryShort: string
  clientFriendlySummary: string
  emotions: { label: string; intensity: 'low' | 'medium' | 'high'; context: string }[]
  needs: { label: string; description: string }[]
  patterns: { id: string; title: string; description: string; confidence: Confidence; evidence: string[] }[]
  riskFlags: { type: string; severity: RiskSeverity; evidence: string[]; recommendedAction: string }[]
  dynamics: {
    summary: string
    improved: string[]
    stable: string[]
    newTopics: string[]
  }
  therapistQuestions: string[]
  uncertainties: string[]
  transcript: TranscriptSegment[]
  themes: AnalysisTheme[]
  insights: AnalysisInsight[]
  model: string
  tokens: { input: number; output: number }
  approvedAt?: string
  sentAt?: string
}

export interface RoadmapGoal {
  goal: string
  progress: number // 0..100
  note: string
}

export interface Roadmap {
  clientId: string
  currentFocus: string
  goals: RoadmapGoal[]
  stages: { title: string; status: 'done' | 'current' | 'next' }[]
  resources: string[]
  obstacles: string[]
  nextSteps: string[]
  experiments: string[]
  reviewDate: string
  version: number
  draftPending: boolean
}

export interface CheckInPoint {
  date: string
  mood: number // 1..10
  energy: number
  anxiety: number
}

export interface TherapistNote {
  id: string
  clientId: string
  text: string
  tags: string[]
  useAsAiContext: boolean
  createdAt: string
}

// ------------------------------ therapist ------------------------------

export const therapist = {
  name: 'Анна Соколова',
  title: 'Гештальт-терапевт, супервизор',
  initials: 'АС',
  activeClients: 14,
  maxClients: 20,
  monthSessions: 47,
  monthSessionsLimit: 80,
  monthHours: 58.5,
  monthHoursLimit: 120,
}

export const clients: Client[] = [
  {
    id: 'cl-1', name: 'Мария Л.', initials: 'МЛ', age: 32, status: 'active', since: 'январь 2026',
    lastSession: '18 июля', sessionsCount: 24, focus: 'Границы в близких отношениях',
    nextSession: '25 июля, 11:00', dynamics: 'up', pendingApprovals: 3, homeworkActive: 2, avatarHue: 330,
  },
  {
    id: 'cl-2', name: 'Дмитрий К.', initials: 'ДК', age: 41, status: 'active', since: 'март 2026',
    lastSession: '17 июля', sessionsCount: 12, focus: 'Проживание злости и самоподдержка',
    nextSession: '24 июля, 18:30', dynamics: 'stable', pendingApprovals: 1, homeworkActive: 1, avatarHue: 265,
  },
  {
    id: 'cl-3', name: 'Ольга Р.', initials: 'ОР', age: 28, status: 'active', since: 'май 2026',
    lastSession: '15 июля', sessionsCount: 8, focus: 'Тревога перед переменами',
    dynamics: 'attention', riskFlag: { severity: 'medium', label: 'Тяжёлый дистресс — проверить' },
    pendingApprovals: 2, homeworkActive: 3, avatarHue: 300,
  },
  {
    id: 'cl-4', name: 'Игорь В.', initials: 'ИВ', age: 36, status: 'active', since: 'ноябрь 2025',
    lastSession: '12 июля', sessionsCount: 31, focus: 'Завершение незавершённых ситуаций',
    dynamics: 'up', pendingApprovals: 0, homeworkActive: 1, avatarHue: 210,
  },
  {
    id: 'cl-5', name: 'Светлана Н.', initials: 'СН', age: 45, status: 'active', since: 'февраль 2026',
    lastSession: '10 июля', sessionsCount: 15, focus: 'Опора на себя после развода',
    nextSession: '28 июля, 10:00', dynamics: 'stable', pendingApprovals: 1, homeworkActive: 2, avatarHue: 20,
  },
  {
    id: 'cl-6', name: 'Артём П.', initials: 'АП', age: 25, status: 'archived', since: 'июнь 2025',
    lastSession: '3 апреля', sessionsCount: 19, focus: 'Сепарация от родительской семьи',
    dynamics: 'stable', pendingApprovals: 0, homeworkActive: 0, avatarHue: 160,
  },
]

// ------------------------------ sessions ------------------------------

const demoTranscript: TranscriptSegment[] = [
  { id: 'seg-1', start: '00:00:12', end: '00:00:48', speaker: 'therapist', text: 'Здравствуйте, Мария. Как вы сегодня? С чего бы вам хотелось начать нашу встречу?', confidence: 0.98 },
  { id: 'seg-2', start: '00:00:49', end: '00:01:37', speaker: 'client', text: 'Здравствуйте. Я всю неделю думала о том разговоре с мамой. Я заметила, что снова согласилась приехать, хотя внутри всё сопротивлялось. И потом злилась на себя.', confidence: 0.97 },
  { id: 'seg-3', start: '00:01:38', end: '00:02:10', speaker: 'therapist', text: 'Останемся здесь на минуту. Когда вы сейчас говорите «внутри всё сопротивлялось» — что вы замечаете в теле прямо сейчас?', confidence: 0.99 },
  { id: 'seg-4', start: '00:02:11', end: '00:03:02', speaker: 'client', text: 'Сжались плечи… и живот как будто стянуло. Интересно, я этого раньше не замечала. Как будто тело знало «нет» раньше, чем я.', confidence: 0.96 },
  { id: 'seg-5', start: '00:03:03', end: '00:03:41', speaker: 'therapist', text: 'Красиво сказано — «тело знало раньше, чем я». Что если попробовать дать этому сжатию голос? Что бы оно сказало маме?', confidence: 0.98 },
  { id: 'seg-6', start: '00:03:42', end: '00:04:50', speaker: 'client', text: 'Оно бы сказало… «Я устала быть удобной. Я хочу выбирать сама». Мне страшно это говорить вслух, но стало легче дышать.', confidence: 0.97 },
  { id: 'seg-7', start: '00:47:20', end: '00:48:15', speaker: 'therapist', text: 'Мы подходим к завершению. Что вы забираете с собой из сегодняшней встречи?', confidence: 0.98 },
  { id: 'seg-8', start: '00:48:16', end: '00:49:30', speaker: 'client', text: 'Что моё «нет» живёт в теле и я могу его замечать. Я хочу попробовать на этой неделе один раз сказать «нет» в маленькой ситуации — и просто понаблюдать, что будет.', confidence: 0.97 },
]

export const sessions: Session[] = [
  {
    id: 'ses-1',
    clientId: 'cl-1',
    title: 'Сессия 24 · Границы с мамой',
    date: '18 июля 2026',
    durationMin: 55,
    status: 'therapist_review',
    hasMedia: true,
    summaryShort:
      'Клиентка исследовала автоматическое согласие в контакте с мамой; ключевая фигура — телесное «нет», которое предшествует осознанному решению.',
    clientFriendlySummary:
      'На этой встрече вы заметили важное: ваше тело часто знает ответ раньше, чем мысли. Сжатые плечи и стянутый живот — это способ, которым ваше «нет» проявляет себя. Вы попробовали дать этому ощущению голос, и от этого стало легче дышать. Это большой шаг: вы начинаете слышать себя.',
    emotions: [
      { label: 'Злость на себя', intensity: 'medium', context: 'После автоматического согласия приехать к маме' },
      { label: 'Страх', intensity: 'medium', context: 'При мысли сказать маме «нет» вслух' },
      { label: 'Облегчение', intensity: 'high', context: 'После проговаривания «я устала быть удобной»' },
      { label: 'Любопытство', intensity: 'medium', context: 'К телесным сигналам как к ресурсу' },
    ],
    needs: [
      { label: 'Право на выбор', description: 'Потребность выбирать самой, без чувства вины' },
      { label: 'Безопасность в контакте', description: 'Оставаться в отношениях, не теряя себя' },
      { label: 'Признание чувств', description: 'Чтобы злость и усталость имели место' },
    ],
    patterns: [
      { id: 'pat-1', title: 'Автоматическое согласие', description: 'Быстрое «да» в ответ на запрос значимого другого, с последующей злостью на себя', confidence: 'high', evidence: ['seg-2'] },
      { id: 'pat-2', title: 'Телесное опережение решения', description: 'Тело реагирует «нет» раньше, чем решение осознаётся', confidence: 'high', evidence: ['seg-4'] },
      { id: 'pat-3', title: 'Дефлексия через самокритику', description: 'Злость на другого разворачивается на себя («злилась на себя»)', confidence: 'medium', evidence: ['seg-2'] },
    ],
    riskFlags: [],
    dynamics: {
      summary: 'По сравнению с предыдущими сессиями заметно выросло осознавание телесных сигналов; тема границ впервые прожита не только в мыслях, но и в теле.',
      improved: ['Осознавание телесных реакций', 'Доступ к злости как к информации'],
      stable: ['Тема отношений с мамой', 'Запрос на самоподдержку'],
      newTopics: ['Тело как источник ответа', 'Эксперимент с маленьким «нет»'],
    },
    therapistQuestions: [
      'Что происходит с чувством вины в момент, когда возникает импульс отказать?',
      'Какие воспоминания детства подпитывают убеждение «быть удобной = быть любимой»?',
      'Как клиентка распознаёт разницу между «хочу» и «должна» в моменте?',
    ],
    uncertainties: [
      'Фраза «я всегда была удобной дочерью» прозвучала однажды — недостаточно данных для устойчивого вывода о ранней истории.',
      'Реакция мамы на реальный отказ пока неизвестна; прогнозировать динамику отношений рано.',
    ],
    transcript: demoTranscript,
    themes: [
      { id: 'th-1', title: 'Границы с мамой', description: 'Автоматическое согласие, чувство вины, страх отказа', confidence: 'high', evidence: ['seg-2', 'seg-6'], approved: false },
      { id: 'th-2', title: 'Тело как ресурс', description: 'Телесные сигналы как ранний индикатор истинного ответа', confidence: 'high', evidence: ['seg-3', 'seg-4'], approved: false },
      { id: 'th-3', title: 'Право быть неудобной', description: 'Проживание и проговаривание «я устала быть удобной»', confidence: 'medium', evidence: ['seg-6'], approved: false },
    ],
    insights: [
      { id: 'ins-1', title: 'Моё тело знает ответ раньше меня', description: 'Сжатые плечи и стянутый живот появляются до того, как я решаю согласиться. Это моё «нет», которое уже есть.', clientAction: 'explore', confidence: 'high', evidence: ['seg-4'], approved: false },
      { id: 'ins-2', title: 'Когда я говорю правду, мне легче дышать', description: 'Проговорив «я устала быть удобной», я почувствовала облегчение, хотя было страшно.', clientAction: 'integrate', confidence: 'high', evidence: ['seg-6'], approved: false },
      { id: 'ins-3', title: 'Злость на себя — это развёрнутая злость на ситуацию', description: 'Когда я соглашаюсь против желания, злость остаётся и направляется на меня.', clientAction: 'discuss', confidence: 'medium', evidence: ['seg-2'], approved: false },
    ],
    model: 'gpt-6-terra (mock)',
    tokens: { input: 18420, output: 3105 },
  },
  {
    id: 'ses-2',
    clientId: 'cl-1',
    title: 'Сессия 23 · Чувство вины',
    date: '11 июля 2026',
    durationMin: 50,
    status: 'sent_to_client',
    hasMedia: true,
    summaryShort: 'Работа с чувством вины как ретрофлексией; первые формулировки личных границ.',
    clientFriendlySummary: 'Вы исследовали, как чувство вины появляется, когда вы думаете о своих желаниях. Оказалось, что за виной часто стоит старая договорённость с собой: «сначала другие, потом я». Вы начали пробовать новую формулу: «мои желания тоже важны».',
    emotions: [
      { label: 'Вина', intensity: 'high', context: 'При мысли о собственных желаниях' },
      { label: 'Нежность к себе', intensity: 'low', context: 'В конце сессии, впервые за несколько встреч' },
    ],
    needs: [{ label: 'Разрешение хотеть', description: 'Внутреннее разрешение иметь желания' }],
    patterns: [
      { id: 'pat-4', title: 'Интроджект «сначала другие»', description: 'Проглоченное правило ставить чужие нужды выше своих', confidence: 'high', evidence: ['seg-x1'] },
    ],
    riskFlags: [],
    dynamics: {
      summary: 'Тема вины устойчива, но появилась первая контрформула.',
      improved: ['Формулирование границ словами'],
      stable: ['Вина при контакте с желаниями'],
      newTopics: ['Нежность к себе'],
    },
    therapistQuestions: ['Чьим голосом звучит «сначала другие»?'],
    uncertainties: [],
    transcript: [
      { id: 'seg-x1', start: '00:10:02', end: '00:11:20', speaker: 'client', text: 'Как только я думаю о себе, сразу появляется это чувство… как будто я что-то украла.', confidence: 0.96 },
      { id: 'seg-x2', start: '00:32:40', end: '00:33:15', speaker: 'therapist', text: 'Побудьте с этой фразой. «Как будто я что-то украла». У кого, как вам кажется, вы это украли?', confidence: 0.98 },
    ],
    themes: [
      { id: 'th-4', title: 'Чувство вины', description: 'Вина как ретрофлексия потребности в заботе о себе', confidence: 'high', evidence: ['seg-x1'], approved: true },
    ],
    insights: [
      { id: 'ins-4', title: 'Вина появляется там, где моё желание', description: 'Я чувствую вину не потому, что делаю что-то плохое, а потому что осмеливаюсь хотеть.', clientAction: 'explore', confidence: 'high', evidence: ['seg-x1'], approved: true },
    ],
    model: 'gpt-6-terra (mock)',
    tokens: { input: 16980, output: 2740 },
    approvedAt: '12 июля, 09:14',
    sentAt: '12 июля, 09:20',
  },
  {
    id: 'ses-3',
    clientId: 'cl-3',
    title: 'Сессия 8 · Паника перед переездом',
    date: '15 июля 2026',
    durationMin: 60,
    status: 'draft_ready',
    hasMedia: true,
    summaryShort: 'Сильная тревога перед переездом; зафиксированы признаки тяжёлого дистресса, требуется внимание терапевта.',
    clientFriendlySummary: '',
    emotions: [
      { label: 'Тревога', intensity: 'high', context: 'Предстоящий переезд в другой город' },
      { label: 'Беспомощность', intensity: 'medium', context: '«Я не справлюсь одна»' },
    ],
    needs: [{ label: 'Опора', description: 'Потребность в поддержке при больших переменах' }],
    patterns: [
      { id: 'pat-5', title: 'Катастрофизация будущего', description: 'Сценарии будущего преимущественно в ключе провала', confidence: 'medium', evidence: ['seg-y1'] },
    ],
    riskFlags: [
      { type: 'severe_distress', severity: 'medium', evidence: ['seg-y2'], recommendedAction: 'Обсудить на ближайшей сессии; уточнить уровень напряжения и опоры клиентки. Не является диагнозом.' },
    ],
    dynamics: {
      summary: 'Тревога усилилась относительно сессий 6–7.',
      improved: [],
      stable: ['Тема контроля'],
      newTopics: ['Переезд', 'Страх одиночества'],
    },
    therapistQuestions: ['Какие реальные опоры уже есть в новом городе?', 'Что самое страшное в фантазии «не справлюсь»?'],
    uncertainties: ['Уровень дистресса оценён по вербальным маркерам; требуется живая оценка терапевта.'],
    transcript: [
      { id: 'seg-y1', start: '00:05:10', end: '00:06:00', speaker: 'client', text: 'Я уже вижу, как всё пойдёт не так. Я не найду работу, не найду друзей, и буду сидеть одна в пустой квартире.', confidence: 0.95 },
      { id: 'seg-y2', start: '00:21:44', end: '00:22:30', speaker: 'client', text: 'Последнюю неделю я почти не сплю. Просыпаюсь в четыре утра, и сердце колотится. Я не знаю, сколько так можно.', confidence: 0.94 },
    ],
    themes: [
      { id: 'th-5', title: 'Тревога перед переменами', description: 'Катастрофические сценарии переезда', confidence: 'medium', evidence: ['seg-y1'], approved: false },
    ],
    insights: [
      { id: 'ins-5', title: 'За тревогой — потребность в опоре', description: 'Когда я представляю, что рядом есть люди, тревога заметно снижается.', clientAction: 'discuss', confidence: 'medium', evidence: ['seg-y1'], approved: false },
    ],
    model: 'gpt-6-terra (mock)',
    tokens: { input: 20150, output: 3390 },
  },
  {
    id: 'ses-4',
    clientId: 'cl-2',
    title: 'Сессия 12 · Злость как энергия',
    date: '17 июля 2026',
    durationMin: 50,
    status: 'approved',
    hasMedia: false,
    summaryShort: 'Ручная сессия без записи. Работа с проживанием злости через телесный эксперимент.',
    clientFriendlySummary: '',
    emotions: [{ label: 'Злость', intensity: 'high', context: 'Ситуация на работе' }],
    needs: [{ label: 'Уважение', description: 'Потребность в признании вклада' }],
    patterns: [],
    riskFlags: [],
    dynamics: { summary: 'Клиент впервые прожил злость в сессии без избегания.', improved: ['Доступ к злости'], stable: ['Тема работы'], newTopics: [] },
    therapistQuestions: [],
    uncertainties: [],
    transcript: [],
    themes: [],
    insights: [],
    model: '—',
    tokens: { input: 0, output: 0 },
    approvedAt: '17 июля, 20:02',
  },
]

// ------------------------------ homework ------------------------------

export const homeworkList: Homework[] = [
  {
    id: 'hw-1', clientId: 'cl-1',
    title: 'Маленькое «нет»',
    description: 'Один раз на этой неделе сказать «нет» в небольшой, безопасной ситуации — и понаблюдать, что происходит в теле и в мыслях.',
    purpose: 'Закрепить опыт сессии: тело знает ответ; отказ в малом — тренировка границы.',
    frequency: '1 раз за неделю', dueDate: '25 июля',
    status: 'in_progress', approved: true, insightTitle: 'Моё тело знает ответ раньше меня',
  },
  {
    id: 'hw-2', clientId: 'cl-1',
    title: 'Дневник телесных сигналов',
    description: '2–3 раза в день коротко отмечать: что я сейчас чувствую в теле? Где напряжение? О чём оно может говорить?',
    purpose: 'Развивать осознавание телесных реакций как источника информации о себе.',
    frequency: '2–3 раза в день', dueDate: '1 августа',
    status: 'assigned', approved: true, insightTitle: 'Моё тело знает ответ раньше меня',
  },
  {
    id: 'hw-3', clientId: 'cl-1',
    title: 'Письмо злости (не отправлять)',
    description: 'Написать письмо ситуации или человеку, на которого есть злость. Не отправлять. После — отметить, что изменилось в состоянии.',
    purpose: 'Дать злости безопасный выход и исследовать, что за ней стоит.',
    frequency: 'по желанию', dueDate: 'без срока',
    status: 'done', approved: true,
    reflection: 'Стало спокойнее. Поняла, что за злостью — усталость и желание, чтобы меня услышали.',
  },
]

export const agreements: Agreement[] = [
  {
    id: 'ag-1', clientId: 'cl-1',
    text: 'Я имею право сказать «нет», даже если это неудобно другим.',
    type: 'installation', status: 'active', reviewDate: '15 августа', approved: true,
  },
  {
    id: 'ag-2', clientId: 'cl-1',
    text: 'Перед автоматическим «да» — пауза и вопрос себе: «Я правда этого хочу?»',
    type: 'agreement', status: 'active', reviewDate: '8 августа', approved: true,
  },
  {
    id: 'ag-3', clientId: 'cl-1',
    text: 'Эксперимент: неделя честных ответов на «как дела?» — хотя бы с одним близким человеком.',
    type: 'experiment', status: 'review', reviewDate: '25 июля', approved: true,
  },
]

// ------------------------------ roadmap ------------------------------

export const roadmaps: Roadmap[] = [
  {
    clientId: 'cl-1',
    currentFocus: 'Границы в близких отношениях: замечать автоматическое «да» и возвращать себе право выбора.',
    goals: [
      { goal: 'Замечать автоматическое согласие в моменте', progress: 70, note: 'Клиентка устойчиво распознаёт паттерн после факта; начинает замечать в моменте.' },
      { goal: 'Опираться на телесные сигналы', progress: 45, note: 'Новый навык, хорошая динамика после сессии 24.' },
      { goal: 'Говорить «нет» в безопасных ситуациях', progress: 30, note: 'Первый эксперимент назначен на эту неделю.' },
      { goal: 'Снизить интенсивность чувства вины', progress: 35, note: 'Вина устойчива, но появилась контрформула.' },
    ],
    stages: [
      { title: 'Запрос и первичная карта тем', status: 'done' },
      { title: 'Осознавание паттернов контакта', status: 'done' },
      { title: 'Границы: от осознания к действию', status: 'current' },
      { title: 'Интеграция и самоподдержка', status: 'next' },
    ],
    resources: ['Хорошая рефлексия', 'Поддерживающие отношения с подругой', 'Телесная чувствительность'],
    obstacles: ['Интроджект «быть удобной»', 'Страх потерять контакт с мамой'],
    nextSteps: ['Эксперимент «маленькое нет»', 'Дневник телесных сигналов', 'Обсудить реакцию мамы на отказ'],
    experiments: ['Маленькое «нет»', 'Неделя честных ответов'],
    reviewDate: '15 августа 2026',
    version: 7,
    draftPending: true,
  },
]

// ------------------------------ check-ins ------------------------------

export const checkIns: CheckInPoint[] = [
  { date: '28 июн', mood: 5, energy: 4, anxiety: 7 },
  { date: '30 июн', mood: 6, energy: 5, anxiety: 6 },
  { date: '2 июл', mood: 5, energy: 5, anxiety: 6 },
  { date: '5 июл', mood: 6, energy: 6, anxiety: 5 },
  { date: '8 июл', mood: 7, energy: 6, anxiety: 5 },
  { date: '11 июл', mood: 6, energy: 5, anxiety: 6 },
  { date: '14 июл', mood: 7, energy: 7, anxiety: 4 },
  { date: '17 июл', mood: 8, energy: 7, anxiety: 4 },
  { date: '19 июл', mood: 8, energy: 8, anxiety: 3 },
]

// ------------------------------ notes ------------------------------

export const therapistNotes: TherapistNote[] = [
  {
    id: 'nt-1', clientId: 'cl-1',
    text: 'Обратить внимание: клиентка улыбается, когда говорит о злости. Возможная дефлексия — исследовать бережно, не в лоб.',
    tags: ['дефлексия', 'наблюдение'], useAsAiContext: false, createdAt: '18 июля, 21:40',
  },
  {
    id: 'nt-2', clientId: 'cl-1',
    text: 'К сессии 25: спросить про эксперимент «маленькое нет». Если получилось — отпраздновать, это важно для ассимиляции.',
    tags: ['план', 'эксперимент'], useAsAiContext: true, createdAt: '19 июля, 09:12',
  },
]

// ------------------------------ client view ------------------------------

export const clientUser = {
  name: 'Мария',
  therapistName: 'Анной Соколовой',
  sessionsCount: 24,
  nextSession: '25 июля, 11:00',
  insightsNew: 2,
}

// ------------------------------ admin ------------------------------

export const tokenUsageSeries = [
  { day: '1 июл', tokens: 182000, cost: 21.4 },
  { day: '4 июл', tokens: 246000, cost: 28.9 },
  { day: '7 июл', tokens: 198000, cost: 23.3 },
  { day: '10 июл', tokens: 312000, cost: 36.7 },
  { day: '13 июл', tokens: 275000, cost: 32.3 },
  { day: '16 июл', tokens: 341000, cost: 40.1 },
  { day: '19 июл', tokens: 289000, cost: 34.0 },
  { day: '22 июл', tokens: 158000, cost: 18.6 },
]

export const adminUsers = [
  { id: 'u-1', name: 'Анна Соколова', role: 'Терапевт', clients: '14 / 20', monthSessions: 47, status: 'active' },
  { id: 'u-2', name: 'Павел Гринёв', role: 'Терапевт', clients: '11 / 20', monthSessions: 39, status: 'active' },
  { id: 'u-3', name: 'Елена Мирова', role: 'Терапевт', clients: '19 / 20', monthSessions: 74, status: 'limit-warning' },
  { id: 'u-4', name: 'Мария Л.', role: 'Клиент', clients: '—', monthSessions: 4, status: 'active' },
  { id: 'u-5', name: 'Дмитрий К.', role: 'Клиент', clients: '—', monthSessions: 4, status: 'active' },
]

export const auditLog = [
  { time: '22 июля, 14:02', actor: 'Анна Соколова', action: 'session.upload', entity: 'ses-1', meta: 'video/mp4, 55 мин, 1.2 GB' },
  { time: '22 июля, 14:19', actor: 'system', action: 'ai.analysis_complete', entity: 'ses-1', meta: 'gpt-6-terra (mock), 21 525 tokens' },
  { time: '22 июля, 11:47', actor: 'Анна Соколова', action: 'material.approve', entity: 'ins-4', meta: 'insight → approved' },
  { time: '22 июля, 11:48', actor: 'Анна Соколова', action: 'material.send_to_client', entity: 'ses-2', meta: 'summary + 1 insight' },
  { time: '21 июля, 19:20', actor: 'Мария Л.', action: 'homework.complete', entity: 'hw-3', meta: 'reflection added' },
  { time: '21 июля, 10:05', actor: 'admin', action: 'quota.update', entity: 'u-3', meta: 'monthly_hours 120 → 140' },
]

export const featureFlags = [
  { key: 'ai_analysis', label: 'AI-анализ сессий', enabled: true },
  { key: 'client_checkins', label: 'Чек-ины клиента', enabled: true },
  { key: 'telegram_notifications', label: 'Уведомления в Telegram', enabled: false },
  { key: 'client_export', label: 'Экспорт материалов клиентом', enabled: true },
  { key: 'auto_roadmap_draft', label: 'Авто-обновление roadmap (draft)', enabled: true },
]

// ------------------------------ helpers ------------------------------

export const sessionStatusMeta: Record<SessionStatus, { label: string; tone: 'pink' | 'violet' | 'success' | 'warning' | 'danger' | 'muted' }> = {
  uploaded: { label: 'Загружено', tone: 'muted' },
  queued: { label: 'В очереди', tone: 'muted' },
  extracting_audio: { label: 'Извлечение аудио', tone: 'violet' },
  transcribing: { label: 'Расшифровка', tone: 'violet' },
  diarizing: { label: 'Разделение голосов', tone: 'violet' },
  analyzing: { label: 'AI-анализ', tone: 'violet' },
  draft_ready: { label: 'Черновик готов', tone: 'warning' },
  therapist_review: { label: 'На проверке', tone: 'pink' },
  approved: { label: 'Подтверждено', tone: 'success' },
  sent_to_client: { label: 'Отправлено клиенту', tone: 'success' },
  failed: { label: 'Ошибка', tone: 'danger' },
  requires_manual_fix: { label: 'Нужно исправление', tone: 'danger' },
}

export const confidenceLabel: Record<Confidence, string> = {
  low: 'низкая',
  medium: 'средняя',
  high: 'высокая',
}

export const clientActionLabel: Record<AnalysisInsight['clientAction'], string> = {
  explore: 'исследовать',
  practice: 'практиковать',
  experiment: 'попробовать',
  discuss: 'обсудить с терапевтом',
  integrate: 'интегрировать',
}

export const agreementTypeLabel: Record<Agreement['type'], string> = {
  installation: 'установка',
  agreement: 'договорённость',
  rule: 'правило',
  intention: 'намерение',
  experiment: 'эксперимент',
}

export const homeworkStatusLabel: Record<Homework['status'], string> = {
  assigned: 'назначено',
  in_progress: 'в работе',
  done: 'выполнено',
  skipped: 'пропущено',
  cancelled: 'отменено',
}
