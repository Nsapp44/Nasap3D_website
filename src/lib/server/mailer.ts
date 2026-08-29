import nodemailer from "nodemailer";
import pino from "pino";

// Real transactional email via SMTP. Falls back to logging the email to the
// console when SMTP isn't configured, so every mail-sending flow stays
// testable in dev without real credentials.

// Set SMTP_DEBUG=true to log the full SMTP conversation (connect, EHLO, the
// AUTH attempt, and — critically — the mail server's own response text, e.g.
// "535 Authentication failed") as structured JSON to stdout.
//
// nodemailer wants a bunyan-style logger (`.level` is a *method*); pino's
// `.level` is a plain string property, so it doesn't satisfy that interface
// as-is — this small adapter bridges the two without resorting to `any`.
function buildSmtpLogger() {
  if (process.env.SMTP_DEBUG !== "true") return undefined;
  const p = pino({ name: "smtp" });
  return {
    level: (lvl: pino.LevelWithSilent) => {
      p.level = lvl;
    },
    trace: (...args: Parameters<typeof p.trace>) => p.trace(...args),
    debug: (...args: Parameters<typeof p.debug>) => p.debug(...args),
    info: (...args: Parameters<typeof p.info>) => p.info(...args),
    warn: (...args: Parameters<typeof p.warn>) => p.warn(...args),
    error: (...args: Parameters<typeof p.error>) => p.error(...args),
    fatal: (...args: Parameters<typeof p.fatal>) => p.fatal(...args),
  };
}
const smtpDebugLogger = buildSmtpLogger();

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !port || !user || !pass) return null;

  // Port 465 is implicit TLS; 587/25 use STARTTLS negotiated after connect.
  const isImplicitTls = Number(port) === 465;
  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: isImplicitTls,
    // Without this, secure:false only makes STARTTLS opportunistic — a
    // server that doesn't (or can't) upgrade would silently fall through to
    // plaintext AUTH instead of failing loudly. Never intentionally send
    // auth in the clear on 587/25.
    requireTLS: !isImplicitTls,
    auth: { user, pass },
    debug: !!smtpDebugLogger,
    logger: smtpDebugLogger,
  });
}
let transporter: ReturnType<typeof buildTransporter> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = buildTransporter();
  return transporter;
}

// `html` is optional so call sites that don't have a designed template yet
// (admin-only notifications) can keep sending plain text — `text` is always
// included either way, both because it's required while html is optional
// and as the actual body shown by clients that strip/ignore HTML mail.
export async function sendMail(to: string, subject: string, body: string, html?: string) {
  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] (SMTP not configured — see SMTP_* in .env) to=${to} subject="${subject}"\n${body}`);
    return;
  }
  await t.sendMail({
    from: process.env.MAIL_FROM || "Nasap3D <no-reply@nasap3d.com>",
    to,
    subject,
    text: body,
    ...(html ? { html } : {}),
  });
}
