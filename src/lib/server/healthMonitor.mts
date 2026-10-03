import "dotenv/config";
import { sanitizeEnv } from "../../../bootstrap/sanitizeEnv.mjs";

sanitizeEnv();

import { sendMail } from "./mailer";

// Standalone watchdog — NOT run inside the main server process (see
// server-entry.mjs). It runs as its own separate container (docker-
// compose.yml's "monitor" service, same image, different entrypoint) on
// purpose: if the api container itself crashes or gets OOM-killed, a
// watchdog living inside that same process/container would die with it and
// could never send the alert it exists for. A sibling container on the same
// Docker network keeps working independently and can still reach out over
// SMTP even while api is down.
//
// Polls GET /api/health (now a real DB round-trip too, not just process
// liveness — see health.ts) instead of a bare TCP check, so this also
// catches "the process is up but Postgres isn't" — the process alone
// looking fine while the quote flow is actually broken for real visitors,
// which is the exact complaint this was built for.
const TARGET_URL = process.env.HEALTH_CHECK_URL || "http://api:3000/api/health";
const ALERT_EMAIL = process.env.DOWNTIME_ALERT_EMAIL || process.env.ORDER_NOTIFY_EMAIL || process.env.CONTACT_NOTIFY_EMAIL;
const CHECK_INTERVAL_MS = 30_000;
// 3 consecutive failures (~90s of real downtime) before alerting — a single
// failed check is cheap to get from one slow response or a request that
// lands mid-deploy restart; three in a row is a much stronger signal of a
// real outage, at the cost of a ~90s alerting delay that's an acceptable
// trade for not paging over nothing.
const FAILURE_THRESHOLD = 3;
const REQUEST_TIMEOUT_MS = 10_000;

let consecutiveFailures = 0;
// Tracks whether an alert was already sent for the CURRENT outage, so a
// still-down site doesn't get a fresh email every 30s — one alert per
// outage, one recovery email when it actually comes back.
let alertSent = false;
// What the last failed check actually said — the health endpoint's own
// error class/codes when it answered with a 503, or why it didn't answer at
// all. Goes into the alert email so the email itself names the cause.
let lastFailureDetail = "";

async function checkOnce(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(TARGET_URL, { signal: controller.signal });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      lastFailureDetail = body
        ? `HTTP ${res.status} — erreur=${body.errorName ?? "?"} codePrisma=${body.prismaCode ?? "-"} codePostgres=${body.pgCode ?? "-"} version=${body.version ?? "?"}`
        : `HTTP ${res.status} (pas de détail)`;
    }
    return res.ok;
  } catch (err) {
    lastFailureDetail = `pas de réponse du conteneur api (${(err as Error).name}: ${(err as Error).message})`;
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function tick() {
  const healthy = await checkOnce();

  if (healthy) {
    if (alertSent) {
      console.warn(`[healthMonitor] ${TARGET_URL} is responding again — sending recovery email`);
      if (ALERT_EMAIL) {
        await sendMail(
          ALERT_EMAIL,
          "✅ Nasap3D — l'API est de nouveau en ligne",
          `Le site répond de nouveau correctement (${TARGET_URL}).`
        ).catch((err) => console.error("[healthMonitor] failed to send recovery email", err));
      }
    }
    consecutiveFailures = 0;
    alertSent = false;
    return;
  }

  consecutiveFailures++;
  console.warn(`[healthMonitor] health check failed (${consecutiveFailures}/${FAILURE_THRESHOLD}) — ${TARGET_URL}`);

  if (!alertSent && consecutiveFailures >= FAILURE_THRESHOLD) {
    alertSent = true;
    const downForSec = Math.round((FAILURE_THRESHOLD * CHECK_INTERVAL_MS) / 1000);
    console.error(`[healthMonitor] API considered DOWN after ${consecutiveFailures} consecutive failed checks — ${lastFailureDetail}`);
    if (!ALERT_EMAIL) {
      console.error("[healthMonitor] no DOWNTIME_ALERT_EMAIL/ORDER_NOTIFY_EMAIL/CONTACT_NOTIFY_EMAIL configured — cannot send alert");
      return;
    }
    await sendMail(
      ALERT_EMAIL,
      "🚨 Nasap3D — l'API ne répond plus",
      `Le site n'a pas répondu correctement depuis au moins ${downForSec}s (${TARGET_URL}).\n\n` +
        `Diagnostic : ${lastFailureDetail}\n\n` +
        `Le devis instantané et le reste du site sont probablement inaccessibles pour les visiteurs. ` +
        `Avant de redémarrer quoi que ce soit, récupérer : docker compose logs api --tail 100 ` +
        `et le fichier uploads/_diagnostics/db-incidents.log (dans le volume nasap3d_uploads_data). ` +
        `Un email de confirmation sera envoyé automatiquement dès que ça revient.`
    ).catch((err) => console.error("[healthMonitor] failed to send alert email", err));
  }
}

console.log(`[healthMonitor] watching ${TARGET_URL} every ${CHECK_INTERVAL_MS / 1000}s (alert after ${FAILURE_THRESHOLD} consecutive failures, to ${ALERT_EMAIL || "(non configuré)"})`);
tick();
setInterval(tick, CHECK_INTERVAL_MS);
