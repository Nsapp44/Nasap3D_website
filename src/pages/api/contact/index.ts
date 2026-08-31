import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { prisma } from "../../../lib/server/prisma";
import { isValidEmail } from "../../../lib/server/password";
import { verifyCaptcha } from "../../../lib/server/captcha";
import { sendMail } from "../../../lib/server/mailer";
import { renderEmailHtml, contactNotificationContentHtml, contactConfirmationContentHtml } from "../../../lib/server/emailTemplate";
import { enforceRateLimit, clientIp } from "../../../lib/api/rateLimit";

const schema = z.object({
  name: z.string().min(1).max(60),
  email: z.string(),
  subject: z.string().min(1).max(80),
  message: z.string().max(1000).optional().default(""),
  // Attachments are optional and never required to submit the form — only
  // name/email/subject are. Capped at 5: plenty for "a broken part photo +
  // a CAD file", not enough to be an abuse vector on top of the per-upload
  // rate limit in upload.ts.
  files: z
    .array(z.object({ fileKey: z.string(), fileName: z.string() }))
    .max(5)
    .optional()
    .default([]),
  captchaToken: z.string().optional(),
});

// Direct port of POST /contact.
export const POST = apiHandler(async (context) => {
  enforceRateLimit(`contact:submit:${clientIp(context)}`, 5, 60_000);

  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");
  if (!isValidEmail(body.data.email)) return jsonError(400, "invalid_email");

  const rc = await verifyCaptcha(body.data.captchaToken);
  if (!rc.ok) return jsonError(400, "captcha_failed", { reason: rc.reason });

  const created = await prisma.contactMessage.create({
    data: {
      name: body.data.name,
      email: body.data.email,
      subject: body.data.subject,
      message: body.data.message,
      files: { create: body.data.files.map((f) => ({ fileKey: f.fileKey, fileName: f.fileName })) },
    },
    include: { files: true },
  });

  const notify = process.env.CONTACT_NOTIFY_EMAIL;
  // Whether the admin notification specifically failed — surfaced to the
  // client below. The message is still saved either way (so a retry isn't
  // strictly required to preserve it), but there's no admin UI for contact
  // messages beyond this email — if it never arrives, the message is
  // effectively invisible to anyone who could act on it, unlike the
  // customer's own confirmation email below (a courtesy, not the only
  // record).
  let notifyFailed = false;
  if (notify) {
    try {
      // Front and API are the same origin since the SSR migration — FRONT_URL
      // already holds the site's own public URL, no need for a separate
      // API_BASE_URL anymore (removed).
      const base = process.env.FRONT_URL || "http://localhost:3000";
      const attachmentLines = created.files
        .map((f) => `\n\nPièce jointe (${f.fileName}) : ${base}/api/admin/contact-messages/${created.id}/files/${f.id}`)
        .join("");
      await sendMail(
        notify,
        `[Contact Nasap3D] ${body.data.subject}`,
        `De : ${body.data.name} <${body.data.email}>\n\n${body.data.message || "(pas de message)"}${attachmentLines}`,
        renderEmailHtml(
          `[Contact Nasap3D] ${body.data.subject}`,
          contactNotificationContentHtml(
            body.data.name,
            body.data.email,
            body.data.subject,
            body.data.message || "(pas de message)",
            created.files.map((f) => ({ url: `${base}/api/admin/contact-messages/${created.id}/files/${f.id}`, name: f.fileName })),
          ),
        ),
      );
    } catch (err) {
      notifyFailed = true;
      console.error("contact notification email failed", err);
    }
  }

  // Accusé de réception à l'expéditeur — distinct de la notification admin
  // ci-dessus (destinataire différent, contenu différent). The message
  // itself is still saved in DB either way, so this failing doesn't mean it
  // was lost — but it's the *only* email the visitor themselves ever gets,
  // so from their side a failure here is indistinguishable from the form
  // having silently done nothing: surfaced the same way as the admin
  // notification failing above, not swallowed.
  let confirmationFailed = false;
  try {
    const subjectLine = `Message bien reçu — ${body.data.subject}`;
    await sendMail(
      body.data.email,
      subjectLine,
      `Bonjour ${body.data.name},\n\nNous avons bien reçu votre message « ${body.data.subject} » et revenons vers vous dans les meilleurs délais.\n\nCeci est une confirmation automatique — inutile de renvoyer votre message.`,
      renderEmailHtml(subjectLine, contactConfirmationContentHtml(body.data.name, body.data.subject)),
    );
  } catch (err) {
    confirmationFailed = true;
    console.error("contact confirmation email failed", err);
  }

  if (notifyFailed || confirmationFailed) return jsonError(502, "mail_send_failed");
  return json({ ok: true });
});
