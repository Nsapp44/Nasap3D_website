import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument, type InvoicePdfData } from "./InvoicePdf";

// Runs as a short-lived child process (see invoicePdfSubprocess.ts), never
// imported directly by the server. @react-pdf/renderer has a real,
// long-standing memory leak (yoga-layout's internal EventEmitters are never
// fully released between renders — confirmed live: 150 sequential
// renderToBuffer() calls in one process grew heapUsed from 33MB to 61MB and
// RSS from 143MB to 254MB, monotonically, even with forced global.gc()
// between every measurement; matches diegomura/react-pdf#718, #2848, #3051,
// long open/unresolved upstream). Generating each invoice in its own
// process sidesteps the leak entirely: whatever it retains dies with the
// process instead of accumulating in the long-running server.
// issuedAt crosses the IPC boundary as an ISO string, not a real Date —
// even with fork()'s "advanced" (structured-clone) serialization, it still
// arrived here as a string (confirmed live: tsx's CLI re-execs the actual
// script in a way that doesn't preserve the Date type through that extra
// hop). Reconstructing it explicitly here is simpler and more robust than
// chasing exactly why, and doesn't depend on IPC internals at all.
process.on("message", async (raw: InvoicePdfData) => {
  const data: InvoicePdfData = { ...raw, issuedAt: new Date(raw.issuedAt) };
  try {
    const buffer = await renderToBuffer(InvoiceDocument({ data }));
    process.send?.({ ok: true, pdfBase64: buffer.toString("base64") });
  } catch (err) {
    process.send?.({ ok: false, error: err instanceof Error ? err.message : String(err) });
  } finally {
    process.exit(0);
  }
});
