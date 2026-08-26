// Mirrors public/viewer3d.js's RENDERABLE_EXT/isRenderableExt exactly — kept
// as a separate trivial TS helper so callers that only need this check
// don't have to dynamically import the whole (three.js-heavy) viewer module.
const RENDERABLE_EXT = new Set([".stl", ".obj", ".step", ".stp"]);

export function isRenderableExt(ext: string): boolean {
  return RENDERABLE_EXT.has(ext.toLowerCase());
}
