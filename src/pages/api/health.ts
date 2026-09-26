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
export const GET = apiHandler(async () => {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("db_check_timeout")), 5000)),
    ]);
  } catch (err) {
    console.error("[health] database check failed", err);
    return json({ ok: false, version: process.env.GIT_SHA || "dev", error: "db_unreachable" }, { status: 503 });
  }
  return json({ ok: true, version: process.env.GIT_SHA || "dev" });
});
