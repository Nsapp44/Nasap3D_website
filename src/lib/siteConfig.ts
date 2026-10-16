// Textes réutilisés sur plusieurs pages — une seule source pour que délai,
// formats et prix plancher ne divergent plus entre meta, FAQ et pages locales.

// Les prix « à partir de » affichés viennent de l'admin (table Settings) via
// src/lib/server/publicPricing.ts : source de vérité = l'admin.
// Ces deux constantes ne sont plus utilisées par les pages (valeurs de secours seulement).
export const PRIX_PLANCHER_AFFICHE = "8,90 €";
export const PRIX_PLANCHER_PRECISION = "petite pièce en PLA — prix exact calculé sur votre fichier";

// Formats réellement acceptés par le devis instantané (ALLOWED_EXT dans
// useQuoteWizard.ts et api/quotes/index.ts).
export const FORMATS_DEVIS = "STL, OBJ et 3MF";

export const DELAI_DEVIS = "prix calculé sur votre fichier en quelques minutes";
