import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

declare global {
  interface Window {
    intlTelInput?: (el: HTMLInputElement, opts: Record<string, unknown>) => IntlTelInputInstance;
  }
}
interface IntlTelInputInstance {
  destroy(): void;
  getNumber(format: string): string;
  setNumber(n: string): void;
  isValidNumber(): boolean;
}

export interface PhoneInputHandle {
  isValidNumber(): boolean;
  getNumber(): string;
}

// Uncontrolled <input>, driven entirely by the intl-tel-input widget (value/
// formatting/validation live in its own instance, not React state) — ported
// from Cart.dc.html's phoneInputRef/_syncPhoneWidget. Unlike the original
// (which had to defend against the whole page remounting this input on
// every setState — see that file's own comment), a React component mounts
// this input exactly once per logical "which delivery mode is active"
// instance, so the widget only needs a normal mount-time init and
// unmount-time destroy.
const PhoneInput = forwardRef<PhoneInputHandle, { onActivity?: () => void }>(function PhoneInput({ onActivity }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const itiRef = useRef<IntlTelInputInstance | null>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el || !window.intlTelInput) return;
    const iti = window.intlTelInput(el, { initialCountry: "fr", strictMode: true, separateDialCode: true });
    itiRef.current = iti;
    const handleActivity = () => onActivity?.();
    el.addEventListener("input", handleActivity);
    el.addEventListener("countrychange", handleActivity);
    return () => {
      el.removeEventListener("input", handleActivity);
      el.removeEventListener("countrychange", handleActivity);
      iti.destroy();
      itiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- widget is mounted once per PhoneInput instance, onActivity identity isn't a re-init trigger
  }, []);

  useImperativeHandle(ref, () => ({
    isValidNumber: () => itiRef.current?.isValidNumber() ?? false,
    getNumber: () => itiRef.current?.getNumber("E164") ?? "",
  }));

  return <input ref={inputRef} type="tel" placeholder="Téléphone" />;
});

export default PhoneInput;
