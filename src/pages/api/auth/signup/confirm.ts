import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { prisma } from "../../../../lib/server/prisma";
import { nextCustomerNo } from "../../../../lib/server/counter";
import { createSession } from "../../../../lib/server/session";
import { setSessionCookie, getGuestSessionId } from "../../../../lib/api/cookies";
import { publicUser } from "../../../../lib/server/serialize";
import { mergeGuestCartIntoUser } from "../../../../lib/server/cart";
import {
  consumePendingSignupCode,
  WrongCodeError,
  NoPendingCodeError,
  TooManyAttemptsError,
} from "../../../../lib/server/verification";
import { enforceRateLimit, clientIp } from "../../../../lib/api/rateLimit";

interface PendingSignupPayload {
  email: string;
  passwordHash: string;
}

// Direct port of POST /auth/signup/confirm — step 2/2: confirms the code
// and only THEN creates the account. emailVerifiedAt is set immediately
// since control of the mailbox was just proven.
//
// consumePendingSignupCode throws WrongCodeError/NoPendingCodeError/
// TooManyAttemptsError (see lib/server/verification.ts) — those are
// HttpError subclasses (lib/api/errors.ts) so apiHandler() would map them
// to the right status automatically, but the original Fastify route mapped
// them to specific bodies ({error:"wrong_code"} etc.) matched by the
// front-end's error-message lookup, so they're still explicitly re-thrown/
// caught here for identical response shape.
export const POST = apiHandler(async ({ request, cookies, clientAddress }) => {
  enforceRateLimit(`auth:signup:confirm:${clientIp({ clientAddress })}`, 15, 60_000);

  const schema = z.object({ pendingId: z.string(), code: z.string().trim().length(6) });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  let payload: PendingSignupPayload;
  try {
    payload = await consumePendingSignupCode<PendingSignupPayload>(body.data.pendingId, body.data.code);
  } catch (err) {
    if (err instanceof NoPendingCodeError) return jsonError(400, "no_pending_code");
    if (err instanceof TooManyAttemptsError) return jsonError(429, "too_many_attempts");
    if (err instanceof WrongCodeError) return jsonError(400, "wrong_code");
    throw err;
  }

  // Re-check: someone else could have taken the email during the 3-minute
  // window between the request and this confirmation.
  const existing = await prisma.user.findUnique({ where: { email: payload.email } });
  if (existing) return jsonError(409, "email_taken");

  const user = await prisma.user.create({
    data: {
      email: payload.email,
      passwordHash: payload.passwordHash,
      customerNo: await nextCustomerNo(),
      role: "CLIENT",
      emailVerifiedAt: new Date(),
    },
  });

  const guestSessionId = getGuestSessionId(cookies);
  if (guestSessionId) await mergeGuestCartIntoUser(guestSessionId, user.id);

  const { raw, expiresAt } = await createSession(user.id);
  setSessionCookie(cookies, raw, expiresAt);
  return json({ user: publicUser(user) }, { status: 201 });
});
