import type { APIContext, APIRoute } from "astro";
import { HttpError } from "./errors";

// Replaces Fastify's global setErrorHandler (server/src/app.ts): every route
// there implicitly relied on Fastify catching an unexpected throw (a DB
// error, a bug) and scrubbing it to a generic 500 before it ever reached the
// client — no stack trace, no internals, only logged server-side. Astro has
// no single global hook that does this for API routes, so every route is
// wrapped in this instead. src/middleware.ts adds a second, unconditional
// backstop around apiHandler() itself in case a route ever forgets to use
// it — this is the precise, per-route layer, not the only one.
//
// A route's own logic throws HttpError (see errors.ts) for anything it wants
// to report as a specific 4xx with a specific error code — anything else
// thrown (an unexpected DB failure, a bug) becomes a generic 500, exactly
// like the Fastify behavior it replaces.
export function apiHandler(fn: (context: APIContext) => Promise<Response>): APIRoute {
  return async (context) => {
    try {
      return await fn(context);
    } catch (err) {
      if (err instanceof HttpError) {
        return jsonError(err.status, err.code);
      }
      console.error(err);
      return jsonError(500, "internal_error");
    }
  };
}

export function jsonError(status: number, error: string, extra?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error, ...extra }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}
