import nodemailer from "nodemailer";

// Real transactional email via SMTP (OVH mail hosting, or any other SMTP
// account — nothing here is OVH-specific). Falls back to logging the email
// to the console when SMTP isn't configured, so every mail-sending flow
// (password reset, email verification, ...) stays testable in dev without
// real credentials — see server/README.md.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !port || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    // Port 465 is implicit TLS; 587/25 use STARTTLS negotiated after connect.
    secure: Number(port) === 465,
    auth: { user, pass },
  });
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
    from: process.env.MAIL_FROM || "Nasap3D <noreply@nasap3d.com>",
    to,
    subject,
    text: body,
    ...(html ? { html } : {}),
  });
}
