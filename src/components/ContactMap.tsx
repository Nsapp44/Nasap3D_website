import { useEffect, useRef } from "react";

declare global {
  interface Window {
    L?: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Leaflet's own global, loaded from CDN, no bundled types
  }
}

const NASAP3D_COORDS: [number, number] = [47.21023, -1.580297];

// Leaflet map centered on the workshop — ported from Contact.dc.html's
// _initMap(). Leaflet itself stays a CDN <script>/<link> (see contact.astro),
// not bundled, matching the original.
export default function ContactMap({ height = "420px" }: { height?: string }) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function init(attempt = 0) {
      if (cancelled) return;
      const el = mapElRef.current;
      if (!el) return;
      if (typeof window.L === "undefined") {
        if (attempt < 40) retryTimer = setTimeout(() => init(attempt + 1), 150);
        return;
      }
      if (mapRef.current) return;
      const L = window.L;
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
    init();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={mapElRef} style={{ width: "100%", height }} />;
}
