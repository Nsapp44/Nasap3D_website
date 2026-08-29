import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { requireAuth } from "../../../lib/api/auth";
import { getCartTotalWeightG, getCartParcelRequirement, getCartTotalPrintMinutes } from "../../../lib/server/cart";
import { quoteShippingRates, BoxtalConfigError, BoxtalApiError } from "../../../lib/server/boxtal";
import { enforceRateLimit, clientIp } from "../../../lib/api/rateLimit";

const recipientSchema = z.object({
  address: z.string().trim().min(3).max(120),
  city: z.string().trim().min(1).max(80),
  zipcode: z.string().trim().min(2).max(12),
  country: z.string().trim().length(2).default("FR"),
});

// Direct port of POST /shipping/rates — real-time rate simulation, called
// from the cart page once the customer has entered a delivery address.
// Requires an account for the same reason /checkout does (the front prompts
// login before this).
export const POST = apiHandler(async (context) => {
  const user = await requireAuth(context);
  enforceRateLimit(`shipping:rates:${clientIp(context)}`, 20, 60_000);

  const body = recipientSchema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  const weightG = await getCartTotalWeightG({ userId: user.id });
  if (weightG <= 0) return jsonError(400, "empty_cart");
  const parcelRequirement = await getCartParcelRequirement({ userId: user.id });
  const printMinutes = await getCartTotalPrintMinutes({ userId: user.id });

  try {
    const rates = await quoteShippingRates(body.data, weightG, parcelRequirement, printMinutes);
    if (!rates.relay && !rates.home) return jsonError(502, "no_offer_available");
    return json(rates);
  } catch (err) {
    if (err instanceof BoxtalConfigError) {
      console.error("boxtal not configured", err);
      return jsonError(503, "shipping_not_configured");
    }
    if (err instanceof BoxtalApiError) {
      console.error("boxtal cotation failed", err);
      return jsonError(502, "shipping_provider_error");
    }
    throw err;
  }
});
