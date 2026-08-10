import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: (process.env.CORS_ORIGIN || "").split(",").filter(Boolean),
  credentials: true,
});
await app.register(cookie);

app.get("/health", async () => ({ ok: true }));

const port = Number(process.env.PORT || 3000);
app
  .listen({ port, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
