// Textes réutilisés sur plusieurs pages — une seule source pour que délai,
// formats et prix plancher ne divergent plus entre meta, FAQ et pages locales.

// Reflète le prix plancher par pièce réglé dans l'admin (minUnitPriceCents,
// 8,90 € par défaut — voir PRICING.md). Affichage seulement : le prix réel
// vient toujours du serveur. À mettre à jour si le réglage admin change.
export const PRIX_PLANCHER_AFFICHE = "8,90 €";
export const PRIX_PLANCHER_PRECISION = "petite pièce en PLA — prix exact calculé sur votre fichier";

// Formats réellement acceptés par le devis instantané (ALLOWED_EXT dans
// useQuoteWizard.ts et api/quotes/index.ts).
export const FORMATS_DEVIS = "STL, OBJ et 3MF";

export const DELAI_DEVIS = "prix calculé sur votre fichier en quelques minutes";
