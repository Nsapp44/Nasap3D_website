// Shared real-geometry 3D preview — renders the customer's actual uploaded
// STL/OBJ/3MF file (not a placeholder cube) into a small WebGL canvas, in
// their chosen color. Used by Devis Instantane.dc.html, Home.dc.html (quote
// analysis previews) and Cart.dc.html (cart line preview, static/no spin).
// STEP stays renderable here too (occt-import-js) for the static H2C
// marketing model shown elsewhere on the site — the instant-quote wizard
// itself no longer accepts .step uploads (see useQuoteWizard.ts), but this
// module's own capability is intentionally kept general-purpose.

const RENDERABLE_EXT = new Set(['.stl', '.obj', '.3mf', '.step', '.stp']);

export function isRenderableExt(ext) {
  return RENDERABLE_EXT.has(ext.toLowerCase());
}

let occtLoadPromise = null;
// occt-import-js is a classic (non-ES-module) Emscripten build — it must be
// loaded as a real <script> tag (sets document.currentScript, which is how
// its wasm loader finds ./vendor/occt/occt-import-js.wasm next to itself),
// not via dynamic import(). Loaded lazily — most quotes are STL, no reason
// to fetch a 7MB wasm file for those.
function loadOcct() {
  if (occtLoadPromise) return occtLoadPromise;
  occtLoadPromise = new Promise((resolve, reject) => {
    if (window.occtimportjs) { resolve(window.occtimportjs); return; }
    const s = document.createElement('script');
    // Chemin absolu (pas relatif) : ce fichier est maintenant chargé depuis
    // des pages Astro à des routes variées (/panier, /devis-instantane...),
    // un chemin relatif dépendrait de la présence ou non d'un slash final
    // sur l'URL de la page courante — /vendor/... est sans ambiguïté.
    s.src = '/vendor/occt/occt-import-js.js';
    s.onload = () => resolve(window.occtimportjs);
    s.onerror = () => reject(new Error('occt-import-js failed to load'));
    document.head.appendChild(s);
  }).then((factory) => factory({ locateFile: (p) => '/vendor/occt/' + p }));
  return occtLoadPromise;
}

// Renders into `container` (any block element with a real width/height —
// the canvas fills it) in the piece's chosen color, auto-fit so a tiny
// piece and a large piece both read at a sensible size. `animate: false`
// renders one still frame at a flattering angle instead of spinning
// (used in the cart — see Cart.dc.html). `showGrid: true` adds a floor
// grid + "5 cm" scale bar (used by the file-upload step's Unité/Échelle
// panel — see Devis Instantane.dc.html/Home.dc.html) — the returned
// handle's getSizeMm()/setScale() let that panel show live dimensions and
// preview a scale factor without reloading/re-parsing the file.
// `positions`: an optional flat Float32Array (non-indexed triangle-soup,
// mm) — pass this instead of fileBuffer/ext when the caller already has
// real, parsed (and possibly already-oriented) geometry in hand
// (useQuoteWizard.ts's oriented preview, see kiri-slicer.js's
// trianglesToPositions), so this renders it directly instead of
// re-encoding to a file format just to immediately re-parse it back out.
export async function renderModelPreview(container, { fileBuffer, ext, positions, colorHex, animate = true, showGrid = false }) {
  const THREE = await import('./vendor/three/three.module.min.js');

  let object;
  if (positions) {
    // Copy, not a direct wrap — geometry.translate()/.rotateX() below mutate
    // the position buffer IN PLACE, and `positions` here is the caller's
    // own cached array (useQuoteWizard.ts's orientedModelPromiseRef, reused
    // across every re-render of the same file: step 1, step 3's "Analyse
    // terminée", and step 1 again after navigating back). Without this
    // copy, each render call rotated that shared array another -90° on top
    // of the last — confirmed live: navigating step1 -> step3 -> back to
    // step1 visibly spun the same real part a further -90° each time,
    // reported as "orientation not retained when going back". A fresh
    // Float32Array here means every render starts from the same untouched
    // source data, however many times it's shown.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.computeVertexNormals();
    object = new THREE.Mesh(geometry, materialFor(THREE, colorHex));
  } else {
    const lowerExt = ext.toLowerCase();
    if (lowerExt === '.stl') {
      const { STLLoader } = await import('./vendor/three/STLLoader.js');
      const geometry = new STLLoader().parse(fileBuffer);
      geometry.computeVertexNormals();
      object = new THREE.Mesh(geometry, materialFor(THREE, colorHex));
    } else if (lowerExt === '.obj') {
      const { OBJLoader } = await import('./vendor/three/OBJLoader.js');
      const text = new TextDecoder().decode(fileBuffer);
      object = new OBJLoader().parse(text);
      const mat = materialFor(THREE, colorHex);
      object.traverse((child) => { if (child.isMesh) child.material = mat; });
    } else if (lowerExt === '.3mf') {
      const { read3mfFile } = await import('./threeMfLoader.js');
      const result = await read3mfFile(fileBuffer);
      object = buildGroupFromMeshResult(THREE, result, materialFor(THREE, colorHex));
      if (!object) return null;
    } else if (lowerExt === '.step' || lowerExt === '.stp') {
      object = await buildStepObject(THREE, fileBuffer, colorHex);
      if (!object) return null;
    } else {
      return null;
    }
  }

  // Recenter the underlying GEOMETRY (not just the object's position) on
  // its own bounding-box center. Rotation always pivots around an object's
  // local origin — a raw STL/STEP export's local origin is usually a
  // CAD-intent point (a corner, a mounting hole...), not the visual
  // center, which is what made the piece look like it was orbiting a
  // point far from itself instead of spinning in place.
  const box0 = new THREE.Box3().setFromObject(object);
  const center0 = box0.getCenter(new THREE.Vector3());
  object.traverse((child) => {
    if (child.isMesh && child.geometry) child.geometry.translate(-center0.x, -center0.y, -center0.z);
  });
  object.position.set(0, 0, 0);
  // File Z = print height everywhere else in this app (PrusaSlicer's own
  // convention — see server/src/lib/slicer.ts sizeZMm and orientation.ts,
  // which score orientations on that same Z axis). three.js treats Y as
  // "up" for its own floor/camera defaults, so remap Z→Y once here, on the
  // GEOMETRY itself (not just object.rotation) so every box/size/corner
  // computed below already reflects the final display orientation.
  // Applied unconditionally (used to be showGrid-only) — now that the
  // stored file's orientation is a real, server-computed value baked into
  // its geometry (see exportTransformedStl/suggestOrientation in
  // routes/quotes.ts), every viewer showing that file — the step-1/3 grid
  // aperçu, the step-3 spinning "Analyse terminée" preview, and the cart —
  // needs to agree on which axis is "up", or the same file looks upright
  // in one and tipped over in another. Confirmed: cart's still preview
  // (animate:false, showGrid:false) was skipping this and looked wrong
  // relative to the aperçu.
  object.traverse((child) => {
    if (child.isMesh && child.geometry) child.geometry.rotateX(-Math.PI / 2);
  });
  // Real dimensions in the file's own units (mm, by this app's universal
  // convention — matches bboxXMm/YMm/ZMm server-side) — exposed via the
  // returned handle's getSizeMm() for the caller's live dimension readout.
  // Taken pre-remap so x/y/z always mean the same physical axes as the
  // server (getSizeMm().z stays "print height" regardless of showGrid).
  const sizeMm = box0.getSize(new THREE.Vector3());

  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 0.001);

  const scene = new THREE.Scene();
  scene.add(object);
  let grid = null;
  if (showGrid) {
    // Nearest "nice" 1/2/5×10^n cm size that comfortably contains the part,
    // one division per cm — a fixed, real-world-scale ruler behind the
    // part, so changing "Échelle" visibly grows/shrinks the part against a
    // constant reference instead of both moving together.
    const wantedCm = (Math.max(size.x, size.z) / 10) * 1.6;
    const niceSteps = [5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 750, 1000];
    const gridCm = niceSteps.find((n) => n >= wantedCm) || niceSteps[niceSteps.length - 1];
    grid = new THREE.GridHelper(gridCm * 10, gridCm, 0x888888, 0x444444);
    // Below the part's actual bottom, not exactly on it — otherwise the
    // grid plane and the part's bottom face are perfectly coplanar, a
    // textbook WebGL z-fighting setup (depth-test ties resolve
    // unpredictably per pixel, so the grid visibly flickers through the
    // part's underside). The offset has to be sized against the camera's
    // near/far range, not just the part itself — depth-buffer precision is
    // what actually matters here, and it degrades fast with a wide near/far
    // ratio (see the tightened camera.near/far below, set once `dist` is
    // known, which is what makes a small offset like this actually hold).
    grid.position.y = box.min.y - Math.max(radius * 0.01, 0.05);
    scene.add(grid);
  }
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(1, 1.4, 1.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.4);
  fill.position.set(-1.2, -0.6, -0.8);
  scene.add(fill);

  const width = container.clientWidth || 200;
  const height = container.clientHeight || 200;
  const camera = new THREE.PerspectiveCamera(35, width / height, radius / 100, radius * 100);
  const fovRad = (camera.fov * Math.PI) / 180;

  // Tight fit using the actual bounding-box CORNERS (not the bounding
  // sphere) in the exact camera direction used below — a sphere assumes
  // the worst case across every possible orientation at once (the full 3D
  // diagonal), which is far more conservative than what's actually needed
  // for a fixed viewing angle and leaves real, avoidable empty space.
  // Verified against real box-shaped test parts (the worst case for this,
  // since a box's corners sit exactly on its bounding sphere) to confirm
  // this never clips before shipping it.
  const corners = [];
  for (const sx of [box.min.x - center.x, box.max.x - center.x])
    for (const sy of [box.min.y - center.y, box.max.y - center.y])
      for (const sz of [box.min.z - center.z, box.max.z - center.z])
        corners.push(new THREE.Vector3(sx, sy, sz));

  let orbitDist;
  // Reused by setScale() below to re-fit the camera when the Échelle
  // panel changes the part's size — kept at the same outer scope as
  // `orbitDist` regardless of `animate` so it's available either way.
  const fitDir = new THREE.Vector3(1, 1, 1).normalize();
  if (animate) {
    // Spins continuously (rotation.y free-running, rotation.x wobbling
    // +/-0.15 rad) — the camera direction is fixed, so the fit must stay
    // safe across that whole motion range, sampled here once up front.
    const dir = new THREE.Vector3(0.55, 0.5, 0.7).normalize();
    const samples = [];
    for (let yi = 0; yi < 24; yi++) {
      const ry = (yi / 24) * Math.PI * 2;
      for (let xi = -2; xi <= 2; xi++) samples.push({ ry, rx: (xi / 2) * 0.15 });
    }
    const dist = tightFitDistance(THREE, corners, dir, fovRad, width / height, samples, 1.05);
    camera.position.copy(dir).multiplyScalar(dist);
  } else {
    // Classic isometric 3/4 angle — camera at equal offsets on all three
    // axes, so every piece reads the same way regardless of its own shape
    // or how its file happened to be exported (used for the cart, where
    // the piece stays still, so a single fixed orientation is all that
    // needs to fit). Grid mode uses a wider margin so the ruler grid reads
    // clearly around the part instead of being cropped tight against it.
    const dist = tightFitDistance(THREE, corners, fitDir, fovRad, width / height, [{ ry: 0, rx: 0 }], showGrid ? 1.8 : 1.05);
    camera.position.copy(fitDir).multiplyScalar(dist);
    orbitDist = dist;
  }
  camera.lookAt(0, 0, 0);

  // Depth-buffer precision is dominated by the near/far RATIO, not the
  // absolute values — the generic radius/100..radius*100 range above is
  // fine for the auto-fit spin/cart previews (camera distance moves with
  // it), but for the grid viewer specifically we now know the exact,
  // fixed camera distance, so tightening around it fixes the part/grid
  // z-fighting confirmed live (see grid.position.y above) far more
  // reliably than a bigger offset alone would.
  if (showGrid && orbitDist) {
    camera.near = orbitDist * 0.05;
    camera.far = orbitDist * 4;
    camera.updateProjectionMatrix();
  }

  // Anticrénelage désactivé pour la vue qui tourne en continu : son coût se
  // paie à chaque image, 60 fois par seconde, alors que pour les vues
  // statiques (une seule image rendue) il ne coûte quasiment rien. Signalé
  // comme lourd sur Firefox avec de vrais fichiers clients — l'implémentation
  // WebGL de Firefox gère le MSAA moins efficacement que Chrome sur certaines
  // configurations.
  const renderer = new THREE.WebGLRenderer({ antialias: !animate, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // Drag-to-inspect + wheel/button zoom for the grid viewer only (it never
  // auto-spins, so there'd otherwise be no way to see the part from
  // another angle) — the CAMERA orbits around the fixed part+grid, exactly
  // like PrusaSlicer's own viewer (or any real CAD/slicer tool) — not the
  // part spinning in place on a fixed camera, which was the first version
  // of this and read wrong (the grid, standing in for the physical print
  // bed, should never itself appear to move).
  let onPointerDown, onPointerMove, onPointerUp, onWheel;
  let zoomIn, zoomOut;
  // Hoisted so setScale() (defined on the returned handle, below) can also
  // call it after re-fitting orbitDist to a newly scaled part — declared
  // here rather than staying local to the `if (showGrid)` block it's
  // created in, since a closure keeps working correctly when invoked from
  // outside that block as long as it was DEFINED inside it.
  let updateCamera = null;
  if (showGrid) {
    let dragging = false, lastX = 0, lastY = 0, zoom = 1;
    // Spherical angles derived from the isometric start position set
    // above, so the drag continues smoothly from exactly where the part
    // was already framed instead of snapping to a different angle.
    let theta = Math.atan2(camera.position.x, camera.position.z);
    let phi = Math.acos(THREE.MathUtils.clamp(camera.position.y / orbitDist, -1, 1));
    updateCamera = () => {
      const r = orbitDist * zoom;
      camera.position.set(
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.cos(theta),
      );
      camera.lookAt(0, 0, 0);
    };
    const setZoom = (z) => { zoom = THREE.MathUtils.clamp(z, 0.25, 4); updateCamera(); renderer.render(scene, camera); };
    onPointerDown = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; container.style.cursor = 'grabbing'; };
    onPointerMove = (e) => {
      if (!dragging) return;
      theta -= (e.clientX - lastX) * 0.008;
      // Clamped just shy of straight up/down — exactly at the pole makes
      // "left/right" drag direction undefined (gimbal lock), same reason
      // every orbit-camera implementation avoids the exact pole.
      phi = THREE.MathUtils.clamp(phi - (e.clientY - lastY) * 0.008, 0.05, Math.PI - 0.05);
      lastX = e.clientX; lastY = e.clientY;
      updateCamera();
      renderer.render(scene, camera);
    };
    onPointerUp = () => { dragging = false; container.style.cursor = 'grab'; };
    onWheel = (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY > 0 ? 1.12 : 1 / 1.12)); };
    container.style.cursor = 'grab';
    container.style.touchAction = 'none';
    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    zoomIn = () => setZoom(zoom / 1.25);
    zoomOut = () => setZoom(zoom * 1.25);
  }

  let disposed = false;
  let frameId = null;
  if (animate) {
    // Plafonné à ~30 im/s (au lieu des 60 par défaut de requestAnimationFrame)
    // — signalé lourd sur Firefox avec de vrais fichiers clients. La vitesse
    // de rotation reste la même (basée sur le temps écoulé, pas sur le
    // nombre d'images), seul le nombre de rendus WebGL par seconde baisse.
    const TARGET_FRAME_MS = 1000 / 30;
    let lastRenderTime = 0;
    (function loop(now) {
      if (disposed || !container.isConnected) return;
      frameId = requestAnimationFrame(loop);
      if (now - lastRenderTime < TARGET_FRAME_MS) return;
      lastRenderTime = now;
      object.rotation.y = (now / 1000) * 0.72; // même vitesse qu'avant (0.012 rad/image à 60 im/s)
      object.rotation.x = Math.sin(now / 3000) * 0.15;
      renderer.render(scene, camera);
    })(performance.now());
  } else {
    renderer.render(scene, camera);
  }

  const gridBottomLocal = box.min.y; // pre-scale, local space — see setScale()

  return {
    // Real X/Y/Z in mm, at scale 1 (unscaled) — the file's own axes, same
    // meaning as the server's bboxXMm/YMm/ZMm regardless of showGrid's
    // display-only Z→Y remap.
    getSizeMm() {
      return { x: sizeMm.x, y: sizeMm.y, z: sizeMm.z };
    },
    // Visually previews a scale factor (1 = 100%) without reloading the
    // file — keeps the part's bottom resting on the grid at any scale
    // (object.position.y compensates for the fact that a uniform scale
    // from the origin would otherwise lift or sink that bottom edge).
    setScale(factor) {
      const posY = gridBottomLocal - factor * gridBottomLocal;
      object.scale.setScalar(factor);
      object.position.y = posY;
      // Re-fit the camera distance to the newly scaled part — without
      // this, only the object grew/shrank while the camera stayed at its
      // original distance, so a small part scaled up (e.g. 1000%) grew
      // straight past the frame and became invisible, confirmed live. The
      // grid itself is left alone on purpose (still the fixed real-world
      // reference — see its own comment above); only the camera adapts,
      // at the same drag angle/zoom the customer already set (theta/phi/
      // zoom, captured by updateCamera()'s closure) so this never resets
      // their view. `corners` are offsets from the object's own center at
      // scale 1 with position (0,0,0) — scaling them by `factor` alone
      // would ignore the compensating Y shift above (`posY`, which keeps
      // the part's bottom resting on the grid, and grows large at extreme
      // scales), so it's added back in to get each corner's real world
      // position.
      if (showGrid && updateCamera) {
        const scaledCorners = corners.map((c) => {
          const sc = c.clone().multiplyScalar(factor);
          sc.y += posY;
          return sc;
        });
        orbitDist = tightFitDistance(THREE, scaledCorners, fitDir, fovRad, width / height, [{ ry: 0, rx: 0 }], 1.8);
        camera.near = orbitDist * 0.05;
        camera.far = orbitDist * 4;
        camera.updateProjectionMatrix();
        updateCamera();
      }
      renderer.render(scene, camera);
    },
    // Grid viewer only (undefined otherwise) — same zoom the mouse wheel
    // drives, for an explicit +/− button pair (see Devis Instantane.dc.html/
    // Home.dc.html step-1 panel).
    zoomIn,
    zoomOut,
    dispose() {
      disposed = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (onPointerDown) {
        container.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        container.removeEventListener('wheel', onWheel);
        window.removeEventListener('pointerup', onPointerUp);
      }
      renderer.dispose();
      object.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    },
  };
}

async function buildStepObject(THREE, fileBuffer, colorHex) {
  const occt = await loadOcct();
  const result = occt.ReadStepFile(new Uint8Array(fileBuffer), null);
  return buildGroupFromMeshResult(THREE, result, materialFor(THREE, colorHex));
}

// Shared by the STEP (occt-import-js) and 3MF (threeMfLoader.js) preview
// paths — both produce the same {success, meshes:[{attributes:{position},
// index}]} shape (threeMfLoader.js deliberately mirrors occt's own result
// shape for exactly this reason), so one THREE.Group-building path covers
// both instead of duplicating it.
function buildGroupFromMeshResult(THREE, result, material) {
  if (!result || !result.success || !result.meshes || !result.meshes.length) return null;
  const group = new THREE.Group();
  for (const resultMesh of result.meshes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(resultMesh.attributes.position.array, 3));
    if (resultMesh.attributes.normal) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(resultMesh.attributes.normal.array, 3));
    } else {
      geometry.computeVertexNormals();
    }
    geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(resultMesh.index.array), 1));
    group.add(new THREE.Mesh(geometry, material));
  }
  return group;
}

// Distance (along `dir`, a unit vector from the object's origin to the
// camera) so that every corner in `corners`, rotated by each {ry, rx} in
// `rotationSamples` (matching the object's actual runtime spin), stays
// within the camera's field of view — with `margin` as a small safety
// multiplier for edge/antialiasing softness.
function tightFitDistance(THREE, corners, dir, fovRad, aspect, rotationSamples, margin) {
  const forward = dir.clone().negate();
  let right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
  right = right.lengthSq() < 1e-8 ? new THREE.Vector3(1, 0, 0) : right.normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const tanV = Math.tan(fovRad / 2);
  const tanH = tanV * aspect; // horizontal FOV's tan-half, from the vertical one and the aspect ratio

  let need = 0;
  const v = new THREE.Vector3();
  const eulerY = new THREE.Euler();
  const eulerX = new THREE.Euler();
  for (const { ry, rx } of rotationSamples) {
    eulerY.set(0, ry, 0);
    eulerX.set(rx, 0, 0);
    for (const c of corners) {
      v.copy(c).applyEuler(eulerY).applyEuler(eulerX);
      const along = v.dot(forward);
      need = Math.max(need, Math.abs(v.dot(right)) / tanH - along, Math.abs(v.dot(up)) / tanV - along);
    }
  }
  return Math.max(need, 0.001) * margin;
}

function materialFor(THREE, colorHex) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex || '#ff5a3c'),
    roughness: 0.55,
    metalness: 0.05,
  });
}
