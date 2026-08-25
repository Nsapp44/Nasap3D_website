import type { FastifyInstance } from "fastify";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isValidEmail } from "../lib/password.js";
import { verifyCaptcha } from "../lib/captcha.js";
import { sendMail } from "../lib/mailer.js";
import { renderEmailHtml, contactNotificationContentHtml } from "../lib/emailTemplate.js";
import { newFileKey, saveFile, readFileByKey } from "../lib/storage.js";
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
  app.post("/contact/upload", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
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
  });

  app.post("/contact", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1).max(60),
      email: z.string(),
      subject: z.string().min(1).max(80),
      message: z.string().max(1000).optional().default(""),
      fileKey: z.string().optional(),
      fileName: z.string().optional(),
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
        fileKey: body.data.fileKey,
        fileName: body.data.fileName,
      },
    });

    const notify = process.env.CONTACT_NOTIFY_EMAIL;
    if (notify) {
      // The message is already saved above — a mail hiccup (SMTP down,
      // misconfigured) must not turn into a 500 for someone who just
      // successfully submitted the form.
      try {
        const attachmentUrl = created.fileKey
          ? `${process.env.API_BASE_URL || "http://localhost:3000"}/admin/contact-messages/${created.id}/file`
          : undefined;
        const attachmentLine = attachmentUrl ? `\n\nPièce jointe (${body.data.fileName}) : ${attachmentUrl} (connecté en admin)` : "";
        await sendMail(
          notify,
          `[Contact Nasap3D] ${body.data.subject}`,
          `De : ${body.data.name} <${body.data.email}>\n\n${body.data.message || "(pas de message)"}${attachmentLine}`,
          renderEmailHtml(
            `[Contact Nasap3D] ${body.data.subject}`,
            contactNotificationContentHtml(body.data.name, body.data.email, body.data.subject, body.data.message || "(pas de message)", attachmentUrl),
          ),
        );
      } catch (err) {
        request.log.error(err, "contact notification email failed");
      }
    }

    return reply.send({ ok: true });
  });

  app.get("/admin/contact-messages/:id/file", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const msg = await prisma.contactMessage.findUnique({ where: { id } });
    if (!msg || !msg.fileKey) return reply.code(404).send({ error: "not_found" });

    const buffer = await readFileByKey(msg.fileKey);
    return reply
      .header("Content-Disposition", `attachment; filename="${(msg.fileName || "piece-jointe").replace(/"/g, "")}"`)
      .header("Content-Type", "application/octet-stream")
      .send(buffer);
  });
}
