import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const updateMany = vi.fn();
vi.mock("../src/lib/server/prisma", () => ({
  prisma: { order: { findUnique: (...a: unknown[]) => findUnique(...a), updateMany: (...a: unknown[]) => updateMany(...a) } },
}));

const createInvoice = vi.fn();
vi.mock("../src/lib/server/invoiceGenerator", () => ({ createAndAttachInvoiceForOrder: (...a: unknown[]) => createInvoice(...a) }));

const notifyPaid = vi.fn();
const sendPaid = vi.fn();
const notifyAnomaly = vi.fn();
vi.mock("../src/lib/server/orderEmails", () => ({
  notifyAdminOrderPaid: (...a: unknown[]) => notifyPaid(...a),
  sendOrderPaidEmail: (...a: unknown[]) => sendPaid(...a),
  notifyAdminPaymentAnomaly: (...a: unknown[]) => notifyAnomaly(...a),
}));

import type Stripe from "stripe";
import { checkPaidSession, paymentIntentIdOf, applyPaidCheckoutSession, handleAsyncPaymentFailed } from "../src/lib/server/stripePayment";

const order = { id: "o1", ref: "NS-001", totalCents: 4590, status: "AWAITING_PAYMENT", user: { email: "client@example.com" }, items: [] };

function makeSession(over: Record<string, unknown> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_1",
    payment_status: "paid",
    amount_total: 4590,
    currency: "eur",
    payment_intent: "pi_1",
    customer_email: "client@example.com",
    metadata: { orderId: "o1" },
    ...over,
  } as unknown as Stripe.Checkout.Session;
}

beforeEach(() => {
  for (const m of [findUnique, updateMany, createInvoice, notifyPaid, sendPaid, notifyAnomaly]) m.mockReset();
  createInvoice.mockResolvedValue({ attached: true });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("checkPaidSession", () => {
  const base = { payment_status: "paid", amount_total: 4590, currency: "EUR" };
  it("accepte une session payée, bon montant, EUR", () => {
    expect(checkPaidSession(base, { totalCents: 4590 })).toEqual({ ok: true });
  });
  it("refuse une session non payée", () => {
    expect(checkPaidSession({ ...base, payment_status: "unpaid" }, { totalCents: 4590 })).toEqual({ ok: false, reason: "not_paid" });
  });
  it("refuse un montant différent", () => {
    expect(checkPaidSession({ ...base, amount_total: 100 }, { totalCents: 4590 })).toEqual({ ok: false, reason: "amount_mismatch" });
  });
  it("refuse une autre devise", () => {
    expect(checkPaidSession({ ...base, currency: "usd" }, { totalCents: 4590 })).toEqual({ ok: false, reason: "currency_mismatch" });
  });
});

describe("paymentIntentIdOf", () => {
  it("string -> tel quel", () => expect(paymentIntentIdOf({ payment_intent: "pi_1" })).toBe("pi_1"));
  it("objet -> son id", () => expect(paymentIntentIdOf({ payment_intent: { id: "pi_2" } })).toBe("pi_2"));
  it("null -> null (jamais la chaîne \"null\")", () => {
    expect(paymentIntentIdOf({ payment_intent: null })).toBeNull();
    expect(paymentIntentIdOf({})).toBeNull();
  });
});

describe("applyPaidCheckoutSession", () => {
  it("count 1 -> applied, facture + 2 emails une fois", async () => {
    findUnique.mockResolvedValue(order);
    updateMany.mockResolvedValue({ count: 1 });
    expect(await applyPaidCheckoutSession(makeSession(), "checkout.session.completed")).toBe("applied");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "o1", status: "AWAITING_PAYMENT" },
      data: { status: "PENDING", stripeCheckoutSessionId: "cs_1", stripePaymentIntentId: "pi_1" },
    });
    expect(createInvoice).toHaveBeenCalledTimes(1);
    expect(notifyPaid).toHaveBeenCalledTimes(1);
    expect(notifyPaid).toHaveBeenCalledWith("NS-001", "client@example.com", 4590);
    expect(sendPaid).toHaveBeenCalledTimes(1);
    expect(sendPaid).toHaveBeenCalledWith("client@example.com", "NS-001", 4590);
    expect(notifyAnomaly).not.toHaveBeenCalled();
  });

  it("count 1 sans PaymentIntent -> ne stocke pas stripePaymentIntentId", async () => {
    findUnique.mockResolvedValue(order);
    updateMany.mockResolvedValue({ count: 1 });
    await applyPaidCheckoutSession(makeSession({ payment_intent: null }), "checkout.session.completed");
    const data = updateMany.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("stripePaymentIntentId");
  });

  it("count 0 + même PaymentIntent -> duplicate, ni suites ni alerte", async () => {
    findUnique.mockResolvedValueOnce(order).mockResolvedValueOnce({ status: "PENDING", stripePaymentIntentId: "pi_1" });
    updateMany.mockResolvedValue({ count: 0 });
    expect(await applyPaidCheckoutSession(makeSession(), "checkout.session.completed")).toBe("duplicate");
    expect(createInvoice).not.toHaveBeenCalled();
    expect(notifyPaid).not.toHaveBeenCalled();
    expect(sendPaid).not.toHaveBeenCalled();
    expect(notifyAnomaly).not.toHaveBeenCalled();
  });

  it("count 0 + PaymentIntent différent -> anomaly, alerte, pas de facture", async () => {
    findUnique.mockResolvedValueOnce(order).mockResolvedValueOnce({ status: "PENDING", stripePaymentIntentId: "pi_other" });
    updateMany.mockResolvedValue({ count: 0 });
    expect(await applyPaidCheckoutSession(makeSession(), "checkout.session.completed")).toBe("anomaly");
    expect(notifyAnomaly).toHaveBeenCalledTimes(1);
    expect(notifyAnomaly.mock.calls[0][0]).toBe("NS-001");
    expect(notifyAnomaly.mock.calls[0][1]).toContain("PENDING");
    expect(notifyAnomaly.mock.calls[0][2]).toBe("pi_1");
    expect(createInvoice).not.toHaveBeenCalled();
    expect(sendPaid).not.toHaveBeenCalled();
  });

  it("count 0 + aucun PaymentIntent en base (virement forcé à la main) -> anomaly", async () => {
    findUnique.mockResolvedValueOnce(order).mockResolvedValueOnce({ status: "PENDING", stripePaymentIntentId: null });
    updateMany.mockResolvedValue({ count: 0 });
    expect(await applyPaidCheckoutSession(makeSession(), "checkout.session.completed")).toBe("anomaly");
    expect(notifyAnomaly).toHaveBeenCalledTimes(1);
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("count 0 + session sans PaymentIntent -> anomaly (jamais un doublon sans preuve)", async () => {
    findUnique.mockResolvedValueOnce(order).mockResolvedValueOnce({ status: "PENDING", stripePaymentIntentId: null });
    updateMany.mockResolvedValue({ count: 0 });
    expect(await applyPaidCheckoutSession(makeSession({ payment_intent: null }), "checkout.session.completed")).toBe("anomaly");
    expect(notifyAnomaly.mock.calls[0][2]).toBe("cs_1");
  });

  it("montant faux -> anomaly, updateMany jamais appelé", async () => {
    findUnique.mockResolvedValue(order);
    expect(await applyPaidCheckoutSession(makeSession({ amount_total: 100 }), "checkout.session.completed")).toBe("anomaly");
    expect(updateMany).not.toHaveBeenCalled();
    expect(notifyAnomaly).toHaveBeenCalledTimes(1);
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it("completed + unpaid (paiement différé) -> ignored, updateMany jamais appelé", async () => {
    findUnique.mockResolvedValue(order);
    expect(await applyPaidCheckoutSession(makeSession({ payment_status: "unpaid" }), "checkout.session.completed")).toBe("ignored");
    expect(updateMany).not.toHaveBeenCalled();
    expect(notifyAnomaly).not.toHaveBeenCalled();
  });

  it("async_payment_succeeded payé -> applied", async () => {
    findUnique.mockResolvedValue(order);
    updateMany.mockResolvedValue({ count: 1 });
    expect(await applyPaidCheckoutSession(makeSession(), "checkout.session.async_payment_succeeded")).toBe("applied");
    expect(createInvoice).toHaveBeenCalledTimes(1);
  });

  it("metadata sans orderId -> ignored", async () => {
    expect(await applyPaidCheckoutSession(makeSession({ metadata: {} }), "checkout.session.completed")).toBe("ignored");
    expect(findUnique).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("commande introuvable -> ignored", async () => {
    findUnique.mockResolvedValue(null);
    expect(await applyPaidCheckoutSession(makeSession(), "checkout.session.completed")).toBe("ignored");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("une erreur BDD sur updateMany remonte (500 -> Stripe réessaie)", async () => {
    findUnique.mockResolvedValue(order);
    updateMany.mockRejectedValue(new Error("db down"));
    await expect(applyPaidCheckoutSession(makeSession(), "checkout.session.completed")).rejects.toThrow("db down");
  });

  it("un échec de facture/email ne fait pas échouer : applied quand même", async () => {
    findUnique.mockResolvedValue(order);
    updateMany.mockResolvedValue({ count: 1 });
    createInvoice.mockRejectedValue(new Error("pdf down"));
    expect(await applyPaidCheckoutSession(makeSession(), "checkout.session.completed")).toBe("applied");
  });
});

describe("handleAsyncPaymentFailed", () => {
  it("alerte l'admin sans modifier la commande", async () => {
    findUnique.mockResolvedValue({ ref: "NS-001" });
    await handleAsyncPaymentFailed(makeSession());
    expect(notifyAnomaly).toHaveBeenCalledTimes(1);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("commande introuvable -> log seulement", async () => {
    findUnique.mockResolvedValue(null);
    await handleAsyncPaymentFailed(makeSession());
    expect(notifyAnomaly).not.toHaveBeenCalled();
  });
});
