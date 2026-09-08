import { prisma } from "./prisma";
import { deleteFile } from "./storage";

// Deletes the uploaded file for a quote job if nothing still needs it: no
// cart line references it anymore, and it was never turned into a real
// order. The QuoteJob row itself is kept (fileDeletedAt marks it, same
// pattern as the admin "reclaim storage after printing" action) — only the
// file on disk is reclaimed. Called right after a cart line is removed; a
// QuoteJob can in principle be referenced by more than one CartItem (no
// unique constraint), hence the "still in cart" check rather than assuming
// this was the only one.
export async function deleteQuoteJobFileIfOrphaned(quoteJobId: string): Promise<void> {
  const job = await prisma.quoteJob.findUnique({ where: { id: quoteJobId } });
  if (!job || job.fileDeletedAt) return;

  const [stillInCart, everOrdered] = await Promise.all([
    prisma.cartItem.findFirst({ where: { quoteJobId } }),
    prisma.orderItem.findFirst({ where: { quoteJobId } }),
  ]);
  if (stillInCart || everOrdered) return;

  await deleteFile(job.fileKey);
  await prisma.quoteJob.update({ where: { id: quoteJobId }, data: { fileDeletedAt: new Date() } });
}

// Deliberately shorter than cartCleanup.ts's own guest TTL (1h) — a
// never-carted quote's file is written to storage the moment "Analyse auto"
// prices it, before the visitor has committed to anything; on request, this
// treats it as abandoned much sooner (10 minutes, roughly how long an
// active visit takes) since leaving the page resets the wizard's own
// client-side state anyway, so nothing is lost by wiping the server copy
// that fast. A quote that DOES get added to a cart is untouched by this —
// deleteQuoteJobFileIfOrphaned's stillInCart check below skips it
// regardless of its own age, and it then follows cartCleanup.ts's longer
// timeline instead (1h guest / 48h account) once that cart line itself
// expires. There's no cart line to anchor "inactive since" on for a
// never-carted quote, so this uses the QuoteJob's own createdAt instead.
const GUEST_QUOTE_TTL_MS = 10 * 60 * 1000; // 10min
const ACCOUNT_QUOTE_TTL_MS = 48 * 60 * 60 * 1000; // 48h

// Periodic sweep (wired in src/middleware.ts) — the backstop for quotes
// that were uploaded/analyzed but never added to any cart at all (so
// cartCleanup.ts never gets a chance to run deleteQuoteJobFileIfOrphaned
// for them), and for the rare case the best-effort sendBeacon discard
// (POST /api/quotes/:id/discard) never reached the server.
// deleteQuoteJobFileIfOrphaned still re-checks cart membership and order
// history itself, so a quote that's old but legitimately still in an
// active cart is safely skipped here regardless of this sweep's own age
// threshold.
export async function sweepExpiredQuoteFiles(): Promise<number> {
  const now = Date.now();
  const candidates = await prisma.quoteJob.findMany({
    where: {
      fileDeletedAt: null,
      OR: [
        { userId: null, createdAt: { lt: new Date(now - GUEST_QUOTE_TTL_MS) } },
        { userId: { not: null }, createdAt: { lt: new Date(now - ACCOUNT_QUOTE_TTL_MS) } },
      ],
    },
    select: { id: true },
  });
  for (const job of candidates) {
    await deleteQuoteJobFileIfOrphaned(job.id);
  }
  return candidates.length;
}
