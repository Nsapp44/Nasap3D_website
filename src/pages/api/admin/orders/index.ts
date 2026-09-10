import { apiHandler, json } from "../../../../lib/api/handler";
import { requireAdmin } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";
import { ORDER_FILTER_STATUSES } from "../../../../lib/server/orderStatus";

// Direct port of GET /admin/orders.
export const GET = apiHandler(async (context) => {
  await requireAdmin(context);

  const url = context.url;
  const statusParam = url.searchParams.get("status") ?? undefined;
  const status =
    statusParam && (ORDER_FILTER_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as (typeof ORDER_FILTER_STATUSES)[number])
      : undefined;
  // Une recherche texte (numéro de commande, email, n° client — utile pour
  // retrouver une commande en SAV sans savoir dans quel statut elle se
  // trouve) ignore volontairement le filtre de statut : le cas d'usage est
  // justement "je ne sais pas où chercher".
  const q = url.searchParams.get("q")?.trim();
  const where = q
    ? {
        OR: [
          { ref: { contains: q, mode: "insensitive" as const } },
          { user: { email: { contains: q, mode: "insensitive" as const } } },
          { user: { customerNo: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : status
      ? { status }
      : undefined;

  const [orders, counts, qualityProfiles] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: { include: { quoteJob: { select: { fileName: true, fileDeletedAt: true } } } },
        user: { select: { email: true, customerNo: true } },
        invoice: { select: { id: true } },
      },
    }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
    prisma.qualityProfile.findMany({ select: { label: true, layerHeightMm: true } }),
  ]);

  const countByStatus: Record<string, number> = {};
  for (const c of counts) countByStatus[c.status] = c._count;

  // qualitySnapshot only ever stored the profile's label ("Standard") — see
  // orders.ts's own qualitySnapshot: item.quoteJob.quality.label — not the
  // layer height itself, so it has to be looked up here rather than read
  // straight off the order item. Looked up by CURRENT label rather than
  // also snapshotting layerHeightMm at order time (unlike material/color,
  // which really do need to freeze at purchase time for pricing/legal
  // reasons): this is workshop-facing info only, and layer heights per
  // named profile essentially never change once set, so a live lookup is
  // simpler than a schema migration for the same practical result.
  const layerHeightByQualityLabel = new Map(qualityProfiles.map((q) => [q.label, q.layerHeightMm]));

  return json({
    orders: orders.map((o) => ({
      id: o.id,
      ref: o.ref,
      clientEmail: o.user.email,
      customerNo: o.user.customerNo,
      status: o.status,
      totalCents: o.totalCents,
      createdAt: o.createdAt,
      hasInvoice: !!o.invoice,
      shippingMode: o.shippingMode,
      shippingLabel: o.shippingLabel,
      shippingOversized: o.shippingOversized,
      shippingWeightG: o.shippingWeightG,
      shippingParcelLengthCm: o.shippingParcelLengthCm,
      shippingParcelWidthCm: o.shippingParcelWidthCm,
      shippingParcelHeightCm: o.shippingParcelHeightCm,
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
        colorNameSnapshot: i.colorNameSnapshot,
        colorHexSnapshot: i.colorHexSnapshot,
        infillSnapshot: i.infillSnapshot,
        qualitySnapshot: i.qualitySnapshot,
        layerHeightMm: layerHeightByQualityLabel.get(i.qualitySnapshot) ?? null,
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
