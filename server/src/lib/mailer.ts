// TODO: plug in a real transactional email provider (OVH SMTP, Brevo,
// Resend, ...) — no provider has been chosen yet. Until then this only logs
// the email to the server console, so the reset-password flow stays fully
// testable end-to-end without one.
export async function sendMail(to: string, subject: string, body: string) {
  console.log(`[mailer] (stub — no provider configured) to=${to} subject="${subject}"\n${body}`);
}
