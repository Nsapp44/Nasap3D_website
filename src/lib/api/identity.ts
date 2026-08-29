import type { APIContext } from "astro";
import { getSessionUser } from "./auth";
import { getOrCreateGuestSessionId } from "./cookies";

// Resolves either {userId} (logged in) or {sessionId} (guest, cookie
// created on demand) — direct port of server/src/routes/cart.ts's
// identityFor. Shared by every cart route, since a visitor can add to cart
// before ever creating an account.
export async function identityFor(context: APIContext) {
  const user = await getSessionUser(context);
  if (user) return { userId: user.id } as const;
  const sessionId = getOrCreateGuestSessionId(context.cookies);
  return { sessionId } as const;
}
