import { useState } from "react";

// Hamburger button for the collapsible mobile nav — ported from
// mobile-nav.js. The old version had to mount itself as a direct child of
// <body>, outside the DC framework's React root, specifically to survive
// that framework re-rendering the whole page on every setState (see that
// file's own comment for the full explanation). Astro islands are mounted
// and hydrated independently by design, so that workaround is no longer
// needed — this is now a normal, ordinary React component.
//
// Still toggles a class on <html> (rather than local component state feeding
// the nav panel directly) because the nav-links panel it controls lives in
// the separate, server-rendered Header.astro markup, not inside this island
// — same mechanism as before, just owned by a real component now instead of
// a hand-rolled IIFE.
export default function MobileNavToggle() {
  const [open, setOpen] = useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    document.documentElement.classList.toggle("nasap-nav-open", next);
  }

  return (
    <div className="nasap-nav-toggle-anchor">
      <button
        type="button"
        className={`nasap-nav-toggle${open ? " is-open" : ""}`}
        aria-label="Menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <span />
        <span />
        <span />
      </button>
    </div>
  );
}
