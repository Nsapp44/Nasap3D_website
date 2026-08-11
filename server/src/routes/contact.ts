import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isValidEmail } from "../lib/password.js";
import { verifyRecaptcha } from "../lib/recaptcha.js";
import { sendMail } from "../lib/mailer.js";

export async function contactRoutes(app: FastifyInstance) {
  app.post("/contact", async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1).max(60),
      email: z.string(),
      subject: z.string().min(1).max(80),
      message: z.string().max(1000).optional().default(""),
      fileKey: z.string().optional(),
      recaptchaToken: z.string().optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    if (!isValidEmail(body.data.email)) return reply.code(400).send({ error: "invalid_email" });

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const rc = await verifyRecaptcha(body.data.recaptchaToken, "contact", settings?.recaptchaMinScore ?? 0.5);
    if (!rc.ok) return reply.code(400).send({ error: "recaptcha_failed", reason: rc.reason });

    await prisma.contactMessage.create({
      data: {
        name: body.data.name,
        email: body.data.email,
        subject: body.data.subject,
        message: body.data.message,
        fileKey: body.data.fileKey,
        recaptchaScore: rc.score,
      },
    });

    const notify = process.env.CONTACT_NOTIFY_EMAIL;
    if (notify) {
      // The message is already saved above — a mail hiccup (SMTP down,
      // misconfigured) must not turn into a 500 for someone who just
      // successfully submitted the form.
      try {
        await sendMail(
          notify,
          `[Contact Nasap3D] ${body.data.subject}`,
          `De : ${body.data.name} <${body.data.email}>\n\n${body.data.message || "(pas de message)"}`,
        );
      } catch (err) {
        request.log.error(err, "contact notification email failed");
      }
    }

    return reply.send({ ok: true });
  });
}
