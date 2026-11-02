import { describe, it, expect } from "vitest";
import { isTransitionAllowed, isOrderPaidOrInvoiced } from "../src/lib/server/adminOrderRules";

describe("isTransitionAllowed", () => {
  it("autorise d'avancer d'un cran et les corrections", () => {
    expect(isTransitionAllowed("PENDING", "PRINTING")).toBe(true);
    expect(isTransitionAllowed("PRINTING", "READY")).toBe(true);
    expect(isTransitionAllowed("PRINTING", "PENDING")).toBe(true);
    expect(isTransitionAllowed("READY", "PRINTING")).toBe(true);
    expect(isTransitionAllowed("READY", "DELIVERED")).toBe(true);
    expect(isTransitionAllowed("PRINTING", "PRINTING")).toBe(true);
  });
  it("autorise les sauts entre statuts payes, interdit les retours vers l'avant-paiement", () => {
    expect(isTransitionAllowed("PENDING", "DELIVERED")).toBe(true);
    expect(isTransitionAllowed("PENDING", "READY")).toBe(true);
    for (const from of ["PENDING", "PRINTING", "READY", "DELIVERED"] as const) {
      for (const to of ["EXPERTISE", "AWAITING_PAYMENT", "REJECTED"] as const) {
        expect(isTransitionAllowed(from, to)).toBe(false);
        expect(isTransitionAllowed(from, to, true)).toBe(false);
      }
    }
    expect(isTransitionAllowed("DELIVERED", "PRINTING")).toBe(false);
  });
  it("avant paiement : seulement force vers PENDING", () => {
    expect(isTransitionAllowed("AWAITING_PAYMENT", "PENDING")).toBe(false);
    expect(isTransitionAllowed("AWAITING_PAYMENT", "PENDING", true)).toBe(true);
    expect(isTransitionAllowed("EXPERTISE", "PRINTING", true)).toBe(false);
  });
});

describe("isOrderPaidOrInvoiced", () => {
  const base = { status: "EXPERTISE" as const, stripePaymentIntentId: null, invoice: null };
  it("supprimable si jamais payee", () => {
    expect(isOrderPaidOrInvoiced(base)).toBe(false);
    expect(isOrderPaidOrInvoiced({ ...base, status: "REJECTED" })).toBe(false);
  });
  it("bloque si payee ou facturee", () => {
    expect(isOrderPaidOrInvoiced({ ...base, status: "PENDING" })).toBe(true);
    expect(isOrderPaidOrInvoiced({ ...base, stripePaymentIntentId: "pi_1" })).toBe(true);
    expect(isOrderPaidOrInvoiced({ ...base, invoice: { id: "i" } })).toBe(true);
  });
});
