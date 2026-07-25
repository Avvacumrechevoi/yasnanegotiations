// ═══════════════════════════════════════════════════════════════════
// Отправка писем. Один транспорт — SMTP.
//
// ПОЧЕМУ ТОЛЬКО SMTP. Рассматривались три пути: Yandex Cloud Postbox по API,
// сторонний сервис по HTTP и обычный SMTP. Проверено на месте: зон DNS в
// облаке ноль (домен обслуживается не Yandex Cloud, DKIM-записи для Postbox
// добавить нечем), а Postbox API отвечает 403 — сервис для этого облака не
// включён. SMTP при этом покрывает ВСЕ реальные варианты одним кодом:
// ящик Яндекс 360, Gmail с паролем приложения, корпоративная почта и сам
// Postbox, у которого есть SMTP-интерфейс. Один путь вместо трёх — меньше
// того, что может сломаться по-разному.
//
// НАСТРОЙКА. Пять переменных окружения функции:
//   SMTP_HOST, SMTP_PORT (465 — TLS сразу, 587 — STARTTLS),
//   SMTP_USER, SMTP_PASS, MAIL_FROM (например «Ясна <no-reply@домен>»)
// Ставятся скриптом scripts/set-mail-env.sh — он спрашивает пароль без эха и
// кладёт его прямо в облако, чтобы секрет не проходил через переписку и не
// оставался в истории команд.
//
// ПОКА НЕ НАСТРОЕНО — isConfigured() возвращает false, и вызывающий обязан
// ответить 503 с внятным текстом. Молча «как будто отправили» нельзя: человек
// будет ждать письмо, которого нет.
// ═══════════════════════════════════════════════════════════════════

let transport = null;

function mailConfig(){
  const host = process.env.SMTP_HOST || '';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const from = process.env.MAIL_FROM || '';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  return { host, port, user, pass, from };
}

function isConfigured(){
  const c = mailConfig();
  return !!(c.host && c.user && c.pass && c.from);
}

function getTransport(){
  if(transport) return transport;
  const c = mailConfig();
  // nodemailer добавлен в зависимости ТОЛЬКО той функции, которая рассылает
  // письма (см. deps_for в scripts/deploy-backend.sh): тащить его в submit,
  // который вызывается на каждый матч, смысла нет — это лишний холодный старт.
  const nodemailer = require('nodemailer');
  transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.port === 465,     // 465 — TLS сразу; 587 — STARTTLS, поднимается сам
    auth: { user: c.user, pass: c.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return transport;
}

async function send({ to, subject, text, html }){
  if(!isConfigured()) throw new Error('mail not configured');
  const c = mailConfig();
  const t = getTransport();
  // Заголовки против попадания писем-кодов в автоответчики и в цепочки:
  // Auto-Submitted и Precedence просят почтовые системы не отвечать на них.
  const info = await t.sendMail({
    from: c.from,
    to,
    subject,
    text,
    html,
    headers: {
      'Auto-Submitted': 'auto-generated',
      'Precedence': 'bulk',
      'X-Entity-Ref-ID': String(Date.now()),
    },
  });
  return { ok: true, messageId: info?.messageId || null };
}

// ─── письмо с кодом входа ────────────────────────────────────────────
// Текстовая версия обязательна: часть почтовых клиентов и корпоративных
// шлюзов режут HTML, и человек должен увидеть код в любом случае.
function loginCodeLetter(code, minutes){
  const subject = `Код для входа: ${code}`;
  const text = [
    `Код для входа в Ясну: ${code}`,
    ``,
    `Он действует ${minutes} минут и нужен только один раз.`,
    `Если вы не запрашивали вход — просто не вводите код, ничего не произошло.`,
    ``,
    `Это письмо отправлено автоматически, отвечать на него не нужно.`,
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:14px;padding:28px">
  <div style="font-size:15px;color:#6e6e73;margin-bottom:18px">Ясна</div>
  <div style="font-size:19px;font-weight:600;margin-bottom:14px">Код для входа</div>
  <div style="font-size:34px;font-weight:700;letter-spacing:.14em;padding:14px 0 18px">${code}</div>
  <div style="font-size:14px;line-height:1.55;color:#3a3a3c">
    Действует ${minutes} минут и нужен только один раз.<br/>
    Если вы не запрашивали вход — просто не вводите код, ничего не произошло.
  </div>
  <div style="font-size:12px;color:#8a8a8e;margin-top:22px;border-top:1px solid #e5e5ea;padding-top:14px">
    Письмо отправлено автоматически, отвечать на него не нужно.
  </div>
</div></body></html>`;
  return { subject, text, html };
}

module.exports = { isConfigured, send, loginCodeLetter, mailConfig };
