import { useEffect, useRef, useState } from "react";
import { renderHcaptcha, resetHcaptcha } from "../lib/hcaptcha-widget";
import { HCAPTCHA_SITE_KEY } from "../lib/api-client";

// Mounts a real hCaptcha checkbox widget into a ref'd container and tracks
// its current token — ported from the _mountCaptcha/_resetCaptcha pattern
// duplicated in each page's Component class (Account/Contact/Home). The
// <script src="https://js.hcaptcha.com/1/api.js?render=explicit"> tag is added
// on demand by renderHcaptcha() (hcaptcha-widget.ts) when this hook mounts,
// unless the page already carries it (compte.astro).
export function useHcaptcha() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    renderHcaptcha(containerRef.current, {
      sitekey: HCAPTCHA_SITE_KEY,
      onToken: (t) => !cancelled && setToken(t),
      onExpire: () => !cancelled && setToken(""),
    }).then((id) => {
      if (!cancelled) widgetIdRef.current = id;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reset() {
    await resetHcaptcha(widgetIdRef.current);
    setToken("");
  }

  return { containerRef, token, reset };
}
