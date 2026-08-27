import { prisma } from "./prisma.js";
import { hashToken, generateNumericCode } from "./tokens.js";
import { sendMail } from "./mailer.js";
import { renderEmailHtml, verificationCodeContentHtml } from "./emailTemplate.js";
import type { VerificationPurpose } from "@prisma/client";

// Shared lifetime for every 6-digit code in the app (signup, email change,
// password change): short on purpose — a code is only ever meant to be
// typed within a minute or two of receiving it, and a short window limits
// how long a stale, unconsumed code sits around. Resending is only allowed
// once the current code has actually expired (see canResend below) rather
// than on a short fixed cooldown, so there's only ever one *valid* code at a
// time per pending action.
export const CODE_EXPIRY_MS = 3 * 60 * 1000;
const MAX_ATTEMPTS = 8;

// Shared by three flows: verifying a new account, confirming a new email
// address, and confirming a password change (see routes/auth.ts and
// routes/account.ts). `payload` is whatever the confirm step needs once the
// code checks out (new email, new password hash, ...). The code is created
// either way — a mail hiccup shouldn't corrupt state — but `mailSent: false`
// tells the caller to surface an error instead of the normal "check your
// email" response: a code that was never actually delivered leaves the
// visitor stuck with no way to know why nothing arrived, see mailer.ts.
export async function createAndSendVerificationCode(
  userId: string,
  purpose: VerificationPurpose,
  recipientEmail: string,
  subject: string,
  bodyIntro: string,
  payload?: unknown,
): Promise<{ expiresAt: Date; mailSent: boolean }> {
  const code = generateNumericCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);
  await prisma.verificationCode.create({
    data: {
      userId,
      purpose,
      codeHash: hashToken(code),
      payload: payload !== undefined ? JSON.stringify(payload) : null,
      expiresAt,
    },
  });
  let mailSent = true;
  try {
    await sendMail(
      recipientEmail,
      subject,
      `${bodyIntro}\n\nVotre code de vérification : ${code}\n\nIl est valable 3 minutes.`,
      renderEmailHtml(subject, verificationCodeContentHtml(bodyIntro, code)),
    );
  } catch (err) {
    mailSent = false;
    console.error(`[verification] sendMail failed for purpose=${purpose}`, err);
  }
  return { expiresAt, mailSent };
}

export class WrongCodeError extends Error {}
export class NoPendingCodeError extends Error {}
export class TooManyAttemptsError extends Error {}

// Verifies `code` against the latest pending code for userId+purpose,
// tracks failed attempts, and returns the parsed payload on success. Throws
// one of the typed errors above on failure — callers map those to HTTP
// responses (see routes/auth.ts, routes/account.ts).
export async function consumeVerificationCode<T = unknown>(
  userId: string,
  purpose: VerificationPurpose,
  code: string,
): Promise<T | undefined> {
  const record = await prisma.verificationCode.findFirst({
    where: { userId, purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.expiresAt < new Date()) throw new NoPendingCodeError();
  if (record.attempts >= MAX_ATTEMPTS) throw new TooManyAttemptsError();

  if (record.codeHash !== hashToken(code)) {
    await prisma.verificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new WrongCodeError();
  }

  await prisma.verificationCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return record.payload ? (JSON.parse(record.payload) as T) : undefined;
}

// Resend is only allowed once the current code has expired — there's only
// ever one *valid* code per pending action at a time, so a resend can't be
// used to spam mailboxes faster than one message per CODE_EXPIRY_MS.
export async function canResend(userId: string, purpose: VerificationPurpose): Promise<boolean> {
  const last = await prisma.verificationCode.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: "desc" },
  });
  return !last || Date.now() - last.createdAt.getTime() >= CODE_EXPIRY_MS;
}

// Signup verification code, sent BEFORE any User row exists (see
// routes/auth.ts POST /auth/signup) — payload carries the pending
// email+passwordHash, and the User row is only created once the code is
// confirmed. Keyed by the VerificationCode's own id (returned to the client
// as `pendingId`) rather than userId, since there's no user to scope it to.
export async function createPendingSignupCode(
  email: string,
  payload: unknown,
): Promise<{ id: string; expiresAt: Date; mailSent: boolean }> {
  const code = generateNumericCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);
  // No userId: this code precedes account creation (see doc comment above).
  const record = await prisma.verificationCode.create({
    data: {
      purpose: "SIGNUP",
      codeHash: hashToken(code),
      payload: JSON.stringify(payload),
      expiresAt,
    },
  });
  let mailSent = true;
  try {
    const intro = "Bienvenue chez Nasap3D ! Saisissez ce code pour créer votre compte.";
    await sendMail(
      email,
      "Votre code de vérification Nasap3D",
      `${intro}\n\nVotre code de vérification : ${code}\n\nIl est valable 3 minutes.`,
      renderEmailHtml("Votre code de vérification Nasap3D", verificationCodeContentHtml(intro, code)),
    );
  } catch (err) {
    mailSent = false;
    console.error("[verification] sendMail failed for pending signup", err);
  }
  return { id: record.id, expiresAt, mailSent };
}

export async function consumePendingSignupCode<T = unknown>(id: string, code: string): Promise<T> {
  const record = await prisma.verificationCode.findUnique({ where: { id } });
  if (
    !record ||
    record.userId !== null ||
    record.purpose !== "SIGNUP" ||
    record.usedAt ||
    record.expiresAt < new Date()
  ) {
    throw new NoPendingCodeError();
  }
  if (record.attempts >= MAX_ATTEMPTS) throw new TooManyAttemptsError();

  if (record.codeHash !== hashToken(code)) {
    await prisma.verificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new WrongCodeError();
  }

  await prisma.verificationCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return JSON.parse(record.payload!) as T;
}

// Regenerates the code in place (same row, same id) so the `pendingId` the
// client already holds stays valid — a resend isn't a new signup attempt.
// Cooldown is derived from expiresAt (= last-sent + CODE_EXPIRY_MS) rather
// than a separate timestamp column, since the row is reused in place.
export async function resendPendingSignupCode(
  id: string,
  email: string,
): Promise<
  { ok: true; expiresAt: Date; mailSent: boolean } | { ok: false; error: "too_soon" | "no_pending_code" }
> {
  const record = await prisma.verificationCode.findUnique({ where: { id } });
  // Note: an EXPIRED code is exactly the normal case a resend is for — only
  // an already-consumed or altogether unknown id is a dead end here.
  if (!record || record.userId !== null || record.purpose !== "SIGNUP" || record.usedAt) {
    return { ok: false, error: "no_pending_code" };
  }
  const lastSentAt = record.expiresAt.getTime() - CODE_EXPIRY_MS;
  if (Date.now() - lastSentAt < CODE_EXPIRY_MS) return { ok: false, error: "too_soon" };

  const code = generateNumericCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);
  await prisma.verificationCode.update({
    where: { id },
    data: { codeHash: hashToken(code), attempts: 0, expiresAt },
  });
  let mailSent = true;
  try {
    const intro = "Voici votre nouveau code de vérification.";
    await sendMail(
      email,
      "Votre code de vérification Nasap3D",
      `${intro}\n\nVotre code de vérification : ${code}\n\nIl est valable 3 minutes.`,
      renderEmailHtml("Votre code de vérification Nasap3D", verificationCodeContentHtml(intro, code)),
    );
  } catch (err) {
    mailSent = false;
    console.error("[verification] sendMail failed for pending signup resend", err);
  }
  return { ok: true, expiresAt, mailSent };
}
