import { useEffect, useState } from "react";
import { api } from "../lib/api-client";
import { isRenderableExt } from "../lib/viewer-ext";
import Viewer3D from "./Viewer3D";

// Renders a cart line's real uploaded geometry (not a placeholder) — ported
// from Cart.dc.html's _renderLinePreviews(). Simpler than the original's
// manual ref/Map bookkeeping: that existed entirely to work around the old
// framework re-rendering the whole page and sometimes remounting a line's
// DOM node under it (see that file's own long comment on the bug this
// caused). A real React component keyed by line id doesn't have that
// problem — mount/unmount (and Viewer3D's own dispose-on-unmount) is just
// ordinary React reconciliation.
export default function CartLineThumbnail({ quoteJobId, fileName, colorHex }: { quoteJobId: string; fileName: string; colorHex: string }) {
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const ext = "." + (fileName.split(".").pop() || "").toLowerCase();
  const renderable = isRenderableExt(ext);

  useEffect(() => {
    if (!renderable) return;
    let cancelled = false;
    fetch(api.quoteFileUrl(quoteJobId), { credentials: "include" })
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((buf) => {
        if (!cancelled) setBuffer(buf);
      })
      .catch(() => {
        if (!cancelled) setBuffer(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- renderable is derived from fileName, already covered
  }, [quoteJobId, fileName]);

  return (
    <div className="line-thumb">
      {buffer && renderable && <Viewer3D fileBuffer={buffer} ext={ext} colorHex={colorHex} animate={false} showGrid={false} />}
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
