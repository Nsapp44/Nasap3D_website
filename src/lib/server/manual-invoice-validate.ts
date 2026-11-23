// Validation du corps des "factures libres" (création et modification).

const MAX_ITEMS = 100;
const MAX_NAME = 200;
const MAX_ADDRESS = 500;
const MAX_EMAIL = 254;
const MAX_NOTE = 2000;
const MAX_TITLE = 200;
const MAX_DESC = 1000;
const MAX_QTY = 100_000;
const MAX_UNIT_CENTS = 100_000_000; // 1 000 000,00 €
const MAX_TOTAL_CENTS = 2_000_000_000; // reste sous la limite Int32 de Postgres
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CleanItem = {
  title: string;
  description?: string;
  quantity: number;
  unitPriceCents: number;
};

export type ManualInvoiceData = {
  clientName: string;
  billingAddress: string;
  deliveryAddress: string | null;
  clientEmail: string | null;
  note: string | null;
  items: CleanItem[];
  totalCents: number;
};

export type ManualInvoiceValidation =
  | { ok: true; data: ManualInvoiceData }
  | { ok: false; error: string };

// undefined = invalide ; null = absent (champ optionnel) ; string = ok
function str(v: unknown, max: number, required: boolean): string | null | undefined {
  if (v === undefined || v === null || v === "") return required ? undefined : null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return required ? undefined : null;
  if (t.length > max) return undefined;
  return t;
}

export function validateManualInvoiceBody(body: unknown): ManualInvoiceValidation {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const b = body as Record<string, unknown>;

  const clientName = str(b.clientName, MAX_NAME, true);
  const billingAddress = str(b.billingAddress, MAX_ADDRESS, true);
  const deliveryAddress = str(b.deliveryAddress, MAX_ADDRESS, false);
  const clientEmail = str(b.clientEmail, MAX_EMAIL, false);
  const note = str(b.note, MAX_NOTE, false);
  if (!clientName) return { ok: false, error: "invalid_client_name" };
  if (!billingAddress) return { ok: false, error: "invalid_billing_address" };
  if (deliveryAddress === undefined) return { ok: false, error: "invalid_delivery_address" };
  if (clientEmail === undefined || (clientEmail !== null && !EMAIL_RE.test(clientEmail))) {
    return { ok: false, error: "invalid_client_email" };
  }
  if (note === undefined) return { ok: false, error: "invalid_note" };

  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > MAX_ITEMS) {
    return { ok: false, error: "invalid_items" };
  }
  const items: CleanItem[] = [];
  let totalCents = 0;
  for (const raw of b.items as unknown[]) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_items" };
    const it = raw as Record<string, unknown>;
    const title = str(it.title, MAX_TITLE, true);
    const description = str(it.description, MAX_DESC, false);
    if (!title) return { ok: false, error: "invalid_item_title" };
    if (description === undefined) return { ok: false, error: "invalid_item_description" };
    const q = it.quantity;
    const p = it.unitPriceCents;
    if (typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > MAX_QTY) {
      return { ok: false, error: "invalid_item_quantity" };
    }
    if (typeof p !== "number" || !Number.isInteger(p) || p < 0 || p > MAX_UNIT_CENTS) {
      return { ok: false, error: "invalid_item_price" };
    }
    totalCents += q * p;
    if (totalCents > MAX_TOTAL_CENTS) return { ok: false, error: "total_too_large" };
    items.push({ title, ...(description ? { description } : {}), quantity: q, unitPriceCents: p });
  }

  return {
    ok: true,
    data: { clientName, billingAddress, deliveryAddress, clientEmail, note, items, totalCents },
  };
}
