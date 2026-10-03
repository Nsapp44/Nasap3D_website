import os from "node:os";
import path from "node:path";
import { readdirSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

// In-process DB watchdog, built for one recurring production outage: after
// several days, every DB query starts failing instantly while the Node
// process itself stays up, and only restarting the api container fixes it.
// Two jobs:
//
// 1. Capture evidence. The real error so far only existed in `docker logs`,
//    which was gone by the time anyone looked (the fix is a restart). The
//    first failure of a streak is written, with a host snapshot, to a file
//    on the uploads named volume — that survives container restarts AND
//    recreation. It also records the decisive test: does a brand-new
//    PrismaClient work while the app's own one fails? Yes means the stuck
//    state is in the client (a restart fixes it); no means Postgres itself.
//
// 2. Emergency restart, as asked by the owner: after RESTART_AFTER_MS of
//    uninterrupted failure, exit so Docker's `restart: unless-stopped`
//    brings the container back — but only if a fresh client works (a
//    restart would actually help) and at most once per 24h (persisted on
//    the same volume), so a recurring bug can never turn into a restart
//    loop that hides it. Deliberately no Docker-socket access: that was
//    rejected earlier as too much privilege.

export interface DbWatchdogDeps {
  checkMain: () => Promise<void>;
  checkFresh: () => Promise<void>;
  readLastRestart: () => Promise<number | null>;
  writeLastRestart: (at: number) => Promise<void>;
  record: (line: string) => Promise<void>;
  snapshot: () => string;
  exit: () => void;
  now: () => number;
}

export const RESTART_AFTER_MS = 5 * 60_000;
export const MIN_RESTART_INTERVAL_MS = 24 * 60 * 60_000;

export function describeError(err: unknown): string {
  const e = err as { name?: string; code?: unknown; errorCode?: unknown; meta?: { code?: unknown }; message?: string };
  const parts = [
    `name=${e?.name ?? "unknown"}`,
    e?.code ? `code=${String(e.code)}` : null,
    e?.errorCode ? `errorCode=${String(e.errorCode)}` : null,
    e?.meta?.code ? `pgCode=${String(e.meta.code)}` : null,
    `message=${JSON.stringify(String(e?.message ?? err).slice(0, 600))}`,
  ];
  return parts.filter(Boolean).join(" ");
}

export function createDbWatchdog(deps: DbWatchdogDeps) {
  let streakStart: number | null = null;
  let decided = false;

  async function tick() {
    try {
      await deps.checkMain();
      if (streakStart !== null) {
        await deps.record(`RECOVERED after ${Math.round((deps.now() - streakStart) / 1000)}s without a restart`);
      }
      streakStart = null;
      decided = false;
      return;
    } catch (err) {
      if (streakStart === null) {
        streakStart = deps.now();
        let fresh: string;
        try {
          await deps.checkFresh();
          fresh = "OK (stuck state is inside the app's own Prisma client — a restart fixes it)";
        } catch (freshErr) {
          fresh = `FAILS TOO (Postgres side) — ${describeError(freshErr)}`;
        }
        await deps.record(`FIRST FAILURE ${describeError(err)} | fresh client: ${fresh} | ${deps.snapshot()}`);
      }
    }

    if (decided || deps.now() - streakStart < RESTART_AFTER_MS) return;
    decided = true;

    try {
      await deps.checkFresh();
    } catch (freshErr) {
      await deps.record(`still failing after ${RESTART_AFTER_MS / 60_000}min, but a fresh client fails too (${describeError(freshErr)}) — restarting the app would not help, not restarting`);
      return;
    }

    const last = await deps.readLastRestart();
    if (last !== null && deps.now() - last < MIN_RESTART_INTERVAL_MS) {
      await deps.record(`still failing after ${RESTART_AFTER_MS / 60_000}min and a restart would help, but one already happened at ${new Date(last).toISOString()} (max 1 per 24h) — waiting for a manual restart`);
      return;
    }

    await deps.writeLastRestart(deps.now());
    await deps.record(`SELF-RESTART: failing for ${RESTART_AFTER_MS / 60_000}min, a fresh client works — exiting so Docker restarts the container | ${deps.snapshot()}`);
    deps.exit();
  }

  return { tick };
}

// ---- production wiring ----

const CHECK_INTERVAL_MS = 30_000;
const CHECK_TIMEOUT_MS = 5_000;
const DIAG_DIR = path.resolve(process.cwd(), "uploads", "_diagnostics");
const INCIDENT_LOG = path.join(DIAG_DIR, "db-incidents.log");
const LAST_RESTART_FILE = path.join(DIAG_DIR, "last-self-restart.txt");

async function selectOneWithTimeout(client: PrismaClient) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      client.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("db_check_timeout"), { name: "DbCheckTimeout" })), CHECK_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function hostSnapshot(): string {
  let fds = "n/a";
  try {
    fds = String(readdirSync("/proc/self/fd").length);
  } catch {
    // not Linux
  }
  const mb = (n: number) => Math.round(n / 1024 / 1024);
  return `host free=${mb(os.freemem())}MB/${mb(os.totalmem())}MB load=${os.loadavg().map((l) => l.toFixed(2)).join(",")} | process rss=${mb(process.memoryUsage().rss)}MB uptime=${Math.round(process.uptime() / 3600)}h fds=${fds}`;
}

let started = false;
export function startDbWatchdog() {
  if (started || process.env.NODE_ENV !== "production") return;
  started = true;

  const watchdog = createDbWatchdog({
    checkMain: () => selectOneWithTimeout(prisma),
    checkFresh: async () => {
      const fresh = new PrismaClient();
      try {
        await selectOneWithTimeout(fresh);
      } finally {
        await fresh.$disconnect().catch(() => {});
      }
    },
    readLastRestart: async () => {
      const raw = await readFile(LAST_RESTART_FILE, "utf8").catch(() => null);
      const at = raw ? Number(raw.trim()) : NaN;
      return Number.isFinite(at) ? at : null;
    },
    writeLastRestart: async (at) => {
      await mkdir(DIAG_DIR, { recursive: true });
      await writeFile(LAST_RESTART_FILE, String(at));
    },
    record: async (line) => {
      const stamped = `${new Date().toISOString()} [db-watchdog] ${line}`;
      console.error(stamped);
      await mkdir(DIAG_DIR, { recursive: true }).catch(() => {});
      await appendFile(INCIDENT_LOG, stamped + "\n").catch((err) => console.error("[db-watchdog] could not write incident log", err));
    },
    snapshot: hostSnapshot,
    exit: () => process.exit(1),
    now: () => Date.now(),
  });

  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await watchdog.tick();
    } catch (err) {
      console.error("[db-watchdog] tick failed", err);
    } finally {
      running = false;
    }
  }, CHECK_INTERVAL_MS);
}
