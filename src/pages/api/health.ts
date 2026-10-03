import { apiHandler, json } from "../../lib/api/handler";
import { prisma } from "../../lib/server/prisma";

// Direct port of server/src/app.ts's GET /health — version = the git commit
// SHA baked in at Docker build time (see server/Dockerfile's GIT_SHA arg),
// "dev" for a plain local build.
//
// Also checked here: a real, cheap DB round-trip. Without it, this stayed
// {ok:true} even when the Node process was up but Postgres wasn't reachable
// (container down/OOM, network blip) — the exact state where the process
// itself looks "healthy" while the quote flow, checkout, and everything
// else that touches the DB is actually broken for real visitors. Bounded by
// a manual timeout so a hanging DB can't hang this endpoint indefinitely —
// see healthMonitor.mts, which polls this route and emails an alert on
// sustained failure.
//
// On failure, the response carries the error's class and codes (never its
// message: that can contain hostnames/SQL). A recurring production outage
// ("every DB query fails instantly until the container is restarted")
// could not be diagnosed from outside because this only ever said
// "db_unreachable" — these three fields are enough to tell apart a full
// Postgres connection table (P2037 / 53300), a database in recovery
// (57P03), an unreachable server (P1001), a closed connection (P1017), a
// poisoned transaction (25P02) or an engine failure, from a plain curl.
function describeDbError(err: unknown) {
  const e = err as { name?: string; code?: unknown; errorCode?: unknown; meta?: { code?: unknown } };
  const asCode = (v: unknown) => (typeof v === "string" && /^[A-Z0-9]{4,6}$/.test(v) ? v : undefined);
  return {
    errorName: typeof e?.name === "string" ? e.name.slice(0, 60) : "unknown",
    prismaCode: asCode(e?.code) ?? asCode(e?.errorCode),
    pgCode: asCode(e?.meta?.code),
  };
}

export const GET = apiHandler(async () => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("db_check_timeout"), { name: "DbCheckTimeout" })), 5000);
      }),
    ]);
  } catch (err) {
    console.error("[health] database check failed", err);
    return json(
      { ok: false, version: process.env.GIT_SHA || "dev", error: "db_unreachable", ...describeDbError(err) },
      { status: 503 },
    );
  } finally {
    clearTimeout(timer);
  }
  return json({ ok: true, version: process.env.GIT_SHA || "dev" });
});
