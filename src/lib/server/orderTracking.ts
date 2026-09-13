import { prisma } from "./prisma";
import { checkLabelStatus, BoxtalApiError, BoxtalConfigError } from "./boxtal";
import { deleteFile } from "./storage";

// Wiped the moment an order reaches DELIVERED — none of it serves any
// purpose once the parcel has actually arrived, and there's no reason to
// keep a customer's address/phone/relay point/tracking number around
// indefinitely once the job is done. ref, pricing, item snapshots
// (material/color/qty — see OrderItem) and the Invoice are untouched: that
// stays as the customer's own purchase record. shippingMode and
// recipientName are kept too (low-sensitivity, gives minimal context —
// "livré à domicile" vs "retiré à l'atelier" — without exposing where).
export const SHIPPING_DATA_PURGE = {
  recipientPhone: null,
  recipientAddress: null,
  recipientCity: null,
  recipientZipcode: null,
  recipientCountry: null,
  relayPointCode: null,
  relayPointName: null,
  relayPointAddress: null,
  relayPointCity: null,
  relayPointZipcode: null,
  shippingCarrierCode: null,
  shippingServiceCode: null,
  shippingLabel: null,
  shippingLabelUrl: null,
  shippingWeightG: null,
  shippingParcelLengthCm: null,
  shippingParcelWidthCm: null,
  shippingParcelHeightCm: null,
  shippingOversized: false,
  boxtalOrderRef: null,
  trackingNumber: null,
  labelPurchasedAt: null,
} as const;

// Reclaims storage the moment an order is truly done — the original
// STL/3MF uploads (QuoteJob.fileKey) have no purpose once delivered
// (printing finished long before), unlike the Invoice, which stays as the
// customer's own purchase record and is untouched here. Same underlying
// deletion as the admin's existing manual per-item "Supprimer" button (see
// admin/orders/[id]/items/[itemId]/file.ts) — this just does it
// automatically, for every item on the order, at the moment DELIVERED is
// reached (whether that's the admin's own PATCH or the automatic Boxtal
// tracking sweep below), instead of relying on someone to remember to
// click it per item. Never throws — a storage hiccup on one file must
// never block the delivery status change itself; failures are logged and
// left for a manual retry via that same per-item button.
export async function purgeOrderFiles(orderId: string): Promise<void> {
  const items = await prisma.orderItem.findMany({
    where: { orderId, quoteJob: { fileDeletedAt: null } },
    include: { quoteJob: true },
  });
  for (const item of items) {
    if (!item.quoteJob) continue;
    try {
      await deleteFile(item.quoteJob.fileKey);
      await prisma.quoteJob.update({ where: { id: item.quoteJob.id }, data: { fileDeletedAt: new Date() } });
    } catch (err) {
      console.error(`purgeOrderFiles: failed to delete file for order ${orderId}, item ${item.id}`, err);
    }
  }
}

// Pulls the live tracking number + carrier status from Boxtal for one
// order, persists whatever's new, and auto-transitions to DELIVERED (with
// the purge above) when the carrier status looks like a delivery — see
// isLikelyDelivered's caveats in boxtal.ts. Shared by the admin's manual
// "vérifier" action and the periodic sweep (src/middleware.ts) — the
// latter is what makes this "automatic" rather than something the admin
// has to remember to click.
export async function refreshOrderTrackingStatus(orderId: string): Promise<{
  trackingNumber: string | null;
  state: string | null;
  autoDelivered: boolean;
} | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.boxtalOrderRef || order.status === "DELIVERED") return null;

  let status;
  try {
    status = await checkLabelStatus(order.boxtalOrderRef);
  } catch (err) {
    if (err instanceof BoxtalConfigError || err instanceof BoxtalApiError) return null;
    throw err;
  }

  if (status.isLikelyDelivered) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "DELIVERED", deliveredAt: order.deliveredAt ?? new Date(), ...SHIPPING_DATA_PURGE },
    });
    await purgeOrderFiles(orderId);
    return { trackingNumber: null, state: status.state, autoDelivered: true };
  }

  const data: Record<string, unknown> = {};
  if (status.labelUrl && status.labelUrl !== order.shippingLabelUrl) data.shippingLabelUrl = status.labelUrl;
  if (status.carrierReference && status.carrierReference !== order.trackingNumber)
    data.trackingNumber = status.carrierReference;
  if (Object.keys(data).length > 0) await prisma.order.update({ where: { id: orderId }, data });

  return { trackingNumber: status.carrierReference ?? order.trackingNumber, state: status.state, autoDelivered: false };
}

// Periodic sweep (see src/middleware.ts) — checks every shipped-and-labelled
// order still short of DELIVERED, so a package that's actually arrived gets
// marked without the admin having to click "vérifier" on it themselves.
export async function sweepOrderTracking(): Promise<number> {
  const candidates = await prisma.order.findMany({
    where: { status: { in: ["PRINTING", "READY"] }, boxtalOrderRef: { not: null } },
    select: { id: true },
  });
  let autoDeliveredCount = 0;
  for (const { id } of candidates) {
    const result = await refreshOrderTrackingStatus(id);
    if (result?.autoDelivered) autoDeliveredCount++;
  }
  return autoDeliveredCount;
}
