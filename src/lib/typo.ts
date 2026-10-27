// Typographie française : espaces insécables avant ? ! ; : » après « et entre un nombre et son unité (affichage seulement, jamais JSON-LD/meta).
const UNITES = "€|%|°C|h|mm|cm|g|kg|min|j";
const RE_PONCT_FINE = / +(?=[?!;])/g;
const RE_DEUX_POINTS = / +:/g;
const RE_GUILLEMET_FERMANT = / +»/g;
const RE_GUILLEMET_OUVRANT = /« +/g;
const RE_NOMBRE_UNITE = new RegExp(`(\\d) (${UNITES})(?![\\p{L}\\p{N}])`, "gu");

export function fr(s: string): string {
  if (typeof s !== "string" || s === "") return s;
  return s
    .replace(RE_PONCT_FINE, " ")
    .replace(RE_DEUX_POINTS, " :")
    .replace(RE_GUILLEMET_FERMANT, " »")
    .replace(RE_GUILLEMET_OUVRANT, "« ")
    .replace(RE_NOMBRE_UNITE, "$1 $2");
}
