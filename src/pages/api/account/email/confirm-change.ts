import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { requireAuth } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";
import { publicUser } from "../../../../lib/server/serialize";
import {
  consumeVerificationCode,
  WrongCodeError,
  NoPendingCodeError,
  TooManyAttemptsError,
} from "../../../../lib/server/verification";

interface EmailChangePayload {
  newEmail: string;
}

// Direct port of POST /account/email/confirm-change.
export const POST = apiHandler(async (context) => {
  const user = await requireAuth(context);

  const schema = z.object({ code: z.string().trim().length(6) });
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  let payload: EmailChangePayload | undefined;
  try {
    payload = await consumeVerificationCode<EmailChangePayload>(user.id, "EMAIL_CHANGE", body.data.code);
  } catch (err) {
    if (err instanceof NoPendingCodeError) return jsonError(400, "no_pending_code");
    if (err instanceof TooManyAttemptsError) return jsonError(429, "too_many_attempts");
    if (err instanceof WrongCodeError) return jsonError(400, "wrong_code");
    throw err;
  }
  if (!payload) return jsonError(400, "no_pending_code");

  const taken = await prisma.user.findUnique({ where: { email: payload.newEmail } });
  if (taken && taken.id !== user.id) return jsonError(409, "email_taken");

  const updated = await prisma.user.update({
    where: { id: user.id },
    // They just proved control of the mailbox — no separate SIGNUP-style
    // verification needed on top of that.
    data: { email: payload.newEmail, emailVerifiedAt: new Date() },
  });
  return json({ user: publicUser(updated) });
});
