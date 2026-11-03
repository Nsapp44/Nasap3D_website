import { describe, it, expect, vi, beforeEach } from "vitest";

// Stock de cartons simule en memoire + commandes simulees en memoire.
const state = vi.hoisted(() => ({
  stock: {} as Record<string, number>,
  orders: {} as Record<string, Record<string, unknown>>,
}));

const prismaMock = vi.hoisted(() => ({
  order: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  shippingBoxStock: { updateMany: vi.fn() },
}));
vi.mock("../src/lib/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/api/auth", () => ({ requireAdmin: vi.fn(async () => ({ id: "a1", email: "admin@x.fr", role: "ADMIN" })) }));
vi.mock("../src/lib/server/orderTracking", () => ({
  SHIPPING_DATA_PURGE: { shippingParcels: null },
  purgeOrderFiles: vi.fn(async () => {}),
}));
vi.mock("../src/lib/server/invoiceGenerator", () => ({ createAndAttachInvoiceForOrder: vi.fn(async () => ({ attached: true })) }));
vi.mock("../src/lib/server/storage", () => ({ deleteFile: vi.fn(async () => {}) }));
vi.mock("../src/lib/server/orderEmails", () => ({
  notifyAdminOrderPaid: vi.fn(),
  sendOrderPaidEmail: vi.fn(),
  notifyAdminPaymentAnomaly: vi.fn(),
}));

import type Stripe from "stripe";
import { PATCH } from "../src/pages/api/admin/orders/[id]/index";
import { applyPaidCheckoutSession } from "../src/lib/server/stripePayment";

type Ctx = Parameters<typeof PATCH>[0];
function ctx(body: unknown): Ctx {
  return {
    params: { id: "o1" },
    request: new Request("http://x/api", { method: "PATCH", body: JSON.stringify(body) }),
  } as unknown as Ctx;
}

function makeOrder(over: Record<string, unknown> = {}) {
  return {
    id: "o1",
    ref: "NS-001",
    totalCents: 4590,
    status: "PENDING",
    shippingMode: "COLISSIMO",
    trackingNumber: null,
    printingAt: null,
    readyAt: null,
    deliveredAt: null,
    shippingParcels: [{ box: "S" }, { box: "S" }, { box: "M" }],
    user: { email: "client@example.com" },
    items: [],
    ...over,
  };
}

function session(): Stripe.Checkout.Session {
  return {
    id: "cs_1",
    payment_status: "paid",
    amount_total: 4590,
    currency: "eur",
    payment_intent: "pi_1",
    customer_email: "client@example.com",
    metadata: { orderId: "o1" },
  } as unknown as Stripe.Checkout.Session;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.stock = { S: 10, M: 5 };
  state.orders = { o1: makeOrder() };

  prismaMock.order.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    const o = state.orders[where.id];
    return o ? { ...o } : null;
  });
  prismaMock.order.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const o = state.orders[where.id];
    for (const [k, v] of Object.entries(data)) if (v !== undefined) o[k] = v;
    return { ...o };
  });
  prismaMock.order.updateMany.mockImplementation(async ({ where, data }: { where: { id: string; status: string }; data: Record<string, unknown> }) => {
    const o = state.orders[where.id];
    if (!o || o.status !== where.status) return { count: 0 };
    Object.assign(o, data);
    return { count: 1 };
  });
  prismaMock.shippingBoxStock.updateMany.mockImplementation(
    async ({ where, data }: { where: { code: string; qty?: { gte: number } }; data: { qty: number | { decrement: number } } }) => {
      const cur = state.stock[where.code];
      if (cur === undefined) return { count: 0 };
      if (where.qty && !(cur >= where.qty.gte)) return { count: 0 };
      state.stock[where.code] = typeof data.qty === "number" ? data.qty : cur - data.qty.decrement;
      return { count: 1 };
    },
  );
});

describe("stock de cartons : parcours paiement -> expedition", () => {
  it("1. le paiement (webhook) ne baisse pas le stock", async () => {
    state.orders.o1 = makeOrder({ status: "AWAITING_PAYMENT" });
    expect(await applyPaidCheckoutSession(session(), "checkout.session.completed")).toBe("applied");
    expect(state.orders.o1.status).toBe("PENDING");
    expect(prismaMock.shippingBoxStock.updateMany).not.toHaveBeenCalled();
    expect(state.stock).toEqual({ S: 10, M: 5 });
  });

  it("2. PENDING -> READY (avec suivi) baisse 1 par carton", async () => {
    const res = await PATCH(ctx({ status: "READY", trackingNumber: "TRK123" }));
    expect(res.status).toBe(200);
    expect(state.stock).toEqual({ S: 8, M: 4 });
    expect(state.orders.o1.readyAt).toBeInstanceOf(Date);
  });

  it("3. READY -> PRINTING -> READY ne rebaisse pas", async () => {
    expect((await PATCH(ctx({ status: "READY", trackingNumber: "TRK123" }))).status).toBe(200);
    expect(state.stock).toEqual({ S: 8, M: 4 });
    expect((await PATCH(ctx({ status: "PRINTING" }))).status).toBe(200);
    expect((await PATCH(ctx({ status: "READY" }))).status).toBe(200);
    expect(state.stock).toEqual({ S: 8, M: 4 });
  });

  it("4. PRINTING -> DELIVERED direct (sans readyAt) baisse avec les cartons lus avant l'effacement", async () => {
    state.orders.o1 = makeOrder({ status: "PRINTING" });
    const res = await PATCH(ctx({ status: "DELIVERED" }));
    expect(res.status).toBe(200);
    expect(state.orders.o1.shippingParcels).toBeNull(); // purge bien appliquee
    expect(state.stock).toEqual({ S: 8, M: 4 }); // mais le stock a baisse
  });

  it("5. stock a 0 : reste a 0, le PATCH repond OK", async () => {
    state.stock = { S: 0, M: 5 };
    const res = await PATCH(ctx({ status: "READY", trackingNumber: "TRK123" }));
    expect(res.status).toBe(200);
    expect(state.stock.S).toBe(0);
    expect(state.stock.M).toBe(4);
  });

  it("5b. stock insuffisant (1 pour 2 cartons) : plafonne a 0, jamais negatif", async () => {
    state.stock = { S: 1, M: 5 };
    const res = await PATCH(ctx({ status: "READY", trackingNumber: "TRK123" }));
    expect(res.status).toBe(200);
    expect(state.stock.S).toBe(0);
  });

  it("6a. commande PICKUP sans shippingParcels : aucune baisse, pas d'erreur", async () => {
    state.orders.o1 = makeOrder({ shippingMode: "PICKUP", shippingParcels: null });
    const res = await PATCH(ctx({ status: "READY" }));
    expect(res.status).toBe(200);
    expect(prismaMock.shippingBoxStock.updateMany).not.toHaveBeenCalled();
    expect(state.stock).toEqual({ S: 10, M: 5 });
  });

  it("6b. PICKUP avec shippingParcels vide : aucune baisse", async () => {
    state.orders.o1 = makeOrder({ shippingMode: "PICKUP", shippingParcels: [] });
    const res = await PATCH(ctx({ status: "READY" }));
    expect(res.status).toBe(200);
    expect(state.stock).toEqual({ S: 10, M: 5 });
  });
});
