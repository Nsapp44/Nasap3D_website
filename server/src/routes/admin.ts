import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../lib/session.js";
import { readFileByKey, deleteFile } from "../lib/storage.js";
import { purchaseShippingLabel, BoxtalConfigError, BoxtalApiError } from "../lib/boxtal.js";
import { refreshOrderTrackingStatus, SHIPPING_DATA_PURGE } from "../lib/orderTracking.js";

const ORDER_STATUSES = ["PENDING", "PRINTING", "READY", "DELIVERED"] as const;

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  // ---- Materials / stock ----------------------------------------------
  app.get("/admin/materials", async (_request, reply) => {
    const materials = await prisma.material.findMany({
      orderBy: { label: "asc" },
      include: { colors: { orderBy: { colorName: "asc" } } },
    });
    return reply.send({ materials });
  });

  app.patch("/admin/materials/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({ pricePerKgCents: z.number().int().positive() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const material = await prisma.material.findUnique({ where: { id } });
    if (!material) return reply.code(404).send({ error: "not_found" });

    const updated = await prisma.material.update({
      where: { id },
      data: { pricePerKgCents: body.data.pricePerKgCents },
    });
    return reply.send({ material: updated });
  });

  app.patch("/admin/materials/:materialId/colors/:colorId", async (request, reply) => {
    const { materialId, colorId } = request.params as { materialId: string; colorId: string };
    const schema = z.object({ inStock: z.boolean() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const color = await prisma.materialColor.findUnique({ where: { id: colorId } });
    if (!color || color.materialId !== materialId) return reply.code(404).send({ error: "not_found" });

    const updated = await prisma.materialColor.update({
      where: { id: colorId },
      data: { inStock: body.data.inStock },
    });
    return reply.send({ color: updated });
  });

  // ---- Orders -----------------------------------------------------------
  app.get("/admin/orders", async (request, reply) => {
    const query = request.query as { status?: string };
    const status = query.status && (ORDER_STATUSES as readonly string[]).includes(query.status)
      ? (query.status as (typeof ORDER_STATUSES)[number])
      : undefined;

    const [orders, counts] = await Promise.all([
      prisma.order.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          items: { include: { quoteJob: { select: { fileName: true, fileDeletedAt: true } } } },
          user: { select: { email: true, customerNo: true } },
        },
      }),
      prisma.order.groupBy({ by: ["status"], _count: true }),
    ]);

    const countByStatus: Record<string, number> = {};
    for (const c of counts) countByStatus[c.status] = c._count;

    return reply.send({
      orders: orders.map((o) => ({
        id: o.id,
        ref: o.ref,
        clientEmail: o.user.email,
        customerNo: o.user.customerNo,
        status: o.status,
        totalCents: o.totalCents,
        createdAt: o.createdAt,
        shippingMode: o.shippingMode,
        shippingLabel: o.shippingLabel,
        shippingOversized: o.shippingOversized,
        canBuyLabel: !!o.shippingMode && !!o.shippingCarrierCode && !!o.shippingServiceCode && !!o.shippingWeightG,
        boxtalOrderRef: o.boxtalOrderRef,
        shippingLabelUrl: o.shippingLabelUrl,
        trackingNumber: o.trackingNumber,
        recipientName: o.recipientName,
        recipientPhone: o.recipientPhone,
        recipientAddress: o.recipientAddress,
        recipientCity: o.recipientCity,
        recipientZipcode: o.recipientZipcode,
        recipientCountry: o.recipientCountry,
        relayPointName: o.relayPointName,
        relayPointAddress: o.relayPointAddress,
        relayPointCity: o.relayPointCity,
        relayPointZipcode: o.relayPointZipcode,
        items: o.items.map((i) => ({
          id: i.id,
          nameSnapshot: i.nameSnapshot,
          materialSnapshot: i.materialSnapshot,
          qty: i.qty,
          fileName: i.quoteJob?.fileName ?? null,
          fileAvailable: !!i.quoteJob && !i.quoteJob.fileDeletedAt,
        })),
      })),
      counts: {
        all: counts.reduce((sum, c) => sum + c._count, 0),
        ...countByStatus,
      },
    });
  });

  // Original STL/3MF upload for one order line — kept only as long as it's
  // needed for printing. See deleteFile() below to reclaim the storage
  // afterward.
  app.get("/admin/orders/:orderId/items/:itemId/file", async (request, reply) => {
    const { orderId, itemId } = request.params as { orderId: string; itemId: string };
    const item = await prisma.orderItem.findUnique({ where: { id: itemId }, include: { quoteJob: true } });
    if (!item || item.orderId !== orderId || !item.quoteJob || item.quoteJob.fileDeletedAt) {
      return reply.code(404).send({ error: "not_found" });
    }

    const buffer = await readFileByKey(item.quoteJob.fileKey);
    return reply
      .header("Content-Disposition", `attachment; filename="${item.quoteJob.fileName.replace(/"/g, "")}"`)
      .header("Content-Type", "application/octet-stream")
      .send(buffer);
  });

  app.delete("/admin/orders/:orderId/items/:itemId/file", async (request, reply) => {
    const { orderId, itemId } = request.params as { orderId: string; itemId: string };
    const item = await prisma.orderItem.findUnique({ where: { id: itemId }, include: { quoteJob: true } });
    if (!item || item.orderId !== orderId || !item.quoteJob) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (item.quoteJob.fileDeletedAt) return reply.send({ ok: true });

    await deleteFile(item.quoteJob.fileKey);
    await prisma.quoteJob.update({ where: { id: item.quoteJob.id }, data: { fileDeletedAt: new Date() } });
    return reply.send({ ok: true });
  });

  // Achat RÉEL de l'étiquette d'expédition (Boxtal api/v1/order) — argent
  // réel, jamais déclenché automatiquement. boxtalOrderRef déjà rempli =
  // garde-fou anti-double-achat (409, pas de nouvel appel à Boxtal).
  app.post("/admin/orders/:id/shipping-label", async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await prisma.order.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
    if (!order) return reply.code(404).send({ error: "not_found" });
    if (order.boxtalOrderRef) return reply.code(409).send({ error: "label_already_purchased" });
    // Retrait à l'atelier : gratuit, jamais expédié, rien à acheter chez
    // Boxtal — narrows shippingMode to "RELAY" | "HOME" for TS below.
    if (order.shippingMode === "PICKUP") return reply.code(409).send({ error: "not_shippable" });
    if (
      !order.shippingMode ||
      !order.shippingCarrierCode ||
      !order.shippingServiceCode ||
      !order.shippingWeightG ||
      !order.shippingParcelLengthCm ||
      !order.shippingParcelWidthCm ||
      !order.shippingParcelHeightCm ||
      !order.recipientName ||
      !order.recipientPhone ||
      !order.recipientAddress ||
      !order.recipientCity ||
      !order.recipientZipcode ||
      !order.recipientCountry
    ) {
      return reply.code(409).send({ error: "missing_shipping_info" });
    }
    if (order.shippingMode === "RELAY" && !order.relayPointCode) {
      return reply.code(409).send({ error: "missing_relay_point" });
    }
    // La pièce ne rentrait dans aucun des 3 formats de carton connus au
    // moment du paiement (voir PARCEL_BOXES_CM dans boxtal.ts) — le client a
    // quand même payé un tarif estimé avec le plus grand carton, mais on
    // n'achète jamais une étiquette automatiquement sur cette base : il faut
    // vérifier l'emballage réel et le faire manuellement sur Boxtal.
    if (order.shippingOversized) {
      return reply.code(409).send({ error: "parcel_oversized" });
    }

    try {
      const result = await purchaseShippingLabel({
        recipient: {
          fullName: order.recipientName,
          phone: order.recipientPhone,
          email: order.user.email,
          address: order.recipientAddress,
          city: order.recipientCity,
          zipcode: order.recipientZipcode,
          country: order.recipientCountry,
        },
        weightG: order.shippingWeightG,
        parcelCm: {
          length: order.shippingParcelLengthCm,
          width: order.shippingParcelWidthCm,
          height: order.shippingParcelHeightCm,
        },
        operatorCode: order.shippingCarrierCode,
        serviceCode: order.shippingServiceCode,
        mode: order.shippingMode,
        relayPointCode: order.relayPointCode,
        declaredValueCents: order.subtotalCents,
      });
      const updated = await prisma.order.update({
        where: { id },
        data: {
          boxtalOrderRef: result.boxtalOrderRef,
          shippingLabelUrl: result.labelUrl,
          labelPurchasedAt: new Date(),
        },
      });
      // Best-effort: the tracking number is never in the purchase response
      // itself (confirmed against the real API), only learned afterward —
      // try right away so it's often already there by the time the admin
      // looks, instead of always needing a separate manual check.
      const tracking = await refreshOrderTrackingStatus(id);
      return reply.send({
        boxtalOrderRef: updated.boxtalOrderRef,
        shippingLabelUrl: tracking && !tracking.autoDelivered ? updated.shippingLabelUrl : updated.shippingLabelUrl,
        labelPending: !updated.shippingLabelUrl,
        trackingNumber: tracking?.trackingNumber ?? null,
      });
    } catch (err) {
      if (err instanceof BoxtalConfigError) return reply.code(500).send({ error: "boxtal_not_configured" });
      if (err instanceof BoxtalApiError) {
        request.log.error({ err }, "boxtal label purchase failed");
        return reply.code(502).send({ error: "boxtal_order_failed", reason: err.message });
      }
      throw err;
    }
  });

  // Re-vérifie le statut Boxtal à la demande : étiquette (si l'achat ne
  // l'a pas renvoyée immédiatement — génération asynchrone chez certains
  // transporteurs), numéro de suivi, et passage automatique en DELIVERED si
  // le statut transporteur ressemble à une livraison (voir
  // lib/orderTracking.ts). Appelle toujours Boxtal tant que la commande
  // n'est pas déjà DELIVERED — contrairement à avant, ne s'arrête plus
  // silencieusement une fois l'étiquette disponible (le suivi/la livraison
  // continuent d'évoluer après).
  app.get("/admin/orders/:id/shipping-label", async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return reply.code(404).send({ error: "not_found" });
    if (!order.boxtalOrderRef) return reply.code(409).send({ error: "label_not_purchased" });
    if (order.status === "DELIVERED") return reply.send({ shippingLabelUrl: null, labelPending: false, trackingNumber: null, autoDelivered: false });

    try {
      const result = await refreshOrderTrackingStatus(id);
      const fresh = await prisma.order.findUnique({ where: { id } });
      return reply.send({
        shippingLabelUrl: result?.autoDelivered ? null : fresh?.shippingLabelUrl ?? null,
        labelPending: !result?.autoDelivered && !fresh?.shippingLabelUrl,
        trackingNumber: result?.trackingNumber ?? null,
        autoDelivered: !!result?.autoDelivered,
      });
    } catch (err) {
      if (err instanceof BoxtalConfigError) return reply.code(500).send({ error: "boxtal_not_configured" });
      if (err instanceof BoxtalApiError) {
        request.log.error({ err }, "boxtal label status check failed");
        return reply.code(502).send({ error: "boxtal_status_failed", reason: err.message });
      }
      throw err;
    }
  });

  app.patch("/admin/orders/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({ status: z.enum(ORDER_STATUSES).optional(), trackingNumber: z.string().trim().min(1).max(60).optional() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    if (!body.data.status && !body.data.trackingNumber) return reply.code(400).send({ error: "invalid_body" });

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return reply.code(404).send({ error: "not_found" });
    // Terminal state — no going back once delivered, on purpose: the
    // shipping/recipient data needed to make sense of an earlier status is
    // wiped the moment this is reached (see SHIPPING_DATA_PURGE below), so
    // there'd be nothing left to revert *to* even if we allowed it. A
    // genuine mistake needs a direct DB fix, not a button here.
    if (order.status === "DELIVERED") return reply.code(409).send({ error: "order_already_delivered" });

    // A shipped order (not a workshop pickup) needs a tracking number
    // before it can be marked READY/"Expédié" — either already on file
    // (auto-fetched from Boxtal) or provided in this same request (manual
    // label purchased outside the system, e.g. the oversized-parcel case).
    const nextStatus = body.data.status ?? order.status;
    const trackingNumber = body.data.trackingNumber ?? order.trackingNumber;
    if (nextStatus === "READY" && order.shippingMode && order.shippingMode !== "PICKUP" && !trackingNumber) {
      return reply.code(409).send({ error: "tracking_number_required" });
    }

    const now = new Date();
    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: nextStatus,
        trackingNumber: body.data.trackingNumber ?? undefined,
        printingAt: nextStatus === "PRINTING" && !order.printingAt ? now : undefined,
        readyAt: nextStatus === "READY" && !order.readyAt ? now : undefined,
        deliveredAt: nextStatus === "DELIVERED" && !order.deliveredAt ? now : undefined,
        ...(nextStatus === "DELIVERED" ? SHIPPING_DATA_PURGE : {}),
      },
    });
    return reply.send({ order: updated });
  });

  // "Refuser" une commande : seulement possible tant qu'elle est encore
  // PENDING (pas encore acceptée en impression) — au-delà, un refus reviendrait
  // à annuler un travail en cours et doit passer par un vrai remboursement
  // Stripe, pas juste une suppression. TODO(phase Stripe): déclencher un
  // remboursement ici plutôt que de se contenter de supprimer la ligne.
  app.delete("/admin/orders/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return reply.code(404).send({ error: "not_found" });
    if (order.status !== "PENDING") {
      return reply.code(409).send({ error: "not_pending" });
    }
    await prisma.order.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  // ---- Settings (mode vacances + paramètres de prix) ---------------------
  app.get("/admin/settings", async (_request, reply) => {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    return reply.send({ settings });
  });

  app.patch("/admin/settings", async (request, reply) => {
    const schema = z.object({
      quoteEnabled: z.boolean().optional(),
      hourlyRateCents: z.number().int().positive().optional(),
      minUnitPriceCents: z.number().int().min(0).optional(),
      minOrderCents: z.number().int().min(0).optional(),
      smallOrderFeeCents: z.number().int().min(0).optional(),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const updated = await prisma.settings.update({ where: { id: 1 }, data: body.data });
    return reply.send({ settings: updated });
  });

  // ---- Discount tiers -----------------------------------------------------
  app.put("/admin/discount-tiers", async (request, reply) => {
    const schema = z.array(z.object({ minQty: z.number().int().positive(), pct: z.number().min(0).max(100) }));
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    await prisma.$transaction([
      prisma.discountTier.deleteMany({}),
      prisma.discountTier.createMany({ data: body.data }),
    ]);
    const tiers = await prisma.discountTier.findMany({ orderBy: { minQty: "asc" } });
    return reply.send({ tiers });
  });
}
