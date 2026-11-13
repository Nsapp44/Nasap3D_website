import { describe, it, expect } from "vitest";
import { decideStoredSession } from "../src/lib/server/checkoutSession";

const ORDER = "order_1";
const TOTAL = 4590;

const base = {
  id: "cs_1",
  status: "open" as string | null,
  amount_total: TOTAL as number | null,
  url: "https://checkout.stripe.com/c/pay/cs_1" as string | null,
  metadata: { orderId: ORDER } as Record<string, string> | null | undefined,
};

describe("decideStoredSession", () => {
  it("reuse : session ouverte, bon montant, bonne commande, url presente", () => {
    expect(decideStoredSession(base, TOTAL, ORDER)).toBe("reuse");
  });

  it("in_progress : session complete (payee ou paiement differe)", () => {
    expect(decideStoredSession({ ...base, status: "complete" }, TOTAL, ORDER)).toBe("in_progress");
  });

  it("in_progress : complete meme si le montant ou l'orderId different", () => {
    expect(decideStoredSession({ ...base, status: "complete", amount_total: 1 }, TOTAL, ORDER)).toBe("in_progress");
    expect(decideStoredSession({ ...base, status: "complete", metadata: { orderId: "autre" } }, TOTAL, ORDER)).toBe(
      "in_progress",
    );
  });

  it("expire_and_create : session ouverte avec un montant different", () => {
    expect(decideStoredSession({ ...base, amount_total: TOTAL + 100 }, TOTAL, ORDER)).toBe("expire_and_create");
  });

  it("expire_and_create : session ouverte pour une autre commande", () => {
    expect(decideStoredSession({ ...base, metadata: { orderId: "order_2" } }, TOTAL, ORDER)).toBe("expire_and_create");
  });

  it("expire_and_create : session ouverte sans metadata (null)", () => {
    expect(decideStoredSession({ ...base, metadata: null }, TOTAL, ORDER)).toBe("expire_and_create");
  });

  it("expire_and_create : session ouverte sans metadata (absente) ou metadata vide", () => {
    expect(decideStoredSession({ ...base, metadata: undefined }, TOTAL, ORDER)).toBe("expire_and_create");
    expect(decideStoredSession({ ...base, metadata: {} }, TOTAL, ORDER)).toBe("expire_and_create");
  });

  it("expire_and_create : session ouverte avec amount_total null", () => {
    expect(decideStoredSession({ ...base, amount_total: null }, TOTAL, ORDER)).toBe("expire_and_create");
  });

  it("jamais reuse : session ouverte sans url (null ou vide)", () => {
    expect(decideStoredSession({ ...base, url: null }, TOTAL, ORDER)).not.toBe("reuse");
    expect(decideStoredSession({ ...base, url: "" }, TOTAL, ORDER)).not.toBe("reuse");
  });

  it("create : session expiree", () => {
    expect(decideStoredSession({ ...base, status: "expired", url: null }, TOTAL, ORDER)).toBe("create");
  });

  it("create : statut inconnu ou null", () => {
    expect(decideStoredSession({ ...base, status: null }, TOTAL, ORDER)).toBe("create");
    expect(decideStoredSession({ ...base, status: "whatever" }, TOTAL, ORDER)).toBe("create");
  });

  it("montant attendu a 0 : ne reutilise pas une session a un autre montant", () => {
    expect(decideStoredSession(base, 0, ORDER)).toBe("expire_and_create");
  });
});
