import { useEffect, useRef } from "react";

declare global {
  interface Window {
    L?: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Leaflet's own global, loaded from CDN, no bundled types
  }
}

const NASAP3D_COORDS: [number, number] = [47.21023, -1.580297];

const LEAFLET_CSS_HREF = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_SRC = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let leafletPromise: Promise<any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any

// Loads Leaflet (same CDN files/version as the former <head> tags in
// index.astro/contact.astro) on demand, once per page — the promise is cached
// so several maps share a single load. Resolves with the global `L` once both
// the stylesheet and the script are ready; a failed load clears the cache so
// a later mount can retry.
function loadLeaflet(): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (leafletPromise) return leafletPromise;
  if (window.L) return Promise.resolve(window.L);

  const cssReady = new Promise<void>((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS_HREF;
    // A stylesheet failure is not fatal: the map still initialises.
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
  const jsReady = new Promise<any>((resolve, reject) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const script = document.createElement("script");
    script.src = LEAFLET_JS_SRC;
    script.async = true;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("leaflet_missing_global")));
    script.onerror = () => reject(new Error("leaflet_load_failed"));
    document.head.appendChild(script);
  });

  leafletPromise = Promise.all([cssReady, jsReady])
    .then(([, L]) => L)
    .catch((err) => {
      leafletPromise = null;
      throw err;
    });
  return leafletPromise;
}

// Leaflet map centered on the workshop — ported from Contact.dc.html's
// _initMap(). Leaflet itself stays a CDN <script>/<link>, not bundled,
// matching the original — but it is now injected on demand by loadLeaflet()
// when the map mounts instead of blocking the <head> of every page.
export default function ContactMap({ height = "420px" }: { height?: string }) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    function init(L: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (cancelled) return;
      const el = mapElRef.current;
      if (!el) return;
      if (mapRef.current) return;
      const map = L.map(el, { zoomControl: false, attributionControl: false }).setView(NASAP3D_COORDS, 6);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        subdomains: "abc",
        maxZoom: 19,
      }).addTo(map);
      const pulseIcon = L.divIcon({
        className: "",
        html: '<div class="nasap-pulse-wrap"><div class="nasap-pulse-ring"></div><div class="nasap-pulse-dot"></div></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      L.marker(NASAP3D_COORDS, { icon: pulseIcon }).addTo(map).bindPopup("Nasap3D — Nantes (Canclaux)");
      // Leaflet freezes its tile-grid size at init time, from the container's
      // size at that exact instant — if layout isn't settled yet (fonts/CSS
      // still loading, or the responsive grid hasn't collapsed to 1 column
      // on mobile yet), invalidateSize() forces a re-measure. The
      // ResizeObserver covers later resizes (screen rotation, desktop window
      // resize).
      setTimeout(() => mapRef.current?.invalidateSize(), 0);
      if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => mapRef.current?.invalidateSize());
        resizeObserver.observe(el);
      }
    }
    loadLeaflet().then(init, () => {
      // CDN unreachable: leave the empty map frame, same as before.
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  function recenter() {
    const map = mapRef.current;
    if (!map) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) map.setView(NASAP3D_COORDS, 6, { animate: false });
    else map.flyTo(NASAP3D_COORDS, 6, { duration: 0.8 });
  }

  return (
    <div style={{ position: "relative", zIndex: 0, width: "100%", height }}>
      <div ref={mapElRef} style={{ width: "100%", height: "100%" }} />
      <style>{`
        .nasap-recenter{position:absolute;top:10px;right:10px;z-index:1000;width:44px;height:44px;display:flex;align-items:center;justify-content:center;padding:0;background:#1a1917;border:1px solid rgba(255,255,255,.18);border-radius:10px;color:#fff;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.35);transition:color .2s ease,border-color .2s ease}
        .nasap-recenter:hover{color:#ff5a3c;border-color:rgba(255,90,60,.6)}
        .nasap-recenter:focus-visible{outline:2px solid #ff5a3c;outline-offset:2px;color:#ff5a3c}
        @media (prefers-reduced-motion: reduce){.nasap-recenter{transition:none}}
      `}</style>
      <button type="button" className="nasap-recenter" onClick={recenter} aria-label="Recentrer la carte" title="Recentrer la carte">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
    </div>
  );
}
