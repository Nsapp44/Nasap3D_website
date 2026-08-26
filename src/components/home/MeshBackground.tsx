import { useEffect, useRef } from "react";

interface Point {
  originX: number;
  originY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

// Ported 1:1 from Home.dc.html's _initMeshBg — the triangulated point-grid
// background behind the hero, pushed away from the cursor. The hero section
// itself is static Astro markup (title/CTAs never need to hydrate), so
// rather than a ref passed in from outside the React boundary (refs can't
// cross it), this island finds its container via .closest('.hero-wrap') —
// not just canvas.parentElement, since Astro wraps every client:load
// island's output in its own <astro-island> element, which sits between
// the canvas and the real .hero-wrap container (same boundary issue as
// elsewhere in this migration, e.g. QuoteNavLink's CSS scoping fix — here
// it would silently make the container's own getBoundingClientRect() report
// the near-zero-size <astro-island> box instead of the real hero section,
// since an absolutely-positioned canvas is its only content).
//
// Mouse-follow interaction is skipped on phone/tablet (<=900px, the same
// breakpoint used everywhere else in this codebase for "not desktop") — a
// real bug reported live: touch devices synthesize a mousemove on tap with
// no matching mouseleave, so the grid froze bulged toward the last tap
// point instead of relaxing back. The ambient animation itself still runs
// everywhere; only the interactive push-away is gated.
export default function MeshBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
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

    let raf = 0;
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
      raf = requestAnimationFrame(animate);
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

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} id="nasap-mesh-canvas" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }} />;
}
