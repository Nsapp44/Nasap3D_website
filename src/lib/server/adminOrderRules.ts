// Regles pures (sans base) du PATCH/DELETE admin des commandes.

export type AnyOrderStatus = "EXPERTISE" | "AWAITING_PAYMENT" | "PENDING" | "PRINTING" | "READY" | "DELIVERED" | "REJECTED";

// Transitions du PATCH generique, une fois la commande payee. Une cible egale
// au statut courant est toujours acceptee (ex. ajout du numero de suivi seul).
// Jamais de retour vers EXPERTISE / AWAITING_PAYMENT / REJECTED depuis PENDING
// et au-dela ; DELIVERED est terminal (garde separee dans la route).
const PAID_TRANSITIONS: Record<string, readonly AnyOrderStatus[]> = {
  PENDING: ["PRINTING", "READY", "DELIVERED"],
  PRINTING: ["PENDING", "READY", "DELIVERED"],
  READY: ["PENDING", "PRINTING", "DELIVERED"],
  DELIVERED: [],
};

// Statuts d'avant paiement : seule sortie par PATCH = `force` vers PENDING
// (paiement reel que le webhook a rate).
const PRE_PAYMENT: readonly AnyOrderStatus[] = ["EXPERTISE", "AWAITING_PAYMENT", "REJECTED"];

export function isTransitionAllowed(from: AnyOrderStatus, to: AnyOrderStatus, force = false): boolean {
  if (PRE_PAYMENT.includes(from)) return force && to === "PENDING";
  if (from === to) return true;
  return (PAID_TRANSITIONS[from] ?? []).includes(to);
}

// Une commande payee ou facturee ne se supprime pas (factures a conserver).
export function isOrderPaidOrInvoiced(order: {
  status: AnyOrderStatus;
  stripePaymentIntentId: string | null;
  invoice: unknown | null;
}): boolean {
  return (
    order.invoice != null ||
    order.stripePaymentIntentId != null ||
    !PRE_PAYMENT.includes(order.status)
  );
}
