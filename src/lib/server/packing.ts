// Rangement automatique d'une commande en plusieurs colis (pur, sans Prisma).
// Remplace l'ancien choix « un seul carton / hors gabarit » de boxtal.ts.

export type BoxCode = "S" | "M" | "L" | "XL" | "XXL";

export interface BoxDef {
  code: BoxCode;
  label: string;
  innerMm: [number, number, number];
  outerCm: [number, number, number];
  emptyWeightG: number; // carton vide, fiche karton.eu « Poids de l'article » (relevé le 27/10/2026)
  maxWeightG: number;
  relayOk: boolean; // Point Relais Mondial Relay
  lockerOk: boolean; // consigne automatique (max 62×38×36 cm, 20 kg ; voir parcelsLockerOk)
  karton: { article: string; url: string; flute: "simple" | "double" };
}

// Du plus petit au plus grand.
export const BOXES: BoxDef[] = [
  {
    code: "S",
    label: "S 14×14×10 cm",
    innerMm: [140, 140, 100],
    outerCm: [15, 15, 11],
    emptyWeightG: 50,
    maxWeightG: 6000,
    relayOk: true,
    lockerOk: true,
    karton: { article: "002", url: "https://fr.karton.eu/140x140x100-mm-Cartons-a-simple-cannelure", flute: "simple" },
  },
  {
    code: "M",
    label: "M 20×20×20 cm",
    innerMm: [200, 200, 200],
    outerCm: [21, 21, 21],
    emptyWeightG: 130,
    maxWeightG: 6000,
    relayOk: true,
    lockerOk: true,
    karton: { article: "011", url: "https://fr.karton.eu/200x200x200-mm-Cartons-a-simple-cannelure", flute: "simple" },
  },
  {
    code: "L",
    label: "L 40×35×30 cm",
    innerMm: [400, 350, 300],
    outerCm: [41, 36, 31],
    emptyWeightG: 380,
    maxWeightG: 6000,
    relayOk: true,
    lockerOk: true,
    karton: { article: "037", url: "https://fr.karton.eu/400x350x300-mm-Cartons-a-simple-cannelure", flute: "simple" },
  },
  {
    code: "XL",
    label: "XL 60×40×30 cm",
    innerMm: [600, 400, 300],
    outerCm: [62, 42, 33],
    emptyWeightG: 950,
    // Carton prévu pour 30 kg, mais plafonné à 25 kg par colis par le site (locker : 20 kg, voir parcelsLockerOk).
    maxWeightG: 25000,
    relayOk: true, // 62×42×33 passe en Point Relais
    lockerOk: false,
    karton: { article: "200", url: "https://fr.karton.eu/600x400x300-mm-Cartons-a-double-cannelure", flute: "double" },
  },
  {
    code: "XXL",
    label: "XXL 80×40×40 cm",
    innerMm: [786, 386, 378],
    outerCm: [80, 40, 40],
    emptyWeightG: 1140,
    // Carton prévu pour 30 kg, mais plafonné à 25 kg par colis par le site (locker : 20 kg, voir parcelsLockerOk).
    maxWeightG: 25000,
    relayOk: false, // L+l+h = 160 > 150 : Colissimo seul
    lockerOk: false,
    karton: {
      article: "1040",
      url: "https://fr.karton.eu/800x400x400-mm-Cartons-a-double-cannelure-Dimensions-exterieures",
      flute: "double",
    },
  },
];

export interface PackPiece {
  label: string;
  bboxMm: [number, number, number];
  weightG: number;
}

export interface Parcel {
  box: BoxCode;
  outerCm: [number, number, number];
  weightG: number;
  pieces: string[];
}

export type PackResult = { ok: true; parcels: Parcel[] } | { ok: false; reason: "piece_too_big"; piece: string };

// ~1cm de jeu de chaque côté de la pièce, sur chaque dimension.
const PARCEL_MARGIN_MM = 10;

// Les pièces ne remplissent jamais un carton à 100 % : l'ensemble doit tenir
// dans 95 % du volume intérieur.
const PACKING_EFFICIENCY = 0.95;

// Poids compté (limite 25 kg, devis Boxtal ET étiquette : un seul et même poids)
// = (pièces + carton vide) × 1,1 (10 % de calage), arrondi au gramme supérieur,
// avec un plancher de 300 g (minimum Colissimo / Mondial Relay), sans arrondi au 0,5 kg (décision Nolann 27/10 : une petite commande ne doit pas payer 500 g de plus).
const PACKAGING_WEIGHT_PERCENT = 110; // ×1,1 en entiers (évite 24145,000000000004 → 24146)
const MIN_PARCEL_WEIGHT_G = 300;

export function getBox(code: BoxCode): BoxDef {
  const box = BOXES.find((b) => b.code === code);
  if (!box) throw new Error(`unknown box code: ${code}`);
  return box;
}

function paddedSortedMm(piece: PackPiece): number[] {
  return piece.bboxMm.map((mm) => mm + 2 * PARCEL_MARGIN_MM).sort((a, b) => a - b);
}

export function countedWeightG(pieces: PackPiece[], box: BoxDef): number {
  const raw = pieces.reduce((sum, p) => sum + p.weightG, 0);
  return Math.max(MIN_PARCEL_WEIGHT_G, Math.ceil(((raw + box.emptyWeightG) * PACKAGING_WEIGHT_PERCENT) / 100));
}

function pieceFitsBox(piece: PackPiece, box: BoxDef): boolean {
  const part = paddedSortedMm(piece);
  const inner = [...box.innerMm].sort((a, b) => a - b);
  return part[0] <= inner[0] && part[1] <= inner[1] && part[2] <= inner[2];
}

const PERMUTATIONS: [number, number, number][] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

// Garde géométrique, volontairement prudente : les « grosses » pièces (volume avec marge
// > 1/8 du volume intérieur) doivent tenir en une seule rangée le long d'un axe du carton.
// Le volume seul laisserait passer 2 pièces qui ne tiennent pas physiquement côte à côte.
function bigPiecesFitInRow(pieces: PackPiece[], box: BoxDef): boolean {
  const innerVolume = box.innerMm[0] * box.innerMm[1] * box.innerMm[2];
  const big = pieces.filter((p) => paddedSortedMm(p).reduce((a, b) => a * b, 1) > innerVolume / 8);
  if (big.length <= 1) return true;
  for (let axis = 0; axis < 3; axis++) {
    const t1 = box.innerMm[(axis + 1) % 3];
    const t2 = box.innerMm[(axis + 2) % 3];
    let total = 0;
    let ok = true;
    for (const p of big) {
      const dims = p.bboxMm.map((mm) => mm + 2 * PARCEL_MARGIN_MM);
      let best = Infinity;
      for (const [a, b, c] of PERMUTATIONS) {
        if (dims[b] <= t1 && dims[c] <= t2) best = Math.min(best, dims[a]);
      }
      if (best === Infinity) {
        ok = false;
        break;
      }
      total += best;
    }
    if (ok && total <= box.innerMm[axis]) return true;
  }
  return false;
}

function setFitsBox(pieces: PackPiece[], box: BoxDef): boolean {
  if (!pieces.every((p) => pieceFitsBox(p, box))) return false;
  const innerVolume = box.innerMm[0] * box.innerMm[1] * box.innerMm[2];
  const volume = pieces.reduce((sum, p) => sum + paddedSortedMm(p).reduce((a, b) => a * b, 1), 0);
  if (volume > innerVolume * PACKING_EFFICIENCY) return false;
  if (!bigPiecesFitInRow(pieces, box)) return false;
  return countedWeightG(pieces, box) <= box.maxWeightG;
}

function smallestBoxFor(pieces: PackPiece[]): BoxDef | null {
  return BOXES.find((box) => setFitsBox(pieces, box)) ?? null;
}

export function packPieces(pieces: PackPiece[]): PackResult {
  const volumeOf = (p: PackPiece) => paddedSortedMm(p).reduce((a, b) => a * b, 1);
  const sorted = [...pieces].sort((a, b) => volumeOf(b) - volumeOf(a));

  const groups: PackPiece[][] = [];
  for (const piece of sorted) {
    if (!smallestBoxFor([piece])) return { ok: false, reason: "piece_too_big", piece: piece.label };
    const open = groups.find((g) => smallestBoxFor([...g, piece]) != null);
    if (open) open.push(piece);
    else groups.push([piece]);
  }

  const parcels: Parcel[] = groups.map((g) => {
    const box = smallestBoxFor(g)!;
    return { box: box.code, outerCm: box.outerCm, weightG: countedWeightG(g, box), pieces: g.map((p) => p.label) };
  });
  return { ok: true, parcels };
}

export function parcelsRelayOk(parcels: Parcel[]): boolean {
  return parcels.every((p) => getBox(p.box).relayOk);
}

// Limites locker (étiquette Mondial Relay / InPost, 05/11/2026) : 20 kg et
// 62×38×36 cm, comparés après tri des 3 côtés (plus grand ≤ 62, médian ≤ 38,
// plus petit ≤ 36). Le L (41×36×31) rentre.
export const LOCKER_MAX_WEIGHT_G = 20000;
export const LOCKER_MAX_SORTED_CM: [number, number, number] = [62, 38, 36];

export function parcelsLockerOk(parcels: Parcel[]): boolean {
  return parcels.every((p) => {
    if (!getBox(p.box).lockerOk || p.weightG > LOCKER_MAX_WEIGHT_G) return false;
    const sorted = [...p.outerCm].sort((a, b) => b - a);
    return sorted.every((v, i) => v <= LOCKER_MAX_SORTED_CM[i]);
  });
}
