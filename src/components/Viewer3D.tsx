import { useEffect, useRef } from "react";
import { dynamicImport } from "../lib/dynamic-import";

export interface Viewer3DHandle {
  getSizeMm(): { x: number; y: number; z: number };
  setScale(factor: number): void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  dispose(): void;
}

interface Props {
  fileBuffer: ArrayBuffer;
  ext: string;
  colorHex: string;
  animate?: boolean;
  showGrid?: boolean;
  onHandle?: (handle: Viewer3DHandle | null) => void;
}

// Thin React wrapper around viewer3d.js — deliberately NOT rewritten as a
// React/three.js component. viewer3d.js is framework-agnostic imperative
// code (real three.js scene setup, occt-import-js WASM loading for STEP
// files) that's already correct and battle-tested; kept as a plain vendored
// script at public/viewer3d.js (not under src/, so Vite never tries to
// bundle its own `./vendor/...` dynamic imports) and loaded at runtime via
// a plain browser import, exactly like every .dc.html page did.
export default function Viewer3D({ fileBuffer, ext, colorHex, animate = true, showGrid = false, onHandle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let handle: Viewer3DHandle | null = null;
    (async () => {
      const mod = await dynamicImport("/viewer3d.js");
      if (cancelled || !containerRef.current) return;
      handle = await mod.renderModelPreview(containerRef.current, { fileBuffer, ext, colorHex, animate, showGrid });
      if (cancelled) {
        handle?.dispose();
        return;
      }
      onHandle?.(handle);
    })();
    return () => {
      cancelled = true;
      handle?.dispose();
      onHandle?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fileBuffer identity is the real re-render trigger, not colorHex/ext alone changing on every render
  }, [fileBuffer, ext, colorHex, animate, showGrid]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
