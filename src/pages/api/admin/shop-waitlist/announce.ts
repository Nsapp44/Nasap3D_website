import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { requireAdmin } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";
import { isMailConfigured, sendMail } from "../../../../lib/server/mailer";
import {
  renderEmailHtml,
  shopOpeningContentHtml,
  shopOpeningText,
  SHOP_OPENING_SUBJECT,
} from "../../../../lib/server/emailTemplate";

const schema = z.object({ confirm: z.literal("ENVOYER") });

// Jour J : un e-mail d'annonce à chaque inscrit, puis suppression de sa ligne.
// Séquentiel ; une ligne n'est supprimée qu'après un envoi réussi (les échecs
// restent en liste et peuvent être relancés).
export const POST = apiHandler(async (context) => {
  await requireAdmin(context);
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "confirm_required");
  // Sans SMTP, sendMail ne fait que journaliser : la liste serait vidée sans aucun envoi.
  if (!isMailConfigured()) return jsonError(503, "mail_not_configured");

  const rows = await prisma.shopWaitlist.findMany({ orderBy: { createdAt: "asc" } });
  const html = renderEmailHtml(SHOP_OPENING_SUBJECT, shopOpeningContentHtml());
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await sendMail(row.email, SHOP_OPENING_SUBJECT, shopOpeningText(), html);
      await prisma.shopWaitlist.deleteMany({ where: { id: row.id } });
      sent++;
    } catch (err) {
      failed++;
      console.error("shop waitlist announce failed", row.id, err);
    }
  }
  const remaining = await prisma.shopWaitlist.count();
  return json({ sent, failed, remaining });
});
