// Decision logic for POST /api/orders/[id]/pay: what to do with the Stripe
// Checkout Session already stored on an order, so that a double click, two
// tabs or a browser back never produce two payable sessions for one order.
//
//  - "reuse"            : the stored session is still open and matches the
//                         order (amount + orderId) -> give its URL back.
//  - "in_progress"      : the stored session is complete (paid, or a delayed
//                         payment is pending): the webhook will move the order
//                         to PENDING, never create another session.
//  - "expire_and_create": still open but amount/orderId do not match (defensive
//                         check) -> expire it, then create a fresh one.
//  - "create"           : expired or unknown status -> create a fresh one.

export type StoredSession = {
  id: string;
  status: string | null;
  amount_total: number | null;
  url: string | null;
  metadata?: Record<string, string> | null;
};

export type StoredSessionDecision = "reuse" | "in_progress" | "expire_and_create" | "create";

export function decideStoredSession(
  existing: StoredSession,
  expectedTotalCents: number,
  orderId: string,
): StoredSessionDecision {
  if (existing.status === "complete") return "in_progress";

  if (existing.status === "open") {
    const matches =
      existing.amount_total === expectedTotalCents && existing.metadata?.orderId === orderId;
    if (matches && typeof existing.url === "string" && existing.url !== "") return "reuse";
    return "expire_and_create";
  }

  return "create";
}
