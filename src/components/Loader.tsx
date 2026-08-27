// Shared spinner (ContactForm's file-upload rows/send button, AuthPanel's
// submit button) — a plain CSS border-spin, deliberately not another
// PrinterLoaderIcon: those two spots are short, generic waits (an upload,
// an API round-trip), not the print-themed loading moments PrinterLoaderIcon
// is for elsewhere (quote analysis, page transitions).
export default function Loader({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <span
      className="css-loader"
      style={{ width: size, borderWidth: Math.max(2, Math.round(size / 6.25)), color }}
    />
  );
}
