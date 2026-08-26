import { useState } from "react";

export interface FaqItem {
  q: string;
  a: string;
}

// Single-open accordion — ported from the openFaq (index-or-null) pattern
// duplicated across Devis Instantane.dc.html/Home.dc.html.
export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="faq-list">
      {items.map((f, i) => {
        const isOpen = openIdx === i;
        return (
          <div key={i} className="faq-item">
            <div className="faq-question" onClick={() => setOpenIdx(isOpen ? null : i)}>
              <span className="faq-q-text">{f.q}</span>
              <span className="faq-icon">{isOpen ? "−" : "+"}</span>
            </div>
            <div className="faq-answer" style={{ maxHeight: isOpen ? "200px" : "0px" }}>
              <div className="faq-answer-text">{f.a}</div>
            </div>
          </div>
        );
      })}
      <style>{`
        .faq-list { display: flex; flex-direction: column; gap: 8px; }
        .faq-item { border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: #1a1917; overflow: hidden; }
        .faq-question { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; cursor: pointer; }
        .faq-q-text { font: 600 12.5px 'Space Grotesk',sans-serif; color: #f3f1ec; }
        .faq-icon { font: 600 14px 'Inter',sans-serif; color: #ff5a3c; }
        .faq-answer { overflow: hidden; transition: max-height .25s ease; }
        .faq-answer-text { padding: 0 16px 14px; font: 400 11px/1.6 'Inter',sans-serif; color: rgba(255,255,255,.55); }
      `}</style>
    </div>
  );
}
