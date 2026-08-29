// Statuses settable via the admin's free-form quick-status chips (PATCH
// /api/admin/orders/:id). Deliberately excludes:
// - EXPERTISE/AWAITING_PAYMENT: reached only via their own dedicated
//   accept/reject actions (each has a side effect — an email — a generic
//   "set any status" chip shouldn't casually trigger).
// - PENDING: only ever set by the Stripe webhook once actually paid — a
//   chip that could fake a "paid" status without a real payment would be a
//   serious bug, not just a UX nicety.
// - REJECTED: terminal, time-limited (see sweepRejectedOrders), only ever
//   reached via the reject action.
export const ORDER_STATUSES = ["PRINTING", "READY", "DELIVERED"] as const;
// Every status, for the GET /api/admin/orders list filter — a superset of
// the admin-settable ones above.
export const ORDER_FILTER_STATUSES = ["EXPERTISE", "AWAITING_PAYMENT", "PENDING", ...ORDER_STATUSES, "REJECTED"] as const;
