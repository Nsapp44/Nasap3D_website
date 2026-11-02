import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  order: { findUnique: vi.fn() },
  adminAlert: { upsert: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("../src/lib/server/prisma", () => ({ prisma: prismaMock }));

import { deriveAlerts, storedAlertToDTO, type AlertOrderInput } from "../src/lib/server/adminAlertsDerive";
import { recordAlert, resolveAlerts, alertKey } from "../src/lib/server/adminAlerts";
import { missingShippingFields, describeMissingFields } from "../src/lib/server/shippingChecks";

const full = {
  shippingMode: "HOME",
  shippingCarrierCode: "POFR",
  shippingServiceCode: "ColissimoHome",
  shippingWeightG: 500,
  shippingParcelLengthCm: 20,
  shippingParcelWidthCm: 15,
  shippingParcelHeightCm: 10,
  recipientName: "A B",
  recipientPhone: "0600000000",
  recipientAddress: "1 rue X",
  recipientCity: "Nantes",
  recipientZipcode: "44000",
  recipientCountry: "FR",
};

function order(over: Partial<AlertOrderInput> = {}): AlertOrderInput {
  return { id: "o1", ref: "N3D-1", status: "PENDING", invoice: { id: "i" }, ...full, ...over };
}
const kinds = (a: ReturnType<typeof deriveAlerts>) => a.map((x) => x.kind);

describe("shippingChecks", () => {
  it("liste les champs manquants et formule la phrase", () => {
    expect(missingShippingFields(full)).toEqual([]);
    const m = missingShippingFields({ ...full, recipientPhone: null, recipientZipcode: "" });
    expect(m).toEqual(["recipientPhone", "recipientZipcode"]);
    expect(describeMissingFields(m)).toBe("il manque le téléphone et le code postal du destinataire");
    expect(describeMissingFields(["shippingCarrierCode"])).toBe("données d'expédition manquantes, à vérifier");
  });
});

describe("deriveAlerts", () => {
  it("rien pour une commande saine", () => {
    expect(deriveAlerts([order()], [{ code: "S", qty: 3 }], [])).toEqual([]);
  });

  it("BOXTAL_NOT_CONFIGURED liste les variables", () => {
    const a = deriveAlerts([], [], ["BOXTAL_API_KEY_V1"]);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: "BOXTAL_NOT_CONFIGURED", severity: "critical", source: "derived" });
    expect(a[0].message).toContain("BOXTAL_API_KEY_V1");
  });

  it("ADDRESS_INCOMPLETE : champ destinataire manquant, PENDING/PRINTING seulement", () => {
    const a = deriveAlerts([order({ recipientPhone: null, recipientZipcode: null })], [], []);
    expect(kinds(a)).toEqual(["ADDRESS_INCOMPLETE"]);
    expect(a[0].message).toBe("N3D-1 : il manque le téléphone et le code postal du destinataire.");
    expect(a[0].severity).toBe("critical");
    expect(deriveAlerts([order({ status: "READY", recipientPhone: null })], [], [])).toEqual([]);
    expect(deriveAlerts([order({ status: "AWAITING_PAYMENT", recipientPhone: null })], [], [])).toEqual([]);
  });

  it("ADDRESS_INCOMPLETE disparaît si l'étiquette est faite", () => {
    for (const over of [{ boxtalOrderRef: "B1" }, { labelManualAt: new Date() }, { trackingNumber: "T1" }]) {
      expect(deriveAlerts([order({ recipientPhone: null, ...over })], [], [])).toEqual([]);
    }
  });

  it("RELAY_MISSING", () => {
    const a = deriveAlerts([order({ shippingMode: "RELAY", relayPointCode: null })], [], []);
    expect(kinds(a)).toEqual(["RELAY_MISSING"]);
    expect(a[0].actions).toContain("manual_label");
    expect(deriveAlerts([order({ shippingMode: "RELAY", relayPointCode: "R1" })], [], [])).toEqual([]);
  });

  it("INVOICE_MISSING : PENDING..DELIVERED sans facture, pas EXPERTISE/REJECTED", () => {
    for (const status of ["PENDING", "PRINTING", "READY", "DELIVERED"]) {
      const a = deriveAlerts([order({ status, invoice: null })], [], []);
      expect(kinds(a)).toEqual(["INVOICE_MISSING"]);
      expect(a[0].actions).toContain("generate_invoice");
    }
    for (const status of ["EXPERTISE", "AWAITING_PAYMENT", "REJECTED"]) {
      expect(deriveAlerts([order({ status, invoice: null })], [], [])).toEqual([]);
    }
  });

  it("WEIGHT_ONLY_QUOTE : hors DELIVERED/REJECTED, disparaît avec un n° de suivi", () => {
    const a = deriveAlerts([order({ shippingOversized: true })], [], []);
    expect(kinds(a)).toEqual(["WEIGHT_ONLY_QUOTE"]);
    expect(deriveAlerts([order({ shippingOversized: true, trackingNumber: "T" })], [], [])).toEqual([]);
    expect(deriveAlerts([order({ shippingOversized: true, status: "REJECTED" })], [], [])).toEqual([]);
  });

  it("rien sur DELIVERED/REJECTED (sauf facture manquante)", () => {
    for (const status of ["DELIVERED", "REJECTED"]) {
      const o = order({ status, recipientPhone: null, shippingOversized: true, shippingParcels: [{ box: "S" }] });
      expect(deriveAlerts([o], [], [])).toEqual([]);
      // stock vide : alerte groupée seulement en attention, ces commandes n'ont plus besoin de carton
      expect(deriveAlerts([o], [{ code: "S", qty: 0 }], []).map((a) => a.severity)).toEqual(["warning"]);
    }
  });

  it("rien sur PICKUP", () => {
    const o = order({
      shippingMode: "PICKUP",
      recipientPhone: null,
      shippingOversized: true,
      shippingParcels: [{ box: "S" }],
    });
    expect(deriveAlerts([o], [], [])).toEqual([]);
    expect(kinds(deriveAlerts([o], [{ code: "S", qty: 0 }], []))).toEqual(["BOX_STOCK_EMPTY"]);
    expect(deriveAlerts([o], [{ code: "S", qty: 0 }], [])[0].severity).toBe("warning");
  });

  it("BOX_STOCK_EMPTY : UNE alerte groupée, attention sans besoin", () => {
    const a = deriveAlerts([], [{ code: "XL", qty: 0 }, { code: "S", qty: 0 }, { code: "M", qty: 4 }], []);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: "BOX_STOCK_EMPTY", severity: "warning", actions: ["open_stock"] });
    expect(a[0].message).toBe("Plus de carton S ni XL.");
  });

  it("BOX_STOCK_EMPTY critique si une commande ouverte a besoin du carton", () => {
    const o = order({ ref: "N3D-45", shippingParcels: [{ box: "M" }] });
    const a = deriveAlerts([o], [{ code: "M", qty: 0 }], []);
    expect(a).toHaveLength(1);
    expect(a[0].severity).toBe("critical");
    expect(a[0].message).toContain("N3D-45 a besoin d'un M");
    // étiquette déjà faite : plus de besoin
    const done = order({ ref: "N3D-45", shippingParcels: [{ box: "M" }], trackingNumber: "T" });
    expect(deriveAlerts([done], [{ code: "M", qty: 0 }], [])[0].severity).toBe("warning");
  });

  it("tri : critiques d'abord, puis plus récentes", () => {
    const a = deriveAlerts(
      [
        order({ id: "a", ref: "A", invoice: null, updatedAt: "2026-11-01T10:00:00Z" }),
        order({ id: "b", ref: "B", invoice: null, updatedAt: "2026-11-02T10:00:00Z" }),
      ],
      [{ code: "S", qty: 0 }],
      [],
    );
    expect(a.map((x) => x.orderRef ?? x.kind)).toEqual(["B", "A", "BOX_STOCK_EMPTY"]);
  });
});

describe("storedAlertToDTO", () => {
  it("convertit une anomalie de paiement avec lien Stripe", () => {
    const d = storedAlertToDTO({
      id: "x",
      kind: "PAYMENT_ANOMALY",
      key: "PAYMENT_ANOMALY:o1:pi_123",
      orderId: "o1",
      orderRef: "N3D-1",
      message: "Paiement reçu",
      detail: null,
      count: 2,
      lastSeenAt: new Date("2026-11-02T10:00:00Z"),
    });
    expect(d).toMatchObject({ severity: "critical", source: "stored", stripeRef: "pi_123", count: 2 });
    expect(d.actions).toEqual(["open_stripe", "open_order", "resolve"]);
  });
});

describe("recordAlert / resolveAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("clé : kind:orderId|global (+ suffixe)", () => {
    expect(alertKey("LABEL_REFUSED", "o1")).toBe("LABEL_REFUSED:o1");
    expect(alertKey("TRACKING_UNREACHABLE")).toBe("TRACKING_UNREACHABLE:global");
    expect(alertKey("PAYMENT_ANOMALY", "o1", "pi_1")).toBe("PAYMENT_ANOMALY:o1:pi_1");
  });

  it("upsert par clé, count + 1 et remise à non résolu", async () => {
    prismaMock.adminAlert.upsert.mockResolvedValue({});
    await recordAlert({ kind: "LABEL_REFUSED", orderId: "o1", orderRef: "N3D-1", message: "m", detail: "<b>x</b>  y" });
    const arg = prismaMock.adminAlert.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ key: "LABEL_REFUSED:o1" });
    expect(arg.update).toMatchObject({ count: { increment: 1 }, resolvedAt: null, resolvedBy: null });
    expect(arg.create.detail).toBe("x y");
  });

  it("retrouve l'orderId par la ref", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: "o9" });
    prismaMock.adminAlert.upsert.mockResolvedValue({});
    await recordAlert({ kind: "EMAIL_FAILED", orderRef: "N3D-9", message: "m" });
    expect(prismaMock.adminAlert.upsert.mock.calls[0][0].where).toEqual({ key: "EMAIL_FAILED:o9" });
  });

  it("ne lève jamais, même si la base échoue", async () => {
    prismaMock.adminAlert.upsert.mockRejectedValue(new Error("db down"));
    await expect(recordAlert({ kind: "PAYMENT_ANOMALY", orderId: "o1", message: "m" })).resolves.toBeUndefined();
    prismaMock.adminAlert.updateMany.mockRejectedValue(new Error("db down"));
    await expect(resolveAlerts("LABEL_REFUSED", "o1")).resolves.toBe(0);
  });

  it("resolveAlerts pose resolvedBy auto", async () => {
    prismaMock.adminAlert.updateMany.mockResolvedValue({ count: 1 });
    await expect(resolveAlerts("LABEL_REFUSED", "o1")).resolves.toBe(1);
    const arg = prismaMock.adminAlert.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ kind: "LABEL_REFUSED", orderId: "o1", resolvedAt: null });
    expect(arg.data.resolvedBy).toBe("auto");
    await resolveAlerts("TRACKING_UNREACHABLE");
    expect(prismaMock.adminAlert.updateMany.mock.calls[1][0].where).toEqual({
      key: "TRACKING_UNREACHABLE:global",
      resolvedAt: null,
    });
  });
});
