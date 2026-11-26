import { createHmac, timingSafeEqual } from "node:crypto";

// Signed per-order URL given to Boxtal as `url_push` when buying a label.
// Boxtal calls it back (GET) on tracking/status changes; the signature in
// the path proves the call targets an order we actually announced.
function secret(): string {
  const key = process.env.BOXTAL_WEBHOOK_SECRET || process.env.BOXTAL_API_SECRET_V1;
  if (!key) throw new Error("BOXTAL_WEBHOOK_SECRET or BOXTAL_API_SECRET_V1 required to sign Boxtal webhook URLs");
  return key;
}

export function signBoxtalWebhook(orderId: string): string {
  return createHmac("sha256", secret()).update(`boxtal:${orderId}`).digest("hex").slice(0, 32);
}

export function boxtalWebhookUrl(orderId: string): string {
  const base = (process.env.FRONT_URL || "").replace(/\/+$/, "");
  return `${base}/api/webhooks/boxtal/${orderId}/${signBoxtalWebhook(orderId)}`;
}

export function verifyBoxtalWebhook(orderId: string, sig: string): boolean {
  let expected: Buffer;
  try {
    expected = Buffer.from(signBoxtalWebhook(orderId));
  } catch {
    return false;
  }
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
