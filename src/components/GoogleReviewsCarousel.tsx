import { useState } from "react";
import { RATING, REVIEWS } from "../lib/reviews";

function truncate(text: string, max = 150) {
  if (!text || text.length <= max) return text || "";
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…";
}

// Ported from the Google-reviews block duplicated in Devis
// Instantane.dc.html / Home.dc.html — badge + single-card carousel. Data is
// hardcoded now (see lib/reviews.ts) rather than fetched live from Google
// Places: that API capped at 4-5 reviews per call and the live badge wasn't
// worth the upkeep for a rating that barely moves.
export default function GoogleReviewsCarousel({ idPrefix }: { idPrefix: string }) {
  const [idx, setIdx] = useState(0);

  const reviews = REVIEWS.map((r) => ({
    stars: "★".repeat(Math.round(r.rating)) + "☆".repeat(5 - Math.round(r.rating)),
    text: "« " + truncate(r.text) + " »",
    author: r.author,
  }));

  function go(delta: number) {
    setIdx((i) => (i + delta + reviews.length) % reviews.length);
  }

  const stars = Array.from({ length: 5 }, (_, i) => {
    const fillFrac = Math.max(0, Math.min(1, RATING - i));
    return { x: i * 28, clipW: (fillFrac * 24).toFixed(2), clipId: `${idPrefix}-star-clip-${i}` };
  });

  return (
    <div className="greviews">
      <div className="greviews-head">
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
            Avis clients <tspan fontWeight="600" fill="#E8EAED">{RATING.toFixed(1).replace(".", ",")}</tspan>
          </text>
        </svg>
      </div>
      <div className="greviews-track-wrap">
        <div className="greviews-track-clip">
          <div className="greviews-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
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
          <span key={d} onClick={() => setIdx(d)} className={`greviews-dot${idx === d ? " active" : ""}`} />
        ))}
      </div>

      <style>{`
        .greviews-head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .greviews-badge-svg { display: block; }
        .greviews-track-wrap { position: relative; padding: 0 32px; }
        .greviews-track-clip { overflow: hidden; border-radius: 8px; }
        .greviews-track { display: flex; transition: transform .4s ease; }
        .greviews-slide { flex: 0 0 100%; box-sizing: border-box; }
        .greviews-card { border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 16px; background: #1a1917; }
        .greviews-stars { color: #ff5a3c; font: 14px/1 'Inter',sans-serif; margin-bottom: 8px; }
        .greviews-text { font: 400 11px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.6); margin-bottom: 10px; white-space: pre-line; }
        .greviews-author { font: 600 10.5px 'Inter',sans-serif; color: #f3f1ec; }
        .greviews-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; border-radius: 50%; background: #1e1c1a; border: 1px solid rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; color: #f3f1ec; font: 700 13px 'Inter',sans-serif; cursor: pointer; }
        .greviews-nav.prev { left: 0; }
        .greviews-nav.next { right: 0; }
        .greviews-dots { display: flex; gap: 6px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
        .greviews-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.25); cursor: pointer; display: inline-block; }
        .greviews-dot.active { background: #ff5a3c; }
      `}</style>
    </div>
  );
}
