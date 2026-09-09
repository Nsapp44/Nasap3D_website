// Serves a vendored client asset (Kiri:Moto's engine.js/worker.js/
// minion.js/manifold.wasm, and our own geometryWorker.js) as a real Astro
// route instead of a plain public/ static file. Two independent, both
// real, reasons these needed to move here rather than just adding headers
// to their public/ response some other way — @astrojs/node's standalone
// adapter serves public/ through its own static handler (node_modules/
// @astrojs/node/dist/serve-static.js) BEFORE Astro's own routing/
// middleware ever sees the request, with no hook for custom headers on a
// plain public/ file; only a real Astro route gets a chance to set one:
//
// 1. Cross-Origin-Resource-Policy — `new Worker(url, {type: "module"})`
//    enforces CORP on its own top-level script fetch under COEP:require-
//    corp even for same-origin scripts (same-origin resources are normally
//    CORP-exempt; module worker scripts go through a stricter fetch
//    algorithm that isn't) — confirmed live as `net::ERR_BLOCKED_BY_
//    RESPONSE` on geometryWorker.js before this existed. Only matters for
//    the 3 files actually passed to `new Worker()` (geometryWorker.js,
//    kiri/worker.js, kiri/minion.js) — see middleware.ts's COOP/COEP block.
//
// 2. Cache-Control — confirmed live (curl -I, both localhost and prod):
//    public/ static files serve with `max-age=0` (send()'s own default,
//    unchanged by this project), meaning the browser revalidates
//    engine.js+manifold.wasm (~4.4MB combined) on every single visit
//    before slicing can even start — cheap on localhost (loopback), real
//    latency on prod's actual internet-facing connection, and a full
//    re-download of that ~4.4MB for every visitor right after each
//    deploy (fresh ETag/Last-Modified). Applies to all 4 kiri files, not
//    just the 3 moved for CORP.
//
// Read once into memory at module load (these files only change on a
// redeploy, which re-imports this module fresh) rather than per-request
// disk I/O — all 4 files together are ~9.5MB, trivial to hold resident.
import { readFileSync } from "node:fs";
import path from "node:path";

const WORKER_ASSETS_DIR = path.resolve(process.cwd(), "worker-assets");

export function loadWorkerScript(relativePath: string): Buffer {
  return readFileSync(path.join(WORKER_ASSETS_DIR, relativePath));
}

// BodyInit's DOM typing doesn't accept Node's Buffer type in this project's
// lib config even though Node's Response/Blob both handle it fine at
// runtime — Buffer's ArrayBufferLike (which admits SharedArrayBuffer) vs
// BlobPart's plain-ArrayBuffer-only typing is the mismatch; the cast is
// safe because readFileSync always backs its Buffer with a real
// (non-shared) ArrayBuffer.
export function workerScriptResponse(body: Buffer, contentType: string = "text/javascript; charset=utf-8"): Response {
  return new Response(new Blob([body as unknown as ArrayBuffer]), {
    headers: {
      "Content-Type": contentType,
      "Cross-Origin-Resource-Policy": "same-origin",
      // Static, versioned only by redeploy — same long-cache convention
      // serve-static.js already applies to Astro's own hashed assetsDir.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
