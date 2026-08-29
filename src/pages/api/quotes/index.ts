import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { getSessionUser } from "../../../lib/api/auth";
import { getOrCreateGuestSessionId } from "../../../lib/api/cookies";
import { prisma } from "../../../lib/server/prisma";
import { newFileKey, saveFile } from "../../../lib/server/storage";
import { getModelInfo, pickPrinter, sliceModel, exportTransformedStl } from "../../../lib/server/slicer";
import { computePrice } from "../../../lib/server/pricing";
import { parseStlTriangles, suggestOrientation } from "../../../lib/server/orientation";
import { enforceRateLimit, checkRateLimit, clientIp } from "../../../lib/api/rateLimit";

const ALLOWED_EXT = new Set([".stl", ".obj", ".step", ".stp"]);
const MAX_FILE_BYTES = 150 * 1024 * 1024;
// Scale is a raw multiplication factor, not a percentage (client sends
// unitMultiplier × pct/100 already combined). Bounds cover the realistic
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

// Direct port of POST /quotes — the real quote engine: uploads a 3D model,
// slices it with PrusaSlicer, computes the price. Sans limite, un script
// qui boucle dessus peut faire tourner PrusaSlicer (le plus coûteux du
// site en CPU) et remplir le stockage/la base à volonté.
export const POST = apiHandler(async (context) => {
  enforceRateLimit(`quotes:post:${clientIp(context)}`, 15, 60_000);
  if (!checkRateLimit(`quotes:${clientIp(context)}`, 100, 60 * 60 * 1000)) {
    return jsonError(429, "too_many_requests");
  }

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.quoteEnabled) {
    return jsonError(403, "quote_disabled");
  }

  const form = await context.request.formData().catch(() => null);
  if (!form) return jsonError(400, "invalid_body");
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "missing_file");
  if (file.size > MAX_FILE_BYTES) return jsonError(413, "file_too_large");

  const fileName = file.name;
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return jsonError(400, "unsupported_file_type");

  const materialKey = String(form.get("material") ?? "");
  const colorId = String(form.get("colorId") ?? "");
  const qualityKey = String(form.get("quality") ?? "");
  const infillPct = parseInt(String(form.get("infillPct") ?? ""), 10);
  const quantity = Math.min(2000, Math.max(1, parseInt(String(form.get("quantity") ?? ""), 10) || 1));
  const scaleRaw = form.get("scale");
  const scale = scaleRaw !== null ? parseFloat(String(scaleRaw)) : 1;

  if (!materialKey || !colorId || !qualityKey || !Number.isFinite(infillPct)) {
    return jsonError(400, "invalid_body");
  }
  if (!Number.isFinite(scale) || scale < MIN_SCALE || scale > MAX_SCALE) {
    return jsonError(400, "invalid_scale");
  }

  const [material, quality] = await Promise.all([
    prisma.material.findUnique({ where: { key: materialKey }, include: { colors: true } }),
    prisma.qualityProfile.findUnique({ where: { key: qualityKey } }),
  ]);
  if (!material || !material.active) return jsonError(400, "unknown_material");
  if (!quality || !quality.active) return jsonError(400, "unknown_quality");
  const color = material.colors.find((c) => c.id === colorId);
  if (!color) return jsonError(400, "unknown_color");
  if (!color.inStock) return jsonError(409, "color_out_of_stock");

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const dir = await mkdtemp(path.join(tmpdir(), "nasap3d-upload-"));
  const tmpPath = path.join(dir, fileName);
  try {
    await writeFile(tmpPath, fileBuffer);

    // Best-effort print-orientation suggestion — scored on the raw,
    // unscaled geometry (rotation is scale-independent) before anything
    // else runs. Never fails the quote on its own: a parse hiccup or an
    // unusual/degenerate mesh just falls back to no rotation (0, 0), same
    // as before this feature existed.
    let rotateXDeg = 0,
      rotateYDeg = 0;
    try {
      const stlBuffer = ext === ".stl" ? fileBuffer : await exportTransformedStl(tmpPath, {});
      const triangles = parseStlTriangles(stlBuffer);
      const suggestion = suggestOrientation(triangles);
      if (suggestion) {
        rotateXDeg = suggestion.rotateXDeg;
        rotateYDeg = suggestion.rotateYDeg;
        console.info("suggestOrientation", suggestion);
      }
    } catch (e) {
      console.warn("suggestOrientation failed, printing as-uploaded", e);
    }
    const transform = { scale, rotateXDeg, rotateYDeg };

    const info = await getModelInfo(tmpPath, transform).catch((e) => {
      console.warn("getModelInfo failed", e);
      return null;
    });
    if (!info) return jsonError(400, "unreadable_file");
    if (!info.manifold) {
      return jsonError(400, "non_manifold_model");
    }
    const printer = pickPrinter(info);
    if (!printer) return jsonError(400, "part_too_large");

    const sliced = await sliceModel(tmpPath, {
      printer,
      materialKey: material.key,
      qualityKey: quality.key,
      densityGCm3: material.densityGCm3,
      layerHeightMm: quality.layerHeightMm,
      infillPct,
      ...transform,
    }).catch((e) => {
      console.warn("sliceModel failed", e);
      return null;
    });
    if (!sliced) return jsonError(422, "slicing_failed");

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
    // admin) always has scale AND the suggested orientation actually baked
    // into its geometry, so it never again needs any client-side transform
    // to match what was priced/sliced. Always .stl output regardless of
    // the original format (.obj/.step get normalized too — fileName keeps
    // its original extension for display purposes only, the stored bytes
    // are the real, final mesh).
    const needsExport = scale !== 1 || rotateXDeg !== 0 || rotateYDeg !== 0;
    const storedBuffer = needsExport ? await exportTransformedStl(tmpPath, transform) : fileBuffer;

    const fileKey = newFileKey(fileName);
    await saveFile(fileKey, storedBuffer);

    const user = await getSessionUser(context);
    const sessionId = user ? null : getOrCreateGuestSessionId(context.cookies);

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

    return json({ quote: quotePublicView(quoteJob, price.discountPct) }, { status: 201 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
