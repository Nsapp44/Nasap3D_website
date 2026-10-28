import { describe, it, expect } from "vitest";
import { packPieces, parcelsRelayOk, parcelsLockerOk, getBox, BOXES, type PackPiece } from "../src/lib/server/packing";

const piece = (label: string, bboxMm: [number, number, number], weightG = 100): PackPiece => ({ label, bboxMm, weightG });

describe("packPieces", () => {
  it("petite pièce -> 1 colis S", () => {
    const r = packPieces([piece("a", [50, 50, 30])]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parcels).toHaveLength(1);
      expect(r.parcels[0].box).toBe("S");
      expect(r.parcels[0].weightG).toBe(300); // (100 + 50) × 1,1 = 165 → plancher 300 g
    }
  });

  it("550x350x250 -> XL", () => {
    const r = packPieces([piece("a", [550, 350, 250])]);
    expect(r.ok && r.parcels.map((p) => p.box)).toEqual(["XL"]);
  });

  it("750x350x350 -> XXL", () => {
    const r = packPieces([piece("a", [750, 350, 350])]);
    expect(r.ok && r.parcels.map((p) => p.box)).toEqual(["XXL"]);
  });

  it("450x450x200 -> trop grande", () => {
    const r = packPieces([piece("grosse", [450, 450, 200])]);
    expect(r).toEqual({ ok: false, reason: "piece_too_big", piece: "grosse" });
  });

  it("300x300x200 de 7 kg (8,4 kg compté) -> XL à cause du poids", () => {
    const r = packPieces([piece("lourde", [300, 300, 200], 7000)]);
    expect(r.ok && r.parcels.map((p) => p.box)).toEqual(["XL"]);
  });

  it("pièce trop lourde pour tous les cartons -> trop grande", () => {
    const r = packPieces([piece("enclume", [100, 100, 100], 23000)]);
    expect(r.ok).toBe(false);
  });

  it("40 pièces 150x150x150 de 500 g -> plusieurs colis valides et au plus petit carton", () => {
    const pieces = Array.from({ length: 40 }, (_, i) => piece(`p${i}`, [150, 150, 150], 500));
    const r = packPieces(pieces);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parcels.length).toBeGreaterThan(1);
    expect(r.parcels.flatMap((p) => p.pieces).sort()).toEqual(pieces.map((p) => p.label).sort());
    for (const parcel of r.parcels) {
      const box = getBox(parcel.box);
      expect(parcel.weightG).toBeLessThanOrEqual(box.maxWeightG);
      // aucun carton plus petit ne contenait déjà cet ensemble
      const inParcel = pieces.filter((p) => parcel.pieces.includes(p.label));
      const smaller = BOXES.slice(0, BOXES.findIndex((b) => b.code === parcel.box));
      const innerVol = (b: (typeof BOXES)[number]) => b.innerMm[0] * b.innerMm[1] * b.innerMm[2];
      const vol = inParcel.length * 170 * 170 * 170;
      for (const s of smaller) {
        const fits =
          [170, 170, 170].every((d, i) => d <= [...s.innerMm].sort((a, b) => a - b)[i]) &&
          vol <= innerVol(s) * 0.95 &&
          inParcel.length * 500 * 1.2 <= s.maxWeightG;
        expect(fits).toBe(false);
      }
    }
  });
});

describe("garde géométrique des grosses pièces", () => {
  it("2 x 375x320x270 (4 kg) -> 2 colis L, relais et consigne OK", () => {
    const r = packPieces([piece("a", [375, 320, 270], 4000), piece("b", [375, 320, 270], 4000)]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parcels.map((p) => p.box)).toEqual(["L", "L"]);
    expect(parcelsRelayOk(r.parcels)).toBe(true);
    expect(parcelsLockerOk(r.parcels)).toBe(true);
  });

  it("2 x 750x350x350 (3,5 kg) -> 2 colis XXL", () => {
    const r = packPieces([piece("a", [750, 350, 350], 3500), piece("b", [750, 350, 350], 3500)]);
    expect(r.ok && r.parcels.map((p) => p.box)).toEqual(["XXL", "XXL"]);
  });

  it("20 petits clips 40x30x20 -> 1 seul colis", () => {
    const pieces = Array.from({ length: 20 }, (_, i) => piece(`c${i}`, [40, 30, 20], 15));
    const r = packPieces(pieces);
    expect(r.ok && r.parcels).toHaveLength(1);
  });

  it("1 grosse pièce 380x330x280 + 3 petites -> 1 seul colis", () => {
    const r = packPieces([
      piece("grosse", [380, 330, 280], 3000),
      piece("s1", [40, 30, 20], 15),
      piece("s2", [40, 30, 20], 15),
      piece("s3", [40, 30, 20], 15),
    ]);
    expect(r.ok && r.parcels).toHaveLength(1);
  });
});

const mk = (box: "S" | "M" | "L" | "XL" | "XXL") => ({ box, outerCm: getBox(box).outerCm, weightG: 100, pieces: [] });

describe("parcelsRelayOk", () => {
  it("vrai pour S/M/L et XL, faux avec un XXL", () => {
    expect(parcelsRelayOk([mk("S"), mk("M"), mk("L"), mk("XL")])).toBe(true);
    expect(parcelsRelayOk([mk("S"), mk("XXL")])).toBe(false);
    expect(getBox("XL").relayOk).toBe(true);
    expect(getBox("XXL").relayOk).toBe(false);
  });
});

describe("parcelsLockerOk", () => {
  it("vrai pour S/M/L, faux dès un XL ou un XXL", () => {
    expect(parcelsLockerOk([mk("S"), mk("M"), mk("L")])).toBe(true);
    expect(parcelsLockerOk([mk("S"), mk("XL")])).toBe(false);
    expect(parcelsLockerOk([mk("XXL")])).toBe(false);
    expect(getBox("XL").lockerOk).toBe(false);
  });
});

describe("plafond 25 kg par colis", () => {
  it("tous les cartons sont plafonnés à 25 kg", () => {
    for (const b of BOXES) expect(b.maxWeightG).toBeLessThanOrEqual(25000);
  });

  it("beaucoup de pièces lourdes -> chaque colis <= 25000 g", () => {
    const pieces = Array.from({ length: 30 }, (_, i) => piece(`h${i}`, [200, 200, 150], 5000));
    const r = packPieces(pieces);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parcels.length).toBeGreaterThan(1);
    for (const parcel of r.parcels) expect(parcel.weightG).toBeLessThanOrEqual(25000);
  });
});

describe("poids déclaré du colis", () => {
  it("= (pièces + carton vide) × 1,1, plancher 300 g, arrondi au gramme supérieur, sans arrondi au 0,5 kg", () => {
    const r = packPieces([piece("a", [50, 50, 30], 0.2)]);
    expect(r.ok && r.parcels[0].weightG).toBe(300); // petite commande : plancher 300 g
    const mid = packPieces([piece("m", [100, 100, 100], 1001)]);
    expect(mid.ok && mid.parcels[0].box).toBe("M");
    expect(mid.ok && mid.parcels[0].weightG).toBe(Math.ceil((1001 + 130) * 1.1)); // 1244, pas 1500
    const big = packPieces([piece("b", [300, 300, 250], 4000)]);
    expect(big.ok && big.parcels[0].weightG).toBe(Math.ceil((4000 + getBox(big.ok ? big.parcels[0].box : "S").emptyWeightG) * 1.1));
  });
  it("la limite de 25 kg s'applique au poids avec carton et calage", () => {
    // 22,5 kg de pièces → (22500 + 950) × 1,1 = 25,8 kg > 25 kg : trop lourd pour un colis
    expect(packPieces([piece("lourd", [500, 300, 200], 22500)]).ok).toBe(false);
    const ok = packPieces([piece("limite", [500, 300, 200], 21000)]); // (21000 + 950) × 1,1 = 24 145 g
    expect(ok.ok && ok.parcels[0].weightG).toBe(24145);
  });
  it("l'étiquette (parcelParams) envoie exactement le poids du devis", async () => {
    const { parcelParams } = await import("../src/lib/server/boxtal");
    const r = packPieces([piece("a", [50, 50, 30], 100)]);
    if (!r.ok) throw new Error("pack");
    expect(parcelParams(r.parcels)["colis_1.poids"]).toBe((r.parcels[0].weightG / 1000).toFixed(3));
  });
});
