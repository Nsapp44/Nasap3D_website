import { prisma } from "./prisma";
import { deleteQuoteJobFileIfOrphaned } from "./quoteCleanup";

// A cart line left untouched (no qty change, not added-to since) for this
// long is considered abandoned. Guest carts (no account) are wiped much
// sooner than a logged-in customer's — there's no way to come back to a
// guest cart except "still have the same browser/cookie", so it's treated
// as much more ephemeral. There's no separate quote-price expiry anymore —
// this sweep is the only thing that ever removes a cart line, so a
// surviving line's price is always the one it was quoted.
const GUEST_CART_TTL_MS = 60 * 60 * 1000; // 1h
const ACCOUNT_CART_TTL_MS = 48 * 60 * 60 * 1000; // 48h

// Run periodically (see src/middleware.ts) alongside sweepExpiredQuoteFiles
// — deletes abandoned cart lines and reclaims their quote's file the same
// way an explicit "Retirer" click does.
export async function sweepAbandonedCarts(): Promise<number> {
  const now = Date.now();
  const stale = await prisma.cartItem.findMany({
    where: {
      OR: [
        { userId: null, updatedAt: { lt: new Date(now - GUEST_CART_TTL_MS) } },
        { userId: { not: null }, updatedAt: { lt: new Date(now - ACCOUNT_CART_TTL_MS) } },
      ],
    },
    select: { id: true, quoteJobId: true },
  });

  // Per-item try/catch: without it, one line that fails (a storage error on
  // its file, a row already deleted by a concurrent "Retirer") aborted the
  // whole loop — and since the same line is first in the list again on the
  // next run, cleanup could stay stuck on it forever.
  for (const item of stale) {
    try {
      await prisma.cartItem.delete({ where: { id: item.id } });
      await deleteQuoteJobFileIfOrphaned(item.quoteJobId);
    } catch (err) {
      console.error(`[sweep] abandoned cart item ${item.id} failed, continuing`, err);
    }
  }
  return stale.length;
}
