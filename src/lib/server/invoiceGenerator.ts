import type { Order, OrderItem, User } from "@prisma/client";
import type { InvoicePdfData } from "./InvoicePdf";
import { generateInvoicePdfBuffer as renderInvoicePdfInSubprocess } from "./invoicePdfSubprocess";
import { prisma } from "./prisma";
import { nextCounter } from "./counter";
import { saveFile } from "./storage";

// Builds the invoice PDF straight from our own DB rows — no Stripe invoice
// API call involved. Stripe's own role shrinks to "payment completed";
// everything the invoice needs (items, prices, recipient) already lives on
// Order/OrderItem by the time a payment is confirmed, whether that's via the
// normal webhook or the admin's "Forcer → Payée" path.
//
// Must be called at payment-confirmed time, not lazily at download time:
// recipientName/Address are purged once an order reaches DELIVERED (see
// purgeShippingDataOnDelivery, schema.prisma comment on Order.trackingNumber)
// — generating later would silently produce an invoice with no billing name.
export function buildInvoicePdfData(
  order: Order & { items: OrderItem[] },
  user: User,
  ref: string,
  issuedAt: Date,
): InvoicePdfData {
  const addressParts = [order.recipientAddress, [order.recipientZipcode, order.recipientCity].filter(Boolean).join(" ")]
    .filter((p) => p && p.trim().length > 0);

  return {
    ref,
    issuedAt,
    customerNo: user.customerNo,
    billedToName: order.recipientName || user.email,
    billedToAddress: addressParts.length > 0 ? addressParts.join(", ") : null,
    items: order.items.map((item) => ({
      nameSnapshot: item.nameSnapshot,
      materialSnapshot: item.materialSnapshot,
      colorNameSnapshot: item.colorNameSnapshot,
      colorHexSnapshot: item.colorHexSnapshot,
      infillSnapshot: item.infillSnapshot,
      qualitySnapshot: item.qualitySnapshot,
      qty: item.qty,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
    })),
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
  };
}

// Rendered in a separate short-lived process, not in-process — see
// invoicePdfSubprocess.ts for why (a real, measured @react-pdf/renderer
// memory leak across repeated in-process renders).
export async function generateInvoicePdfBuffer(
  order: Order & { items: OrderItem[] },
  user: User,
  ref: string,
  issuedAt: Date,
): Promise<Buffer> {
  const data: InvoicePdfData = buildInvoicePdfData(order, user, ref, issuedAt);
  return renderInvoicePdfInSubprocess(data);
}

// Replaces the previous Stripe-invoice-API-dependent path (fetching
// stripe.invoices.retrieve() + downloading its PDF, which only ever worked
// if invoice_creation was enabled AND the session's invoice had finished
// generating on Stripe's side). Stripe's role is now just "payment
// completed" — every field this invoice needs already lives on our own
// Order/OrderItem/User rows the moment payment is confirmed, so this can
// run unconditionally, whether that confirmation came from the normal
// webhook or the admin's "Forcer → Payée" override, without any Stripe API
// call or stored session id.
//
// Never throws — mirrors the old fetchAndAttachInvoiceForOrder contract, so
// callers can keep treating this as a best-effort side effect that must
// never block the status change that triggered it. On failure, the existing
// "Uploader une facture" manual fallback (admin/orders/[id]/invoice/upload.ts)
// remains available.
export async function createAndAttachInvoiceForOrder(
  order: Order & { items: OrderItem[] },
  user: User,
): Promise<{ attached: boolean; reason?: string }> {
  const existing = await prisma.invoice.findUnique({ where: { orderId: order.id } });
  if (existing) {
    return { attached: false, reason: "order already has an invoice" };
  }

  try {
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const dailySeq = await nextCounter("invoice:" + dateKey);
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const ref = `FAC_${String(dailySeq).padStart(3, "0")}_${dd}${mm}${yyyy}_${user.customerNo}`;

    const pdfBuffer = await generateInvoicePdfBuffer(order, user, ref, now);
    const pdfKey = `invoices/${ref}.pdf`;
    await saveFile(pdfKey, pdfBuffer);

    await prisma.invoice.create({
      data: {
        ref,
        orderId: order.id,
        userId: user.id,
        amountCents: order.totalCents,
        pdfKey,
        dailySeq,
        issuedAt: now,
      },
    });
    return { attached: true };
  } catch (err) {
    return { attached: false, reason: `invoice generation failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
