import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { requireAuth } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";
import { revokeAllSessions, createSession } from "../../../../lib/server/session";
import { setSessionCookie } from "../../../../lib/api/cookies";
import {
  consumeVerificationCode,
  WrongCodeError,
  NoPendingCodeError,
  TooManyAttemptsError,
} from "../../../../lib/server/verification";

interface PasswordChangePayload {
  newPasswordHash: string;
}

// Direct port of POST /account/password/confirm-change.
export const POST = apiHandler(async (context) => {
  const user = await requireAuth(context);

  const schema = z.object({ code: z.string().trim().length(6) });
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  let payload: PasswordChangePayload | undefined;
  try {
    payload = await consumeVerificationCode<PasswordChangePayload>(user.id, "PASSWORD_CHANGE", body.data.code);
  } catch (err) {
    if (err instanceof NoPendingCodeError) return jsonError(400, "no_pending_code");
    if (err instanceof TooManyAttemptsError) return jsonError(429, "too_many_attempts");
    if (err instanceof WrongCodeError) return jsonError(400, "wrong_code");
    throw err;
  }
  if (!payload) return jsonError(400, "no_pending_code");

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: payload.newPasswordHash } });
  // Log out every other device, then re-issue a fresh session for this one.
  await revokeAllSessions(user.id);
  const { raw, expiresAt } = await createSession(user.id);
  setSessionCookie(context.cookies, raw, expiresAt);
  return json({ ok: true });
});
