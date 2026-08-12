// Shared real-geometry 3D preview — renders the customer's actual uploaded
// STL/OBJ file (not a placeholder cube) into a small rotating WebGL canvas.
// Used by Devis Instantane.dc.html, Home.dc.html (quote analysis preview)
// and Cart.dc.html (cart line preview). STEP files aren't renderable here
// (no practical client-side STEP parser without a heavy WASM CAD kernel) —
// callers should show a generic file icon for those instead, see
// isRenderableExt() below.

const RENDERABLE_EXT = new Set(['.stl', '.obj']);

export function isRenderableExt(ext) {
  return RENDERABLE_EXT.has(ext.toLowerCase());
}

// Renders into `container` (any block element with a real width/height —
// the canvas fills it) and keeps rotating until `.dispose()` is called.
// `colorHex` is the material's chosen color, so the preview genuinely shows
// what the customer picked, not a generic accent color.
export async function renderModelPreview(container, { fileBuffer, ext, colorHex }) {
  const THREE = await import('./vendor/three/three.module.min.js');

  let object;
  if (ext.toLowerCase() === '.stl') {
    const { STLLoader } = await import('./vendor/three/STLLoader.js');
    const geometry = new STLLoader().parse(fileBuffer);
    geometry.computeVertexNormals();
    object = new THREE.Mesh(geometry, materialFor(THREE, colorHex));
  } else if (ext.toLowerCase() === '.obj') {
    const { OBJLoader } = await import('./vendor/three/OBJLoader.js');
    const text = new TextDecoder().decode(fileBuffer);
    object = new OBJLoader().parse(text);
    const mat = materialFor(THREE, colorHex);
    object.traverse((child) => { if (child.isMesh) child.material = mat; });
  } else {
    return null;
  }

  // Center on origin and read its size so the camera can be placed at a
  // distance proportional to the piece — a tiny piece and a large piece
  // both end up filling the same portion of the preview instead of one
  // looking microscopic next to the other.
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  object.position.sub(center);
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
  (function animate() {
    if (disposed || !container.isConnected) return;
    object.rotation.y += 0.012;
    object.rotation.x = Math.sin(Date.now() / 3000) * 0.15;
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  })();

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

function materialFor(THREE, colorHex) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex || '#ff5a3c'),
    roughness: 0.55,
    metalness: 0.05,
  });
}
