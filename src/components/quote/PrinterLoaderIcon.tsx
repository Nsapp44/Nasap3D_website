// The animated "printer laying filament" loader — shown while the 3D
// preview loads (step 1) and while the server analyzes the model (step 3).
// Ported 1:1 from the inline SVG duplicated at both call sites in Devis
// Instantane.dc.html; only the wrapping <div> size/color differs per site.
export default function PrinterLoaderIcon({ maskId }: { maskId: string }) {
  return (
    <svg viewBox="0 0 100 100" className="printer-loader-svg">
      <defs>
        <linearGradient id={`plFade-${maskId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="65%" stopColor="white" stopOpacity="1" />
          <stop offset="90%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`plMask-${maskId}`}>
          <rect x="0" y="0" width="100" height="100" fill={`url(#plFade-${maskId})`} />
        </mask>
      </defs>
      <g mask={`url(#plMask-${maskId})`}>
        <g className="stack">
          <path className="filament" d="M 75 105 L 25 105 A 5 5 0 0 1 25 95 L 75 95 A 5 5 0 0 0 75 85 L 25 85 A 5 5 0 0 1 25 75 L 75 75 A 5 5 0 0 0 75 65 L 25 65 A 5 5 0 0 1 25 55" />
          <path className="filament line-lr" d="M 25 55 L 75 55" />
          <path className="filament arc-r" d="M 75 55 A 5 5 0 0 0 75 45" />
          <path className="filament line-rl" d="M 75 45 L 25 45" />
          <path className="filament arc-l" d="M 25 45 A 5 5 0 0 1 25 35" />
        </g>
      </g>
      <g className="nozzle">
        <rect x="40" y="15" width="20" height="15" rx="1" />
        <line x1="38" y1="20" x2="62" y2="20" />
        <line x1="38" y1="25" x2="62" y2="25" />
        <polygon points="35,30 65,30 65,42 35,42" />
        <polygon points="35,42 65,42 53,55 47,55" />
      </g>
    </svg>
  );
}
