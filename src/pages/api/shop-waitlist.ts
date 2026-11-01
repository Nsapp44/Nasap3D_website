import { z } from "zod";
import { apiHandler, json, jsonError } from "../../lib/api/handler";
import { prisma } from "../../lib/server/prisma";
import { isValidEmail } from "../../lib/server/password";
import { enforceRateLimit, clientIp } from "../../lib/api/rateLimit";

const schema = z.object({
  email: z.string().max(254),
  // Pot de miel : champ caché que seuls les robots remplissent.
  website: z.string().optional(),
});

// Liste d'attente éphémère de l'ouverture de Nasap Shop. Toujours { ok: true }
// (doublon ou non) pour ne pas permettre de deviner quelles adresses sont inscrites.
export const POST = apiHandler(async (context) => {
  enforceRateLimit(`shop-waitlist:${clientIp(context)}`, 5, 60_000);

  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");
  if (body.data.website) return json({ ok: true });

  const email = body.data.email.trim().toLowerCase();
  if (!isValidEmail(email)) return jsonError(400, "invalid_email");

  await prisma.shopWaitlist.createMany({ data: [{ email }], skipDuplicates: true });
  return json({ ok: true });
});
