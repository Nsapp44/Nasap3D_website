import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { parse3mfTriangles } from "../src/lib/server/threeMfParse";

function buildZip(name: string, data: Buffer, declaredSize: number): Buffer {
  const comp = deflateRawSync(data);
  const nameBuf = Buffer.from(name);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(8, 8);
  lh.writeUInt32LE(comp.length, 18);
  lh.writeUInt32LE(declaredSize, 22);
  lh.writeUInt16LE(nameBuf.length, 26);
  const local = Buffer.concat([lh, nameBuf, comp]);
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(8, 10);
  cd.writeUInt32LE(comp.length, 20);
  cd.writeUInt32LE(declaredSize, 24);
  cd.writeUInt16LE(nameBuf.length, 28);
  cd.writeUInt32LE(0, 42);
  const cdFull = Buffer.concat([cd, nameBuf]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdFull.length, 12);
  eocd.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, cdFull, eocd]);
}

describe("3MF zip bomb", () => {
  const big = Buffer.alloc(201 * 1024 * 1024, 0x20);

  it("refuse une taille declaree au-dessus du plafond", () => {
    const zip = buildZip("3D/3dmodel.model", big, big.length);
    expect(() => parse3mfTriangles(zip)).toThrow();
  });

  it("refuse une taille declaree mensongere (inflate plafonne)", () => {
    const zip = buildZip("3D/3dmodel.model", big, 10);
    expect(() => parse3mfTriangles(zip)).toThrow("3mf_inflate_failed");
  });
});
