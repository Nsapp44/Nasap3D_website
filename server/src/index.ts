import "dotenv/config";
import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { authRoutes } from "./routes/auth.js";
import { accountRoutes } from "./routes/account.js";
import { contactRoutes } from "./routes/contact.js";
import { quoteRoutes } from "./routes/quotes.js";
import { materialRoutes } from "./routes/materials.js";
import { adminRoutes } from "./routes/admin.js";
import { cartRoutes } from "./routes/cart.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: (process.env.CORS_ORIGIN || "").split(",").filter(Boolean),
  credentials: true,
});
await app.register(cookie);
await app.register(multipart);

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

const port = Number(process.env.PORT || 3000);
app
  .listen({ port, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
