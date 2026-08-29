import { apiHandler, json } from "../../lib/api/handler";

// Direct port of server/src/app.ts's GET /health — version = the git commit
// SHA baked in at Docker build time (see server/Dockerfile's GIT_SHA arg),
// "dev" for a plain local build. First route ported, deliberately trivial:
// proves the apiHandler()/middleware.ts plumbing works end-to-end before
// anything stateful is built on top of it.
export const GET = apiHandler(async () => {
  return json({ ok: true, version: process.env.GIT_SHA || "dev" });
});
