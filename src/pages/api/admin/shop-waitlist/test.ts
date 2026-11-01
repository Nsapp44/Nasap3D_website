import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { requireAdmin } from "../../../../lib/api/auth";
import { isMailConfigured, sendMail } from "../../../../lib/server/mailer";
import {
  renderEmailHtml,
  shopOpeningContentHtml,
  shopOpeningText,
  SHOP_OPENING_SUBJECT,
} from "../../../../lib/server/emailTemplate";

// Envoie l'annonce à l'admin connecté seulement (aucune suppression).
export const POST = apiHandler(async (context) => {
  const admin = await requireAdmin(context);
  const to = admin.email;
  if (!isMailConfigured()) return jsonError(503, "mail_not_configured");
  try {
    await sendMail(to, SHOP_OPENING_SUBJECT, shopOpeningText(), renderEmailHtml(SHOP_OPENING_SUBJECT, shopOpeningContentHtml()));
  } catch (err) {
    console.error("shop waitlist test mail failed", err);
    return jsonError(502, "mail_send_failed");
  }
  return json({ ok: true, to });
});
