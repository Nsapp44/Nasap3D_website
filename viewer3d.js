// Shared real-geometry 3D preview — renders the customer's actual uploaded
// STL/OBJ/STEP file (not a placeholder cube) into a small WebGL canvas, in
// their chosen color. Used by Devis Instantane.dc.html, Home.dc.html (quote
// analysis previews) and Cart.dc.html (cart line preview, static/no spin).

const RENDERABLE_EXT = new Set(['.stl', '.obj', '.step', '.stp']);

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
    s.src = './vendor/occt/occt-import-js.js';
    s.onload = () => resolve(window.occtimportjs);
    s.onerror = () => reject(new Error('occt-import-js failed to load'));
    document.head.appendChild(s);
  }).then((factory) => factory({ locateFile: (p) => './vendor/occt/' + p }));
  return occtLoadPromise;
}

// Renders into `container` (any block element with a real width/height —
// the canvas fills it) in the piece's chosen color, auto-fit so a tiny
// piece and a large piece both read at a sensible size. `animate: false`
// renders one still frame at a flattering angle instead of spinning
// (used in the cart — see Cart.dc.html).
export async function renderModelPreview(container, { fileBuffer, ext, colorHex, animate = true }) {
  const THREE = await import('./vendor/three/three.module.min.js');
  const lowerExt = ext.toLowerCase();

  let object;
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
  } else if (lowerExt === '.step' || lowerExt === '.stp') {
    object = await buildStepObject(THREE, fileBuffer, colorHex);
    if (!object) return null;
  } else {
    return null;
  }

  // Recenter the underlying GEOMETRY (not just the object's position) on
  // its own bounding-box center. Rotation always pivots around an object's
  // local origin — a raw STL/STEP export's local origin is usually a
  // CAD-intent point (a corner, a mounting hole...), not the visual
  // center, which is what made the piece look like it was orbiting a
  // point far from itself instead of spinning in place.
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  object.traverse((child) => {
    if (child.isMesh && child.geometry) child.geometry.translate(-center.x, -center.y, -center.z);
  });
  object.position.set(0, 0, 0);
  const radius = Math.max(size.length() / 2, 0.001);

  const scene = new THREE.Scene();
  scene.add(object);
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
    // needs to fit).
    const dir = new THREE.Vector3(1, 1, 1).normalize();
    const dist = tightFitDistance(THREE, corners, dir, fovRad, width / height, [{ ry: 0, rx: 0 }], 1.05);
    camera.position.copy(dir).multiplyScalar(dist);
  }
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  let disposed = false;
  let frameId = null;
  if (animate) {
    (function loop() {
      if (disposed || !container.isConnected) return;
      object.rotation.y += 0.012;
      object.rotation.x = Math.sin(Date.now() / 3000) * 0.15;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(loop);
    })();
  } else {
    renderer.render(scene, camera);
  }

  return {
    dispose() {
      disposed = true;
      if (frameId) cancelAnimationFrame(frameId);
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
  if (!result || !result.success || !result.meshes || !result.meshes.length) return null;

  const material = materialFor(THREE, colorHex);
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
