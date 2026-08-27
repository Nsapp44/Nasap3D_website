import type { FastifyInstance } from "fastify";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isValidEmail } from "../lib/password.js";
import { verifyCaptcha } from "../lib/captcha.js";
import { sendMail } from "../lib/mailer.js";
import { renderEmailHtml, contactNotificationContentHtml, contactConfirmationContentHtml } from "../lib/emailTemplate.js";
import { newFileKey, saveFile, readFileByKey, deleteFile } from "../lib/storage.js";
import { checkLongWindowLimit } from "../lib/longWindowLimit.js";
import { requireAdmin } from "../lib/session.js";

const MAX_CONTACT_FILE_BYTES = 50 * 1024 * 1024;
// Matches what the contact form's UI advertises accepting (".stl .step .pdf
// .jpg .png") — the front-end input didn't actually enforce it either, so
// this was previously wide open to any file type.
const ALLOWED_CONTACT_EXT = new Set([".stl", ".step", ".stp", ".pdf", ".jpg", ".jpeg", ".png"]);

export async function contactRoutes(app: FastifyInstance) {
  // Real upload for the contact form's attachment — the file is stored (not
  // emailed: most mailboxes reject/strip attachments over ~25MB, well under
  // our 50MB cap here), and the notification email links to the admin
  // download route below instead.
  app.post(
    "/contact/upload",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      // Filet en plus de la limite par minute ci-dessus — un vrai visiteur
      // n'approche jamais 50 pièces jointes/heure, un script en boucle si.
      if (!checkLongWindowLimit(`contact-upload:${request.ip}`, 50, 60 * 60 * 1000)) {
        return reply.code(429).send({ error: "too_many_requests" });
      }
      const parts = request.parts({ limits: { fileSize: MAX_CONTACT_FILE_BYTES } });
      let fileBuffer: Buffer | null = null;
      let fileName = "";
      for await (const part of parts) {
        if (part.type === "file") {
          fileName = part.filename;
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) chunks.push(chunk as Buffer);
          fileBuffer = Buffer.concat(chunks);
          if (part.file.truncated) return reply.code(413).send({ error: "file_too_large" });
        }
      }
      if (!fileBuffer || !fileName) return reply.code(400).send({ error: "missing_file" });
      const ext = path.extname(fileName).toLowerCase();
      if (!ALLOWED_CONTACT_EXT.has(ext)) return reply.code(400).send({ error: "unsupported_file_type" });

      const fileKey = newFileKey(fileName);
      await saveFile(fileKey, fileBuffer);
      return reply.code(201).send({ fileKey, fileName });
    },
  );

  app.post("/contact", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1).max(60),
      email: z.string(),
      subject: z.string().min(1).max(80),
      message: z.string().max(1000).optional().default(""),
      // Attachments are optional and never required to submit the form —
      // only name/email/subject are. Capped at 5: plenty for "a broken part
      // photo + a CAD file", not enough to be an abuse vector on top of the
      // per-upload rate limit above.
      files: z
        .array(z.object({ fileKey: z.string(), fileName: z.string() }))
        .max(5)
        .optional()
        .default([]),
      captchaToken: z.string().optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    if (!isValidEmail(body.data.email)) return reply.code(400).send({ error: "invalid_email" });

    const rc = await verifyCaptcha(body.data.captchaToken);
    if (!rc.ok) return reply.code(400).send({ error: "captcha_failed", reason: rc.reason });

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
    // strictly required to preserve it), but there's no admin UI for
    // contact messages at all, purely email-driven — if this one email
    // never arrives, the message is effectively invisible to anyone who
    // could act on it, unlike the customer's own confirmation email below
    // (a courtesy, not the only record).
    let notifyFailed = false;
    if (notify) {
      try {
        const base = process.env.API_BASE_URL || "http://localhost:3000";
        const attachmentLines = created.files
          .map((f) => `\n\nPièce jointe (${f.fileName}) : ${base}/admin/contact-messages/${created.id}/files/${f.id} (connecté en admin)`)
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
              created.files.map((f) => ({ url: `${base}/admin/contact-messages/${created.id}/files/${f.id}`, name: f.fileName })),
            ),
          ),
        );
      } catch (err) {
        notifyFailed = true;
        request.log.error(err, "contact notification email failed");
      }
    }

    // Accusé de réception à l'expéditeur — distinct de la notification admin
    // ci-dessus (destinataire différent, contenu différent). A failure here
    // alone doesn't fail the request: it's a courtesy copy, not the only
    // record of the message (unlike the notification above).
    try {
      const subjectLine = `Message bien reçu — ${body.data.subject}`;
      await sendMail(
        body.data.email,
        subjectLine,
        `Bonjour ${body.data.name},\n\nNous avons bien reçu votre message « ${body.data.subject} » et revenons vers vous dans les meilleurs délais.\n\nCeci est une confirmation automatique — inutile de renvoyer votre message.`,
        renderEmailHtml(subjectLine, contactConfirmationContentHtml(body.data.name, body.data.subject)),
      );
    } catch (err) {
      request.log.error(err, "contact confirmation email failed");
    }

    if (notifyFailed) return reply.code(502).send({ error: "mail_send_failed" });
    return reply.send({ ok: true });
  });

  // Deletes the file from storage right after this first successful
  // download — the admin explicitly asked for "gone as soon as I've
  // downloaded it" over any retention delay, accepting that a lost/failed
  // download means asking the customer to resend. `downloadedAt` keeps the
  // row (and its filename) around so a second click gives a clear "already
  // downloaded" instead of a bare 404.
  app.get("/admin/contact-messages/:id/files/:fileId", { preHandler: requireAdmin }, async (request, reply) => {
    const { id, fileId } = request.params as { id: string; fileId: string };
    const file = await prisma.contactMessageFile.findFirst({ where: { id: fileId, contactMessageId: id } });
    if (!file) return reply.code(404).send({ error: "not_found" });
    if (file.downloadedAt) return reply.code(410).send({ error: "already_downloaded", downloadedAt: file.downloadedAt });

    const buffer = await readFileByKey(file.fileKey);
    await deleteFile(file.fileKey);
    await prisma.contactMessageFile.update({ where: { id: file.id }, data: { downloadedAt: new Date() } });
    return reply
      .header("Content-Disposition", `attachment; filename="${file.fileName.replace(/"/g, "")}"`)
      .header("Content-Type", "application/octet-stream")
      .send(buffer);
  });
}
