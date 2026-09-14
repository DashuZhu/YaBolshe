// ============================================================
// Sends session materials to a client by email instead of a client-facing
// web account — the platform is therapist-only, clients never log in.
// Uses the Resend HTTP API (https://resend.com) so no SDK/dependency is
// needed, matching how OPENAI_API_KEY is used elsewhere in this codebase.
// ============================================================

const RESEND_API_KEY = () => process.env.RESEND_API_KEY ?? "";
const EMAIL_FROM = () => process.env.EMAIL_FROM ?? "";

export function emailSendingEnabled(): boolean {
  return RESEND_API_KEY().length > 0 && EMAIL_FROM().length > 0;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Converts plain text with blank-line paragraphs into safe HTML paragraphs. */
function textToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export interface ClientEmailContent {
  clientFirstName: string;
  sessionTitle: string;
  sessionDate: string;
  clientFriendlySummary: string;
  insights: { title: string; description: string }[];
  homework: { title: string; description: string }[];
  clientDynamicsNote: string;
}

function buildEmailHtml(content: ClientEmailContent): string {
  const insightsHtml = content.insights.length > 0
    ? content.insights
        .map((i) => `<li style="margin-bottom:12px;"><b>${escapeHtml(i.title)}</b><br><span style="color:#555;">${escapeHtml(i.description)}</span></li>`)
        .join("")
    : "";
  const homeworkHtml = content.homework.length > 0
    ? content.homework
        .map((h) => `<li style="margin-bottom:12px;"><b>${escapeHtml(h.title)}</b><br><span style="color:#555;">${escapeHtml(h.description)}</span></li>`)
        .join("")
    : "";

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#FBF5F8;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#2B2340;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <h1 style="font-size:20px;margin:0 0 4px;">${escapeHtml(content.sessionTitle)}</h1>
    <p style="font-size:13px;color:#726B84;margin:0 0 28px;">${escapeHtml(content.sessionDate)}</p>

    <h2 style="font-size:15px;margin:0 0 12px;">Конспект встречи</h2>
    ${textToHtml(content.clientFriendlySummary)}

    ${content.insights.length > 0 ? `
    <h2 style="font-size:15px;margin:24px 0 12px;">Инсайты</h2>
    <ul style="padding-left:20px;margin:0;">${insightsHtml}</ul>` : ""}

    ${content.homework.length > 0 ? `
    <h2 style="font-size:15px;margin:24px 0 12px;">Между встречами</h2>
    <ul style="padding-left:20px;margin:0;">${homeworkHtml}</ul>` : ""}

    ${content.clientDynamicsNote ? `
    <h2 style="font-size:15px;margin:24px 0 12px;">Динамика</h2>
    ${textToHtml(content.clientDynamicsNote)}` : ""}

    <p style="margin-top:32px;font-size:12px;color:#9a92a8;">Это письмо сформировано вашим терапевтом после сессии и не является медицинской консультацией.</p>
  </div>
</body>
</html>`;
}

export async function sendClientSessionEmail(to: string, content: ClientEmailContent): Promise<void> {
  if (!emailSendingEnabled()) {
    throw new Error("Отправка почты не настроена на сервере (нет RESEND_API_KEY/EMAIL_FROM)");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM(),
      to: [to],
      subject: content.sessionTitle,
      html: buildEmailHtml(content),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Не удалось отправить письмо (${res.status}): ${text.slice(0, 300)}`);
  }
}
