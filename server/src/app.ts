import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth.js";
import { accountRoutes } from "./routes/account.js";
import { contactRoutes } from "./routes/contact.js";
import { quoteRoutes } from "./routes/quotes.js";
import { materialRoutes } from "./routes/materials.js";
import { adminRoutes } from "./routes/admin.js";
import { cartRoutes } from "./routes/cart.js";
import { shippingRoutes } from "./routes/shipping.js";
import { checkoutRoutes, stripeWebhookRoutes } from "./routes/checkout.js";
import { customerOrderRoutes } from "./routes/orders.js";
import { googleRoutes } from "./routes/google.js";

// Split from index.ts so tests can build a real app (real plugins, real
// routes) and exercise it with Fastify's .inject() — no open port, no
// separate process — without also calling .listen().
export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? true });

  await app.register(cors, {
    origin: (process.env.CORS_ORIGIN || "").split(",").filter(Boolean),
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart);
  // global:false — nothing is rate-limited unless a route opts in with its
  // own `config: { rateLimit: {...} }` (see auth.ts, contact.ts). Login,
  // signup, password-reset and the contact form were previously guarded by
  // hCaptcha alone, with no independent limit on request volume.
  await app.register(rateLimit, { global: false });

  // Every response here can vary per visitor (session cookie, guest cart
  // id, admin auth) — an intermediary cache (a reverse proxy, a CDN) that
  // doesn't specifically know to key its cache by cookie can otherwise
  // serve one visitor's response (e.g. their cart) to a completely
  // different visitor. Explicit "no-store" is a hard instruction any
  // well-behaved cache must obey, rather than relying on every proxy in
  // front of this API to correctly special-case cookie-scoped responses.
  // Confirmed live: a visitor reported seeing another visitor's cart.
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "private, no-store");
    return payload;
  });

  // Any error not already handled explicitly by a route (e.g. the DB being
  // unreachable) must never reach the client as a raw stack trace/message —
  // that leaks internals (file paths, connection strings, query shape).
  app.setErrorHandler((err: FastifyError, request, reply) => {
    request.log.error(err);
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status >= 500) {
      reply.code(500).send({ error: "internal_error" });
      return;
    }
    reply.code(status).send({ error: err.message });
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(accountRoutes);
  await app.register(contactRoutes);
  await app.register(quoteRoutes);
  await app.register(materialRoutes);
  await app.register(adminRoutes);
  await app.register(cartRoutes);
  await app.register(shippingRoutes);
  await app.register(checkoutRoutes);
  await app.register(customerOrderRoutes);
  await app.register(googleRoutes);
  // Own encapsulated scope: registers a raw-buffer body parser needed to
  // verify Stripe's webhook signature, without affecting any other route.
  await app.register(stripeWebhookRoutes);

  return app;
}
