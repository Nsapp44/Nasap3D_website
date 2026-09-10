// Statuses settable via the admin's free-form quick-status chips (PATCH
// /api/admin/orders/:id). Deliberately excludes:
// - EXPERTISE/AWAITING_PAYMENT: reached only via their own dedicated
//   accept/reject actions (each has a side effect — an email — a generic
//   "set any status" chip shouldn't casually trigger).
// - REJECTED: terminal, time-limited (see sweepRejectedOrders), only ever
//   reached via the reject action.
//
// PENDING is included, but ONLY reachable through this route's `force`
// override (see [id]/index.ts's own comment) — normally it's still only
// ever set by the Stripe webhook once actually paid; a chip that could fake
// a "paid" status without a real payment would be a serious bug, not just a
// UX nicety. It has to be a valid enum value here regardless, since the
// emergency-override case (a real payment the webhook failed to record) is
// exactly a transition INTO PENDING — the `force`-gated guard in
// [id]/index.ts is what keeps this from being reachable without it, not
// this list.
export const ORDER_STATUSES = ["PENDING", "PRINTING", "READY", "DELIVERED"] as const;
// Every status, for the GET /api/admin/orders list filter — a superset of
// the admin-settable ones above (PENDING now already in ORDER_STATUSES —
// not repeated here).
export const ORDER_FILTER_STATUSES = ["EXPERTISE", "AWAITING_PAYMENT", ...ORDER_STATUSES, "REJECTED"] as const;
