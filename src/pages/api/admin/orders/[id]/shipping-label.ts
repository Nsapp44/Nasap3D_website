import { apiHandler, json, jsonError } from "../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../lib/api/auth";
import { prisma } from "../../../../../lib/server/prisma";
import { purchaseShippingLabel, BoxtalConfigError, BoxtalApiError } from "../../../../../lib/server/boxtal";
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
    return jsonError(409, "missing_shipping_info");
  }
  if (order.shippingMode === "RELAY" && !order.relayPointCode) {
    return jsonError(409, "missing_relay_point");
  }
  // La pièce ne rentrait dans aucun des 3 formats de carton connus au
  // moment du paiement (voir PARCEL_BOXES_CM dans boxtal.ts) — le client a
  // quand même payé un tarif estimé avec le plus grand carton, mais on
  // n'achète jamais une étiquette automatiquement sur cette base : il faut
  // vérifier l'emballage réel et le faire manuellement sur Boxtal.
  if (order.shippingOversized) {
    return jsonError(409, "parcel_oversized");
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
      },
    });
    // Best-effort: the tracking number is never in the purchase response
    // itself (confirmed against the real API), only learned afterward —
    // try right away so it's often already there by the time the admin
    // looks, instead of always needing a separate manual check.
    const tracking = await refreshOrderTrackingStatus(id!);
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
      return jsonError(502, "boxtal_order_failed", { reason: err.message });
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
      return jsonError(502, "boxtal_status_failed", { reason: err.message });
    }
    throw err;
  }
});
