import { useEffect, useState } from "react";
import NavAuthIcon from "../NavAuthIcon";
import CartBadge from "../CartBadge";
import { useQuoteEnabled } from "../../hooks/useQuoteEnabled";

const SECTIONS = ["accueil", "services", "apropos", "realisations", "machines", "contact"];

interface NavItem {
  key: string;
  label: string;
  href: string | null;
}
const NAV_ITEMS: NavItem[] = [
  { key: "accueil", label: "Accueil", href: null },
  { key: "services", label: "Services", href: "/services" },
  { key: "apropos", label: "À propos", href: "/a-propos" },
  { key: "realisations", label: "Réalisations", href: "/realisations" },
  { key: "machines", label: "Machines", href: "/machines" },
  { key: "contact", label: "Contact", href: "/contact" },
];

// Home's own nav — only page with a scroll-spy, smooth-scroll-to-section
// "Accueil" link (every other page just links to "/"), so it can't reuse
// the shared Header.astro (see BaseLayout's hideHeader). Devis instantané is
// inserted at the same position as everywhere else, gated the same way
// (QuoteNavLink elsewhere, inlined here since this component already needs
// its own quoteEnabled read for the same reason).
export default function HomeHeader() {
  const [activeNav, setActiveNav] = useState("accueil");
  const { quoteEnabled } = useQuoteEnabled();

  useEffect(() => {
    function updateActiveNav() {
      const threshold = 140;
      let active = SECTIONS[0];
      for (const key of SECTIONS) {
        const el = document.getElementById("sec-" + key);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= threshold) active = key;
      }
      setActiveNav((cur) => (cur === active ? cur : active));
    }
    updateActiveNav();
    window.addEventListener("scroll", updateActiveNav, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveNav);
  }, []);

  function goToSection(key: string) {
    const el = document.getElementById("sec-" + key);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 76;
    window.scrollTo({ top, behavior: "smooth" });
  }

  return (
    <div className="home-header">
      <a
        href="/"
        className="logo-link"
        onClick={(e) => {
          e.preventDefault();
          goToSection("accueil");
        }}
      >
        <img src="/assets/logo-blanc-full.png" alt="Nasap3D" className="logo-img" />
      </a>

      <div className="nav-links">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <a
            key={item.key}
            href={item.href || "#sec-accueil"}
            className={`nav-hover-scale${activeNav === item.key ? " nav-current" : ""}`}
            onClick={
              item.href
                ? undefined
                : (e) => {
                    e.preventDefault();
                    goToSection(item.key);
                  }
            }
          >
            {item.label}
          </a>
        ))}
        {quoteEnabled && (
          <a href="/devis-instantane" className="nav-hover-scale n3d-quote-gate">
            Devis instantané
          </a>
        )}
        {NAV_ITEMS.slice(2).map((item) => (
          <a
            key={item.key}
            href={item.href || "#sec-accueil"}
            className={`nav-hover-scale${activeNav === item.key ? " nav-current" : ""}`}
          >
            {item.label}
          </a>
        ))}
      </div>

      <div className="header-account">
        <a href="/compte" className="nav-hover-scale">
          Compte
        </a>
        <NavAuthIcon />
        <a href="/panier" className="cart-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="21" r="1"></circle>
            <circle cx="19" cy="21" r="1"></circle>
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
          </svg>
          <CartBadge />
        </a>
      </div>

      <style>{`
        .home-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 40px; border-bottom: 1px solid rgba(255,255,255,.08); }
        .logo-link { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .logo-img { height: 34px; width: auto; }
        .nav-links { display: flex; gap: 26px; font: 500 13px 'Inter',sans-serif; color: rgba(255,255,255,.62); }
        .nav-links a { text-decoration: none; color: inherit; }
        .nav-current { color: #f3f1ec; border-bottom: 2px solid #ff5a3c; padding-bottom: 4px; font-weight: 600; }
        .header-account { display: flex; align-items: center; gap: 18px; font: 500 12px 'Inter',sans-serif; color: rgba(255,255,255,.75); }
        .header-account a { text-decoration: none; color: inherit; }
        .cart-link { position: relative; display: inline-flex; align-items: center; }
        .cart-link .cart-count { position: absolute; top: -9px; right: -9px; width: 15px; height: 15px; border-radius: 50%; background: #ff5a3c; color: #161514; font: 700 8.5px/15px 'Inter',sans-serif; text-align: center; }

        @media (max-width: 900px) {
          .home-header { padding: 12px 90px 12px 16px; position: relative; }
          .header-account { gap: 22px; }
          .nav-links {
            display: flex; position: absolute; top: 100%; left: 0; right: 0; flex-direction: column; gap: 0;
            background: #161514; border-bottom: 1px solid rgba(255,255,255,.08); box-shadow: 0 12px 24px rgba(0,0,0,.35);
            max-height: 0; overflow: hidden; opacity: 0; transform: scale(.94); transform-origin: top center;
            transition: max-height .28s ease, opacity .22s ease, transform .22s ease; padding: 0 16px; z-index: 50;
          }
          html.nasap-nav-open .nav-links { max-height: 480px; opacity: 1; transform: scale(1); padding: 8px 16px 14px; }
          .nav-links a { display: block; width: 100%; padding: 12px 4px; border-bottom: 1px solid rgba(255,255,255,.06); transition: none; transform: none; }
          .nav-links a:hover { transform: none; }
          .nav-current { font-weight: 700; font-size: 15.5px; padding: 14px 4px; border-bottom: 1px solid rgba(255,255,255,.06); text-decoration: underline; text-decoration-color: rgb(255,90,60); text-decoration-thickness: 2px; text-underline-offset: 6px; }
        }
      `}</style>
    </div>
  );
}
