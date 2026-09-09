// See src/lib/server/serveWorkerScript.ts for why this is a real Astro
// route instead of a plain public/ file.
import type { APIRoute } from "astro";
import { loadWorkerScript, workerScriptResponse } from "../../../lib/server/serveWorkerScript";

const body = loadWorkerScript("kiri/worker.js");

export const GET: APIRoute = () => workerScriptResponse(body);
