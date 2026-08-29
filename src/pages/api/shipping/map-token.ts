import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { requireAuth } from "../../../lib/api/auth";
import { getBoxtalMapAccessToken, BoxtalConfigError, BoxtalApiError } from "../../../lib/server/boxtal";
import { enforceRateLimit, clientIp } from "../../../lib/api/rateLimit";

// Direct port of GET /shipping/map-token — short-lived token for the Boxtal
// parcel-point-map widget, minted server-side so BOXTAL_MAP_API_SECRET
// never reaches the browser (cached in-memory between calls in boxtal.ts,
// since the token isn't user-specific).
export const GET = apiHandler(async (context) => {
  await requireAuth(context);
  enforceRateLimit(`shipping:map-token:${clientIp(context)}`, 20, 60_000);

  try {
    const { accessToken, expiresIn } = await getBoxtalMapAccessToken();
    return json({ accessToken, expiresIn });
  } catch (err) {
    if (err instanceof BoxtalConfigError) {
      console.error("boxtal map not configured", err);
      return jsonError(503, "shipping_not_configured");
    }
    if (err instanceof BoxtalApiError) {
      console.error("boxtal map token failed", err);
      return jsonError(502, "shipping_provider_error");
    }
    throw err;
  }
});
