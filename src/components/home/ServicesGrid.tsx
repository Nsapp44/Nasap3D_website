import { useState } from "react";

const SERVICES = [
  { title: "Rétro-conception", desc: "CAO à partir d'une pièce existante", href: "/services#retroconception" },
  { title: "Impression 3D", desc: "Proto, pièces, séries ≤500", href: "/services#impression3d" },
  { title: "Maquettage", desc: "Maquettage de produit, d'outil pédagogique, de bâtiment...", href: "/services#maquettage" },
  { title: "Customisation Multisupports", desc: "Laser, vinyle, stickers, sublimation", href: "/services#customisation" },
  { title: "Maintenance machine", desc: "Diagnostic, réparation, garantie 3j", href: "/services#maintenance" },
  { title: "Initiation", desc: "Formules dès 90€", href: "/services#initiation" },
];

export default function ServicesGrid() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="services-grid">
      {SERVICES.map((s, i) => {
        const isHovered = hovered === i;
        const isDimmed = hovered !== null && !isHovered;
        return (
          <a
            key={s.title}
            href={s.href}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className={`service-card${isHovered ? " hovered" : ""}${isDimmed ? " dimmed" : ""}`}
          >
            <div className="service-title">{s.title}</div>
            <div className="service-desc">{s.desc}</div>
            <div className="service-link">
              Découvrir <span>→</span>
            </div>
          </a>
        );
      })}

      <style>{`
        .services-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
        .service-card { text-decoration: none; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 20px; background: #1a1917; display: flex; flex-direction: column; gap: 10px; position: relative; overflow: hidden; cursor: pointer; transform-origin: center; transform: scale(1); opacity: 1; z-index: 1; transition: transform .25s ease, opacity .25s ease, border-color .25s ease, box-shadow .25s ease; }
        .service-card.hovered { border-color: #ff5a3c; transform: scale(1.05); box-shadow: 0 14px 28px rgba(0,0,0,.4); z-index: 5; }
        .service-card.dimmed { transform: scale(.95); opacity: .55; }
        .service-title { font: 600 14px 'Space Grotesk',sans-serif; color: #f3f1ec; }
        .service-desc { font: 400 11px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.5); flex: 1; }
        .service-link { font: 600 11px 'Inter',sans-serif; color: #ff5a3c; display: inline-flex; align-items: center; gap: 4px; width: fit-content; padding: 0; border: 1px solid transparent; border-radius: 6px; background: transparent; transition: padding .25s ease, border-color .25s ease, background .25s ease; }
        .service-card.hovered .service-link { padding: 6px 12px; border-color: #ff5a3c; background: rgba(255,90,60,.1); }

        @media (max-width: 640px) {
          .services-grid { grid-template-columns: repeat(2,1fr); }
        }
        @media (max-width: 420px) {
          .services-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
