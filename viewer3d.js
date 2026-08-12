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
  if (!animate) object.rotation.set(-0.35, 0.55, 0); // flattering static 3/4 angle

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
  const dist = radius / Math.sin((camera.fov * Math.PI) / 360) * 1.35;
  camera.position.set(dist * 0.55, dist * 0.5, dist * 0.7);
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

function materialFor(THREE, colorHex) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex || '#ff5a3c'),
    roughness: 0.55,
    metalness: 0.05,
  });
}
