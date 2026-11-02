// Contrôle pur des données d'expédition d'une commande : source unique pour la route
// d'achat d'étiquette (shipping-label.ts) et pour les alertes admin (adminAlerts.ts).

export interface ShippingCheckOrder {
  shippingMode?: string | null;
  shippingCarrierCode?: string | null;
  shippingServiceCode?: string | null;
  shippingWeightG?: number | null;
  shippingParcelLengthCm?: number | null;
  shippingParcelWidthCm?: number | null;
  shippingParcelHeightCm?: number | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientAddress?: string | null;
  recipientCity?: string | null;
  recipientZipcode?: string | null;
  recipientCountry?: string | null;
  relayPointCode?: string | null;
}

// Champs destinataire (phrase « il manque le téléphone et… ») puis champs techniques.
export const RECIPIENT_FIELD_LABELS: Record<string, string> = {
  recipientName: "le nom",
  recipientPhone: "le téléphone",
  recipientAddress: "l'adresse",
  recipientCity: "la ville",
  recipientZipcode: "le code postal",
  recipientCountry: "le pays",
};

const TECHNICAL_FIELDS = [
  "shippingMode",
  "shippingCarrierCode",
  "shippingServiceCode",
  "shippingWeightG",
  "shippingParcelLengthCm",
  "shippingParcelWidthCm",
  "shippingParcelHeightCm",
] as const;

/** Noms des champs manquants (mêmes champs que l'ancien gros `if` de shipping-label.ts). */
export function missingShippingFields(order: ShippingCheckOrder): string[] {
  const rec = order as Record<string, unknown>;
  return [...TECHNICAL_FIELDS, ...Object.keys(RECIPIENT_FIELD_LABELS)].filter((f) => !rec[f]);
}

/** Point relais exigé (mode RELAY) mais non choisi. */
export function isRelayPointMissing(order: ShippingCheckOrder): boolean {
  return order.shippingMode === "RELAY" && !order.relayPointCode;
}

/** Phrase lisible pour une liste de champs manquants ; "" si la liste est vide. */
export function describeMissingFields(fields: string[]): string {
  if (fields.length === 0) return "";
  const labels = fields.filter((f) => f in RECIPIENT_FIELD_LABELS).map((f) => RECIPIENT_FIELD_LABELS[f]);
  const technical = fields.some((f) => !(f in RECIPIENT_FIELD_LABELS));
  const parts: string[] = [];
  if (labels.length > 0) {
    const list = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} et ${labels[labels.length - 1]}`;
    parts.push(`il manque ${list} du destinataire`);
  }
  if (technical) parts.push("données d'expédition manquantes, à vérifier");
  return parts.join(" ; ");
}
