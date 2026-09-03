// Server-side counterpart to public/manifoldCheck.js — same library
// (manifold-3d@3.5.1, Apache-2.0), same vendored files
// (public/vendor/manifold/), same vertex-quantization/indexing logic, so
// client and server always agree on the same input. Used for: the rare
// server-side full-slice fallback (kiriSlicer.ts), and as an independent
// cross-check the client can't be trusted to self-report honestly for (a
// malicious client could always claim "manifold: true").
//
// Replaces the hand-rolled edge-pairing heuristic (checkManifoldAndParts in
// orientation.ts) with the same real geometry kernel Kiri:Moto itself uses
// internally — see public/manifoldCheck.js for the full reasoning
// (including why this is a *separate* vendored copy from
// public/vendor/kiri/manifold.wasm: confirmed live, that copy is a
// different build/version and fails with a real WebAssembly LinkError when
// paired with this package's own JS wrapper).
import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dynamicImport } from "../dynamic-import";
import type { Triangle } from "./orientation";

const CANDIDATE_MANIFOLD_DIRS = [
  path.resolve(process.cwd(), "public/vendor/manifold"),
  path.resolve(process.cwd(), "dist/client/vendor/manifold"),
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let manifoldPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadManifold(): Promise<any> {
  if (!manifoldPromise) {
    manifoldPromise = (async () => {
      let dir: string | null = null;
      for (const candidate of CANDIDATE_MANIFOLD_DIRS) {
        if (
          await access(path.join(candidate, "manifold.js"))
            .then(() => true)
            .catch(() => false)
        ) {
          dir = candidate;
          break;
        }
      }
      if (!dir) throw new Error("manifold.js not found (checked public/ and dist/client/)");
      const mod = await dynamicImport(pathToFileURL(path.join(dir, "manifold.js")).href);
      const factory = mod.default ?? mod;
      const wasm = await factory({ locateFile: (p: string) => path.join(dir as string, p) });
      wasm.setup();
      return wasm;
    })();
  }
  return manifoldPromise;
}

const DEGENERATE_AREA_MM2 = 1e-6;
function triangleArea(v: Triangle["v"]): number {
  const [a, b, c] = v;
  const ux = b[0] - a[0],
    uy = b[1] - a[1],
    uz = b[2] - a[2];
  const vx = c[0] - a[0],
    vy = c[1] - a[1],
    vz = c[2] - a[2];
  const cx = uy * vz - uz * vy,
    cy = uz * vx - ux * vz,
    cz = ux * vy - uy * vx;
  return Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
}

function trianglesToIndexedMesh(triangles: Triangle[]) {
  const vertexId = new Map<string, number>();
  const vertProperties: number[] = [];
  const triVerts: number[] = [];
  function idOf(p: readonly [number, number, number]): number {
    const key = `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(p[2] * 1e4)}`;
    let id = vertexId.get(key);
    if (id === undefined) {
      id = vertexId.size;
      vertexId.set(key, id);
      vertProperties.push(p[0], p[1], p[2]);
    }
    return id;
  }
  for (const t of triangles) {
    for (const p of t.v) triVerts.push(idOf(p));
  }
  return { vertProperties: new Float32Array(vertProperties), triVerts: new Uint32Array(triVerts) };
}

export interface ManifoldCheckResult {
  manifold: boolean;
  status: string;
}

// Mirrors public/manifoldCheck.js exactly, including the confirmed-live
// behavior that the Manifold constructor *throws* a ManifoldError (with
// `.code` set to the ErrorStatus string) on invalid input rather than
// returning an empty Manifold with a status() to read afterward.
export async function checkManifold(triangles: Triangle[]): Promise<ManifoldCheckResult> {
  const wasm = await loadManifold();
  const clean = triangles.filter((t) => triangleArea(t.v) > DEGENERATE_AREA_MM2);
  if (clean.length === 0) return { manifold: false, status: "Empty" };

  const { vertProperties, triVerts } = trianglesToIndexedMesh(clean);
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties, triVerts });
  try {
    const manifold = new wasm.Manifold(mesh);
    const status = manifold.status();
    manifold.delete();
    return { manifold: status === "NoError", status };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { manifold: false, status: e?.code || "NotManifold" };
  }
}
