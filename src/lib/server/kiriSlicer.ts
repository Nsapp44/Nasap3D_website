// Replaces lib/server/slicer.ts (PrusaSlicer) — see the Kiri:Moto plan
// (idempotent-shimmying-swan). Three roles, this file covers two of them:
//
//  1. Client-side full slice (primary) — NOT this file, see
//     public/kiri-slicer.js + src/lib/kiriProfiles.ts, runs in the
//     visitor's own browser.
//  2. Server-side cheap price check — loadTrianglesFromFile() +
//     getModelInfo() below, pure JS, no Kiri:Moto engine involved at all.
//     Confirmed a 225k-triangle STL parses + volumes in a few ms.
//  3. Server-side full-slice fallback (rare: weak client device, or the
//     cheap check flags the client's numbers as implausible) — sliceModel()
//     below, shells out to the real grid-apps Kiri:Moto CLI
//     (vendor/grid-apps/src/kiri-run/cli.js, vendored at Docker build time
//     via a tarball download — see Dockerfile; real symlinks are required
//     and only resolve correctly on Linux, confirmed by direct testing this
//     session, so this role is unavailable in native Windows dev — local
//     testing of this specific path needs `docker compose up --build`).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  parseStlTriangles,
  parseObjTriangles,
  computeBoundingBox,
  computeMeshVolumeMm3,
  checkManifoldAndParts,
  applyTransform,
  serializeBinaryStl,
  type Triangle,
  type MeshTransform,
} from "./orientation";
import { parse3mfTriangles } from "./threeMfParse";
import { buildKiriDevice, buildKiriProcess, parseKiriGcodeStats, filamentLengthToWeightG } from "../kiriProfiles";

const execFileAsync = promisify(execFile);

const GRID_APPS_DIR = path.resolve(process.cwd(), "vendor/grid-apps");
const KIRI_CLI_PATH = path.join(GRID_APPS_DIR, "src/kiri-run/cli.js");

export interface ModelInfo {
  sizeXMm: number;
  sizeYMm: number;
  sizeZMm: number;
  volumeMm3: number;
  manifold: boolean;
  parts: number;
}

export interface PrinterProfile {
  key: string;
  label: string;
  bedXMm: number;
  bedYMm: number;
  heightMm: number;
}

// Same H2C numbers as the old PrusaSlicer PRINTERS — the machine the
// instant quote actually runs against, no .ini file needed anymore (that
// was a PrusaSlicer-specific config format).
export const PRINTERS: PrinterProfile[] = [
  { key: "h2c", label: "Bambu Lab H2C", bedXMm: 330, bedYMm: 320, heightMm: 325 },
];

export function pickPrinter(info: ModelInfo): PrinterProfile | null {
  const p = PRINTERS[0];
  const dims = [info.sizeXMm, info.sizeYMm, info.sizeZMm].sort((a, b) => a - b);
  const bed = [p.bedXMm, p.bedYMm].sort((a, b) => a - b);
  if (dims[0] <= bed[0] - 4 && dims[1] <= bed[1] - 4 && dims[2] <= p.heightMm - 4) return p;
  return null;
}

export type ModelTransform = MeshTransform;

export async function loadTrianglesFromFile(filePath: string, ext: string): Promise<Triangle[]> {
  const buffer = await readFile(filePath);
  if (ext === ".3mf") return parse3mfTriangles(buffer);
  if (ext === ".obj") return parseObjTriangles(buffer.toString("utf8"));
  return parseStlTriangles(buffer);
}

// Replaces PrusaSlicer's `--info` — no subprocess, no slicing engine, just
// geometry math on the already-parsed triangle list (transformed to match
// what will actually be printed/priced). manifold-ness comes from the
// hand-rolled bad-edge-fraction heuristic (checkManifoldAndParts, a
// tolerance-based measure — real hole/missing wall = tens of percent bad
// edges, real-world export noise = well under 1%). An earlier version of
// this used the Manifold library (elalish/manifold, a real CSG-grade
// geometry kernel, via manifold-3d) instead — dropped after confirming live
// it rejects two real, genuinely printable customer files outright
// (NotManifold, no tolerance at all) while this heuristic's 1% tolerance
// correctly accepts both (0.007% and 0.26% bad edges respectively).
export async function getModelInfo(triangles: Triangle[]): Promise<ModelInfo> {
  const bbox = computeBoundingBox(triangles);
  const volumeMm3 = computeMeshVolumeMm3(triangles);
  const { manifold, parts } = checkManifoldAndParts(triangles);
  return { ...bbox, volumeMm3, manifold, parts };
}

// Bakes scale/rotation into the mesh and re-serializes as STL — replaces
// PrusaSlicer's `--export-stl`. Always STL out regardless of input format,
// same as before (production printing needs a normalized mesh either way).
export function exportTransformedStl(triangles: Triangle[], transform: ModelTransform): Buffer {
  return serializeBinaryStl(applyTransform(triangles, transform));
}

export interface ClaimedSliceResult {
  weightG: number;
  estimatedTimeMin: number;
}

// The cheap server-side check (role 2) — NOT a price recomputation, just a
// fraud guard against a client that under-reports weight/time to pay less
// (the only direction that actually matters: the cart always re-reads the
// price from the server-created QuoteJob, see cart/index.ts, so a client
// can never submit a price directly — this only protects the WEIGHT/TIME
// numbers that feed into that price). Deliberately generous: this is a
// sanity envelope, not a precision match — real weight depends on
// infill/walls/support in ways only a real slice knows exactly, and a false
// positive here means a legitimate customer gets bounced to the (rare,
// slower) server fallback for nothing, not a wrongly-priced order.
//
// solidWeightG (100% infill, no cavities) is a hard physical upper bound —
// nothing can weigh more than its own fully-solid volume. fillFraction
// approximates the real fraction of that solid volume actually extruded:
// the requested infill% for the interior, plus a flat allowance for the
// walls/top/bottom solid layers that exist regardless of infill (roughly
// measured against this project's own 3-perimeter/3-layer defaults, see
// kiriProfiles.ts) — not exact, doesn't need to be.
export function validateClaimedSlice(
  info: ModelInfo,
  opts: { infillPct: number; densityGCm3: number },
  claimed: ClaimedSliceResult,
): boolean {
  if (!Number.isFinite(claimed.weightG) || !Number.isFinite(claimed.estimatedTimeMin)) return false;
  if (claimed.weightG <= 0 || claimed.estimatedTimeMin <= 0) return false;

  const solidWeightG = (info.volumeMm3 / 1000) * opts.densityGCm3;
  const fillFraction = Math.min(1, opts.infillPct / 100 + 0.15);
  const expectedWeightG = solidWeightG * fillFraction;
  const minPlausibleWeightG = expectedWeightG * 0.35;
  const maxPlausibleWeightG = solidWeightG * 1.15;
  if (claimed.weightG < minPlausibleWeightG || claimed.weightG > maxPlausibleWeightG) return false;

  // Wide throughput envelope (mm3/s) spanning slow (TPU-like) to fast
  // (PLA-like) real extrusion rates — see MATERIAL_MAX_VOLUMETRIC_SPEED-
  // style figures previously tuned against real Bambu profiles. Generous on
  // purpose: catches an absurd "2 minutes for a 500g part" claim, not
  // fine-grained speed gaming.
  const extrudedVolumeMm3 = info.volumeMm3 * fillFraction;
  const minTimeMin = extrudedVolumeMm3 / 30 / 60;
  const maxTimeMin = extrudedVolumeMm3 / 0.5 / 60 + 5; // +5min floor for travel/setup on tiny parts
  if (claimed.estimatedTimeMin < minTimeMin || claimed.estimatedTimeMin > maxTimeMin) return false;

  return true;
}

let gridAppsAvailable: boolean | null = null;
async function checkGridAppsAvailable(): Promise<boolean> {
  if (gridAppsAvailable === null) {
    gridAppsAvailable = await access(KIRI_CLI_PATH)
      .then(() => true)
      .catch(() => false);
  }
  return gridAppsAvailable;
}

export interface SliceOptions {
  printer: PrinterProfile;
  materialKey: string;
  qualityKey: string;
  layerHeightMm: number;
  densityGCm3: number;
  infillPct: number;
}

export interface SliceResult {
  weightG: number;
  estimatedTimeMin: number;
  volumeCm3: number;
}

// The rare full-slice fallback (role 3) — real Kiri:Moto, via the vendored
// grid-apps CLI script run as a subprocess (its own --device/--process/
// --model/--output flags, no custom wrapper script needed). Confirmed
// working end-to-end this session against a 225k-triangle Benchy with these
// exact custom device/process values (~10s with support enabled).
export async function sliceModel(triangles: Triangle[], opts: SliceOptions): Promise<SliceResult> {
  if (!(await checkGridAppsAvailable())) {
    throw new Error("kiri_fallback_unavailable: vendor/grid-apps not found (Linux/Docker only, see Dockerfile)");
  }

  const device = buildKiriDevice();
  device.bedWidth = opts.printer.bedXMm;
  device.bedDepth = opts.printer.bedYMm;
  device.maxHeight = opts.printer.heightMm;
  const process_ = buildKiriProcess(opts.qualityKey, opts.layerHeightMm, opts.infillPct, opts.materialKey);

  const dir = await mkdtemp(path.join(tmpdir(), "nasap3d-kiri-"));
  try {
    const modelPath = path.join(dir, "model.stl");
    const devicePath = path.join(dir, "device.json");
    const processPath = path.join(dir, "process.json");
    const outputPath = path.join(dir, "out.gcode");

    await Promise.all([
      writeFile(modelPath, serializeBinaryStl(triangles)),
      writeFile(devicePath, JSON.stringify(device)),
      writeFile(processPath, JSON.stringify(process_)),
    ]);

    await execFileAsync(
      "node",
      [
        KIRI_CLI_PATH,
        `--dir=${GRID_APPS_DIR}`,
        `--model=${modelPath}`,
        `--device=${devicePath}`,
        `--process=${processPath}`,
        `--output=${outputPath}`,
      ],
      { timeout: 120_000, cwd: GRID_APPS_DIR, maxBuffer: 10 * 1024 * 1024 },
    );

    // Ground truth is the output file, not the subprocess's stdout/log
    // lines — a real bug hunted down this session: Kiri:Moto's own CLI can
    // exit 0 with sparse logging well before the gcode is actually done,
    // and separately, its promise chain doesn't always surface errors the
    // way a normal execFile failure would.
    const gcode = await readFile(outputPath, "utf8").catch(() => null);
    if (!gcode) throw new Error("kiri produced no gcode output");

    const stats = parseKiriGcodeStats(gcode);
    if (!stats) throw new Error("could not parse kiri gcode output");

    const weightG = filamentLengthToWeightG(stats.filamentMm, opts.densityGCm3);
    return {
      weightG,
      estimatedTimeMin: stats.estimatedTimeMin,
      volumeCm3: (weightG / opts.densityGCm3) * 1, // g / (g/cm3) = cm3
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
