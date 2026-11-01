// Liste des maquettes du carrousel (src/components/MaquetteCarousel.astro) : source unique.
// Pour retirer une maquette : enabled:false (ou supprimer l'entrée) + supprimer public/assets/maquettes/<id>/ — voir SUIVI.md
// `soon: true` = maquette « À venir » : slide générique, aucune image ni canvas, rien n'est chargé.
// `led: true` = charge aussi les calques rank/ et glow/ (chenille LED) ; sinon aucune requête vers ces dossiers.
export interface Maquette {
  id: string;
  title: string;
  caption: string;
  detail: string; // phrase d'accroche propre à la maquette, affichée sous le viewer
  parts?: { title: string; text: string }[]; // sections détaillées sous l'accroche
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
      "De l'idéation à la modélisation, de l'impression aux finitions, jusqu'à l'animation LED : chaque étape est conçue avec le client, pour que le résultat lui ressemble. Une maquette réalisée de A à Z dans notre atelier.",
    parts: [
      { title: "Impression 3D et peinture", text: "La coque verte est imprimée en 3D, puis apprêtée et peinte à la main. Tout le reste de la maquette est de l'impression 3D." },
      { title: "Assemblage", text: "Certaines parties sont imprimées d'une seule pièce, mais l'ensemble demande beaucoup d'assemblage : toutes les petites pièces noires sont imprimées à part, puis montées une à une." },
      { title: "Électronique et LED", text: "L'électronique est intégrée à l'intérieur de la maquette. Le code de la chenille LED est lui aussi géré selon la demande du client." },
    ],
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
      "De l'idéation à la modélisation, de l'impression aux finitions : chaque étape est conçue avec le client, pour que le résultat lui ressemble. Une maquette réalisée de A à Z dans notre atelier.",
    parts: [
      { title: "Impression 3D", text: "Le châssis et les connecteurs sont imprimés en 3D." },
      { title: "Composants sourcés", text: "La tuyauterie est faite de vrais tubes transparents en PVC, que nous avons sourcés. Nous avons aussi sourcé plusieurs petits éléments en métal, afin d'ajouter du réalisme et de la qualité à la maquette : les petites roulettes, par exemple, sont de vraies roulettes en métal, à l'origine destinées à des chariots de cuisine." },
      { title: "Détails de façade", text: "Les pièces métalliques sur la façade sont des presse-étoupes, détournés pour imiter les prises du modèle réel, avec leurs câbles noirs. L'impression 3D et les composants du commerce se mélangent pour un rendu crédible." },
    ],
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
      "De l'idéation à la modélisation, de l'impression aux finitions : chaque étape est conçue avec le client, pour que le résultat lui ressemble. Une maquette réalisée de A à Z dans notre atelier.",
    parts: [
      { title: "Impression 3D", text: "Toute la caravane est imprimée en 3D, pièce par pièce." },
      { title: "Plexiglas découpé", text: "Seules exceptions : les vitres noires et les feux orange. Ce sont des plexiglas que nous découpons puis ajoutons à la maquette, pour un rendu premium et réaliste." },
      { title: "Finitions", text: "Ponçage, assemblage et finitions soignées donnent à l'ensemble l'allure d'un vrai modèle de vitrine." },
    ],
    dir: "/assets/maquettes/caravane",
    elevs: [12, 28, 55],
    frames: 72,
    startEl: 1,
    posterAlt: "Maquette de caravane imprimée en 3D, aperçu avant chargement de la vue à 360°",
    enabled: true,
  },
];

export const MAQUETTES_ACTIVES = MAQUETTES.filter((m) => m.enabled);
