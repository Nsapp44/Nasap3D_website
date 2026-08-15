import type { FastifyInstance } from "fastify";

// Powers the "Avis Google" trust badge AND the review carousel on
// Home.dc.html (see Home.dc.html's _buildReviews) — both now backed by the
// same real Google Business Profile data, no hardcoded testimonials. The
// GOOGLE_PLACES_API_KEY must be restricted to the Places API only in Google
// Cloud Console and must NOT have an HTTP-referer restriction — this is a
// server-to-server call, never sent to the browser, so a referer restriction
// (meant for browser-origin calls) makes Google reject every request.
const PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

// Google's Place Details API caps this at 5 reviews per place, full stop —
// there is no way to fetch more, "reviews" is not paginated. So "the last 7
// reviews" isn't something this API can ever return; this is the real
// ceiling, not a bug here.
const MIN_REVIEW_STARS = 4;

type GoogleReview = { author: string; rating: number; text: string; relativeTime: string; time: number };

// Reviews genuinely don't need to be fresher than this for a small local
// business, and the explicit ask was "once a week, not more" — keeps calls
// (and quota) negligible.
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
let cache: { rating: number; totalReviews: number; reviews: GoogleReview[]; fetchedAt: number } | null = null;

export async function googleRoutes(app: FastifyInstance) {
  app.get("/google-rating", async (_request, reply) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const placeId = process.env.GOOGLE_PLACE_ID;
    if (!apiKey || !placeId) return reply.code(503).send({ error: "google_places_not_configured" });

    if (cache && Date.now() - cache.fetchedAt < CACHE_MS) {
      return reply.send({ rating: cache.rating, totalReviews: cache.totalReviews, reviews: cache.reviews });
    }

    const params = new URLSearchParams({
      place_id: placeId,
      fields: "rating,user_ratings_total,reviews",
      reviews_sort: "newest",
      language: "fr",
      key: apiKey,
    });

    let res: Response;
    try {
      res = await fetch(`${PLACE_DETAILS_URL}?${params.toString()}`);
    } catch {
      // Serve the last known-good value rather than a broken badge if
      // Google is briefly unreachable.
      if (cache) return reply.send({ rating: cache.rating, totalReviews: cache.totalReviews, reviews: cache.reviews });
      return reply.code(502).send({ error: "google_unreachable" });
    }
    const data = (await res.json()) as {
      status: string;
      result?: {
        rating?: number;
        user_ratings_total?: number;
        reviews?: Array<{ author_name: string; rating: number; text: string; relative_time_description: string; time: number }>;
      };
    };
    if (data.status !== "OK" || typeof data.result?.rating !== "number") {
      if (cache) return reply.send({ rating: cache.rating, totalReviews: cache.totalReviews, reviews: cache.reviews });
      return reply.code(502).send({ error: "google_places_error" });
    }

    const reviews: GoogleReview[] = (data.result.reviews ?? [])
      .filter((r) => r.rating >= MIN_REVIEW_STARS)
      .map((r) => ({ author: r.author_name, rating: r.rating, text: r.text, relativeTime: r.relative_time_description, time: r.time }));

    cache = { rating: data.result.rating, totalReviews: data.result.user_ratings_total ?? 0, reviews, fetchedAt: Date.now() };
    return reply.send({ rating: cache.rating, totalReviews: cache.totalReviews, reviews: cache.reviews });
  });
}
