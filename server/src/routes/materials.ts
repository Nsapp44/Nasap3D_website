import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function materialRoutes(app: FastifyInstance) {
  // Public, read-only — powers the configurator's material/color pickers
  // (replaces the front's old stock.js localStorage copy) and, later, the
  // admin stock screen's read side.
  app.get("/materials", async (_request, reply) => {
    const materials = await prisma.material.findMany({
      where: { active: true },
      orderBy: { label: "asc" },
      include: { colors: { orderBy: { colorName: "asc" } } },
    });
    return reply.send({
      materials: materials.map((m) => ({
        key: m.key,
        label: m.label,
        pricePerKgCents: m.pricePerKgCents,
        colors: m.colors.map((c) => ({ id: c.id, colorName: c.colorName, colorHex: c.colorHex, inStock: c.inStock })),
      })),
    });
  });

  app.get("/quality-profiles", async (_request, reply) => {
    const qualities = await prisma.qualityProfile.findMany({
      where: { active: true },
      orderBy: { layerHeightMm: "desc" },
    });
    return reply.send({
      qualities: qualities.map((q) => ({ key: q.key, label: q.label, layerHeightMm: q.layerHeightMm })),
    });
  });

  app.get("/discount-tiers", async (_request, reply) => {
    const tiers = await prisma.discountTier.findMany({ orderBy: { minQty: "asc" } });
    return reply.send({ tiers: tiers.map((t) => ({ minQty: t.minQty, pct: t.pct })) });
  });

  // Public, read-only — the real "mode vacances" source of truth (what
  // POST /quotes itself checks, see routes/quotes.ts). The configurator's
  // quoteEnabled UI state used to come from a per-browser localStorage flag
  // (stock.js's isQuoteEnabled(), a wireframe-demo holdover) that had no
  // connection to this at all — a browser that had ever locally flipped
  // that flag off would keep showing "indisponible" forever, even once the
  // admin turned quotes back on for real. This is what Home.dc.html/Devis
  // Instantane.dc.html should actually be reading.
  app.get("/quote-enabled", async (_request, reply) => {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    return reply.send({ quoteEnabled: !!settings?.quoteEnabled });
  });
}
