import { apiHandler, json } from "../../../lib/api/handler";
import { getSessionUser } from "../../../lib/api/auth";
import { publicUser } from "../../../lib/server/serialize";

// Direct port of GET /auth/me — deliberately never 401s, always 200 with
// user:null when logged out (unlike requireAuth-guarded routes).
export const GET = apiHandler(async (context) => {
  const user = await getSessionUser(context);
  return json({ user: user ? publicUser(user) : null });
});
