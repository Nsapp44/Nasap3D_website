// Plausible custom events (script served through our own /m/s.js proxy).
// No-op when the script is absent (dev, ad blocker, not loaded yet) — tracking
// must never be able to break the page.
type PlausibleFn = (name: string, opts?: { props?: Record<string, string | number> }) => void;

export function trackEvent(name: string, props?: Record<string, string | number>) {
  try {
    (window as unknown as { plausible?: PlausibleFn }).plausible?.(name, props ? { props } : undefined);
  } catch {
    /* analytics only */
  }
}
