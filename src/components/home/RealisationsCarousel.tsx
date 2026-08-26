import { useEffect, useRef, useState } from "react";

const REALISATIONS = [
  { img: "/assets/real-1.png", label: "Maquette ÄKTA readyflux", desc: "Reproduction détaillée d'un système de chromatographie, vue d'ensemble." },
  { img: "/assets/real-2.png", label: "ÄKTA readyflux — face avant", desc: "Panneau fluidique, vannes et tubulures fonctionnels à l'échelle." },
  { img: "/assets/real-3.png", label: "ÄKTA readyflux — vue 3/4", desc: "Châssis, tubulures et raccords fonctionnels à l'échelle." },
  { img: "/assets/real-4.jpg", label: "Trophée cerf", desc: "Découpe laser multi-couches en bois, montage mural." },
  { img: "/assets/real-5.jpg", label: "Caravanes Fendt miniatures", desc: "Série de modèles réduits imprimés et détaillés." },
  { img: "/assets/real-6.jpg", label: "Rondin gravé mariage", desc: "Gravure laser personnalisée sur tranche de bois." },
  { img: "/assets/real-7.jpg", label: "Médaille animal gravée", desc: "Gravure fibre sur médaille inox personnalisée." },
  { img: "/assets/real-8.jpg", label: "Maquette cellule — vue de face", desc: "Modèle pédagogique en coupe, pièces multicolores." },
  { img: "/assets/real-9.jpg", label: "Maquette cellule", desc: "Modèle pédagogique en coupe, pièces multicolores." },
  { img: "/assets/real-10.jpg", label: "Engrenage métal inox 316L", desc: "Impression 3D métal, engrenage technique en acier inoxydable 316L." },
  { img: "/assets/real-11.png", label: "Bloc manifold fluidique", desc: "Manomètres et vannes imprimés pour banc de test." },
  { img: "/assets/real-12.jpg", label: "Pièce rétro-conçue", desc: "Réducteur redessiné en CAO à partir de la pièce d'origine usée." },
  { img: "/assets/real-13.jpg", label: "Verres personnalisés", desc: "Gravure laser sur manchon cuir, personnalisation au prénom." },
  { img: "/assets/real-14.jpg", label: "Petite série technique", desc: "Pièce en TPU noir 90A, série de 528 unités." },
  { img: "/assets/real-15.jpg", label: "Formes pédagogiques", desc: "Pièces d'illustration multicolores pour le secteur santé." },
  { img: "/assets/real-16.jpg", label: "Figurines résine SLA", desc: "Impression résine haute définition prête pour peinture." },
  { img: "/assets/real-17.jpg", label: "Objets liturgiques", desc: "Maquettes de design produit pour une présentation." },
  { img: "/assets/real-18.jpg", label: "Cache Peugeot 102", desc: "Cache personnalisé imprimé pour Peugeot 102." },
];
const REAL_MAX = 6;
const GAP = 32;
const AUTO_MS = 3500;

function cardsPerView(width: number) {
  if (width > 0 && width < 640) return 1;
  if (width > 0 && width < 900) return 2;
  return 3;
}

// Ported from Home.dc.html's realisations carousel — auto-advances every
// 3.5s, pauses on hover, card width/count responsive to the measured
// container (1/2/3 cards per view) rather than a CSS breakpoint, since the
// original computed exact pixel widths for the translateX track.
export default function RealisationsCarousel() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapW, setWrapW] = useState(0);
  const [idx, setIdx] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const hoveredRef = useRef<number | null>(null);
  hoveredRef.current = hovered;
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function measure() {
      const el = wrapRef.current;
      if (!el) return;
      const w = Math.round(el.getBoundingClientRect().width);
      if (w) setWrapW((cur) => (w !== cur ? w : cur));
    }
    measure();
    const t1 = setTimeout(measure, 300);
    const t2 = setTimeout(measure, 1000);
    window.addEventListener("resize", measure);
    let ro: ResizeObserver | null = null;
    if (window.ResizeObserver && wrapRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(wrapRef.current);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, []);

  function startAuto() {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      setIdx((i) => (hoveredRef.current === null ? (i + 1) % (REAL_MAX + 1) : i));
    }, AUTO_MS);
  }
  useEffect(() => {
    startAuto();
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
  }, []);

  function go(delta: number) {
    setIdx((i) => (i + delta + REAL_MAX + 1) % (REAL_MAX + 1));
    startAuto();
  }

  const visible = cardsPerView(wrapW);
  const cardW = wrapW > 0 ? (wrapW - GAP * (visible - 1) - 12) / visible : 0;
  const step = cardW + GAP;

  return (
    <div className="real-carousel">
      <div ref={wrapRef} className="real-clip">
        <div className="real-track" style={{ transform: `translateX(-${idx * step}px)` }}>
          {REALISATIONS.map((r, i) => (
            <div
              key={r.label}
              className="real-slot"
              style={{ width: cardW > 0 ? `${cardW}px` : "calc((100% - 64px) / 3)", marginRight: `${GAP}px` }}
            >
              <div className="real-card" onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                <img src={r.img} alt={r.label} className="real-img" />
                <div className={`real-overlay${hovered === i ? " show" : ""}`}>
                  <div className="real-label">{r.label}</div>
                  <div className="real-desc">{r.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div onClick={() => go(-1)} className="real-nav prev">
        ‹
      </div>
      <div onClick={() => go(1)} className="real-nav next">
        ›
      </div>
      <div className="real-dots">
        {Array.from({ length: REAL_MAX + 1 }, (_, d) => (
          <span key={d} onClick={() => setIdx(d)} className={`real-dot${idx === d ? " active" : ""}`} />
        ))}
      </div>

      <style>{`
        .real-carousel { position: relative; padding: 0 32px; }
        .real-clip { overflow: hidden; border-radius: 8px; }
        .real-track { display: flex; margin-left: 6px; transition: transform .4s ease; }
        .real-slot { flex: none; box-sizing: border-box; }
        .real-card { width: 100%; aspect-ratio: 4/5; border-radius: 10px; border: 1px solid rgba(255,255,255,.1); position: relative; overflow: hidden; background: #0e0d0c; transition: border-color .25s ease, box-shadow .25s ease, transform .25s ease; }
        .real-card:hover { border-color: #ff5a3c; box-shadow: 0 12px 24px rgba(0,0,0,.35); transform: translateY(-3px); }
        .real-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .real-overlay { position: absolute; left: 0; right: 0; bottom: 0; padding: 8px; background: linear-gradient(transparent, rgba(0,0,0,.88)); opacity: 0; transition: opacity .25s ease; pointer-events: none; }
        .real-overlay.show { opacity: 1; }
        .real-label { font: 700 11px/1.3 'Space Grotesk',sans-serif; color: #fff; margin-bottom: 3px; }
        .real-desc { font: 400 10px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.85); }
        .real-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; border-radius: 50%; background: #1e1c1a; border: 1px solid rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; color: #f3f1ec; font: 700 13px 'Inter',sans-serif; cursor: pointer; }
        .real-nav.prev { left: 0; }
        .real-nav.next { right: 0; }
        .real-dots { display: flex; gap: 6px; justify-content: center; margin-top: 12px; }
        .real-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.25); cursor: pointer; display: inline-block; }
        .real-dot.active { background: #ff5a3c; }
      `}</style>
    </div>
  );
}
