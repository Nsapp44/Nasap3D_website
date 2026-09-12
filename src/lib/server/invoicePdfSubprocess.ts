import { fork } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
import type { InvoicePdfData } from "./InvoicePdf";

const require = createRequire(import.meta.url);
// tsx's own CLI entry — the same mechanism `npm run seed` already uses
// (tsx prisma/seed.ts) to run TS/TSX directly in this image without a
// separate compile step. tsx is a regular dependency (not dev-only), so
// it's present in the production image (Dockerfile's `npm install --omit=dev`
// keeps it) — confirmed by seeding already working in the built container.
const TSX_CLI = require.resolve("tsx/cli");
// Resolved from process.cwd(), NOT `new URL("./invoicePdfWorker.mts",
// import.meta.url)` — a real bug caught by testing the actual built image:
// Astro/Vite bundles this file's own code into dist/server/chunks/*.mjs at
// build time and rewrites import.meta.url-relative paths to point inside
// that bundle output, not this file's real on-disk location. The worker
// script itself is never bundled (Vite has no reason to touch a path that's
// only ever passed to child_process.fork(), not imported) — it ships as
// plain source under src/lib/server/ (Dockerfile explicitly copies that
// whole directory into the runtime image), and process.cwd() is always the
// project root (/app) in both dev and the built container, so this stays
// correct in both.
const WORKER_SCRIPT = path.resolve(process.cwd(), "src/lib/server/invoicePdfWorker.mts");

const GENERATE_TIMEOUT_MS = 15_000;

// Never more than (CPU cores - 1) invoice subprocesses at once, queued
// beyond that — a burst of force-payments/webhooks shouldn't be free to
// spawn an unbounded number of Node processes at once. Realistic load here
// is low (one real invoice per paid order), so a plain FIFO queue is enough
// — no need for the weighted/timeout machinery the quote-upload concurrency
// guard uses (concurrencyGuard.ts), which exists for a genuinely different
// problem (bounding total memory of a few huge in-flight uploads, not
// bounding a count of small short-lived processes).
const MAX_CONCURRENT = Math.max(1, os.cpus().length - 1);
let active = 0;
const waiting: (() => void)[] = [];

function acquireSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (active < MAX_CONCURRENT) {
        active++;
        resolve(release);
      } else {
        waiting.push(tryAcquire);
      }
    };
    function release() {
      active--;
      const next = waiting.shift();
      if (next) next();
    }
    tryAcquire();
  });
}

interface WorkerMessage {
  ok: boolean;
  pdfBase64?: string;
  error?: string;
}

// Generates the invoice PDF in a fresh, short-lived child process instead of
// in-process — @react-pdf/renderer has a real memory leak that accumulates
// across repeated renders in the same process (see invoicePdfWorker.mts's
// own comment for the measured numbers). A subprocess makes the leak
// irrelevant: whatever it retains is reclaimed by the OS the moment it
// exits, rather than piling up in the long-running server process.
export async function generateInvoicePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
  const release = await acquireSlot();
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      let settled = false;
      // Default (JSON) IPC serialization — tried "advanced" (V8 structured
      // clone, which normally preserves Date objects) first, but the Date
      // still arrived as a plain string on the worker side regardless
      // (tsx's CLI re-execs the actual script, and that extra hop doesn't
      // carry the structured-clone type through) — confirmed live, not
      // assumed. issuedAt is reconstructed explicitly from an ISO string
      // in invoicePdfWorker.mts instead, which works regardless of IPC mode.
      const child = fork(TSX_CLI, [WORKER_SCRIPT], { stdio: ["ignore", "ignore", "pipe", "ipc"] });

      let stderr = "";
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        reject(new Error("invoice pdf subprocess timed out"));
      }, GENERATE_TIMEOUT_MS);

      child.once("message", (msg: WorkerMessage) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (msg.ok && msg.pdfBase64) {
          resolve(Buffer.from(msg.pdfBase64, "base64"));
        } else {
          reject(new Error((msg.error || "invoice pdf subprocess reported failure") + (stderr ? " | stderr: " + stderr : "")));
        }
        child.kill();
      });

      child.once("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });

      child.once("exit", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`invoice pdf subprocess exited with code ${code}${stderr ? ": " + stderr : ""}`));
      });

      child.send(data);
    });
  } finally {
    release();
  }
}
