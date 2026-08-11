import { prisma } from "./prisma.js";
import { hashToken, generateNumericCode } from "./tokens.js";
import { sendMail } from "./mailer.js";
import type { VerificationPurpose } from "@prisma/client";

const EXPIRY_MS = 30 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 8;

// Shared by three flows: verifying a new account, confirming a new email
// address, and confirming a password change (see routes/auth.ts and
// routes/account.ts). `payload` is whatever the confirm step needs once the
// code checks out (new email, new password hash, ...) — never blocks the
// caller if SMTP isn't configured yet (see mailer.ts).
export async function createAndSendVerificationCode(
  userId: string,
  purpose: VerificationPurpose,
  recipientEmail: string,
  subject: string,
  bodyIntro: string,
  payload?: unknown,
): Promise<void> {
  const code = generateNumericCode();
  await prisma.verificationCode.create({
    data: {
      userId,
      purpose,
      codeHash: hashToken(code),
      payload: payload !== undefined ? JSON.stringify(payload) : null,
      expiresAt: new Date(Date.now() + EXPIRY_MS),
    },
  });
  try {
    await sendMail(recipientEmail, subject, `${bodyIntro}\n\nVotre code de vérification : ${code}\n\nIl est valable 30 minutes.`);
  } catch (err) {
    console.error(`[verification] sendMail failed for purpose=${purpose}`, err);
  }
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

export async function canResend(userId: string, purpose: VerificationPurpose): Promise<boolean> {
  const last = await prisma.verificationCode.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: "desc" },
  });
  return !last || Date.now() - last.createdAt.getTime() >= RESEND_COOLDOWN_MS;
}
