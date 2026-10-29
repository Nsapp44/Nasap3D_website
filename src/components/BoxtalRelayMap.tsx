import { useEffect, useRef } from "react";
import { api } from "../lib/api-client";

declare global {
  interface Window {
    BoxtalParcelPointMap?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vendored lib, no bundled types
      BoxtalParcelPointMap: new (opts: Record<string, any>) => any;
    };
  }
}

export interface RelayPoint {
  code: string;
  name: string;
  address: string;
  city: string;
  zipcode: string;
}
export interface RelaySearchParams {
  country: string;
  zipCode: string;
  city: string;
  street: string;
}

interface Props {
  searchParams: RelaySearchParams | null;
  onPointSelected: (point: RelayPoint) => void;
  onNotice: (notice: string | null) => void;
  // Colis trop grand pour une consigne automatique : on refuse un locker choisi sur la carte.
  // Le widget Boxtal (v0.0.9) n'envoie que `networks[]` à son API, aucun filtre de type de
  // point n'existe : on contrôle donc la sélection côté client (heuristique sur le nom/type).
  hideLockers?: boolean;
}

function looksLikeLocker(point: unknown): boolean {
  const p = point as { name?: string; type?: string; parcelPointType?: string; category?: string };
  const text = [p.name, p.type, p.parcelPointType, p.category].filter(Boolean).join(" ");
  return /locker|consigne|apm|automate/i.test(text);
}

// Wraps vendor/boxtal-parcel-point-map.js — ported from Cart.dc.html's
// _loadRelayMap/_runPendingRelaySearch. Kept as a thin imperative wrapper
// (real map instance lives in a ref, not React state) since the vendored
// widget manages its own iframe/DOM entirely; React only needs to mount the
// container div once and forward new search params when the address
// changes.
export default function BoxtalRelayMap({ searchParams, onPointSelected, onNotice, hideLockers }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vendored lib instance, no bundled types
  const mapRef = useRef<any>(null);
  const mapReadyRef = useRef(false);
  const pendingSearchRef = useRef<RelaySearchParams | null>(null);
  const onPointSelectedRef = useRef(onPointSelected);
  const onNoticeRef = useRef(onNotice);
  onPointSelectedRef.current = onPointSelected;
  onNoticeRef.current = onNotice;
  const hideLockersRef = useRef(hideLockers);
  hideLockersRef.current = hideLockers;

  function runPendingSearch() {
    const params = pendingSearchRef.current;
    if (!params || !mapRef.current) return;
    onNoticeRef.current(null);
    mapRef.current.searchParcelPoints(params, (point: { code: string; name: string; location: { street: string; city: string; zipCode: string } }) => {
      if (hideLockersRef.current && looksLikeLocker(point)) {
        onNoticeRef.current("Les lockers sont trop petits pour votre colis : choisissez un Point Relais en magasin.");
        return;
      }
      onNoticeRef.current(null);
      onPointSelectedRef.current({
        code: point.code,
        name: point.name,
        address: point.location.street || params.street,
        city: point.location.city,
        zipcode: point.location.zipCode,
      });
    });
  }

  useEffect(() => {
    if (!searchParams) return;
    pendingSearchRef.current = searchParams;

    if (!mapRef.current) {
      (async () => {
        const res = await api.getBoxtalMapToken();
        const accessToken = res.ok && res.data ? (res.data as { accessToken: string }).accessToken : null;
        if (!accessToken) {
          onNoticeRef.current("Carte des points relais indisponible pour le moment, réessayez plus tard.");
          return;
        }
        if (!window.BoxtalParcelPointMap) return;
        mapRef.current = new window.BoxtalParcelPointMap.BoxtalParcelPointMap({
          domToLoadMap: "#boxtal-relay-map",
          accessToken,
          debug: true,
          config: {
            locale: "fr",
            parcelPointNetworks: [{ code: "MONR_NETWORK" }],
            options: { autoSelectNearestParcelPoint: false, primaryColor: "#ff5a3c" },
          },
          onMapLoaded: () => {
            mapReadyRef.current = true;
            runPendingSearch();
          },
        });
        mapRef.current.onSearchParcelPointsResponse((points: unknown) => {
          const count = Array.isArray(points) ? points.length : points && Array.isArray((points as { results?: unknown[] }).results) ? (points as { results: unknown[] }).results.length : null;
          onNoticeRef.current(count === 0 ? "Aucun point relais trouvé à proximité de cette adresse." : null);
        });
      })();
      return;
    }
    if (mapReadyRef.current) runPendingSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runPendingSearch closes over refs only, not a real dependency
  }, [searchParams]);

  // touchAction: "pan-y" — a single finger scrolls the page over the map
  // (the browser handles it as a native page scroll instead of routing it
  // to the map widget), so a visitor scrolling past this on mobile doesn't
  // get stuck panning the map by accident. Two-finger gestures (pinch-zoom,
  // two-finger pan) aren't covered by pan-y and still reach the map
  // normally. The vendored Boxtal widget has no gesture-handling option of
  // its own to set this — this works at the browser's touch-dispatch level,
  // above the widget, so it doesn't need one.
  return (
    <div
      id="boxtal-relay-map"
      style={{ height: "380px", borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,.1)", background: "#fff", touchAction: "pan-y" }}
    />
  );
}
