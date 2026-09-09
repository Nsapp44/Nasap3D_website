// See src/lib/server/serveWorkerScript.ts for why this is a real Astro
// route instead of a plain public/ file (here: the Cache-Control reason —
// engine.js is loaded via import(), not new Worker(), so CORP doesn't
// strictly apply to it, but it gets the same header harmlessly).
import type { APIRoute } from "astro";
import { loadWorkerScript, workerScriptResponse } from "../../../lib/server/serveWorkerScript";

const body = loadWorkerScript("kiri/engine.js");

export const GET: APIRoute = () => workerScriptResponse(body);
