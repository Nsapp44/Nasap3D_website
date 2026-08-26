import { useEffect, useRef } from "react";

// The "N" logo drawing itself in as you scroll to the About section, then
// the extruder head sliding to its resting position and the four corner
// branches popping in — ported 1:1 from Home.dc.html's _initNPrint/
// _handlePrintScroll (CSS keyframes/transitions for the branches/extruder
// live in global.css, added once for this component; the path-drawing
// itself is imperative since it depends on live scroll position, not just
// a class toggle).
export default function NPrintLogo() {
  const areaRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const extruderRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const nPath = pathRef.current;
    const extruder = extruderRef.current;
    const printArea = areaRef.current;
    if (!nPath || !extruder || !printArea) return;

    const length = nPath.getTotalLength();
    nPath.style.strokeDasharray = String(length);
    nPath.style.strokeDashoffset = String(length);

    function handleScroll() {
      if (!nPath || !extruder || !printArea) return;
      const rect = printArea.getBoundingClientRect();
      const revealThreshold = 1 / 3;
      const triggerRectTop = window.innerHeight - revealThreshold * rect.height;
      const finishRectTop = window.innerHeight / 2 - rect.height / 2;
      const scrollDistance = triggerRectTop - finishRectTop;
      const extraPx = triggerRectTop - rect.top;
      const scrollPercent = Math.min(Math.max(extraPx / scrollDistance, 0), 1);

      if (scrollPercent === 0) {
        printArea.classList.remove("printing", "finished");
        nPath.style.strokeDashoffset = String(length);
        nPath.style.fill = "transparent";
        return;
      }
      if (scrollPercent === 1) {
        printArea.classList.remove("printing");
        printArea.classList.add("finished");
        nPath.style.strokeDashoffset = "0";
        nPath.style.fill = "";
        extruder.style.transform = "";
        return;
      }
      printArea.classList.add("printing");
      printArea.classList.remove("finished");
      const currentDrawLength = scrollPercent * length;
      nPath.style.strokeDashoffset = String(length - currentDrawLength);
      const pt = nPath.getPointAtLength(currentDrawLength);
      extruder.style.transform = `translate(${pt.x - 52.81}px, ${pt.y - 1.85}px)`;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div ref={areaRef} id="nasap-print-area" className="nasap-print-area">
      <svg id="nasap-main-svg" viewBox="0 0 172.42 205.63" width="100%" height="100%" style={{ overflow: "visible", display: "block" }}>
        <g transform="translate(23.81, 96.17)">
          <path className="nasap-branch" d="M35.9,98.54l-32.72.03c-1.46-.62-3.01-3.45-3.15-4.9-.2-1.93.89-4.71,2.51-6.19l33.25.17c3.46,1.76,3.55,8.03.12,10.89Z" />
          <path className="nasap-branch" d="M37.63,68.44c1.59,1.13.11,5.3-.85,6.56s-3.69,2.9-5.55,2.55L4.87,58.68c-.64-1.91.06-4.64,1.08-6.07.95-1.33,4.21-3.76,5.93-2.53l25.74,18.35Z" />
          <path className="nasap-branch" d="M118.23,78.05c-3.56,2.07-8.86-6.3-5.99-8.54,8.66-6.78,17.4-12.39,26.6-18.66,1.76,0,4.17,1.45,5.11,2.6,1.22,1.49,1.86,4.89.92,6.66-8.84,6.17-17.02,12.34-26.64,17.93Z" />
          <path className="nasap-branch" d="M145.89,97.46c-11.04.57-21.65.72-32.34-.1-3.76-.29-3.8-9.87-.16-10.16,10.79-.85,21.54-.73,32.45-.1,3.49.47,3.55,9.04.04,10.36Z" />
          <path ref={pathRef} className="nasap-n-path" d="M43.49,2.18l18.49.14,27.01,63.2.17-65.52,16.44.02v97.84s-17.86-.01-17.86-.01l-27.68-63.19-.17,63.22-16.4.02V2.18Z" />
        </g>
        <g ref={extruderRef} id="nasap-extruder-group">
          <path style={{ fill: "#f3f1ec" }} d="M152.47,0H3.31C1.36,1.06-.06,3.85,0,5.61c.06,1.76,1.17,4.05,2.54,5.55l20.55.12.08,10.48c.02,3.21,1.74,5.92,5.34,5.92h19.65s0,43.18,0,43.18c0,3.72,1.91,7.53,3.59,10.53l6.62.24.25,22.13c.02,1.49,1.6,4.09,2.78,4.78,1.21.7,4.09.72,6.02.69h18.49l6.12-.26c1.68-1.21,3.07-4.91,3.07-7.13l.03-20.19,7.9-.34c1.4-2.93,3.21-6.39,3.21-9.66l.08-43.96,21.11-.04c1.54,0,4.26-2.81,4.28-4.33l.19-12.04,20.87-.12c1.52-.86,2.94-3.83,2.87-5.48-.08-1.94-1.27-4.4-3.17-5.68ZM82.98,98.02h-12.72v-15.71h12.72v15.71ZM92.71,71.22h-32.87V28.44h32.87v42.78ZM118.11,17.26H35.09v-5.28h83.03v5.28Z" />
          <rect style={{ fill: "#161514" }} x="59.84" y="28.44" width="32.87" height="42.78" />
          <rect style={{ fill: "#161514" }} x="35.09" y="11.98" width="83.03" height="5.28" />
          <rect style={{ fill: "#161514" }} x="70.26" y="82.31" width="12.72" height="15.71" />
        </g>
      </svg>
      <style>{`
        .nasap-print-area { position: relative; width: 116px; margin: 0 auto; }
        .nasap-print-area .nasap-n-path { fill: transparent; stroke: #f3f1ec; stroke-width: 1.5; stroke-linejoin: round; }
        .nasap-print-area.finished .nasap-n-path { fill: #f3f1ec; transition: fill .3s ease; }
        .nasap-print-area .nasap-branch { fill: #f3f1ec; opacity: 0; transform: scale(.5); transform-box: fill-box; transform-origin: center; transition: opacity .4s cubic-bezier(.175,.885,.32,1.275), transform .4s cubic-bezier(.175,.885,.32,1.275); }
        .nasap-print-area.finished .nasap-branch { opacity: 1; transform: scale(1); }
        .nasap-print-area.finished .nasap-branch:nth-of-type(1) { transition-delay: .05s; }
        .nasap-print-area.finished .nasap-branch:nth-of-type(2) { transition-delay: .1s; }
        .nasap-print-area.finished .nasap-branch:nth-of-type(3) { transition-delay: .15s; }
        .nasap-print-area.finished .nasap-branch:nth-of-type(4) { transition-delay: .2s; }
        #nasap-extruder-group { opacity: 0; will-change: transform; transition: none; }
        .nasap-print-area.printing #nasap-extruder-group { opacity: 1; }
        .nasap-print-area.finished #nasap-extruder-group { opacity: 1; transition: transform .6s cubic-bezier(.25,1,.5,1); transform: translate(0.91px,-0.76px); }
      `}</style>
    </div>
  );
}
