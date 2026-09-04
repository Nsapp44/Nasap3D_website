// Runs the upload-time file→triangles→orientation→manifold-check pipeline
// off the main thread — this used to run inline in useQuoteWizard.ts's
// prepareOrientedModel, blocking page interaction/scrolling for the whole
// duration on a large file (confirmed live: ~700ms-5s depending on format
// and triangle count). A module worker (see the `{ type: 'module' }` at its
// construction in useQuoteWizard.ts) so plain `import` works here the same
// as everywhere else in this project.
//
// Only ever posts back the flat positions array, never the oriented
// Triangle[] itself: every consumer downstream (preview render, thin-wall
// check, slice) already converts Triangle[] into exactly this flat shape
// before using it (see trianglesToPositions) — sending the nested
// Triangle[] across postMessage would structured-clone millions of small
// objects/arrays for a large mesh, genuinely slower than just deriving the
// flat array once here and transferring it (Transferable, no copy, close to
// free even for a large buffer).
import { loadTriangles, orientTriangles, trianglesToPositions } from "/kiri-slicer.js";
import { checkManifoldAndParts } from "/orientationSuggest.js";

self.onmessage = async (event) => {
  const { id, fileBuffer, ext } = event.data;
  try {
    const rawTriangles = await loadTriangles(fileBuffer, ext);
    const triangles = await orientTriangles(rawTriangles);
    const { manifold } = checkManifoldAndParts(triangles);
    const positions = trianglesToPositions(triangles);
    self.postMessage({ id, positions, manifold }, [positions.buffer]);
  } catch (e) {
    self.postMessage({ id, error: e && e.message ? e.message : String(e) });
  }
};
