// Centre d'erreurs admin : partie PURE (aucun accès base), testable seule.
// Les alertes dérivées sont recalculées à chaque lecture depuis l'état des commandes ;
// les alertes enregistrées (table AdminAlert) sont converties en AlertDTO par storedAlertToDTO.
import {
  describeMissingFields,
  isRelayPointMissing,
  missingShippingFields,
  type ShippingCheckOrder,
} from "./shippingChecks";

export type AlertKind =
  | "LABEL_REFUSED"
  | "TRACKING_UNREACHABLE"
  | "PAYMENT_ANOMALY"
  | "EMAIL_FAILED"
  | "BOXTAL_NOT_CONFIGURED"
  | "ADDRESS_INCOMPLETE"
  | "RELAY_MISSING"
  | "BOX_STOCK_EMPTY"
  | "INVOICE_MISSING"
  | "WEIGHT_ONLY_QUOTE";

export type ActionKind =
  | "retry_label"
  | "manual_label"
  | "retry_status"
  | "generate_invoice"
  | "open_order"
  | "open_stock"
  | "open_stripe"
  | "resolve";

export interface AlertDTO {
  key: string;
  /** id de la ligne AdminAlert (alertes enregistrées seulement) */
  id?: string;
  kind: AlertKind;
  severity: "critical" | "warning";
  title: string;
  message: string;
  detail?: string;
  orderId?: string;
  orderRef?: string;
  /** ISO 8601 */
  at?: string;
  count?: number;
  /** référence Stripe (pi_…) pour PAYMENT_ANOMALY */
  stripeRef?: string;
  source: "derived" | "stored";
  actions: ActionKind[];
}

export const ALERT_TITLES: Record<AlertKind, string> = {
  LABEL_REFUSED: "Étiquette refusée par Boxtal",
  TRACKING_UNREACHABLE: "Suivi Boxtal injoignable",
  PAYMENT_ANOMALY: "Anomalie de paiement",
  EMAIL_FAILED: "E-mail non envoyé",
  BOXTAL_NOT_CONFIGURED: "Boxtal n'est pas configuré",
  ADDRESS_INCOMPLETE: "Adresse incomplète",
  RELAY_MISSING: "Point relais manquant",
  BOX_STOCK_EMPTY: "Cartons épuisés",
  INVOICE_MISSING: "Facture non générée",
  WEIGHT_ONLY_QUOTE: "Colis à préparer à la main",
};

/** Commande réduite aux champs utiles au calcul des alertes. */
export interface AlertOrderInput extends ShippingCheckOrder {
  id: string;
  ref: string;
  status: string;
  shippingOversized?: boolean | null;
  /** Colis calculés au checkout : [{ box: "M", … }] */
  shippingParcels?: unknown;
  trackingNumber?: string | null;
  boxtalOrderRef?: string | null;
  labelManualAt?: Date | string | null;
  invoice?: unknown | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface BoxStockInput {
  code: string;
  qty: number;
}

/** Ligne AdminAlert (sous-ensemble utile). */
export interface StoredAlertInput {
  id: string;
  kind: string;
  key: string;
  orderId: string | null;
  orderRef: string | null;
  message: string;
  detail: string | null;
  count: number;
  lastSeenAt: Date | string;
}

const BOX_ORDER = ["S", "M", "L", "XL", "XXL"];
const PAID_STATUSES = ["PENDING", "PRINTING", "READY", "DELIVERED"];
const SHIPPING_TO_PREPARE = ["PENDING", "PRINTING"];

function iso(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function hasLabel(o: AlertOrderInput): boolean {
  return Boolean(o.boxtalOrderRef || o.labelManualAt || o.trackingNumber);
}

function needsShipping(o: AlertOrderInput): boolean {
  return o.shippingMode === "HOME" || o.shippingMode === "RELAY";
}

function parcelBoxes(o: AlertOrderInput): string[] {
  if (!Array.isArray(o.shippingParcels)) return [];
  return o.shippingParcels
    .map((p) => (p && typeof p === "object" ? (p as { box?: unknown }).box : undefined))
    .filter((b): b is string => typeof b === "string");
}

function orderAlert(
  kind: AlertKind,
  severity: "critical" | "warning",
  o: AlertOrderInput,
  message: string,
  actions: ActionKind[],
): AlertDTO {
  return {
    key: `${kind}:${o.id}`,
    kind,
    severity,
    title: ALERT_TITLES[kind],
    message,
    orderId: o.id,
    orderRef: o.ref,
    at: iso(o.updatedAt) ?? iso(o.createdAt),
    source: "derived",
    actions,
  };
}

function boxList(codes: string[]): string {
  return codes.join(" ni ");
}

/**
 * Alertes dérivées de l'état des commandes (fonction pure, rien en base).
 * Tri : critiques d'abord, puis plus récentes. Aucune limite de nombre ici (le GET plafonne).
 */
export function deriveAlerts(
  orders: AlertOrderInput[],
  boxStock: BoxStockInput[],
  configMissing: string[],
): AlertDTO[] {
  const out: AlertDTO[] = [];

  if (configMissing.length > 0) {
    out.push({
      key: "BOXTAL_NOT_CONFIGURED:global",
      kind: "BOXTAL_NOT_CONFIGURED",
      severity: "critical",
      title: ALERT_TITLES.BOXTAL_NOT_CONFIGURED,
      message: `Il manque ${configMissing.join(", ")} dans le .env du serveur : aucune étiquette ne peut être créée.`,
      source: "derived",
      actions: [],
    });
  }

  for (const o of orders) {
    const terminal = o.status === "DELIVERED" || o.status === "REJECTED";

    if (PAID_STATUSES.includes(o.status) && !o.invoice) {
      out.push(
        orderAlert(
          "INVOICE_MISSING",
          "critical",
          o,
          `${o.ref} est payée mais n'a pas de facture.`,
          ["generate_invoice", "open_order"],
        ),
      );
    }

    if (terminal) continue;
    if (o.shippingMode === "PICKUP") continue;

    const toPrepare = SHIPPING_TO_PREPARE.includes(o.status) && needsShipping(o) && !hasLabel(o);

    if (toPrepare) {
      const missing = missingShippingFields(o);
      if (missing.length > 0) {
        out.push(
          orderAlert(
            "ADDRESS_INCOMPLETE",
            "critical",
            o,
            `${o.ref} : ${describeMissingFields(missing)}.`,
            ["open_order"],
          ),
        );
      }
      if (isRelayPointMissing(o)) {
        out.push(
          orderAlert(
            "RELAY_MISSING",
            "critical",
            o,
            `${o.ref} : livraison en point relais, mais aucun point choisi.`,
            ["open_order", "manual_label"],
          ),
        );
      }
    }

    if (o.shippingOversized && !hasLabel(o)) {
      out.push(
        orderAlert(
          "WEIGHT_ONLY_QUOTE",
          "critical",
          o,
          `${o.ref} : les pièces ne rentrent dans aucun carton, devis calculé au poids seul. Faire l'étiquette sur Boxtal.`,
          ["manual_label", "open_order"],
        ),
      );
    }
  }

  const empty = boxStock
    .filter((b) => b.qty <= 0)
    .map((b) => b.code)
    .sort((a, b) => BOX_ORDER.indexOf(a) - BOX_ORDER.indexOf(b));
  if (empty.length > 0) {
    // Commandes ouvertes (pas encore étiquetées, expédiées) qui ont besoin d'un carton épuisé.
    const needs: string[] = [];
    for (const o of orders) {
      if (o.status === "DELIVERED" || o.status === "REJECTED" || o.shippingMode === "PICKUP" || hasLabel(o)) continue;
      const wanted = [...new Set(parcelBoxes(o).filter((b) => empty.includes(b)))];
      if (wanted.length > 0) needs.push(`${o.ref} a besoin d'un ${wanted.join(" et d'un ")}.`);
    }
    out.push({
      key: "BOX_STOCK_EMPTY:global",
      kind: "BOX_STOCK_EMPTY",
      severity: needs.length > 0 ? "critical" : "warning",
      title: ALERT_TITLES.BOX_STOCK_EMPTY,
      message: [`Plus de carton ${boxList(empty)}.`, ...needs].join(" "),
      source: "derived",
      actions: ["open_stock"],
    });
  }

  return sortAlerts(out);
}

/** Critiques d'abord, puis plus récentes (alertes sans date en dernier dans leur gravité). */
export function sortAlerts(alerts: AlertDTO[]): AlertDTO[] {
  const sev = (a: AlertDTO) => (a.severity === "critical" ? 0 : 1);
  return [...alerts].sort((a, b) => sev(a) - sev(b) || (b.at ?? "").localeCompare(a.at ?? ""));
}

const STORED_SEVERITY: Record<string, "critical" | "warning"> = {
  LABEL_REFUSED: "critical",
  PAYMENT_ANOMALY: "critical",
  TRACKING_UNREACHABLE: "warning",
  EMAIL_FAILED: "warning",
};

/** Convertit une ligne AdminAlert (non résolue) en AlertDTO. */
export function storedAlertToDTO(row: StoredAlertInput): AlertDTO {
  const kind = row.kind as AlertKind;
  const stripeRef = kind === "PAYMENT_ANOMALY" ? row.key.split(":")[2] : undefined;
  const actions: ActionKind[] = [];
  if (kind === "LABEL_REFUSED") actions.push("retry_label", "manual_label");
  if (kind === "TRACKING_UNREACHABLE") actions.push("retry_status");
  if (stripeRef && stripeRef.startsWith("pi_")) actions.push("open_stripe");
  if (row.orderId) actions.push("open_order");
  if (kind === "PAYMENT_ANOMALY" || kind === "EMAIL_FAILED") actions.push("resolve");
  return {
    key: row.key,
    id: row.id,
    kind,
    severity: STORED_SEVERITY[row.kind] ?? "warning",
    title: ALERT_TITLES[kind] ?? row.kind,
    message: row.message,
    detail: row.detail ?? undefined,
    orderId: row.orderId ?? undefined,
    orderRef: row.orderRef ?? undefined,
    at: iso(row.lastSeenAt),
    count: row.count,
    stripeRef,
    source: "stored",
    actions,
  };
}
