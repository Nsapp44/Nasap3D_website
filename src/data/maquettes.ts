// Liste des maquettes du carrousel (src/components/MaquetteCarousel.astro) : source unique.
// Pour retirer une maquette : enabled:false (ou supprimer l'entrée) + supprimer public/assets/maquettes/<id>/ — voir SUIVI.md
// `soon: true` = maquette « À venir » : slide générique, aucune image ni canvas, rien n'est chargé.
// `led: true` = charge aussi les calques rank/ et glow/ (chenille LED) ; sinon aucune requête vers ces dossiers.
export interface Maquette {
  id: string;
  title: string;
  caption: string;
  detail: string; // phrase propre à la maquette, affichée sous le viewer
  dir?: string; // dossier des images pré-rendues
  elevs?: number[]; // élévations disponibles (degrés), du plus bas au plus haut
  frames?: number; // nombre d'azimuts (un tour complet)
  startEl?: number; // index d'élévation de départ
  posterWebp?: string; // image statique : aperçu avant chargement et repli (défaut : sm/ de l'élévation de départ)
  posterAlt?: string;
  soon?: boolean;
  enabled: boolean; // false = retirée du carrousel
  led?: boolean; // couche LED (rank/glow)
}

export const MAQUETTES: Maquette[] = [
  {
    id: "cellule",
    title: "Maquette cellule",
    caption: "Modèle pédagogique en coupe",
    detail:
      "La coque verte est imprimée en 3D, puis apprêtée et peinte à la main ; tout le reste de la maquette est de l'impression 3D. Certaines parties sont imprimées d'une seule pièce, mais l'ensemble demande beaucoup d'assemblage : toutes les petites pièces noires sont imprimées à part, et l'électronique est intégrée à l'intérieur. Le code de la chenille LED est écrit par NASAP. L'idéation et l'animation ont été conçues en collaboration avec le client, pour que le résultat lui ressemble.",
    dir: "/assets/maquettes/cellule",
    elevs: [12, 28, 55],
    frames: 72,
    startEl: 1,
    posterWebp: "/assets/real-8.webp",
    posterAlt: "Maquette de cellule en coupe, aperçu avant chargement de la vue à 360°",
    enabled: true,
    led: true,
  },
  {
    id: "purification",
    title: "Maquette de système de purification",
    caption: "Pièce d'ingénierie imprimée en 3D",
    detail:
      "Le châssis et les connecteurs sont imprimés en 3D. La tuyauterie, elle, est faite de vrais tubes transparents en PVC, que nous avons sourcés. Plusieurs petits éléments en métal ajoutent à la qualité de la maquette : les petites roulettes sont de vraies roulettes en métal, normalement destinées à des chariots de cuisine, et les pièces métalliques sur la façade sont des presse-étoupes, détournés pour imiter les prises du modèle réel, avec leurs câbles noirs. Un projet d'ingénierie où l'on mélange impression 3D et composants du commerce pour un rendu crédible.",
    dir: "/assets/maquettes/purification",
    elevs: [12, 28, 55],
    frames: 72,
    startEl: 1,
    posterAlt: "Maquette d'un système de purification imprimée en 3D, aperçu avant chargement de la vue à 360°",
    enabled: true,
  },
  {
    id: "caravane",
    title: "Maquette de caravane",
    caption: "Carrosserie imprimée en 3D",
    detail:
      "Toute la caravane est imprimée en 3D, pièce par pièce, à l'exception des vitres noires et des feux orange : ce sont des plexiglas que nous découpons puis ajoutons à la maquette, pour un rendu premium et réaliste. Ponçage, assemblage et finitions soignées donnent à l'ensemble l'allure d'un vrai modèle de vitrine.",
    dir: "/assets/maquettes/caravane",
    elevs: [12, 28, 55],
    frames: 72,
    startEl: 1,
    posterAlt: "Maquette de caravane imprimée en 3D, aperçu avant chargement de la vue à 360°",
    enabled: true,
  },
];

export const MAQUETTES_ACTIVES = MAQUETTES.filter((m) => m.enabled);
