import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { requireAdmin } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";
import { nextCounter } from "../../../../lib/server/counter";

// "Factures libres" : factures créées depuis l'admin sans commande. Une fois
// émise, une facture est figée — il n'existe volontairement aucune route de
// modification ou de suppression.

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

type CleanItem = {
  title: string;
  description?: string;
  quantity: number;
  unitPriceCents: number;
};

// undefined = invalide ; null = absent (champ optionnel) ; string = ok
function str(v: unknown, max: number, required: boolean): string | null | undefined {
  if (v === undefined || v === null || v === "") return required ? undefined : null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return required ? undefined : null;
  if (t.length > max) return undefined;
  return t;
}

export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const rows = await prisma.manualInvoice.findMany({
    orderBy: { issuedAt: "desc" },
    select: { id: true, ref: true, clientName: true, totalCents: true, issuedAt: true, sentAt: true, pdfKey: true },
  });
  return json(
    rows.map((r) => ({
      id: r.id,
      ref: r.ref,
      clientName: r.clientName,
      totalCents: r.totalCents,
      issuedAt: r.issuedAt,
      sentAt: r.sentAt,
      hasPdf: !!r.pdfKey,
    })),
  );
});

export const POST = apiHandler(async (context) => {
  await requireAdmin(context);
  const body = (await context.request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return jsonError(400, "invalid_body");

  const clientName = str(body.clientName, MAX_NAME, true);
  const billingAddress = str(body.billingAddress, MAX_ADDRESS, true);
  const deliveryAddress = str(body.deliveryAddress, MAX_ADDRESS, false);
  const clientEmail = str(body.clientEmail, MAX_EMAIL, false);
  const note = str(body.note, MAX_NOTE, false);
  if (!clientName) return jsonError(400, "invalid_client_name");
  if (!billingAddress) return jsonError(400, "invalid_billing_address");
  if (deliveryAddress === undefined) return jsonError(400, "invalid_delivery_address");
  if (clientEmail === undefined || (clientEmail !== null && !EMAIL_RE.test(clientEmail))) {
    return jsonError(400, "invalid_client_email");
  }
  if (note === undefined) return jsonError(400, "invalid_note");

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_ITEMS) {
    return jsonError(400, "invalid_items");
  }
  const items: CleanItem[] = [];
  let totalCents = 0;
  for (const raw of body.items as unknown[]) {
    if (!raw || typeof raw !== "object") return jsonError(400, "invalid_items");
    const it = raw as Record<string, unknown>;
    const title = str(it.title, MAX_TITLE, true);
    const description = str(it.description, MAX_DESC, false);
    if (!title) return jsonError(400, "invalid_item_title");
    if (description === undefined) return jsonError(400, "invalid_item_description");
    const q = it.quantity;
    const p = it.unitPriceCents;
    if (typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > MAX_QTY) {
      return jsonError(400, "invalid_item_quantity");
    }
    if (typeof p !== "number" || !Number.isInteger(p) || p < 0 || p > MAX_UNIT_CENTS) {
      return jsonError(400, "invalid_item_price");
    }
    totalCents += q * p;
    if (totalCents > MAX_TOTAL_CENTS) return jsonError(400, "total_too_large");
    items.push({ title, ...(description ? { description } : {}), quantity: q, unitPriceCents: p });
  }

  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();

  // Même compteur journalier que les factures de commande ("invoice:"), dans
  // une transaction : si le create échoue, le numéro n'est pas consommé.
  const created = await prisma.$transaction(async (tx) => {
    const dailySeq = await nextCounter("invoice:" + dateKey, tx);
    const ref = `FAC_${String(dailySeq).padStart(3, "0")}_${dd}${mm}${yyyy}_L`;
    return tx.manualInvoice.create({
      data: {
        ref,
        dailySeq,
        clientName,
        billingAddress,
        deliveryAddress,
        clientEmail,
        items,
        note,
        totalCents,
        issuedAt: now,
      },
    });
  });

  return json(
    {
      id: created.id,
      ref: created.ref,
      issuedAt: created.issuedAt,
      totalCents: created.totalCents,
      dailySeq: created.dailySeq,
      clientName: created.clientName,
      billingAddress: created.billingAddress,
      deliveryAddress: created.deliveryAddress,
      clientEmail: created.clientEmail,
      items,
      note: created.note,
    },
    { status: 201 },
  );
});
