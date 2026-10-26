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

  return <div ref={mapElRef} style={{ width: "100%", height }} />;
}
