import { useEffect, useRef, useState } from "react";
import NavAuthIcon from "../NavAuthIcon";
import CartBadge from "../CartBadge";
import { useQuoteEnabledCached } from "../../hooks/useQuoteEnabled";

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
const GUIDES_INDEX = 5; // "Guides" s'insère juste avant "Contact"

// Menu "Guides" : même liste et même rendu que Header.astro (déroulant sur
// ordinateur, groupe de liens dans le menu burger sur mobile). `short` = libellé
// court du menu mobile.
const GUIDES = [
  { href: "/impression-3d-en-ligne", title: "Impression 3D en ligne", sub: "Commander depuis toute la France", short: "Impression 3D en ligne" },
  { href: "/impression-3d-particuliers", title: "Impression 3D pour particuliers", sub: "Même sans fichier 3D", short: "Pour particuliers" },
  { href: "/prix-impression-3d", title: "Prix de l'impression 3D", sub: "Comment le prix est calculé, exemples", short: "Prix" },
  { href: "/materiaux-impression-3d", title: "Matériaux d'impression 3D", sub: "PLA, PETG, TPU, ABS…", short: "Matériaux" },
];

// Home's own nav — only page with a scroll-spy, smooth-scroll-to-section
// "Accueil" link (every other page just links to "/"), so it can't reuse
// the shared Header.astro (see BaseLayout's hideHeader). Devis instantané is
// inserted at the same position as everywhere else, gated the same way
// (QuoteNavLink elsewhere, inlined here since this component already needs
// its own quoteEnabled read for the same reason) — trusts the cache only,
// same as QuoteNavLink: QuoteWizardSection (also on this page) is the one
// doing the real check, this nav link just reflects whatever it last found.
export default function HomeHeader() {
  const [activeNav, setActiveNav] = useState("accueil");
  const quoteEnabled = useQuoteEnabledCached();

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

  // Menu "Guides" : le CSS l'ouvre déjà au survol et au focus clavier ; l'état
  // ajoute le clic/tap (is-open) et la fermeture volontaire (is-closed : Échap,
  // second clic) qui masque le panneau malgré le survol/focus restant.
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [guidesClosed, setGuidesClosed] = useState(false);
  const guidesRef = useRef<HTMLDivElement>(null);
  const guidesBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = guidesRef.current;
    const btn = guidesBtnRef.current;
    if (!root || !btn) return;
    function onDocClick(e: MouseEvent) {
      if (!root!.contains(e.target as Node)) setGuidesOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const shown =
        root!.classList.contains("is-open") || root!.matches(":hover") || root!.matches(":focus-within");
      if (!shown) return;
      const hadFocus = root!.contains(document.activeElement);
      setGuidesOpen(false);
      setGuidesClosed(true);
      if (hadFocus) btn!.focus();
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function onGuidesClick() {
    if (guidesOpen) {
      setGuidesOpen(false);
      setGuidesClosed(true);
    } else {
      setGuidesClosed(false);
      setGuidesOpen(true);
    }
  }

  function onGuidesLeave() {
    setGuidesOpen(false);
    setGuidesClosed(false);
    // Un clic souris laisse le focus sur le bouton : on le retire pour que
    // :focus-within ne garde pas le panneau ouvert (le focus clavier reste).
    const f = document.activeElement;
    if (f instanceof HTMLElement && guidesRef.current?.contains(f) && !f.matches(":focus-visible")) f.blur();
  }

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
        <a href="/maquette-impression-3d" className="nav-hover-scale">
          Maquettes
        </a>
        {quoteEnabled && (
          <a href="/devis-instantane" className="nav-hover-scale n3d-quote-gate">
            Devis instantané
          </a>
        )}
        {NAV_ITEMS.slice(2, GUIDES_INDEX).map((item) => (
          <a
            key={item.key}
            href={item.href || "#sec-accueil"}
            className={`nav-hover-scale${activeNav === item.key ? " nav-current" : ""}`}
          >
            {item.label}
          </a>
        ))}
        <div
          ref={guidesRef}
          className={`nav-guides${guidesOpen ? " is-open" : ""}${guidesClosed ? " is-closed" : ""}`}
          onMouseEnter={() => setGuidesClosed(false)}
          onMouseLeave={onGuidesLeave}
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null;
            if (next && !e.currentTarget.contains(next)) {
              setGuidesOpen(false);
              setGuidesClosed(false);
            }
          }}
        >
          <button
            ref={guidesBtnRef}
            type="button"
            className="nav-guides-btn nav-hover-scale"
            aria-expanded={guidesOpen}
            aria-controls="guides-menu"
            onClick={onGuidesClick}
          >
            Guides
          </button>
          <span className="guides-grp" aria-hidden="true">
            Guides
          </span>
          <div className="guides-menu" id="guides-menu">
            <ul className="guides-list" aria-label="Guides">
              {GUIDES.map((g) => (
                <li key={g.href}>
                  <a href={g.href} className="g-link">
                    <b className="g-t">{g.title}</b>
                    <small className="g-s">{g.sub}</small>
                    <i className="g-m">{g.short}</i>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {NAV_ITEMS.slice(GUIDES_INDEX).map((item) => (
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

        /* Menu déroulant "Guides" (ordinateur) : ouvert au survol, au focus clavier et au clic/tap (.is-open) ; .is-closed = fermé volontairement (Échap, second clic). */
        .nav-guides { position: relative; }
        .nav-guides-btn { appearance: none; background: none; border: 0; margin: 0; padding: 0; font: inherit; white-space: nowrap; cursor: pointer; }
        .nav-guides-btn:focus-visible { outline: 2px solid #ff5a3c; outline-offset: 6px; border-radius: 4px; }
        .guides-grp, .g-m { display: none; }
        .guides-menu { position: absolute; top: 100%; right: -14px; padding-top: 12px; z-index: 60; opacity: 0; visibility: hidden; transform: translateY(6px); transition: opacity .2s ease, transform .2s ease, visibility 0s linear .2s; }
        .nav-guides:not(.is-closed):hover .guides-menu,
        .nav-guides:not(.is-closed):focus-within .guides-menu,
        .nav-guides.is-open .guides-menu { opacity: 1; visibility: visible; transform: translateY(0); transition: opacity .2s ease, transform .2s ease, visibility 0s; }
        .guides-menu .guides-list { list-style: none; margin: 0; padding: 8px; width: 340px; max-width: calc(100vw - 32px); box-sizing: border-box; background: #201d1b; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; box-shadow: 0 16px 34px rgba(0,0,0,.45); }
        .guides-menu .g-link { display: flex; flex-direction: column; justify-content: center; min-height: 44px; padding: 9px 12px; border-radius: 8px; text-decoration: none; }
        .guides-menu .g-t { display: block; font: 600 14px/1.3 'Space Grotesk',sans-serif; color: #f3f1ec; transition: color .2s ease; }
        .guides-menu .g-s { display: block; margin-top: 2px; font: 400 12.5px/1.35 'Inter',sans-serif; color: rgba(255,255,255,.55); }
        .guides-menu .g-link:hover, .guides-menu .g-link:focus-visible { background: rgba(255,255,255,.04); }
        .guides-menu .g-link:hover .g-t, .guides-menu .g-link:focus-visible .g-t { color: #ff5a3c; }
        .guides-menu .g-link:focus-visible { outline: 2px solid #ff5a3c; outline-offset: -2px; }
        @media (prefers-reduced-motion: reduce) {
          .guides-menu, .nav-guides:not(.is-closed):hover .guides-menu, .nav-guides:not(.is-closed):focus-within .guides-menu, .nav-guides.is-open .guides-menu, .guides-menu .g-t { transition: none; }
          .guides-menu { transform: none; }
        }

        @media (max-width: 900px) {
          .home-header { padding: 12px 90px 12px 16px; position: relative; }
          .header-account { gap: 22px; }
          .nav-links {
            display: flex; position: absolute; top: 100%; left: 0; right: 0; flex-direction: column; gap: 0;
            background: #161514; border-bottom: 1px solid rgba(255,255,255,.08); box-shadow: 0 12px 24px rgba(0,0,0,.35);
            max-height: 0; overflow: hidden; opacity: 0; transform: scale(.94); transform-origin: top center;
            transition: max-height .28s ease, opacity .22s ease, transform .22s ease; padding: 0 16px; z-index: 50;
          }
          html.nasap-nav-open .nav-links { max-height: 760px; overflow-x: hidden; overflow-y: auto; opacity: 1; transform: scale(1); padding: 8px 16px 14px; }
          .nav-links a { display: block; width: 100%; padding: 12px 4px; border-bottom: 1px solid rgba(255,255,255,.06); transition: none; transform: none; }
          .nav-links a:hover { transform: none; }
          .nav-current { font-weight: 700; font-size: 15.5px; padding: 14px 4px; border-bottom: 1px solid rgba(255,255,255,.06); text-decoration: underline; text-decoration-color: rgb(255,90,60); text-decoration-thickness: 2px; text-underline-offset: 6px; }
          /* "Guides" sur mobile : pas de déroulant. Intitulé de groupe non cliquable + 4 liens en retrait, toujours visibles dans le burger. */
          .nav-links .nav-guides-btn { display: none; }
          .nav-links .guides-grp { display: block; padding: 14px 4px 6px; font: 600 11px 'Inter',sans-serif; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.42); }
          .nav-links .guides-menu { position: static; padding: 0; opacity: 1; visibility: visible; transform: none; transition: none; }
          .nav-links .guides-menu .guides-list { width: auto; max-width: none; padding: 0; background: none; border: 0; border-radius: 0; box-shadow: none; }
          .nav-links .guides-menu .g-link { display: flex; flex-direction: row; align-items: center; min-height: 44px; padding: 10px 4px 10px 18px; border-radius: 0; background: none; }
          .nav-links .guides-menu .g-t, .nav-links .guides-menu .g-s { display: none; }
          .nav-links .guides-menu .g-m { display: inline; font-style: normal; }
        }
      `}</style>
    </div>
  );
}
