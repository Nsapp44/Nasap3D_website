// Kiri:Moto device/process JSON builders + gcode trailer parsing — shared
// between the client (public/kiri-slicer.js, via useQuoteWizard.ts) and the
// server (src/lib/server/kiriSlicer.ts, the rare full-slice fallback role).
// Deliberately dependency-free (no Node imports) so it bundles cleanly for
// the browser as well as running under Node — same discipline as
// src/lib/server/pricing.ts.
//
// The process profile below is the REAL "Bambu PLA" process bundled with
// Kiri:Moto's own stock "Bambu.P1S" device preset — extracted directly from
// the live app (grid.space/kiri/, `kiri.api.conf.get().process` after
// selecting that device), not hand-assembled from PrusaSlicer-era values.
// An earlier version of this file guessed at speeds by porting the old
// PrusaSlicer QUALITY_SPEEDS (per-feature wall/infill/travel speeds derived
// from real Bambu H2C profiles) — that produced a real 3DBenchy estimate of
// 36 minutes, confirmed far too fast by direct comparison: PrusaSlicer with
// matching settings on the same file gives 87 minutes, Bambu Studio gives
// ~80 minutes, and Kiri:Moto's own stock profile (selected live on
// grid.space, same file) gives ~95 minutes — all in the same ballpark,
// unlike the 36-minute guess. Root cause: Kiri:Moto has no acceleration/
// jerk model in its time estimate at all (confirmed: no such field exists
// anywhere in its process JSON schema) — its own stock presets compensate
// for that by using deliberately conservative cruise speeds (this PLA
// preset's outputFeedrate is 110mm/s, well under what the real P1S
// hardware can do), not because the machine is slow but because a lower
// configured speed is what makes Kiri's naive distance÷speed estimate land
// close to reality. Porting PrusaSlicer's own (much higher, accel-aware)
// speeds into Kiri's accel-blind formula was the actual bug, not a missing
// feature — so this file now deliberately keeps the stock preset's values
// as-is rather than re-deriving them, changing only what has to vary per
// quote (bed size, layer height, infill%, material temps).
export interface KiriDeviceJson {
  mode: "FDM";
  bedWidth: number;
  bedDepth: number;
  bedHeight: number;
  maxHeight: number;
  extruders: [{ extNozzle: number; extFilament: number }];
}

export interface KiriProcessJson {
  processName: string;
  sliceHeight: number;
  sliceShells: number;
  sliceShellOrder: string;
  sliceLayerStart: string;
  sliceFillAngle: number;
  sliceFillOverlap: number;
  sliceFillSparse: number;
  sliceFillType: string;
  sliceAdaptive: boolean;
  sliceMinHeight: number;
  sliceSupportDensity: number;
  sliceSupportOffset: number;
  sliceSupportGap: number;
  sliceSupportSize: number;
  sliceSupportArea: number;
  sliceSupportExtra: number;
  sliceSupportAngle: number;
  sliceSupportNozzle: number;
  sliceSolidMinArea: number;
  sliceBottomLayers: number;
  sliceTopLayers: number;
  firstLayerRate: number;
  firstLayerPrintMult: number;
  firstLayerYOffset: number;
  firstLayerBrim: number;
  firstLayerBeltLead: number;
  firstLayerFanSpeed: number;
  outputTemp: number;
  outputBedTemp: number;
  outputFanSpeed: number;
  outputFeedrate: number;
  outputFinishrate: number;
  outputSeekrate: number;
  outputShellMult: number;
  outputFillMult: number;
  outputSparseMult: number;
  outputRetractDist: number;
  outputRetractSpeed: number;
  outputRetractWipe: number;
  outputRetractDwell: number;
  outputShortPoly: number;
  outputMinSpeed: number;
  outputCoastDist: number;
  outputLayerRetract: boolean;
  zHopDistance: number;
  antiBacklash: number;
  sliceFillWidth: number;
  sliceFillRate: number;
  sliceSupportEnable: boolean;
  firstSliceHeight: number;
  firstLayerFillRate: number;
  firstLayerLineMult: number;
  firstLayerNozzleTemp: number;
  firstLayerBedTemp: number;
  firstLayerBrimTrig: number;
  firstLayerBrimGap: number;
  outputRaft: boolean;
  outputRaftSpacing: number;
  outputBrimCount: number;
  outputBrimOffset: number;
  outputPurgeTower: number;
  outputInvertX: boolean;
  outputInvertY: boolean;
  arcTolerance: number;
  ranges: unknown[];
  sliceLineWidth: number;
  sliceFillRepeat: number;
  firstLayerBrimIn: number;
  firstLayerBeltBump: number;
  outputBeltFirst: boolean;
  outputLoops: number;
  sliceFillGrow: number;
  sliceSolidRate: number;
  sliceSupportSpan: number;
  sliceSupportOutline: boolean;
  firstLayerFlatten: number;
  outputDraftShield: boolean;
  outputAvoidGaps: boolean;
  sliceDetectThin: string;
  outputAlternating: boolean;
  sliceLayerStartX: number;
  sliceLayerStartY: number;
  sliceSupportGrow: number;
  outputFanLayer: number;
  outputNozzle: number;
  sliceAngle: number;
  sliceZInterleave: boolean;
}

// Same H2C bed/nozzle — only real change vs. the stock Bambu.P1S device
// (256×256×256) per the instruction to reuse that device/process wholesale
// and only swap the plate size and filament presets.
export function buildKiriDevice(): KiriDeviceJson {
  return {
    mode: "FDM",
    bedWidth: 330,
    bedDepth: 320,
    bedHeight: 0,
    maxHeight: 325,
    extruders: [{ extNozzle: 0.4, extFilament: 1.75 }],
  };
}

// Nozzle/bed temps — Bambu Lab's official H2C filament profiles (same
// source as the old PrusaSlicer-era MATERIAL_TEMPS). Lives here rather than
// in src/lib/server/kiriSlicer.ts so this module stays Node-import-free and
// bundles cleanly for the browser too (see file header).
const MATERIAL_TEMPS: Record<string, { nozzle: number; bed: number }> = {
  PLA: { nozzle: 220, bed: 55 },
  PETG: { nozzle: 245, bed: 70 },
  ABS: { nozzle: 270, bed: 90 },
  ASA: { nozzle: 270, bed: 100 },
  TPU: { nozzle: 230, bed: 50 },
  Nylon: { nozzle: 280, bed: 80 },
  PP: { nozzle: 240, bed: 100 },
};

// The client (useQuoteWizard.ts) doesn't fetch QualityProfile rows from the
// server — its Rapide/Standard/Fine layer-height hints are already
// hardcoded directly in QuoteWizard.tsx's UI copy, so this mirrors that
// same hardcoding for the one place that needs the actual number (the
// client's own Kiri:Moto call). Must stay in sync with prisma/seed.ts —
// the server-side call in quotes/index.ts doesn't use this at all, it reads
// the real DB value instead (see buildKiriProcess's own layerHeightMm
// parameter, sourced from Prisma there).
export const CLIENT_QUALITY_LAYER_HEIGHT: Record<string, number> = {
  Rapide: 0.28,
  Standard: 0.2,
  Fine: 0.12,
};

// The real Bambu.P1S "Bambu PLA" process, verbatim (see file header) —
// layer height varies per quality tier (the actual quality/speed lever;
// the stock preset doesn't define separate per-tier speeds, so none are
// invented here either), everything else is the stock preset's own values
// unchanged. sliceHeight/sliceFillSparse/outputTemp/outputBedTemp are
// overwritten per-call below; every other field is exactly what grid.space
// itself ships for this device.
const STOCK_BAMBU_PLA_PROCESS: KiriProcessJson = {
  processName: "Bambu PLA",
  sliceHeight: 0.2,
  sliceShells: 2,
  sliceShellOrder: "in-out",
  sliceLayerStart: "last",
  sliceFillAngle: 45,
  sliceFillOverlap: 0.35,
  sliceFillSparse: 0.1,
  sliceFillType: "hex",
  sliceAdaptive: false,
  sliceMinHeight: 0,
  sliceSupportDensity: 0.2,
  sliceSupportOffset: 0.4,
  sliceSupportGap: 1,
  sliceSupportSize: 5,
  sliceSupportArea: 0.25,
  sliceSupportExtra: 0,
  sliceSupportAngle: 60,
  sliceSupportNozzle: 0,
  sliceSolidMinArea: 0,
  sliceBottomLayers: 2,
  sliceTopLayers: 3,
  firstLayerRate: 20,
  firstLayerPrintMult: 1,
  firstLayerYOffset: 0,
  firstLayerBrim: 0,
  firstLayerBeltLead: 0,
  firstLayerFanSpeed: 0,
  outputTemp: 210,
  outputBedTemp: 60,
  outputFanSpeed: 255,
  outputFeedrate: 110,
  outputFinishrate: 90,
  outputSeekrate: 200,
  outputShellMult: 1.2,
  outputFillMult: 1.2,
  outputSparseMult: 1.2,
  outputRetractDist: 1,
  outputRetractSpeed: 80,
  outputRetractWipe: 0,
  outputRetractDwell: 0,
  outputShortPoly: 50,
  outputMinSpeed: 5,
  outputCoastDist: 0,
  outputLayerRetract: false,
  zHopDistance: 0,
  antiBacklash: 0,
  sliceFillWidth: 1,
  sliceFillRate: 0,
  sliceSupportEnable: false,
  firstSliceHeight: 0.3,
  firstLayerFillRate: 80,
  firstLayerLineMult: 1,
  firstLayerNozzleTemp: 220,
  firstLayerBedTemp: 65,
  firstLayerBrimTrig: 0,
  firstLayerBrimGap: 0,
  outputRaft: false,
  outputRaftSpacing: 0.2,
  outputBrimCount: 0,
  outputBrimOffset: 2,
  outputPurgeTower: 0,
  outputInvertX: false,
  outputInvertY: false,
  arcTolerance: 0,
  ranges: [],
  sliceLineWidth: 0,
  sliceFillRepeat: 2,
  firstLayerBrimIn: 0,
  firstLayerBeltBump: 0,
  outputBeltFirst: false,
  outputLoops: 0,
  sliceFillGrow: 0,
  sliceSolidRate: 0,
  sliceSupportSpan: 5,
  sliceSupportOutline: false,
  firstLayerFlatten: 0,
  outputDraftShield: false,
  outputAvoidGaps: true,
  sliceDetectThin: "off",
  outputAlternating: false,
  sliceLayerStartX: 0,
  sliceLayerStartY: 0,
  sliceSupportGrow: 0,
  outputFanLayer: 1,
  outputNozzle: 0,
  sliceAngle: 45,
  sliceZInterleave: false,
};

// Max flow rate the nozzle can push through (mm³/s) — Bambu Lab's own
// official H2C filament profiles (filament_max_volumetric_speed). Without
// this, every material shares the stock profile's one cruise speed
// (110mm/s), so a slow-flowing filament like TPU would get quoted as if it
// printed exactly as fast as PLA — physically impossible, and a real
// under-estimate of print time (so of machine-cost, so of price) for
// exactly the materials that most need a longer, more careful print.
// Applied only to speeds that actually extrude (wall/finish/first-layer) —
// travel moves don't push filament, so outputSeekrate is left alone. Line
// width isn't a field Kiri's process JSON exposes, so a common slicer
// default (nozzle × 1.2) stands in for the real one PrusaSlicer would have
// used to derive the same cap.
const MATERIAL_MAX_VOLUMETRIC_SPEED: Record<string, number> = {
  PLA: 25,
  PETG: 21,
  ABS: 20,
  ASA: 20,
  TPU: 3.2,
  Nylon: 8, // Bambu PA-CF @BBL H2C
  PP: 15, // no official Bambu profile — placeholder, similar range to ABS/PETG
};

const NOZZLE_DIAMETER_MM = 0.4;
const LINE_WIDTH_MM = NOZZLE_DIAMETER_MM * 1.2;

function capToVolumetricSpeed(speedMmS: number, layerHeightMm: number, maxVolumetricSpeedMm3S: number): number {
  const crossSectionMm2 = LINE_WIDTH_MM * layerHeightMm;
  return Math.min(speedMmS, maxVolumetricSpeedMm3S / crossSectionMm2);
}

// Tried and reverted: a flat empirical time-correction factor (1.6x,
// scaling down every speed fed to Kiri to compensate for its missing
// acceleration/jerk model). It looked justified from two small/detailed
// test files (3DBenchy: 52.15min raw vs ~80min Bambu Studio, ratio 1.53; a
// real visor part: 17.95min vs 31min, ratio 1.73) — but a third, much
// larger real file (113k triangles) exposed why a flat multiplier is the
// wrong model: 894min raw×1.6 vs Bambu Studio's real 550min — dividing back
// out the 1.6x lands almost exactly on 550min, meaning the *raw*, unscaled
// estimate was already close for this file. Acceleration/deceleration
// overhead is roughly a fixed cost per direction change, so its relative
// share of total time shrinks as a part gets bigger (long sustained-speed
// passes dominate) and only dominates on small, highly-detailed parts. A
// flat factor calibrated on small parts massively overprices large ones —
// a bigger absolute-€ risk than underpricing small parts, which the
// pricing floor (`minUnitPriceCents`, see pricing.ts) already absorbs
// regardless of how far off the raw time estimate is. So: no flat
// correction. TIME_CALIBRATION_FACTOR left at 1 (a no-op) rather than
// removed outright, so this reasoning stays attached to the code that
// would need it if someone tries this again.
const TIME_CALIBRATION_FACTOR = 1;

export function buildKiriProcess(
  qualityKey: string,
  layerHeightMm: number,
  infillPct: number,
  materialKey: string,
): KiriProcessJson {
  const temps = MATERIAL_TEMPS[materialKey] || MATERIAL_TEMPS.PLA;
  const maxVolumetricSpeed = MATERIAL_MAX_VOLUMETRIC_SPEED[materialKey] || MATERIAL_MAX_VOLUMETRIC_SPEED.PLA;
  const cap = (s: number) => capToVolumetricSpeed(s / TIME_CALIBRATION_FACTOR, layerHeightMm, maxVolumetricSpeed);
  return {
    ...STOCK_BAMBU_PLA_PROCESS,
    sliceHeight: layerHeightMm,
    sliceFillSparse: Math.max(0, Math.min(1, infillPct / 100)),
    outputTemp: temps.nozzle,
    outputBedTemp: temps.bed,
    // Support back on (stock preset ships it off) — a part with real
    // overhangs needs its support material/time actually counted, or the
    // quote underprices it. `sliceSupportEnable` itself is dead in the real
    // engine (confirmed by reading the current grid-apps source: it's only
    // referenced by the GUI's checkbox binding in app/init-menu.js, never
    // read by the actual slicing code in work/slice.js) — kept here anyway
    // since the older server-fallback engine still checks it, and it's
    // harmless either way. What actually gates + shapes automatic support
    // in the real engine is `sliceSupportType`/`sliceSupportAngle`/
    // `sliceSupportDensity` (work/slice.js's processSupports/
    // processSupportFills, a real shadow-casting + polygon-fill system —
    // not the older server fork's simple raycast-pillar approach).
    // Angle 50° — tried dropping to 40° (Bambu's own real process default
    // for this field) expecting more support area, but confirmed live it's
    // a dead end for this shape: bit-identical output at 40 vs 50 (verified
    // directly in the served client bundle, not a caching artifact), so the
    // overhang area this shadow-casting system identifies doesn't change in
    // that range for a smoothly curved surface. 50-60° is the right range
    // regardless (confirmed against real grid.space/Kiri:Moto usage).
    sliceSupportEnable: true,
    sliceSupportAngle: 50,
    // 0.4 density (spacing = lineWidth/density = 1mm between fill lines at
    // 0.4mm nozzle) — denser than the engine doc's own "typical" 0.10-0.25
    // range, on purpose: confirmed live against a real Bambu Studio run on
    // a real overhanging part (motorcycle visor, same wall count/infill%/
    // support-angle as this config) that our weight still undershoots
    // (3.78g vs Bambu's real 4.84g, -22%) even with support nominally on —
    // this is an open, only partially-closed gap, still being tuned.
    // sliceSupportSize is the older server-fallback engine's own pillar-
    // spacing knob (grid-apps' FDM.supports: dedup radius = size/4) — the
    // real client engine doesn't use it (no pillar system), kept only for
    // that older engine's benefit.
    sliceSupportDensity: 0.4,
    sliceSupportSize: 3,
    // 3 walls all around — sides, top, and bottom — same explicit project
    // requirement carried over from the PrusaSlicer era; the stock preset
    // ships 2 side walls / 2 bottom layers, thinner than this project wants.
    sliceShells: 3,
    sliceBottomLayers: 3,
    sliceTopLayers: 3,
    // "triangle" is a real Kiri:Moto pattern (confirmed in grid-apps'
    // kiri-mode/fdm/fill.js: FILL = {hex, grid, gyroid, triangle, linear,
    // cubic}) — explicit choice, not the stock preset's "hex".
    sliceFillType: "triangle",
    // outputFeedrate/outputFinishrate — NOT the stock preset's 110/90.
    // Confirmed by reading the real, current grid-apps source directly
    // (kiri/mode/fdm/work/prepare.js, the code that actually ships to
    // browsers via grid.space's CDN — different from the older vendored
    // server-fallback fork): `sliceFillRate` is dead in this version. It's
    // only ever written into legacy device preset JSON, never read by any
    // code path — `infillSpeed = opt.infillSpeed || fillSpeed || printSpeed`
    // and nothing ever sets `opt.infillSpeed`, and `fillSpeed` itself falls
    // back to `process.outputFeedrate` (the WALL speed) same as
    // `printSpeed`. So walls and sparse infill are hard-tied to the exact
    // same speed in the real engine — there is no working way to give
    // infill its own faster speed through the process JSON at all (an
    // earlier attempt to do exactly that via `sliceFillRate` only ever
    // worked on the older server-fallback engine, which still has that
    // field in its own fallback chain — confirmed live: it explains why the
    // server and the real client engine diverged so much on time for the
    // same file/settings, 596min vs 860min on one real test file, despite
    // agreeing closely on weight).
    //
    // Given that constraint, raising this ONE shared speed is the only real
    // lever — chosen well above the stock 110/90 (tuned conservatively for
    // walls' accel/jerk losses, which Kiri's naive distance÷speed model has
    // no way to account for) and toward the real Bambu P1S wall/infill
    // speeds (200-300mm/s depending on feature, extracted from Bambu's own
    // real process profile), while staying under the material's volumetric-
    // flow ceiling so it's still physically achievable. `sliceFillRate` is
    // deliberately left at the stock preset's own value (unset) rather than
    // overridden, so the older server-fallback engine behaves the same way
    // as the real client engine instead of silently disagreeing with it.
    outputFeedrate: cap(168),
    outputFinishrate: cap(153),
    firstLayerRate: cap(STOCK_BAMBU_PLA_PROCESS.firstLayerRate),
  };
}

export interface KiriGcodeStats {
  filamentMm: number;
  estimatedTimeMin: number;
}

// Mirrors src/lib/server/slicer.ts's parseGcodeTime, but for Kiri:Moto's
// much simpler trailer format — confirmed by inspecting a real generated
// gcode file this session: "; --- filament used: 4062.18 mm ---" and
// "; --- print time: 4798s ---" as the last two lines before EOF.
export function parseKiriGcodeStats(gcode: string): KiriGcodeStats | null {
  const filamentMatch = gcode.match(/--- filament used: ([\d.]+) mm ---/);
  const timeMatch = gcode.match(/--- print time: (\d+)s ---/);
  if (!filamentMatch || !timeMatch) return null;
  return {
    filamentMm: parseFloat(filamentMatch[1]),
    estimatedTimeMin: parseInt(timeMatch[1], 10) / 60,
  };
}

// Filament is 1.75mm diameter round stock — same conversion PrusaSlicer's
// own filament_diameter=1.75 config does internally (see slicer.ts).
const FILAMENT_RADIUS_MM = 1.75 / 2;
const FILAMENT_CROSS_SECTION_MM2 = Math.PI * FILAMENT_RADIUS_MM * FILAMENT_RADIUS_MM;

export function filamentLengthToWeightG(filamentMm: number, densityGCm3: number): number {
  const volumeMm3 = filamentMm * FILAMENT_CROSS_SECTION_MM2;
  return (volumeMm3 / 1000) * densityGCm3;
}
