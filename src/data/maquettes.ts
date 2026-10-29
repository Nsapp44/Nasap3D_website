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
    detail: "Ici, la coque verte est peinte et l'intérieur est imprimé en couleur.",
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
    detail: "Châssis, tuyauterie et connecteurs imprimés en 3D, tubes transparents en PVC, petites roulettes réelles.",
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
    detail: "Carrosserie imprimée en 3D ; vitres et feux en plexiglas, roues réelles.",
    dir: "/assets/maquettes/caravane",
    elevs: [12, 28, 55],
    frames: 72,
    startEl: 1,
    posterAlt: "Maquette de caravane imprimée en 3D, aperçu avant chargement de la vue à 360°",
    enabled: true,
  },
];

export const MAQUETTES_ACTIVES = MAQUETTES.filter((m) => m.enabled);
