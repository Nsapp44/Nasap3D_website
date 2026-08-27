import nodemailer from "nodemailer";
import pino from "pino";

// Real transactional email via SMTP (OVH mail hosting, or any other SMTP
// account — nothing here is OVH-specific). Falls back to logging the email
// to the console when SMTP isn't configured, so every mail-sending flow
// (password reset, email verification, ...) stays testable in dev without
// real credentials — see server/README.md.

// Set SMTP_DEBUG=true to log the full SMTP conversation (connect, EHLO, the
// AUTH attempt, and — critically — the mail server's own response text, e.g.
// "535 Authentication failed") as structured JSON to stdout, same place as
// every other server log (`docker compose logs api`). Off by default: this
// is verbose (one block of lines per email sent) and pino itself is the
// same logger Fastify already uses, so the format matches the rest of the
// app's logs. Temporary diagnostic aid for the current auth-failure
// investigation — safe to leave set, or unset once resolved.
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

  return nodemailer.createTransport({
    host,
    port: Number(port),
    // Port 465 is implicit TLS; 587/25 use STARTTLS negotiated after connect.
    secure: Number(port) === 465,
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
