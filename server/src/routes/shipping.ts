import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../lib/session.js";
import { getCartTotalWeightG, getCartParcelRequirement, getCartTotalPrintMinutes } from "../lib/cart.js";
import { quoteShippingRates, getBoxtalMapAccessToken, BoxtalConfigError, BoxtalApiError } from "../lib/boxtal.js";

const recipientSchema = z.object({
  address: z.string().trim().min(3).max(120),
  city: z.string().trim().min(1).max(80),
  zipcode: z.string().trim().min(2).max(12),
  country: z.string().trim().length(2).default("FR"),
});

// Real-time rate simulation, called from the cart page once the customer has
// entered a delivery address — see server/SHIPPING.md. Requires an account
// for the same reason /checkout does (the front prompts login before this).
export async function shippingRoutes(app: FastifyInstance) {
  app.post(
    "/shipping/rates",
    { preHandler: requireAuth, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = recipientSchema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "invalid_body" });

      const weightG = await getCartTotalWeightG({ userId: request.user!.id });
      if (weightG <= 0) return reply.code(400).send({ error: "empty_cart" });
      const parcelRequirement = await getCartParcelRequirement({ userId: request.user!.id });
      const printMinutes = await getCartTotalPrintMinutes({ userId: request.user!.id });

      try {
        const rates = await quoteShippingRates(body.data, weightG, parcelRequirement, printMinutes);
        if (!rates.relay && !rates.home) return reply.code(502).send({ error: "no_offer_available" });
        return reply.send(rates);
      } catch (err) {
        if (err instanceof BoxtalConfigError) {
          request.log.error(err, "boxtal not configured");
          return reply.code(503).send({ error: "shipping_not_configured" });
        }
        if (err instanceof BoxtalApiError) {
          request.log.error(err, "boxtal cotation failed");
          return reply.code(502).send({ error: "shipping_provider_error" });
        }
        throw err;
      }
    },
  );

  // Short-lived token for the Boxtal parcel-point-map widget (see
  // lib/boxtal.ts getBoxtalMapAccessToken) — minted server-side so
  // BOXTAL_MAP_API_SECRET never reaches the browser, cached in-memory
  // between calls since the token isn't user-specific.
  app.get(
    "/shipping/map-token",
    { preHandler: requireAuth, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      try {
        const { accessToken, expiresIn } = await getBoxtalMapAccessToken();
        return reply.send({ accessToken, expiresIn });
      } catch (err) {
        if (err instanceof BoxtalConfigError) {
          request.log.error(err, "boxtal map not configured");
          return reply.code(503).send({ error: "shipping_not_configured" });
        }
        if (err instanceof BoxtalApiError) {
          request.log.error(err, "boxtal map token failed");
          return reply.code(502).send({ error: "shipping_provider_error" });
        }
        throw err;
      }
    },
  );
}
