import type { FastifyInstance } from "fastify";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "../lib/prisma.js";
import { getSessionUser } from "../lib/session.js";
import { getOrCreateGuestSessionId } from "../lib/guestSession.js";
import { newFileKey, saveFile } from "../lib/storage.js";
import { getModelInfo, pickPrinter, sliceModel } from "../lib/slicer.js";
import { computePrice } from "../lib/pricing.js";

const ALLOWED_EXT = new Set([".stl", ".3mf", ".obj", ".step", ".stp"]);
const MAX_FILE_BYTES = 150 * 1024 * 1024;

function quotePublicView(q: {
  id: string; fileName: string; volumeCm3: number | null; weightG: number | null;
  estimatedTimeMin: number | null; unitPriceCents: number | null; totalPriceCents: number | null;
  quantity: number; infillPct: number; expiresAt: Date | null; status: string;
  material: { key: string; label: string }; color: { colorName: string; colorHex: string };
  quality: { key: string; label: string };
}, discountPct: number) {
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
    expiresAt: q.expiresAt,
    status: q.status,
  };
}

export async function quoteRoutes(app: FastifyInstance) {
  app.post("/quotes", async (request, reply) => {
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
    const quantity = Math.max(1, parseInt(fields.quantity, 10) || 1);

    if (!materialKey || !colorId || !qualityKey || !Number.isFinite(infillPct)) {
      return reply.code(400).send({ error: "invalid_body" });
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

      const info = await getModelInfo(tmpPath).catch((e) => {
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
        setupFeeCents: settings.setupFeeCents,
        marginPct: settings.marginPct,
        quantity,
        discountTiers: tiers,
      });

      const fileKey = newFileKey(fileName);
      await saveFile(fileKey, fileBuffer);

      const user = await getSessionUser(request);
      const sessionId = user ? null : getOrCreateGuestSessionId(request, reply);

      const quoteJob = await prisma.quoteJob.create({
        data: {
          userId: user?.id,
          sessionId: sessionId ?? undefined,
          fileKey,
          fileName,
          fileSizeBytes: fileBuffer.length,
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
          expiresAt: new Date(Date.now() + settings.quoteExpiryMinutes * 60_000),
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
}
