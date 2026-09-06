import { useEffect, useState } from "react";
import { api } from "../lib/api-client";
import Viewer3D from "./Viewer3D";
import { getCachedQuoteFile, setCachedQuoteFile } from "../lib/quoteFileCache";

// In-memory, on top of quoteFileCache.ts's IndexedDB layer: avoids even the
// async IndexedDB round-trip when this mounts twice in the very same page
// (the mini cart dropdown and the full /panier line both render the same
// quoteJobId — see CartPage.tsx). IndexedDB itself is what actually
// persists across page loads (this site does full navigations, no
// client-side router — a plain module variable alone resets every time);
// see that file's own comment for why a cached entry never needs
// invalidating.
const memoryCache = new Map<string, ArrayBuffer>();

// Renders a cart line's real uploaded geometry (not a placeholder) — ported
// from Cart.dc.html's _renderLinePreviews(). Simpler than the original's
// manual ref/Map bookkeeping: that existed entirely to work around the old
// framework re-rendering the whole page and sometimes remounting a line's
// DOM node under it (see that file's own long comment on the bug this
// caused). A real React component keyed by line id doesn't have that
// problem — mount/unmount (and Viewer3D's own dispose-on-unmount) is just
// ordinary React reconciliation.
//
// The file this fetches (GET /quotes/:id/file) is ALWAYS a binary STL,
// regardless of what format was originally uploaded — src/pages/api/quotes/
// index.ts always stores exportTransformedStl(...)'s output, keeping the
// original fileName only for display (see that file's own comment). Real
// bug: this used to derive the render extension from fileName instead, so
// a 3MF/OBJ upload's stored bytes (real STL) got handed to the 3MF/OBJ
// reader here, which then failed outright on data that was never a zip in
// the first place ("not a valid zip (3mf) file"). STL is also always
// renderable, so there's no format to check here either.
export default function CartLineThumbnail({ quoteJobId, colorHex }: { quoteJobId: string; colorHex: string }) {
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(memoryCache.get(quoteJobId) ?? null);

  useEffect(() => {
    const inMemory = memoryCache.get(quoteJobId);
    if (inMemory) {
      setBuffer(inMemory);
      return;
    }
    let cancelled = false;
    // One retry after a transient failure — reported live as "sometimes
    // doesn't load after navigating quickly": a single dropped/failed fetch
    // (e.g. a request cancelled mid-flight by the browser's own connection
    // limit while other page assets are also loading) otherwise leaves the
    // thumbnail permanently blank for that page load, with nothing to
    // prompt a second attempt.
    async function load(attempt = 0) {
      const cachedOnDisk = await getCachedQuoteFile(quoteJobId);
      if (cancelled) return;
      if (cachedOnDisk) {
        memoryCache.set(quoteJobId, cachedOnDisk);
        setBuffer(cachedOnDisk);
        return;
      }
      try {
        const res = await fetch(api.quoteFileUrl(quoteJobId), { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) throw new Error(String(res.status));
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        memoryCache.set(quoteJobId, buf);
        setBuffer(buf);
        setCachedQuoteFile(quoteJobId, buf);
      } catch {
        if (cancelled) return;
        if (attempt < 1) {
          setTimeout(() => load(attempt + 1), 600);
        } else {
          setBuffer(null);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [quoteJobId]);

  return (
    <div className="line-thumb">
      {buffer && <Viewer3D fileBuffer={buffer} ext=".stl" colorHex={colorHex} animate={false} showGrid={false} />}
      <style>{`
        .line-thumb {
          width: 100%; height: 100%; border-radius: 8px;
          background: radial-gradient(circle at 35% 30%, #ddd9d2, #b5b1a8);
          border: 1px solid rgba(0,0,0,.2); display: flex; align-items: center; justify-content: center;
          overflow: hidden; box-shadow: inset 0 -6px 10px rgba(0,0,0,.12);
        }
      `}</style>
    </div>
  );
}
