import type { FastifyInstance } from "fastify";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "../lib/prisma.js";
import { getSessionUser } from "../lib/session.js";
import { getOrCreateGuestSessionId } from "../lib/guestSession.js";
import { newFileKey, saveFile, readFileByKey } from "../lib/storage.js";
import { checkLongWindowLimit } from "../lib/longWindowLimit.js";
import { getModelInfo, pickPrinter, sliceModel, exportTransformedStl } from "../lib/slicer.js";
import { computePrice } from "../lib/pricing.js";
import { deleteQuoteJobFileIfOrphaned } from "../lib/quoteCleanup.js";
import { parseStlTriangles, suggestOrientation } from "../lib/orientation.js";

const ALLOWED_EXT = new Set([".stl", ".obj", ".step", ".stp"]);
const MAX_FILE_BYTES = 150 * 1024 * 1024;
// Scale is a raw multiplication factor, not a percentage (client sends
// unitMultiplier × pct/100 already combined — see Home.dc.html/Devis
// Instantane.dc.html _computeCfgScale()). Bounds cover the realistic
// unit-mistake range (mm↔inch ≈25.4×, mm↔m ≈1000×) with margin either way,
// while still rejecting garbage input outright.
const MIN_SCALE = 0.001;
const MAX_SCALE = 2000;

function quotePublicView(
  q: {
    id: string;
    fileName: string;
    volumeCm3: number | null;
    weightG: number | null;
    estimatedTimeMin: number | null;
    unitPriceCents: number | null;
    totalPriceCents: number | null;
    quantity: number;
    infillPct: number;
    status: string;
    material: { key: string; label: string };
    color: { colorName: string; colorHex: string };
    quality: { key: string; label: string };
  },
  discountPct: number,
) {
  return {
    id: q.id,
    fileName: q.fileName,
    material: q.material.key,
    materialLabel: q.material.label,
    colorName: q.color.colorName,
    colorHex: q.color.colorHex,
    quality: q.quality.key,
    qualityLabel: q.quality.label,
    infillPct: q.infillPct,
    quantity: q.quantity,
    volumeCm3: q.volumeCm3,
    weightG: q.weightG,
    estimatedTimeMin: q.estimatedTimeMin,
    unitPriceCents: q.unitPriceCents,
    totalPriceCents: q.totalPriceCents,
    discountPct,
    status: q.status,
  };
}

export async function quoteRoutes(app: FastifyInstance) {
  // Sans limite, un script qui boucle dessus peut faire tourner PrusaSlicer
  // (le plus coûteux du site en CPU) et remplir le stockage/la base à
  // volonté — voir contact.ts pour le même principe sur /contact/upload.
  app.post("/quotes", { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } }, async (request, reply) => {
    // Filet en plus de la limite par minute ci-dessus — un vrai visiteur
    // n'approche jamais 100 devis/heure, un script en boucle si.
    if (!checkLongWindowLimit(`quotes:${request.ip}`, 100, 60 * 60 * 1000)) {
      return reply.code(429).send({ error: "too_many_requests" });
    }
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings?.quoteEnabled) {
      return reply.code(403).send({ error: "quote_disabled" });
    }

    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | null = null;
    let fileName = "";

    for await (const part of request.parts({ limits: { fileSize: MAX_FILE_BYTES } })) {
      if (part.type === "file") {
        fileName = part.filename;
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(chunk as Buffer);
        fileBuffer = Buffer.concat(chunks);
        if (part.file.truncated) {
          return reply.code(413).send({ error: "file_too_large" });
        }
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }

    if (!fileBuffer || !fileName) return reply.code(400).send({ error: "missing_file" });
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return reply.code(400).send({ error: "unsupported_file_type" });

    const materialKey = fields.material;
    const colorId = fields.colorId;
    const qualityKey = fields.quality;
    const infillPct = parseInt(fields.infillPct, 10);
    const quantity = Math.min(2000, Math.max(1, parseInt(fields.quantity, 10) || 1));
    const scale = fields.scale !== undefined ? parseFloat(fields.scale) : 1;

    if (!materialKey || !colorId || !qualityKey || !Number.isFinite(infillPct)) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    if (!Number.isFinite(scale) || scale < MIN_SCALE || scale > MAX_SCALE) {
      return reply.code(400).send({ error: "invalid_scale" });
    }

    const [material, quality] = await Promise.all([
      prisma.material.findUnique({ where: { key: materialKey }, include: { colors: true } }),
      prisma.qualityProfile.findUnique({ where: { key: qualityKey } }),
    ]);
    if (!material || !material.active) return reply.code(400).send({ error: "unknown_material" });
    if (!quality || !quality.active) return reply.code(400).send({ error: "unknown_quality" });
    const color = material.colors.find((c) => c.id === colorId);
    if (!color) return reply.code(400).send({ error: "unknown_color" });
    if (!color.inStock) return reply.code(409).send({ error: "color_out_of_stock" });

    const dir = await mkdtemp(path.join(tmpdir(), "nasap3d-upload-"));
    const tmpPath = path.join(dir, fileName);
    try {
      await writeFile(tmpPath, fileBuffer);

      // Best-effort print-orientation suggestion (see lib/orientation.ts) —
      // scored on the raw, unscaled geometry (rotation is scale-independent)
      // before anything else runs. Never fails the quote on its own: a
      // parse hiccup or an unusual/degenerate mesh just falls back to no
      // rotation (0, 0), same as before this feature existed.
      let rotateXDeg = 0,
        rotateYDeg = 0;
      try {
        const stlBuffer = ext === ".stl" ? fileBuffer : await exportTransformedStl(tmpPath, {});
        const triangles = parseStlTriangles(stlBuffer);
        const suggestion = suggestOrientation(triangles);
        if (suggestion) {
          rotateXDeg = suggestion.rotateXDeg;
          rotateYDeg = suggestion.rotateYDeg;
          request.log.info({ suggestion }, "suggestOrientation");
        }
      } catch (e) {
        request.log.warn(e, "suggestOrientation failed, printing as-uploaded");
      }
      const transform = { scale, rotateXDeg, rotateYDeg };

      const info = await getModelInfo(tmpPath, transform).catch((e) => {
        request.log.warn(e, "getModelInfo failed");
        return null;
      });
      if (!info) return reply.code(400).send({ error: "unreadable_file" });
      if (!info.manifold) {
        return reply.code(400).send({ error: "non_manifold_model" });
      }
      const printer = pickPrinter(info);
      if (!printer) return reply.code(400).send({ error: "part_too_large" });

      const sliced = await sliceModel(tmpPath, {
        printer,
        materialKey: material.key,
        qualityKey: quality.key,
        densityGCm3: material.densityGCm3,
        layerHeightMm: quality.layerHeightMm,
        infillPct,
        ...transform,
      }).catch((e) => {
        request.log.warn(e, "sliceModel failed");
        return null;
      });
      if (!sliced) return reply.code(422).send({ error: "slicing_failed" });

      const tiers = await prisma.discountTier.findMany({ orderBy: { minQty: "asc" } });
      const price = computePrice({
        weightG: sliced.weightG,
        estimatedTimeMin: sliced.estimatedTimeMin,
        pricePerKgCents: material.pricePerKgCents,
        hourlyRateCents: settings.hourlyRateCents,
        minUnitPriceCents: settings.minUnitPriceCents,
        quantity,
        discountTiers: tiers,
      });

      // The file kept in storage (re-downloaded later for real production,
      // and re-used for every later preview — cart, "Analyse terminée",
      // admin) always has scale AND the suggested orientation actually
      // baked into its geometry, so it never again needs any client-side
      // transform to match what was priced/sliced. Always .stl output
      // regardless of the original format (.obj/.step get normalized too —
      // fileName keeps its original extension for display purposes only,
      // the stored bytes are the real, final mesh).
      const needsExport = scale !== 1 || rotateXDeg !== 0 || rotateYDeg !== 0;
      const storedBuffer = needsExport ? await exportTransformedStl(tmpPath, transform) : fileBuffer;

      const fileKey = newFileKey(fileName);
      await saveFile(fileKey, storedBuffer);

      const user = await getSessionUser(request);
      const sessionId = user ? null : getOrCreateGuestSessionId(request, reply);

      const quoteJob = await prisma.quoteJob.create({
        data: {
          userId: user?.id,
          sessionId: sessionId ?? undefined,
          fileKey,
          fileName,
          fileSizeBytes: storedBuffer.length,
          materialId: material.id,
          colorId: color.id,
          qualityId: quality.id,
          infillPct,
          quantity,
          volumeCm3: sliced.volumeCm3,
          bboxXMm: info.sizeXMm,
          bboxYMm: info.sizeYMm,
          bboxZMm: info.sizeZMm,
          weightG: sliced.weightG,
          estimatedTimeMin: sliced.estimatedTimeMin,
          unitPriceCents: price.unitPriceCents,
          totalPriceCents: price.totalCents,
          status: "ANALYZED",
        },
        include: { material: true, color: true, quality: true },
      });

      return reply.code(201).send({ quote: quotePublicView(quoteJob, price.discountPct) });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  app.get("/quotes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const quoteJob = await prisma.quoteJob.findUnique({
      where: { id },
      include: { material: true, color: true, quality: true },
    });
    if (!quoteJob) return reply.code(404).send({ error: "not_found" });

    const user = await getSessionUser(request);
    const sessionId = request.cookies["n3d_guest"];
    const owns = (user && quoteJob.userId === user.id) || (!user && sessionId && quoteJob.sessionId === sessionId);
    if (!owns) return reply.code(404).send({ error: "not_found" });

    const tiers = await prisma.discountTier.findMany({ orderBy: { minQty: "asc" } });
    const discountPct = tiers.reduce((acc, t) => (quoteJob.quantity >= t.minQty ? Math.max(acc, t.pct) : acc), 0);
    return reply.send({ quote: quotePublicView(quoteJob, discountPct) });
  });

  // The original upload, for the owner only — powers the real-geometry
  // preview in the cart (see viewer3d.js) instead of a placeholder cube.
  app.get("/quotes/:id/file", async (request, reply) => {
    const { id } = request.params as { id: string };
    const quoteJob = await prisma.quoteJob.findUnique({ where: { id } });
    if (!quoteJob) return reply.code(404).send({ error: "not_found" });

    const user = await getSessionUser(request);
    const sessionId = request.cookies["n3d_guest"];
    const owns = (user && quoteJob.userId === user.id) || (!user && sessionId && quoteJob.sessionId === sessionId);
    if (!owns) return reply.code(404).send({ error: "not_found" });

    const buffer = await readFileByKey(quoteJob.fileKey);
    return reply
      .header("Content-Disposition", `inline; filename="${quoteJob.fileName.replace(/"/g, "")}"`)
      .header("Content-Type", "application/octet-stream")
      .send(buffer);
  });

  // Best-effort immediate cleanup: the configurator calls this via
  // navigator.sendBeacon when the tab closes/navigates away with an
  // analyzed quote that was never added to the cart (see Devis
  // Instantane.dc.html) — no response is ever read by a beacon, so this
  // always replies 204 regardless of outcome. deleteQuoteJobFileIfOrphaned
  // already no-ops if the quote is still in a cart or was ordered, so even
  // a stray/late call here can't delete a file still in use. Not the only
  // cleanup path — the periodic sweep (lib/quoteCleanup.ts) is the
  // reliable backstop for whatever this misses (network drop, browser not
  // firing the beacon, cookies not sent cross-site, ...).
  app.post("/quotes/:id/discard", async (request, reply) => {
    const { id } = request.params as { id: string };
    const quoteJob = await prisma.quoteJob.findUnique({ where: { id } });
    if (quoteJob) {
      const user = await getSessionUser(request);
      const sessionId = request.cookies["n3d_guest"];
      const owns = (user && quoteJob.userId === user.id) || (!user && sessionId && quoteJob.sessionId === sessionId);
      if (owns) await deleteQuoteJobFileIfOrphaned(id);
    }
    return reply.code(204).send();
  });
}
