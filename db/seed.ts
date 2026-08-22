import { sql } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import { hashPassword } from "../api/auth/session";
import {
  users,
  therapistProfiles,
  clientProfiles,
  sessions,
  insights,
  themes,
  homework,
  agreements,
  roadmaps,
  therapistNotes,
  checkIns,
  invites,
} from "./schema";

// Demo data is 100% synthetic. No real PHI.
// Demo accounts use the password from SEED_DEMO_PASSWORD.

async function seed() {
  const db = getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(users);
  if (Number(n) > 0) {
    console.log("Database already has users — seed skipped.");
    process.exit(0);
  }

  console.log("Seeding demo data (synthetic)...");

  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "demo1234";
  const demoHash = await hashPassword(demoPassword);

  // ---- users ----
  const [{ id: therapistId }] = await db
    .insert(users)
    .values({
      email: "anna@yabolshe.demo",
      passwordHash: demoHash,
      role: "therapist",
      firstName: "Анна",
      lastName: "Соколова",
    })
    .$returningId();
  await db.insert(therapistProfiles).values({ userId: therapistId, bio: "Гештальт-терапевт, супервизор" });

  const [{ id: adminId }] = await db
    .insert(users)
    .values({
      email: "admin@yabolshe.demo",
      passwordHash: demoHash,
      role: "admin",
      firstName: "Администратор",
      lastName: "Портала",
    })
    .$returningId();

  const [{ id: mariaId }] = await db
    .insert(users)
    .values({
      email: "maria@yabolshe.demo",
      passwordHash: demoHash,
      role: "client",
      firstName: "Мария",
      lastName: "Л.",
    })
    .$returningId();

  const [{ id: mariaProfileId }] = await db
    .insert(clientProfiles)
    .values({
      userId: mariaId,
      therapistId,
      focus: "Границы в близких отношениях",
      avatarHue: 330,
      aiConsent: true,
    })
    .$returningId();

  // extra clients (synthetic)
  const extraClients: [string, string, string, number][] = [
    ["Дмитрий", "К.", "Проживание злости и самоподдержка", 265],
    ["Ольга", "Р.", "Тревога перед переменами", 300],
    ["Игорь", "В.", "Завершение незавершённых ситуаций", 210],
    ["Светлана", "Н.", "Опора на себя после развода", 20],
  ];
  for (const [fn, ln, focus, hue] of extraClients) {
    const [{ id: uid }] = await db
      .insert(users)
      .values({
        email: `${fn.toLowerCase()}@yabolshe.demo`,
        passwordHash: demoHash,
        role: "client",
        firstName: fn,
        lastName: ln,
      })
      .$returningId();
    await db.insert(clientProfiles).values({ userId: uid, therapistId, focus, avatarHue: hue, aiConsent: true });
  }

  // ---- session 1: sent to client ----
  const dayMs = 24 * 3600 * 1000;
  const [{ id: s1 }] = await db
    .insert(sessions)
    .values({
      therapistId,
      clientId: mariaProfileId,
      title: "Сессия 23 · Чувство вины",
      sessionDate: new Date(Date.now() - 11 * dayMs),
      durationMin: 50,
      status: "sent_to_client",
      hasMedia: true,
      summaryShort: "Работа с чувством вины как ретрофлексией; первые формулировки личных границ.",
      clientFriendlySummary:
        "Вы исследовали, как чувство вины появляется, когда вы думаете о своих желаниях. Оказалось, что за виной часто стоит старая договорённость с собой: «сначала другие, потом я». Вы начали пробовать новую формулу: «мои желания тоже важны».",
      emotionsJson: [
        { label: "Вина", intensity: "high", context: "При мысли о собственных желаниях" },
        { label: "Нежность к себе", intensity: "low", context: "В конце сессии" },
      ],
      needsJson: [{ label: "Разрешение хотеть", description: "Внутреннее разрешение иметь желания" }],
      patternsJson: [
        { id: "pat-1", title: "Интроджект «сначала другие»", description: "Проглоченное правило ставить чужие нужды выше своих", confidence: "high", evidence: ["seg-1"] },
      ],
      riskFlagsJson: [],
      dynamicsJson: { summary: "Тема вины устойчива, но появилась первая контрформула.", improved: ["Формулирование границ словами"], stable: ["Вина при контакте с желаниями"], newTopics: ["Нежность к себе"] },
      therapistQuestionsJson: ["Чьим голосом звучит «сначала другие»?"],
      uncertaintiesJson: [],
      transcriptJson: [
        { id: "seg-1", start: "00:10:02", end: "00:11:20", speaker: "client", text: "Как только я думаю о себе, сразу появляется это чувство… как будто я что-то украла.", confidence: 0.96 },
        { id: "seg-2", start: "00:32:40", end: "00:33:15", speaker: "therapist", text: "Побудьте с этой фразой. «Как будто я что-то украла». У кого, как вам кажется, вы это украли?", confidence: 0.98 },
      ],
      model: "gpt-5 (seed)",
      approvedAt: new Date(Date.now() - 10 * dayMs),
      sentAt: new Date(Date.now() - 10 * dayMs),
    })
    .$returningId();

  const [{ id: ins1 }] = await db
    .insert(insights)
    .values({
      sessionId: s1,
      clientId: mariaProfileId,
      title: "Вина появляется там, где моё желание",
      description: "Я чувствую вину не потому, что делаю что-то плохое, а потому что осмеливаюсь хотеть.",
      clientAction: "explore",
      confidence: "high",
      evidenceJson: ["seg-1"],
      approved: true,
    })
    .$returningId();
  void ins1;

  await db.insert(themes).values({
    sessionId: s1,
    clientId: mariaProfileId,
    title: "Чувство вины",
    description: "Вина как ретрофлексия потребности в заботе о себе",
    confidence: "high",
    evidenceJson: ["seg-1"],
    approved: true,
  });

  // ---- session 2: draft waiting for review ----
  const [{ id: s2 }] = await db
    .insert(sessions)
    .values({
      therapistId,
      clientId: mariaProfileId,
      title: "Сессия 24 · Границы с мамой",
      sessionDate: new Date(Date.now() - 4 * dayMs),
      durationMin: 55,
      status: "therapist_review",
      hasMedia: true,
      summaryShort:
        "Клиентка исследовала автоматическое согласие в контакте с мамой; ключевая фигура — телесное «нет», которое предшествует осознанному решению.",
      clientFriendlySummary:
        "На этой встрече вы заметили важное: ваше тело часто знает ответ раньше, чем мысли. Сжатые плечи и стянутый живот — это способ, которым ваше «нет» проявляет себя. Вы попробовали дать этому ощущению голос, и от этого стало легче дышать.",
      emotionsJson: [
        { label: "Злость на себя", intensity: "medium", context: "После автоматического согласия" },
        { label: "Страх", intensity: "medium", context: "При мысли сказать «нет» вслух" },
        { label: "Облегчение", intensity: "high", context: "После проговаривания" },
      ],
      needsJson: [
        { label: "Право на выбор", description: "Потребность выбирать самой, без чувства вины" },
        { label: "Безопасность в контакте", description: "Оставаться в отношениях, не теряя себя" },
      ],
      patternsJson: [
        { id: "pat-2", title: "Автоматическое согласие", description: "Быстрое «да» с последующей злостью на себя", confidence: "high", evidence: ["seg-2"] },
        { id: "pat-3", title: "Телесное опережение решения", description: "Тело реагирует «нет» раньше, чем решение осознаётся", confidence: "high", evidence: ["seg-4"] },
      ],
      riskFlagsJson: [],
      dynamicsJson: {
        summary: "Заметно выросло осознавание телесных сигналов; тема границ впервые прожита в теле.",
        improved: ["Осознавание телесных реакций", "Доступ к злости как к информации"],
        stable: ["Тема отношений с мамой"],
        newTopics: ["Тело как источник ответа", "Эксперимент с маленьким «нет»"],
      },
      therapistQuestionsJson: [
        "Что происходит с чувством вины в момент, когда возникает импульс отказать?",
        "Как клиентка распознаёт разницу между «хочу» и «должна» в моменте?",
      ],
      uncertaintiesJson: ["Реакция мамы на реальный отказ пока неизвестна; прогнозировать рано."],
      transcriptJson: [
        { id: "seg-1", start: "00:00:12", end: "00:00:48", speaker: "therapist", text: "Здравствуйте, Мария. Как вы сегодня? С чего бы вам хотелось начать?", confidence: 0.98 },
        { id: "seg-2", start: "00:00:49", end: "00:01:37", speaker: "client", text: "Здравствуйте. Я всю неделю думала о разговоре с мамой. Я заметила, что снова согласилась приехать, хотя внутри всё сопротивлялось. И потом злилась на себя.", confidence: 0.97 },
        { id: "seg-3", start: "00:01:38", end: "00:02:10", speaker: "therapist", text: "Останемся здесь на минуту. Когда вы говорите «внутри всё сопротивлялось» — что замечаете в теле прямо сейчас?", confidence: 0.99 },
        { id: "seg-4", start: "00:02:11", end: "00:03:02", speaker: "client", text: "Сжались плечи… и живот как будто стянуло. Как будто тело знало «нет» раньше, чем я.", confidence: 0.96 },
        { id: "seg-5", start: "00:03:42", end: "00:04:50", speaker: "client", text: "Оно бы сказало… «Я устала быть удобной. Я хочу выбирать сама». Страшно, но стало легче дышать.", confidence: 0.97 },
      ],
      model: "gpt-5 (seed)",
      inputTokens: 18420,
      outputTokens: 3105,
    })
    .$returningId();

  await db.insert(insights).values([
    { sessionId: s2, clientId: mariaProfileId, title: "Моё тело знает ответ раньше меня", description: "Сжатые плечи и стянутый живот появляются до того, как я решаю согласиться. Это моё «нет», которое уже есть.", clientAction: "explore", confidence: "high", evidenceJson: ["seg-4"], approved: false },
    { sessionId: s2, clientId: mariaProfileId, title: "Когда я говорю правду, мне легче дышать", description: "Проговорив «я устала быть удобной», я почувствовала облегчение, хотя было страшно.", clientAction: "integrate", confidence: "high", evidenceJson: ["seg-5"], approved: false },
    { sessionId: s2, clientId: mariaProfileId, title: "Злость на себя — это развёрнутая злость на ситуацию", description: "Когда я соглашаюсь против желания, злость остаётся и направляется на меня.", clientAction: "discuss", confidence: "medium", evidenceJson: ["seg-2"], approved: false },
  ]);
  await db.insert(themes).values([
    { sessionId: s2, clientId: mariaProfileId, title: "Границы с мамой", description: "Автоматическое согласие, чувство вины, страх отказа", confidence: "high", evidenceJson: ["seg-2", "seg-5"], approved: false },
    { sessionId: s2, clientId: mariaProfileId, title: "Тело как ресурс", description: "Телесные сигналы как ранний индикатор истинного ответа", confidence: "high", evidenceJson: ["seg-3", "seg-4"], approved: false },
  ]);

  // ---- homework ----
  await db.insert(homework).values([
    { clientId: mariaProfileId, sessionId: s2, insightTitle: "Моё тело знает ответ раньше меня", title: "Маленькое «нет»", description: "Один раз на этой неделе сказать «нет» в небольшой, безопасной ситуации — и понаблюдать, что происходит в теле и в мыслях.", purpose: "Закрепить опыт сессии: отказ в малом — тренировка границы.", frequency: "1 раз за неделю", dueDate: "до следующей сессии", status: "in_progress", approved: true },
    { clientId: mariaProfileId, sessionId: s2, insightTitle: "Моё тело знает ответ раньше меня", title: "Дневник телесных сигналов", description: "2–3 раза в день коротко отмечать: что я сейчас чувствую в теле? Где напряжение?", purpose: "Развивать осознавание телесных реакций.", frequency: "2–3 раза в день", dueDate: "2 недели", status: "assigned", approved: true },
    { clientId: mariaProfileId, sessionId: s1, title: "Письмо злости (не отправлять)", description: "Написать письмо ситуации или человеку, на которого есть злость. Не отправлять.", purpose: "Дать злости безопасный выход.", frequency: "по желанию", dueDate: "без срока", status: "done", approved: true, reflection: "Стало спокойнее. Поняла, что за злостью — усталость и желание, чтобы меня услышали.", completedAt: new Date(Date.now() - 6 * dayMs) },
  ]);

  // ---- agreements ----
  await db.insert(agreements).values([
    { clientId: mariaProfileId, sessionId: s2, text: "Я имею право сказать «нет», даже если это неудобно другим.", type: "installation", status: "active", reviewDate: "через месяц", approved: true },
    { clientId: mariaProfileId, sessionId: s2, text: "Перед автоматическим «да» — пауза и вопрос себе: «Я правда этого хочу?»", type: "agreement", status: "active", reviewDate: "через 2 недели", approved: true },
    { clientId: mariaProfileId, sessionId: s1, text: "Эксперимент: неделя честных ответов на «как дела?» — хотя бы с одним близким человеком.", type: "experiment", status: "review", reviewDate: "на этой неделе", approved: true },
  ]);

  // ---- roadmap ----
  await db.insert(roadmaps).values({
    clientId: mariaProfileId,
    currentFocus: "Границы в близких отношениях: замечать автоматическое «да» и возвращать себе право выбора.",
    goalsJson: [
      { goal: "Замечать автоматическое согласие в моменте", progress: 70, note: "Клиентка устойчиво распознаёт паттерн; начинает замечать в моменте." },
      { goal: "Опираться на телесные сигналы", progress: 45, note: "Новый навык, хорошая динамика." },
      { goal: "Говорить «нет» в безопасных ситуациях", progress: 30, note: "Первый эксперимент назначен." },
      { goal: "Снизить интенсивность чувства вины", progress: 35, note: "Вина устойчива, но есть контрформула." },
    ],
    stagesJson: [
      { title: "Запрос и первичная карта тем", status: "done" },
      { title: "Осознавание паттернов контакта", status: "done" },
      { title: "Границы: от осознания к действию", status: "current" },
      { title: "Интеграция и самоподдержка", status: "next" },
    ],
    resourcesJson: ["Хорошая рефлексия", "Поддерживающие отношения с подругой", "Телесная чувствительность"],
    obstaclesJson: ["Интроджект «быть удобной»", "Страх потерять контакт с мамой"],
    nextStepsJson: ["Эксперимент «маленькое нет»", "Дневник телесных сигналов", "Обсудить реакцию мамы на отказ"],
    experimentsJson: ["Маленькое «нет»", "Неделя честных ответов"],
    reviewDate: "через месяц",
    version: 7,
    draftPending: false,
    approved: true,
  });

  // ---- notes ----
  await db.insert(therapistNotes).values([
    { therapistId, clientId: mariaProfileId, text: "Клиентка улыбается, когда говорит о злости. Возможная дефлексия — исследовать бережно.", tagsJson: ["дефлексия", "наблюдение"], useAsAiContext: false },
    { therapistId, clientId: mariaProfileId, text: "К следующей сессии: спросить про эксперимент «маленькое нет». Если получилось — отпраздновать, важно для ассимиляции.", tagsJson: ["план"], useAsAiContext: true },
  ]);

  // ---- check-ins ----
  const points = [
    [22, 5, 4, 7], [20, 6, 5, 6], [17, 5, 5, 6], [14, 6, 6, 5],
    [11, 7, 6, 5], [8, 6, 5, 6], [5, 7, 7, 4], [2, 8, 7, 4], [0, 8, 8, 3],
  ] as const;
  for (const [daysAgo, mood, energy, anxiety] of points) {
    await db.insert(checkIns).values({
      clientId: mariaProfileId,
      mood, energy, anxiety,
      createdAt: new Date(Date.now() - daysAgo * dayMs),
    });
  }

  // ---- invite demo ----
  await db.insert(invites).values({
    code: "DEMO2026",
    therapistId,
    focus: "Первичный запрос",
    expiresAt: new Date(Date.now() + 30 * dayMs),
  });

  console.log("Seed complete.");
  console.log("Demo accounts created; password is the value of SEED_DEMO_PASSWORD.");
  console.log("Invite code for new clients: DEMO2026");
  console.log("Admin id:", adminId);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
