import { apiHandler, json, jsonError } from "../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../lib/api/auth";
import { prisma } from "../../../../../lib/server/prisma";
import { purchaseShippingLabel, BoxtalConfigError, BoxtalApiError, shortBoxtalReason } from "../../../../../lib/server/boxtal";
import { recordAlert, resolveAlerts } from "../../../../../lib/server/adminAlerts";
import { describeMissingFields, missingShippingFields } from "../../../../../lib/server/shippingChecks";
import type { Parcel } from "../../../../../lib/server/packing";
import { refreshOrderTrackingStatus } from "../../../../../lib/server/orderTracking";

// Direct port of POST /admin/orders/:id/shipping-label — achat RÉEL de
// l'étiquette d'expédition (Boxtal api/v1/order) — argent réel, jamais
// déclenché automatiquement. boxtalOrderRef déjà rempli = garde-fou
// anti-double-achat (409, pas de nouvel appel à Boxtal).
export const POST = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const order = await prisma.order.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
  if (!order) return jsonError(404, "not_found");
  if (order.boxtalOrderRef) return jsonError(409, "label_already_purchased");
  // Retrait à l'atelier : gratuit, jamais expédié, rien à acheter chez
  // Boxtal.
  if (order.shippingMode === "PICKUP") return jsonError(409, "not_shippable");
  // Étiquette déjà faite à la main (hors site) : ne pas en racheter une.
  if (order.labelManualAt) return jsonError(409, "label_made_manually");
  const missing = missingShippingFields(order);
  if (missing.length > 0) {
    return jsonError(409, "missing_shipping_info", { reason: describeMissingFields(missing) });
  }
  if (order.shippingMode === "RELAY" && !order.relayPointCode) {
    return jsonError(409, "missing_relay_point");
  }
  // Colis figés au paiement (shippingParcels, voir packing.ts). Commandes
  // anciennes (avant le multi-colis) : un seul colis reconstruit depuis les
  // champs hérités.
  const parcels: Parcel[] = Array.isArray(order.shippingParcels)
    ? (order.shippingParcels as unknown as Parcel[])
    : [
        {
          box: "S",
          // missingShippingFields() a vérifié que ces champs sont renseignés.
          outerCm: [order.shippingParcelLengthCm!, order.shippingParcelWidthCm!, order.shippingParcelHeightCm!],
          weightG: order.shippingWeightG!,
          pieces: [],
        },
      ];

  try {
    const result = await purchaseShippingLabel({
      recipient: {
        fullName: order.recipientName!,
        phone: order.recipientPhone!,
        email: order.user.email,
        address: order.recipientAddress!,
        city: order.recipientCity!,
        zipcode: order.recipientZipcode!,
        country: order.recipientCountry!,
      },
      parcels,
      operatorCode: order.shippingCarrierCode!,
      serviceCode: order.shippingServiceCode!,
      mode: order.shippingMode as "RELAY" | "HOME",
      relayPointCode: order.relayPointCode,
      declaredValueCents: order.subtotalCents,
    });
    const updated = await prisma.order.update({
      where: { id },
      data: {
        boxtalOrderRef: result.boxtalOrderRef,
        shippingLabelUrl: result.labelUrl,
        labelPurchasedAt: new Date(),
        ...(result.trackingNumber ? { trackingNumber: result.trackingNumber } : {}),
      },
    });
    // Best-effort: the tracking number is never in the purchase response
    // itself (confirmed against the real API), only learned afterward —
    // try right away so it's often already there by the time the admin
    // looks, instead of always needing a separate manual check.
    await resolveAlerts("LABEL_REFUSED", order.id);
    const tracking = await refreshOrderTrackingStatus(id!);
    // Boxtal met quelques secondes à connaître l'étiquette : si le n° de suivi
    // n'est pas encore là, on réessaie en arrière-plan (5 s, 20 s, 1 min, 3 min, 10 min ; au bac à sable le
    // n° arrive ~2 s après l'achat). Au-delà, le balayage de 3 h prend le relais.
    if (!tracking?.trackingNumber) {
      for (const delay of [5_000, 20_000, 60_000, 180_000, 600_000]) {
        setTimeout(() => {
          refreshOrderTrackingStatus(id!).catch((e) => console.error("retry suivi colis", e));
        }, delay).unref?.();
      }
    }
    return json({
      boxtalOrderRef: updated.boxtalOrderRef,
      shippingLabelUrl: updated.shippingLabelUrl,
      labelPending: !updated.shippingLabelUrl,
      trackingNumber: tracking?.trackingNumber ?? null,
    });
  } catch (err) {
    if (err instanceof BoxtalConfigError) return jsonError(500, "boxtal_not_configured");
    if (err instanceof BoxtalApiError) {
      console.error("boxtal label purchase failed", err);
      const reason = shortBoxtalReason(err);
      await recordAlert({ kind: "LABEL_REFUSED", orderId: order.id, orderRef: order.ref, message: reason, detail: err.message });
      return jsonError(502, "boxtal_order_failed", { reason });
    }
    throw err;
  }
});

// Direct port of GET /admin/orders/:id/shipping-label — re-vérifie le
// statut Boxtal à la demande : étiquette (si l'achat ne l'a pas renvoyée
// immédiatement — génération asynchrone chez certains transporteurs),
// numéro de suivi, et passage automatique en DELIVERED si le statut
// transporteur ressemble à une livraison. Appelle toujours Boxtal tant que
// la commande n'est pas déjà DELIVERED.
export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return jsonError(404, "not_found");
  if (!order.boxtalOrderRef) return jsonError(409, "label_not_purchased");
  if (order.status === "DELIVERED")
    return json({ shippingLabelUrl: null, labelPending: false, trackingNumber: null, autoDelivered: false });

  try {
    const result = await refreshOrderTrackingStatus(id!);
    const fresh = await prisma.order.findUnique({ where: { id } });
    return json({
      shippingLabelUrl: result?.autoDelivered ? null : (fresh?.shippingLabelUrl ?? null),
      labelPending: !result?.autoDelivered && !fresh?.shippingLabelUrl,
      trackingNumber: result?.trackingNumber ?? null,
      autoDelivered: !!result?.autoDelivered,
    });
  } catch (err) {
    if (err instanceof BoxtalConfigError) return jsonError(500, "boxtal_not_configured");
    if (err instanceof BoxtalApiError) {
      console.error("boxtal label status check failed", err);
      return jsonError(502, "boxtal_status_failed", { reason: shortBoxtalReason(err) });
    }
    throw err;
  }
});
