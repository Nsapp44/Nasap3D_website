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
}

// Wraps vendor/boxtal-parcel-point-map.js — ported from Cart.dc.html's
// _loadRelayMap/_runPendingRelaySearch. Kept as a thin imperative wrapper
// (real map instance lives in a ref, not React state) since the vendored
// widget manages its own iframe/DOM entirely; React only needs to mount the
// container div once and forward new search params when the address
// changes.
export default function BoxtalRelayMap({ searchParams, onPointSelected, onNotice }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vendored lib instance, no bundled types
  const mapRef = useRef<any>(null);
  const mapReadyRef = useRef(false);
  const pendingSearchRef = useRef<RelaySearchParams | null>(null);
  const onPointSelectedRef = useRef(onPointSelected);
  const onNoticeRef = useRef(onNotice);
  onPointSelectedRef.current = onPointSelected;
  onNoticeRef.current = onNotice;

  function runPendingSearch() {
    const params = pendingSearchRef.current;
    if (!params || !mapRef.current) return;
    onNoticeRef.current(null);
    mapRef.current.searchParcelPoints(params, (point: { code: string; name: string; location: { street: string; city: string; zipCode: string } }) => {
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

  return <div id="boxtal-relay-map" style={{ height: "380px", borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,.1)", background: "#fff" }} />;
}
