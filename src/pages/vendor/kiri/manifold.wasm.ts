// See src/lib/server/serveWorkerScript.ts for why this is a real Astro
// route instead of a plain public/ file (here: the Cache-Control reason).
import type { APIRoute } from "astro";
import { loadWorkerScript, workerScriptResponse } from "../../../lib/server/serveWorkerScript";

const body = loadWorkerScript("kiri/manifold.wasm");

export const GET: APIRoute = () => workerScriptResponse(body, "application/wasm");
