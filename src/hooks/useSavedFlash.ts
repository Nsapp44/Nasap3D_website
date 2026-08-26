import { useRef, useState } from "react";

// The "OK" -> "✓" (then back to "OK" after 2s) flash shown after saving a
// setting — the same pattern repeated 4 times in Admin.dc.html (hourly
// rate, min price, daily limit, per-material price), each with its own
// hand-rolled setTimeout. One small hook instead.
export function useSavedFlash() {
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash() {
    setSaved(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSaved(false), 2000);
  }

  return { saved, flash };
}
