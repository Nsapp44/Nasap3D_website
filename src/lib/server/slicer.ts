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

// Max flow rate PrusaSlicer is allowed to push through the nozzle
// (mm³/s) — read directly from Bambu Lab's own official H2C filament
// profiles (bambulab/BambuStudio, resources/profiles/BBL/filament/*@BBL
// H2C.json, `filament_max_volumetric_speed`, lowest of the profile's
// listed values). This is what actually throttles a slow-flowing material
// like TPU or PA-CF back down on infill/solid passes, even though
// QUALITY_SPEEDS below requests the same linear mm/s for every material —
// PrusaSlicer caps the real speed per-line once linear-speed × line-width ×
// layer-height would exceed this volumetric limit.
// TPU note: Bambu's own H2C profile reports 3.6 mm³/s; set to 3.2 mm³/s
// per the value given for this specific setup — adjust here if your real
// TPU spool behaves differently.
const MATERIAL_MAX_VOLUMETRIC_SPEED: Record<string, number> = {
  PLA: 25,
  PETG: 21,
  ABS: 20,
  ASA: 20,
  TPU: 3.2,
  Nylon: 8, // Bambu PA-CF @BBL H2C
  PP: 15, // no official Bambu profile — placeholder, similar range to ABS/PETG
};

// Wall/infill/travel speeds and acceleration per quality tier, read from
// Bambu Lab's own H2C process profiles (0.20mm Standard, 0.12mm High
// Quality — closest match for "Rapide" is their 0.24mm Standard tier, since
// 0.4mm nozzles don't have an official 0.28mm preset). The instant quote
// only ever slices against the H2C (see PRINTERS below).
const QUALITY_SPEEDS: Record<
  string,
  {
    outerWall: number;
    innerWall: number;
    infill: number;
    solidInfill: number;
    topSurface: number;
    travel: number;
    firstLayer: number;
    accel: number;
  }
> = {
  Rapide: {
    outerWall: 200,
    innerWall: 300,
    infill: 350,
    solidInfill: 250,
    topSurface: 200,
    travel: 1000,
    firstLayer: 50,
    accel: 8000,
  },
  Standard: {
    outerWall: 200,
    innerWall: 300,
    infill: 350,
    solidInfill: 250,
    topSurface: 200,
    travel: 1000,
    firstLayer: 50,
    accel: 8000,
  },
  Fine: {
    outerWall: 60,
    innerWall: 120,
    infill: 100,
    solidInfill: 100,
    topSurface: 60,
    travel: 500,
    firstLayer: 30,
    accel: 4000,
  },
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

// Simplified deliberately to just the H2C: it's the machine the instant
// quote actually runs against, so there's no real fleet-picking logic to
// maintain — a part either fits the H2C's bed/height or it doesn't.
export const PRINTERS: PrinterProfile[] = [
  {
    key: "h2c",
    label: "Bambu Lab H2C",
    bedXMm: 330,
    bedYMm: 320,
    heightMm: 325,
    iniPath: path.join(PROFILES_DIR, "h2c.ini"),
  },
];

// Rejects a part that doesn't fit the H2C's bed/height (with a couple mm of
// clearance) instead of picking among several machines.
export function pickPrinter(info: ModelInfo): PrinterProfile | null {
  const p = PRINTERS[0];
  const dims = [info.sizeXMm, info.sizeYMm, info.sizeZMm].sort((a, b) => a - b);
  const bed = [p.bedXMm, p.bedYMm].sort((a, b) => a - b);
  // conservative fit check: try the part's two smallest dims against the
  // bed's two dims (allows rotation on the plate), tallest dim vs height.
  if (dims[0] <= bed[0] - 4 && dims[1] <= bed[1] - 4 && dims[2] <= p.heightMm - 4) return p;
  return null;
}

function bin(): string {
  const b = process.env.PRUSASLICER_BIN;
  if (!b) throw new Error("PRUSASLICER_BIN is not configured (see server/.env.example)");
  return b;
}

// scale: raw multiplication factor (1.5 = 150%), never a client-trusted
// price input on its own — it only ever changes what PrusaSlicer itself
// measures/slices (confirmed for real: `--scale 1.5` on a known 10mm cube
// reports size_x/y/z = 15 via --info, and the same flag works identically
// on --export-gcode), so the resulting price always matches the real,
// corrected size. rotateXDeg/rotateYDeg: from suggestOrientation() (see
// lib/orientation.ts) — applied before scale doesn't matter here since
// rotation and uniform scale commute for AABB purposes.
export interface ModelTransform {
  scale?: number;
  rotateXDeg?: number;
  rotateYDeg?: number;
}

function transformArgs(opts: ModelTransform): string[] {
  const args: string[] = [];
  if (opts.rotateXDeg) args.push("--rotate-x", String(opts.rotateXDeg));
  if (opts.rotateYDeg) args.push("--rotate-y", String(opts.rotateYDeg));
  if (opts.scale && opts.scale !== 1) args.push("--scale", String(opts.scale));
  return args;
}

export async function getModelInfo(filePath: string, opts: ModelTransform = {}): Promise<ModelInfo> {
  const args = [...transformArgs(opts), "--info", filePath];
  const { stdout } = await execFileAsync(bin(), args, { timeout: 30_000 });
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

// Re-exports the model with scale/rotation actually baked into the mesh —
// used so the file we keep in storage (downloaded later for real
// production) matches what was actually priced/quoted, not the raw
// as-uploaded geometry. Always STL out regardless of input format (.obj/
// .step get normalized to a mesh too, which production printing needs
// anyway).
export async function exportTransformedStl(filePath: string, opts: ModelTransform): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "nasap3d-export-"));
  try {
    const outPath = path.join(dir, "out.stl");
    const args = [...transformArgs(opts), "--export-stl", "-o", outPath, filePath];
    await execFileAsync(bin(), args, { timeout: 60_000 });
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
  // Must match whatever was passed to getModelInfo() for the same job —
  // pickPrinter()'s fit check and this slice need to agree on the model's
  // real (post-scale/rotate) size, or the price and the fit check would be
  // computed against two different geometries.
  scale?: number;
  rotateXDeg?: number;
  rotateYDeg?: number;
}

export interface SliceResult {
  weightG: number;
  estimatedTimeMin: number;
  volumeCm3: number;
}

export async function sliceModel(filePath: string, opts: SliceOptions): Promise<SliceResult> {
  const temps = MATERIAL_TEMPS[opts.materialKey] || MATERIAL_TEMPS.PLA;
  const speeds = QUALITY_SPEEDS[opts.qualityKey] || QUALITY_SPEEDS.Standard;
  const maxVolumetricSpeed = MATERIAL_MAX_VOLUMETRIC_SPEED[opts.materialKey] || MATERIAL_MAX_VOLUMETRIC_SPEED.PLA;
  const printerIni = await readFile(opts.printer.iniPath, "utf8");

  const dir = await mkdtemp(path.join(tmpdir(), "nasap3d-slice-"));
  try {
    const configLines = [
      printerIni.trim(),
      `layer_height = ${opts.layerHeightMm}`,
      `fill_density = ${opts.infillPct}%`,
      `filament_density = ${opts.densityGCm3}`,
      "filament_diameter = 1.75,1.75,1.75,1.75,1.75",
      `temperature = ${temps.nozzle},${temps.nozzle},${temps.nozzle},${temps.nozzle},${temps.nozzle}`,
      `first_layer_temperature = ${temps.nozzle},${temps.nozzle},${temps.nozzle},${temps.nozzle},${temps.nozzle}`,
      `bed_temperature = ${temps.bed}`,
      `first_layer_bed_temperature = ${temps.bed}`,
      // 3 parois + 3 couches pleines dessus/dessous, jamais plus (demande
      // explicite) — était 2/4/4.
      "perimeters = 3",
      "top_solid_layers = 3",
      "bottom_solid_layers = 3",
      // Supports étaient absents du profil jusqu'ici — un vrai manque : une
      // pièce avec surplombs se serait vue estimer un temps/poids (donc un
      // prix) sans le matériau/temps de support réellement nécessaire à
      // l'impression. support_material_auto (génération automatique selon le
      // seuil de surplomb, pas seulement dans des zones "enforcer" peintes à
      // la main) + support_material_style=snug (littéralement "Ajusté" dans
      // l'UI FR de PrusaSlicer — grid/snug/organic sont les 3 styles
      // possibles ; "organic" = les arbres, explicitement écarté, demande
      // explicite).
      //
      // support_material_threshold=0 était utilisé comme sentinelle "auto"
      // (délégué à l'heuristique interne de PrusaSlicer) — en pratique plus
      // agressif que nécessaire : un 3DBenchy réel (modèle de torture connu,
      // justement conçu pour s'imprimer sans support) se voyait quand même
      // générer du vrai support en auto (+40 000 lignes de gcode vs sans
      // support), gonflant le prix ET le temps de calcul pour rien.
      // --help-fff est sans ambiguïté : la valeur représente "the most
      // horizontal slope you can print without support material" — donc PLUS
      // la valeur est basse, MOINS il y a de support (seul le très plat en a
      // besoin), pas l'inverse. Vérifié empiriquement sur le vrai 3DBenchy à
      // 0.25 CPU (conteneur throttlé pour simuler un serveur de prod modeste) :
      // auto ≈ 40° ≈ 60° tournent tous autour de 700-1000 mentions de
      // "support" dans le gcode et 70-90s ; 15° tombe à 181 mentions et 53s.
      // 30° (demande explicite, arbitrage voulu entre les deux) reste un vrai
      // seuil physique (pas 0/désactivé) : les surplombs plus verticaux que
      // ça s'impriment sans support sur une machine bien réglée.
      // support_material_buildplate_only=0 : le support peut aussi s'appuyer
      // sur la pièce, pas seulement sur le plateau.
      // support_material_contact_distance=0.2 et raft_first_layer_density=90%
      // sont déjà les défauts PrusaSlicer, fixés ici explicitement pour ne
      // plus en dépendre implicitement (demande explicite).
      "support_material = 1",
      "support_material_auto = 1",
      "support_material_style = snug",
      "support_material_threshold = 30",
      "support_material_buildplate_only = 0",
      "support_material_contact_distance = 0.2",
      "raft_first_layer_density = 90%",
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
      // Real per-material flow cap (see MATERIAL_MAX_VOLUMETRIC_SPEED) —
      // this is what makes slow-flowing filaments like TPU/PA-CF actually
      // print slower in the estimate, on top of (not instead of) the
      // per-quality linear speeds above.
      `filament_max_volumetric_speed = ${maxVolumetricSpeed}`,
      `default_acceleration = ${speeds.accel}`,
      `perimeter_acceleration = ${speeds.accel}`,
      `infill_acceleration = ${speeds.accel}`,
    ].join("\n");
    const configPath = path.join(dir, "config.ini");
    await writeFile(configPath, configLines);

    const outPath = path.join(dir, "out.gcode");
    const args = [
      "--load",
      configPath,
      "--ensure-on-bed",
      ...transformArgs(opts),
      "--export-gcode",
      "-o",
      outPath,
      filePath,
    ];
    await execFileAsync(bin(), args, { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 });

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
