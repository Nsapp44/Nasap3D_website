import { apiHandler } from "../../../lib/api/handler";
import { revokeSession } from "../../../lib/server/session";
import { clearSessionCookie, getSessionCookie } from "../../../lib/api/cookies";

// Direct port of POST /auth/logout.
export const POST = apiHandler(async ({ cookies }) => {
  const raw = getSessionCookie(cookies);
  if (raw) await revokeSession(raw);
  clearSessionCookie(cookies);
  return new Response(null, { status: 204 });
});
