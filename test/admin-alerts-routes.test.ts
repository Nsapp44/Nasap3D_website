import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  order: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  shippingBoxStock: { findMany: vi.fn() },
  adminAlert: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("../src/lib/server/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/api/auth", () => ({ requireAdmin: vi.fn(async () => ({ id: "a1", email: "admin@x.fr", role: "ADMIN" })) }));

import { GET } from "../src/pages/api/admin/alerts/index";
import { PATCH } from "../src/pages/api/admin/alerts/[id]";
import { POST as manualLabel } from "../src/pages/api/admin/orders/[id]/manual-label";

type Ctx = Parameters<typeof GET>[0];
function ctx(params: Record<string, string> = {}, body?: unknown): Ctx {
  return {
    params,
    request: new Request("http://x/api", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  } as unknown as Ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /admin/alerts", () => {
  it("plafonne à 50 alertes", async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.shippingBoxStock.findMany.mockResolvedValue([]);
    prismaMock.adminAlert.findMany.mockResolvedValue(
      Array.from({ length: 80 }, (_, i) => ({
        id: `id${i}`,
        kind: "EMAIL_FAILED",
        key: `EMAIL_FAILED:o${i}`,
        orderId: `o${i}`,
        orderRef: `N3D-${i}`,
        message: "m",
        detail: null,
        count: 1,
        lastSeenAt: new Date(2026, 0, 1, 0, i),
      })),
    );
    const res = await GET(ctx());
    const { alerts } = (await res.json()) as { alerts: { id: string }[] };
    expect(alerts).toHaveLength(50);
    expect(alerts.every((a) => a.id)).toBe(true);
  });

  it("renvoie les alertes dérivées avec un id (= clé) et les enregistrées avec leur id", async () => {
    prismaMock.order.findMany.mockResolvedValue([{ id: "o1", ref: "N3D-1", status: "PENDING", invoice: null }]);
    prismaMock.shippingBoxStock.findMany.mockResolvedValue([]);
    prismaMock.adminAlert.findMany.mockResolvedValue([
      { id: "s1", kind: "PAYMENT_ANOMALY", key: "PAYMENT_ANOMALY:o2:pi_9", orderId: "o2", orderRef: "N3D-2", message: "m", detail: null, count: 2, lastSeenAt: new Date() },
    ]);
    const res = await GET(ctx());
    const { alerts } = (await res.json()) as { alerts: { id: string; key: string; kind: string; stripeRef?: string }[] };
    const inv = alerts.find((a) => a.kind === "INVOICE_MISSING");
    expect(inv?.id).toBe(inv?.key);
    const pay = alerts.find((a) => a.kind === "PAYMENT_ANOMALY");
    expect(pay?.id).toBe("s1");
    expect(pay?.stripeRef).toBe("pi_9");
  });
});

describe("PATCH /admin/alerts/[id]", () => {
  it("alerte dérivée -> 400", async () => {
    const res = await PATCH(ctx({ id: "INVOICE_MISSING:o1" }, { resolve: true }));
    expect(res.status).toBe(400);
    expect(prismaMock.adminAlert.update).not.toHaveBeenCalled();
  });
  it("corps invalide -> 400", async () => {
    expect((await PATCH(ctx({ id: "s1" }, {}))).status).toBe(400);
  });
  it("inconnue -> 404", async () => {
    prismaMock.adminAlert.findFirst.mockResolvedValue(null);
    expect((await PATCH(ctx({ id: "nope" }, { resolve: true }))).status).toBe(404);
  });
  it("résout une alerte enregistrée (par id ou clé, { action: 'resolve' } accepté)", async () => {
    prismaMock.adminAlert.findFirst.mockResolvedValue({ id: "s1" });
    prismaMock.adminAlert.update.mockResolvedValue({ id: "s1" });
    const res = await PATCH(ctx({ id: "PAYMENT_ANOMALY:o2:pi_9" }, { action: "resolve" }));
    expect(res.status).toBe(200);
    expect(prismaMock.adminAlert.update.mock.calls[0][0].data.resolvedAt).toBeInstanceOf(Date);
  });
});

describe("POST /admin/orders/[id]/manual-label", () => {
  it("refuse un numéro vide ou trop long", async () => {
    expect((await manualLabel(ctx({ id: "o1" }, { trackingNumber: "   " }))).status).toBe(400);
    expect((await manualLabel(ctx({ id: "o1" }, { trackingNumber: "x".repeat(101) }))).status).toBe(400);
    expect((await manualLabel(ctx({ id: "o1" }, { trackingNumber: 12 }))).status).toBe(400);
  });
  it("commande inexistante -> 404", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    expect((await manualLabel(ctx({ id: "o1" }, { trackingNumber: "AB1" }))).status).toBe(404);
  });
  it("commande non payée -> 409", async () => {
    for (const status of ["EXPERTISE", "AWAITING_PAYMENT", "REJECTED"]) {
      prismaMock.order.findUnique.mockResolvedValue({ id: "o1", status });
      expect((await manualLabel(ctx({ id: "o1" }, { trackingNumber: "AB1" }))).status).toBe(409);
    }
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });
  it("enregistre le suivi (trim), pose labelManualAt et résout LABEL_REFUSED", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: "o1", status: "PENDING" });
    prismaMock.order.update.mockResolvedValue({});
    prismaMock.adminAlert.updateMany.mockResolvedValue({ count: 1 });
    const res = await manualLabel(ctx({ id: "o1" }, { trackingNumber: "  AB123 " }));
    expect(res.status).toBe(200);
    const data = prismaMock.order.update.mock.calls[0][0].data;
    expect(data.trackingNumber).toBe("AB123");
    expect(data.labelManualAt).toBeInstanceOf(Date);
    expect(prismaMock.adminAlert.updateMany.mock.calls[0][0].where).toMatchObject({ kind: "LABEL_REFUSED", orderId: "o1" });
  });
});
