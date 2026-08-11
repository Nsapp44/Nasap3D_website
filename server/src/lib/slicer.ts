import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

// Nozzle/bed temperatures per material family. Sourced from Bambu Lab's own
// official BambuStudio filament profiles (bambulab/BambuStudio, resources/
// profiles/BBL/filament/), fetched and read directly — not guessed. PP has
// no official Bambu profile, kept as a placeholder. These don't move the
// price (only weight/time do), so precision here matters less than for
// densities/speeds below.
const MATERIAL_TEMPS: Record<string, { nozzle: number; bed: number }> = {
  PLA: { nozzle: 220, bed: 55 },
  PETG: { nozzle: 245, bed: 70 },
  ABS: { nozzle: 270, bed: 90 },
  ASA: { nozzle: 270, bed: 100 },
  TPU: { nozzle: 230, bed: 50 },
  Nylon: { nozzle: 280, bed: 80 }, // Bambu PA-CF @base — closest official profile to our carbon-fiber nylon colors
  PP: { nozzle: 240, bed: 100 }, // no official Bambu profile — placeholder
};

// Wall/infill/travel speeds and acceleration per quality tier, read from
// Bambu Lab's own H2C process profiles (0.20mm Standard, 0.12mm High
// Quality — closest match for "Rapide" is their 0.24mm Standard tier, since
// 0.4mm nozzles don't have an official 0.28mm preset). Used as the
// reference for all three machines per the user's instruction, since X1C/
// X2D-specific exports weren't fetched.
const QUALITY_SPEEDS: Record<string, {
  outerWall: number; innerWall: number; infill: number; solidInfill: number;
  topSurface: number; travel: number; firstLayer: number; accel: number;
}> = {
  Rapide: { outerWall: 200, innerWall: 300, infill: 350, solidInfill: 250, topSurface: 200, travel: 1000, firstLayer: 50, accel: 8000 },
  Standard: { outerWall: 200, innerWall: 300, infill: 350, solidInfill: 250, topSurface: 200, travel: 1000, firstLayer: 50, accel: 8000 },
  Fine: { outerWall: 60, innerWall: 120, infill: 100, solidInfill: 100, topSurface: 60, travel: 500, firstLayer: 30, accel: 4000 },
};

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
  iniPath: string;
}

const PROFILES_DIR = path.resolve(process.cwd(), "slicer-profiles");

export const PRINTERS: PrinterProfile[] = [
  { key: "x1c", label: "Bambu Lab X1C", bedXMm: 256, bedYMm: 256, heightMm: 256, iniPath: path.join(PROFILES_DIR, "x1c.ini") },
  { key: "x2d", label: "Bambu Lab X2D", bedXMm: 256, bedYMm: 256, heightMm: 256, iniPath: path.join(PROFILES_DIR, "x2d.ini") },
  { key: "h2c", label: "Bambu Lab H2C", bedXMm: 350, bedYMm: 320, heightMm: 325, iniPath: path.join(PROFILES_DIR, "h2c.ini") },
];

// Smallest machine the part fits on (with a couple mm of clearance), in the
// order defined above. Matches the front-end FAQ's own printer list.
export function pickPrinter(info: ModelInfo): PrinterProfile | null {
  const dims = [info.sizeXMm, info.sizeYMm, info.sizeZMm].sort((a, b) => a - b);
  for (const p of PRINTERS) {
    const bed = [p.bedXMm, p.bedYMm].sort((a, b) => a - b);
    // conservative fit check: try the part's two smallest dims against the
    // bed's two dims (allows rotation on the plate), tallest dim vs height.
    if (dims[0] <= bed[0] - 4 && dims[1] <= bed[1] - 4 && dims[2] <= p.heightMm - 4) return p;
  }
  return null;
}

function bin(): string {
  const b = process.env.PRUSASLICER_BIN;
  if (!b) throw new Error("PRUSASLICER_BIN is not configured (see server/.env.example)");
  return b;
}

export async function getModelInfo(filePath: string): Promise<ModelInfo> {
  const { stdout } = await execFileAsync(bin(), ["--info", filePath], { timeout: 30_000 });
  const get = (key: string) => {
    const m = stdout.match(new RegExp(`^${key}\\s*=\\s*([-\\d.]+)`, "m"));
    return m ? parseFloat(m[1]) : NaN;
  };
  const parts = stdout.match(/^number_of_parts\s*=\s*(\d+)/m);
  return {
    sizeXMm: get("size_x"),
    sizeYMm: get("size_y"),
    sizeZMm: get("size_z"),
    volumeMm3: get("volume"),
    manifold: /^manifold\s*=\s*yes/m.test(stdout),
    parts: parts ? parseInt(parts[1], 10) : 1,
  };
}

function parseGcodeTime(gcode: string): number | null {
  // "; estimated printing time (normal mode) = 1h 23m 45s" (any subset of
  // d/h/m/s present depending on duration).
  const m = gcode.match(/estimated printing time \(normal mode\) = ([\dhmsd ]+)/);
  if (!m) return null;
  const s = m[1];
  const d = parseInt((s.match(/(\d+)d/) || [])[1] || "0", 10);
  const h = parseInt((s.match(/(\d+)h/) || [])[1] || "0", 10);
  const mi = parseInt((s.match(/(\d+)m(?!s)/) || [])[1] || "0", 10);
  const se = parseInt((s.match(/(\d+)s/) || [])[1] || "0", 10);
  return d * 1440 + h * 60 + mi + se / 60;
}

function parseGcodeWeight(gcode: string): number | null {
  const m = gcode.match(/total filament used \[g\]\s*=\s*([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

function parseGcodeVolume(gcode: string): number | null {
  const m = gcode.match(/filament used \[cm3\]\s*=\s*([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

export interface SliceOptions {
  printer: PrinterProfile;
  materialKey: string;
  qualityKey: string;
  densityGCm3: number;
  layerHeightMm: number;
  infillPct: number;
}

export interface SliceResult {
  weightG: number;
  estimatedTimeMin: number;
  volumeCm3: number;
}

export async function sliceModel(filePath: string, opts: SliceOptions): Promise<SliceResult> {
  const temps = MATERIAL_TEMPS[opts.materialKey] || MATERIAL_TEMPS.PLA;
  const speeds = QUALITY_SPEEDS[opts.qualityKey] || QUALITY_SPEEDS.Standard;
  const printerIni = await readFile(opts.printer.iniPath, "utf8");

  const dir = await mkdtemp(path.join(tmpdir(), "nasap3d-slice-"));
  try {
    const configLines = [
      printerIni.trim(),
      `layer_height = ${opts.layerHeightMm}`,
      `fill_density = ${opts.infillPct}%`,
      `filament_density = ${opts.densityGCm3}`,
      `filament_diameter = 1.75,1.75,1.75,1.75,1.75`,
      `temperature = ${temps.nozzle},${temps.nozzle},${temps.nozzle},${temps.nozzle},${temps.nozzle}`,
      `first_layer_temperature = ${temps.nozzle},${temps.nozzle},${temps.nozzle},${temps.nozzle},${temps.nozzle}`,
      `bed_temperature = ${temps.bed}`,
      `first_layer_bed_temperature = ${temps.bed}`,
      `perimeters = 2`,
      `top_solid_layers = 4`,
      `bottom_solid_layers = 4`,
      // Vitesses/accélération réelles Bambu Lab (H2C, voir MATERIAL_TEMPS/
      // QUALITY_SPEEDS ci-dessus pour la source) — remplacent les vitesses
      // par défaut de PrusaSlicer, bien trop lentes pour ces machines.
      `external_perimeter_speed = ${speeds.outerWall}`,
      `perimeter_speed = ${speeds.innerWall}`,
      `infill_speed = ${speeds.infill}`,
      `solid_infill_speed = ${speeds.solidInfill}`,
      `top_solid_infill_speed = ${speeds.topSurface}`,
      `travel_speed = ${speeds.travel}`,
      `first_layer_speed = ${speeds.firstLayer}`,
      `default_acceleration = ${speeds.accel}`,
      `perimeter_acceleration = ${speeds.accel}`,
      `infill_acceleration = ${speeds.accel}`,
    ].join("\n");
    const configPath = path.join(dir, "config.ini");
    await writeFile(configPath, configLines);

    const outPath = path.join(dir, "out.gcode");
    await execFileAsync(
      bin(),
      ["--load", configPath, "--ensure-on-bed", "--export-gcode", "-o", outPath, filePath],
      { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
    );

    const gcode = await readFile(outPath, "utf8");
    const timeMin = parseGcodeTime(gcode);
    const weightG = parseGcodeWeight(gcode);
    const volumeCm3 = parseGcodeVolume(gcode);
    if (timeMin == null || weightG == null) {
      throw new Error("could not parse slicer output");
    }
    return { weightG, estimatedTimeMin: timeMin, volumeCm3: volumeCm3 ?? 0 };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
