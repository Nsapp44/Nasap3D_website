import { useEffect, useState } from "react";
import { api } from "../lib/api-client";

interface ApiReview {
  rating: number;
  text: string;
  author: string;
}

// 3 real Google reviews copied by hand from the Business listing — the
// Place Details API caps at 5 reviews per listing, not paginable (see
// server/src/routes/google.ts), so completing the list here is the only way
// to always show at least 6. Never invented content: only real reviews,
// just sourced another way.
const MANUAL_REVIEWS: ApiReview[] = [
  {
    rating: 5,
    text: "Un service au top, excellent contact et produit fini totalement conforme au projet. Il m'a même été livré à l'hôtel à cause de son encombrement et parce que la patron passait par Saumur. Vraiment adorable.",
    author: "LE LONDRES Direction",
  },
  {
    rating: 5,
    text: "Grâce à eux, j'ai pu vraiment faire avancer mon projet de marque. Leur accompagnement sur les pièces 3D ou stikers m'a permis de structurer mes idées, d'y voir plus clair et de passer à l'action avec confiance. Je recommande à 100 % !",
    author: "Steeve Barber",
  },
  {
    rating: 5,
    text: "Parfaite réalisation d'une pièce complexe pour l'aéronautique de loisir. Délai tenu et prix raisonnable. Je recommande vivement cette entreprise",
    author: "Jean Tramalloni",
  },
];

function truncate(text: string, max = 150) {
  if (!text || text.length <= max) return text || "";
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…";
}

// Ported from the Google-reviews block duplicated in Devis
// Instantane.dc.html / Home.dc.html — badge (real Places rating, via GET
// /google-rating) + a real-avis carousel combining that API's reviews with
// MANUAL_REVIEWS above.
export default function GoogleReviewsCarousel({ idPrefix }: { idPrefix: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [apiReviews, setApiReviews] = useState<ApiReview[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    api.getGoogleRating().then((res) => {
      if (res.ok && res.data && typeof (res.data as { rating?: number }).rating === "number") {
        const data = res.data as { rating: number; reviews?: ApiReview[] };
        setRating(data.rating);
        setApiReviews(Array.isArray(data.reviews) ? data.reviews : []);
      }
    });
  }, []);

  const reviews = [...apiReviews, ...MANUAL_REVIEWS].map((r) => ({
    stars: "★".repeat(Math.round(r.rating)) + "☆".repeat(5 - Math.round(r.rating)),
    text: "« " + truncate(r.text) + " »",
    author: r.author,
  }));
  const activeIdx = Math.min(idx, reviews.length - 1);

  function go(delta: number) {
    setIdx((i) => (i + delta + reviews.length) % reviews.length);
  }

  const stars = Array.from({ length: 5 }, (_, i) => {
    const fillFrac = Math.max(0, Math.min(1, (rating || 0) - i));
    return { x: i * 28, clipW: (fillFrac * 24).toFixed(2), clipId: `${idPrefix}-star-clip-${i}` };
  });

  return (
    <div className="greviews">
      <div className="greviews-head">
        {rating != null ? (
          <svg viewBox="0 0 380 36" height="20" width="211" fill="none" className="greviews-badge-svg">
            <defs>
              <g id={`${idPrefix}-star`}>
                <path d="M12 1.5l3.09 6.26L22 8.77l-5 4.87 1.18 6.86L12 17.27l-6.18 3.23L7 13.64 2 8.77l6.91-1.01L12 1.5z" />
              </g>
            </defs>
            <g transform="translate(0, 6)">
              {stars.map((star) => (
                <g key={star.x} style={{ transform: `translate(${star.x}px, 0)` }}>
                  <use href={`#${idPrefix}-star`} fill="#4B4F56" opacity="0.4" />
                  <clipPath id={star.clipId}>
                    <rect x="0" y="0" style={{ width: `${star.clipW}px` }} height="24" />
                  </clipPath>
                  <g clipPath={`url(#${star.clipId})`}>
                    <use href={`#${idPrefix}-star`} fill="#FBBC05" />
                  </g>
                </g>
              ))}
            </g>
            <g transform="translate(144, 25)" fontFamily="'Product Sans', Roboto, Inter, sans-serif" fontWeight="700" fontSize="22">
              <text fill="#4285F4" x="0">G</text>
              <text fill="#EA4335" x="17">o</text>
              <text fill="#FBBC05" x="31">o</text>
              <text fill="#4285F4" x="45">g</text>
              <text fill="#34A853" x="59">l</text>
              <text fill="#EA4335" x="65">e</text>
            </g>
            <text x="228" y="24" fill="#9AA0A6" fontFamily="Roboto, Inter, sans-serif" fontSize="16" fontWeight="400">
              Avis clients <tspan fontWeight="600" fill="#E8EAED">{rating.toFixed(1).replace(".", ",")}</tspan>
            </text>
          </svg>
        ) : (
          <div className="greviews-fallback-label">Avis Google</div>
        )}
      </div>
      <div className="greviews-track-wrap">
        <div className="greviews-track-clip">
          <div className="greviews-track" style={{ transform: `translateX(-${activeIdx * 100}%)` }}>
            {reviews.map((rev, i) => (
              <div key={i} className="greviews-slide">
                <div className="greviews-card">
                  <div className="greviews-stars">{rev.stars}</div>
                  <div className="greviews-text">{rev.text}</div>
                  <div className="greviews-author">{rev.author}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div onClick={() => go(-1)} className="greviews-nav prev">‹</div>
        <div onClick={() => go(1)} className="greviews-nav next">›</div>
      </div>
      <div className="greviews-dots">
        {reviews.map((_, d) => (
          <span key={d} onClick={() => setIdx(d)} className={`greviews-dot${activeIdx === d ? " active" : ""}`} />
        ))}
      </div>

      <style>{`
        .greviews-head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .greviews-badge-svg { display: block; }
        .greviews-fallback-label { font: 600 11.5px 'Inter',sans-serif; color: #ff5a3c; text-transform: uppercase; letter-spacing: 1px; }
        .greviews-track-wrap { position: relative; padding: 0 32px; }
        .greviews-track-clip { overflow: hidden; border-radius: 8px; }
        .greviews-track { display: flex; transition: transform .4s ease; }
        .greviews-slide { flex: 0 0 100%; box-sizing: border-box; }
        .greviews-card { border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 16px; background: #1a1917; }
        .greviews-stars { color: #ff5a3c; font: 14px/1 'Inter',sans-serif; margin-bottom: 8px; }
        .greviews-text { font: 400 11px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.6); margin-bottom: 10px; }
        .greviews-author { font: 600 10.5px 'Inter',sans-serif; color: #f3f1ec; }
        .greviews-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; border-radius: 50%; background: #1e1c1a; border: 1px solid rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; color: #f3f1ec; font: 700 13px 'Inter',sans-serif; cursor: pointer; }
        .greviews-nav.prev { left: 0; }
        .greviews-nav.next { right: 0; }
        .greviews-dots { display: flex; gap: 6px; justify-content: center; margin-top: 12px; }
        .greviews-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.25); cursor: pointer; display: inline-block; }
        .greviews-dot.active { background: #ff5a3c; }
      `}</style>
    </div>
  );
}
