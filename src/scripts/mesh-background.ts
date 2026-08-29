// Plain script, not a React island — ported OUT of MeshBackground.tsx
// deliberately: this animation has zero React state/props/JSX branching, so
// wrapping it in a client:load component only added pure overhead (wait for
// React+ReactDOM to load, then hydrate, then run this exact same effect) for
// no benefit — the canvas sat blank for ~500ms on every Home load while that
// happened (reported live). As a plain <script> in index.astro, this runs
// as soon as the browser parses the tag, no framework loading step at all.
//
// The triangulated point-grid background behind the hero, pushed away from
// the cursor. Mouse-follow interaction is skipped on phone/tablet
// (<=900px, the same breakpoint used everywhere else in this codebase for
// "not desktop") — a real bug reported live: touch devices synthesize a
// mousemove on tap with no matching mouseleave, so the grid froze bulged
// toward the last tap point instead of relaxing back. The ambient animation
// itself still runs everywhere; only the interactive push-away is gated.

interface Point {
  originX: number;
  originY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

function initMeshBackground() {
  const canvas = document.getElementById("nasap-mesh-canvas") as HTMLCanvasElement | null;
  const container = canvas?.closest<HTMLElement>(".hero-wrap");
  if (!canvas || !container) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width: number, height: number, cols: number, rows: number;
  let points: Point[][] = [];
  const gap = 60;
  const mouse = { x: -1000, y: -1000, radius: 140 };
  const redColor = "255, 90, 60";

  function makePoint(x: number, y: number): Point {
    return { originX: x, originY: y, x, y, targetX: x, targetY: y };
  }
  function updatePoint(p: Point) {
    const dx = mouse.x - p.originX;
    const dy = mouse.y - p.originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < mouse.radius) {
      const force = (mouse.radius - dist) / mouse.radius;
      p.targetX = p.originX - (dx / dist) * force * 22;
      p.targetY = p.originY - (dy / dist) * force * 22;
    } else {
      p.targetX = p.originX;
      p.targetY = p.originY;
    }
    p.x += (p.targetX - p.x) * 0.1;
    p.y += (p.targetY - p.y) * 0.1;
  }

  const init = () => {
    const rect = container.getBoundingClientRect();
    width = canvas.width = rect.width;
    height = canvas.height = rect.height;
    cols = Math.ceil(width / gap) + 1;
    rows = Math.ceil(height / gap) + 1;
    points = [];
    for (let i = 0; i < cols; i++) {
      points[i] = [];
      for (let j = 0; j < rows; j++) {
        const offsetX = (Math.random() - 0.5) * gap * 0.8;
        const offsetY = (Math.random() - 0.5) * gap * 0.8;
        points[i][j] = makePoint(i * gap + offsetX, j * gap + offsetY);
      }
    }
  };

  const drawTriangle = (p1: Point, p2: Point, p3: Point) => {
    const cx = (p1.x + p2.x + p3.x) / 3;
    const cy = (p1.y + p2.y + p3.y) / 3;
    const dx = mouse.x - cx;
    const dy = mouse.y - cy;
    const distToMouse = Math.sqrt(dx * dx + dy * dy);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    if (distToMouse < mouse.radius) {
      const intensity = 1 - distToMouse / mouse.radius;
      ctx.fillStyle = "rgba(" + redColor + "," + intensity * 0.35 + ")";
      ctx.fill();
      ctx.strokeStyle = "rgba(" + redColor + "," + intensity * 0.8 + ")";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      const pushX = (cx - mouse.x) * intensity * 0.3;
      const pushY = (cy - mouse.y) * intensity * 0.3;
      const apexX = cx + pushX;
      const apexY = cy + pushY;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(apexX, apexY);
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(apexX, apexY);
      ctx.moveTo(p3.x, p3.y);
      ctx.lineTo(apexX, apexY);
      ctx.strokeStyle = "rgba(" + redColor + "," + intensity * 0.6 + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(apexX, apexY, 1.5 + intensity, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255," + intensity + ")";
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(60,60,60,.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  const animate = () => {
    ctx.fillStyle = "rgba(22,21,20,.6)";
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) updatePoint(points[i][j]);
    for (let i = 0; i < cols - 1; i++) {
      for (let j = 0; j < rows - 1; j++) {
        const p1 = points[i][j],
          p2 = points[i + 1][j],
          p3 = points[i][j + 1],
          p4 = points[i + 1][j + 1];
        drawTriangle(p1, p2, p3);
        drawTriangle(p2, p4, p3);
      }
    }
    requestAnimationFrame(animate);
  };

  const isTouchViewport = () => window.matchMedia("(max-width: 900px)").matches;
  const onMouseMove = (e: MouseEvent) => {
    if (isTouchViewport()) return;
    const rect = container.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  };
  const onMouseLeave = () => {
    mouse.x = -1000;
    mouse.y = -1000;
  };
  const onResize = () => init();

  container.addEventListener("mousemove", onMouseMove);
  container.addEventListener("mouseleave", onMouseLeave);
  window.addEventListener("resize", onResize);
  init();
  animate();

  // Astro does full page reloads (not client routing), so there's no
  // navigation-away cleanup to wire up here the way the React version
  // needed one (a component unmount effect) — the browser tears the whole
  // page down, listeners included, on every real navigation.
}

initMeshBackground();
