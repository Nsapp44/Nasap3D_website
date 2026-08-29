import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { prisma } from "../../../../lib/server/prisma";
import { resendPendingSignupCode } from "../../../../lib/server/verification";
import { enforceRateLimit, clientIp } from "../../../../lib/api/rateLimit";

interface PendingSignupPayload {
  email: string;
}

// Direct port of POST /auth/signup/resend.
export const POST = apiHandler(async ({ request, clientAddress }) => {
  enforceRateLimit(`auth:signup:resend:${clientIp({ clientAddress })}`, 10, 60_000);

  const schema = z.object({ pendingId: z.string() });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  const record = await prisma.verificationCode.findUnique({ where: { id: body.data.pendingId } });
  if (!record || record.userId !== null || !record.payload) return jsonError(400, "no_pending_code");
  const { email } = JSON.parse(record.payload) as PendingSignupPayload;

  const result = await resendPendingSignupCode(body.data.pendingId, email);
  if (!result.ok) return jsonError(result.error === "too_soon" ? 429 : 400, result.error);
  if (!result.mailSent) return jsonError(502, "mail_send_failed");
  return json({ ok: true, expiresAt: result.expiresAt });
});
