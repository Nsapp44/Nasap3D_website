// dotenv must stay the first import: it populates process.env from
// server/.env (bind-mounted in Docker, see docker-compose.yml) before
// anything else gets a chance to read it. sanitizeEnv() then needs to run
// before ./app.js is evaluated — but static imports are hoisted in ES
// modules, so a plain `import { buildApp } from "./app.js"` placed after
// the sanitizeEnv() call below would still execute before it, defeating
// the whole point for any module in app.js's graph that reads an env var
// at its own top level. A dynamic import() is a real runtime statement,
// not hoisted, so it's the only way to guarantee that.
import "dotenv/config";
import { sanitizeEnv } from "./lib/sanitizeEnv.js";

sanitizeEnv();
const { buildApp } = await import("./app.js");
import { sweepExpiredQuoteFiles } from "./lib/quoteCleanup.js";
import { sweepAbandonedCarts } from "./lib/cartCleanup.js";
import { sweepOrderTracking } from "./lib/orderTracking.js";
import { sweepRejectedOrders } from "./lib/orders.js";

const app = await buildApp();

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

// Reclaims storage for quotes that expired without ever becoming an order
// (abandoned mid-configurator, or left in a cart nobody came back to) — see
// lib/quoteCleanup.ts and lib/cartCleanup.ts. A cart-line removal deletes
// its file immediately; this is the backstop for whatever nobody explicitly
// removed. Single in-process instance, no separate cron needed.
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
async function runSweep() {
  try {
    const abandonedCarts = await sweepAbandonedCarts();
    if (abandonedCarts > 0) app.log.info(`[cartCleanup] removed ${abandonedCarts} abandoned cart line(s)`);
  } catch (err) {
    app.log.error(err, "[cartCleanup] sweep failed");
  }
  try {
    const deletedFiles = await sweepExpiredQuoteFiles();
    if (deletedFiles > 0) app.log.info(`[quoteCleanup] deleted ${deletedFiles} expired quote file(s)`);
  } catch (err) {
    app.log.error(err, "[quoteCleanup] sweep failed");
  }
  try {
    const deletedOrders = await sweepRejectedOrders();
    if (deletedOrders > 0) app.log.info(`[orders] purged ${deletedOrders} rejected order(s) past the 72h retention`);
  } catch (err) {
    app.log.error(err, "[orders] rejected-order sweep failed");
  }
}
setInterval(runSweep, SWEEP_INTERVAL_MS);
runSweep();

// Separate, much slower interval: checks Boxtal's live carrier status for
// every shipped-and-labelled order still short of DELIVERED, auto-marking
// it delivered when detected (see lib/orderTracking.ts). Deliberately once
// a day rather than alongside the sweep above — tracking status doesn't
// change fast enough to justify one Boxtal API call per order every 15
// minutes, and this keeps call volume low.
const TRACKING_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
async function runTrackingSweep() {
  try {
    const autoDelivered = await sweepOrderTracking();
    if (autoDelivered > 0) app.log.info(`[orderTracking] auto-marked ${autoDelivered} order(s) as delivered`);
  } catch (err) {
    app.log.error(err, "[orderTracking] sweep failed");
  }
}
setInterval(runTrackingSweep, TRACKING_SWEEP_INTERVAL_MS);
runTrackingSweep();
