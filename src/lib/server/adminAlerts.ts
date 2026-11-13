// Centre d'erreurs admin : enregistrement et résolution des alertes stockées (table AdminAlert).
// Aucune fonction d'ici ne lève d'exception vers l'appelant (elles sont appelées depuis des
// catch et le webhook Stripe : un échec ne doit jamais casser le flux).
// La partie pure (deriveAlerts, types) est dans adminAlertsDerive.ts, ré-exportée ici.
import { prisma } from "./prisma";

export * from "./adminAlertsDerive";

export type StoredAlertKind = "LABEL_REFUSED" | "TRACKING_UNREACHABLE" | "PAYMENT_ANOMALY" | "EMAIL_FAILED";

export interface RecordAlertInput {
  kind: StoredAlertKind;
  orderId?: string | null;
  orderRef?: string | null;
  message: string;
  detail?: string | null;
  /** ex. référence Stripe pour PAYMENT_ANOMALY */
  keySuffix?: string | null;
}

const DETAIL_MAX = 200;

export function alertKey(kind: StoredAlertKind, orderId?: string | null, keySuffix?: string | null): string {
  return `${kind}:${orderId ?? "global"}${keySuffix ? `:${keySuffix}` : ""}`;
}

function cleanDetail(detail: string | null | undefined): string | null {
  if (!detail) return null;
  const t = detail
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  return t.length > DETAIL_MAX ? `${t.slice(0, DETAIL_MAX - 1).trimEnd()}…` : t;
}

/**
 * Crée ou réactive l'alerte (clé unique) : count + 1, lastSeenAt, remise à non résolue.
 * Ne lève jamais. Si seul orderRef est fourni, l'orderId est retrouvé par la ref.
 */
export async function recordAlert(input: RecordAlertInput): Promise<void> {
  try {
    let orderId = input.orderId ?? null;
    if (!orderId && input.orderRef) {
      const o = await prisma.order.findUnique({ where: { ref: input.orderRef }, select: { id: true } });
      orderId = o?.id ?? null;
    }
    const key = alertKey(input.kind, orderId, input.keySuffix);
    const detail = cleanDetail(input.detail);
    const now = new Date();
    await prisma.adminAlert.upsert({
      where: { key },
      create: {
        kind: input.kind,
        key,
        orderId,
        orderRef: input.orderRef ?? null,
        message: input.message,
        detail,
        firstSeenAt: now,
        lastSeenAt: now,
      },
      update: {
        message: input.message,
        detail,
        orderRef: input.orderRef ?? undefined,
        lastSeenAt: now,
        count: { increment: 1 },
        resolvedAt: null,
        resolvedBy: null,
      },
    });
  } catch (err) {
    console.error("[adminAlerts] recordAlert failed:", (err as Error).message);
  }
}

/**
 * Résout automatiquement les alertes non résolues de ce type pour cette commande
 * (orderId null/absent = alerte globale). Ne lève jamais ; renvoie le nombre résolu.
 */
export async function resolveAlerts(kind: StoredAlertKind, orderId?: string | null): Promise<number> {
  try {
    const where = orderId
      ? { kind, orderId, resolvedAt: null }
      : { key: alertKey(kind, null), resolvedAt: null };
    const r = await prisma.adminAlert.updateMany({
      where,
      data: { resolvedAt: new Date(), resolvedBy: "auto" },
    });
    return r.count;
  } catch (err) {
    console.error("[adminAlerts] resolveAlerts failed:", (err as Error).message);
    return 0;
  }
}
