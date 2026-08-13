// Phone number formatting/validation, French-only for now but structured so
// adding another country later is just a new COUNTRIES entry (a country
// picker in the UI, plumbing the chosen code through instead of the
// hardcoded 'FR' default) — not a rework of the functions below.
//
// No external library: a full multi-country library (e.g. libphonenumber-js)
// would need vendoring like vendor/boxtal-parcel-point-map.js — not
// justified for a single country with a simple, fixed-length numbering
// plan. Revisit if/when a second country is actually added.

const COUNTRIES = {
  // French numbers: national trunk prefix "0" + 9 significant digits
  // (e.g. 06 11 22 33 44 → +33 6 11 22 33 44). Mobiles start 6/7, landlines
  // 1-5/9 — first significant digit is always 1-9, never 0.
  FR: { dialCode: '33', displayPrefix: '+33', nsnLength: 9 },
};

function significantDigits(raw, country) {
  const cfg = COUNTRIES[country];
  const digits = String(raw || '').replace(/\D/g, '');
  let national = digits;
  if (national.startsWith(cfg.dialCode)) national = national.slice(cfg.dialCode.length);
  else if (national.startsWith('0')) national = national.slice(1);
  return national.slice(0, cfg.nsnLength);
}

// Live "as you type" formatting for a controlled input — always recomputed
// from the raw digits in `raw`, so it stays correct through edits/deletes
// without tracking cursor position or previous state.
export function formatPhoneAsYouType(raw, country = 'FR') {
  const cfg = COUNTRIES[country];
  const national = significantDigits(raw, country);
  if (!national) return raw.trim() ? cfg.displayPrefix + ' ' : '';
  const rest = national.slice(1).match(/.{1,2}/g) || [];
  return [cfg.displayPrefix, national[0], ...rest].join(' ');
}

// True once there are exactly nsnLength significant digits and the first
// one is a valid leading digit (1-9, never 0 — that's just the trunk
// prefix, already stripped).
export function isValidPhone(raw, country = 'FR') {
  const cfg = COUNTRIES[country];
  const national = significantDigits(raw, country);
  return national.length === cfg.nsnLength && /^[1-9]/.test(national);
}

// "+33XXXXXXXXX", no spaces — what actually gets sent to the server.
// Verified for real against Boxtal's api/v1/order: it wants a leading "+"
// (rejects "0033...", accepts "+33..." with or without spaces) — see
// server/SHIPPING.md "Format de téléphone".
export function phoneDigits(raw, country = 'FR') {
  const cfg = COUNTRIES[country];
  return '+' + cfg.dialCode + significantDigits(raw, country);
}
