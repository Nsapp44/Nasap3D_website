// Données du carrousel de projets (/maquettiste-nantes) et des fiches /realisations/<slug>.
// Texte mot pour mot de docs/maquettes/page-maquettiste-nantes_2026-11-08.html (PJ:DATA l.927-964 + <article class="pc"> l.703-756).
export type Photo = [src: string, w: number, h: number, alt: string]; // src "/assets/real-1.webp" ou "spin:<dir>"

export interface Realisation {
  slug: string;
  title: string;
  cat: string;
  f: string; // data-f
  text: string; // .pc-text
  full: string[]; // paragraphes .pc-full
  photos: Photo[]; // ordre = zoom ; [0] = image de carte
  fiche: boolean; // drapeau pj-fiches
  page?: {
    h1: string;
    title: string;
    description: string;
    chapo: string;
    sections: { h2: string; html: string }[];
    specs: { k: string; v: string }[];
    related: string[];
    ogImage?: string;
    dateCreated?: string;
  };
}

export const REALISATIONS: Realisation[] = [
  {
    slug: "systeme-filtration-purification",
    title: "Système de filtration et de purification",
    cat: "Industrie et salon",
    f: "industrie",
    text: "Équipement de procédé biotechnologique reproduit à l'échelle : châssis imprimé, vraie tuyauterie transparente, roulettes et presse-étoupes en métal. Panneau fluidique, vannes et tubulures fonctionnels à l'échelle.",
    full: [
      "Équipement de procédé biotechnologique reproduit à l'échelle : châssis imprimé, vraie tuyauterie transparente, roulettes et presse-étoupes en métal.",
      "Panneau fluidique, vannes et tubulures fonctionnels à l'échelle ; manomètres et vannes imprimés.",
    ],
    photos: [
      ["/assets/real-1.webp", 896, 1195, "Système de filtration et de purification : équipement de procédé biotechnologique, châssis imprimé, vraie tuyauterie transparente, roulettes et presse-étoupes en métal"],
      ["/assets/real-2.webp", 896, 1195, "Maquette d'équipement de procédé avec pompe et tuyauterie"],
      ["/assets/real-3.webp", 896, 1195, "Vue 3/4 : châssis, tubulures et raccords fonctionnels à l'échelle"],
      ["/assets/real-11.webp", 896, 1195, "Bloc fluidique : manomètres et vannes imprimés"],
      ["spin:purification", 1600, 1200, "Maquette du système de purification en 3D"],
    ],
    fiche: true,
    page: {
      // BROUILLON à valider par Nolann
      h1: "Maquette d'un système de filtration et de purification",
      title: "Maquette de système de filtration | Nasap3D Nantes",
      description:
        "Maquette d'un équipement de procédé biotechnologique : châssis imprimé en 3D, vraie tuyauterie transparente, composants en métal. Atelier à Nantes.",
      chapo:
        "Un équipement de procédé biotechnologique reproduit à l'échelle, pour la présentation et le salon : un châssis imprimé en 3D, de la vraie tuyauterie transparente et des composants métalliques, assemblés dans notre atelier à Nantes.",
      sections: [
        {
          h2: "Le besoin",
          html: "<p>Il s'agissait de montrer un équipement de procédé biotechnologique sans avoir à le déplacer : une maquette fidèle, reproduite à l'échelle, qui rende crédible le fonctionnement de l'installation. Un projet typique de maquette industrielle pour le salon et la présentation.</p>",
        },
        {
          h2: "Comment on l'a fabriqué",
          html: "<p>Le châssis et les connecteurs sont imprimés en 3D. La tuyauterie est faite de vrais tubes transparents en PVC, que nous avons sourcés. Nous avons aussi sourcé plusieurs petits éléments en métal pour ajouter du réalisme : les petites roulettes sont de vraies roulettes en métal, à l'origine destinées à des chariots de cuisine.</p><p>Les pièces métalliques sur la façade sont des presse-étoupes, détournés pour imiter les prises du modèle réel, avec leurs câbles noirs. Le panneau fluidique, les vannes et les tubulures sont fonctionnels à l'échelle ; les manomètres et les vannes sont imprimés. L'impression 3D et les composants du commerce se mélangent pour un rendu crédible.</p>",
        },
        {
          h2: "Ce que ça apporte",
          html: "<p>Une maquette qui se montre, se manipule et se transporte, là où l'équipement réel ne le permet pas. Chaque projet démarre par une expertise de votre besoin, puis un devis sur mesure : décrivez-nous votre équipement, même à partir de plans, de photos ou d'une simple idée.</p>",
        },
      ],
      specs: [
        { k: "Type", v: "Maquette industrielle et de salon" },
        { k: "Châssis et connecteurs", v: "Imprimés en 3D" },
        { k: "Tuyauterie", v: "Tubes transparents en PVC sourcés" },
        { k: "Éléments métalliques", v: "Roulettes en métal, presse-étoupes" },
        { k: "Atelier", v: "Nantes" },
      ],
      related: ["maquette-bioreacteur", "maquette-caravane"],
      ogImage: "/assets/real-1.webp",
    },
  },
  {
    slug: "maquette-bioreacteur",
    title: "Maquette de bioréacteur",
    cat: "Industrie et salon",
    f: "industrie",
    text: "Reproduction détaillée d'une cuve en inox, de ses tubulures et raccords. Bloc de vannes, leviers et manomètres imprimés à l'échelle, avec stickers intégrés.",
    full: [
      "Reproduction détaillée d'une cuve en inox, de ses tubulures et raccords.",
      "Bloc de vannes, leviers et manomètres imprimés à l'échelle, avec stickers intégrés.",
    ],
    photos: [
      ["/assets/real-19.webp", 896, 1195, "Maquette de bioréacteur en inox imprimée en 3D"],
      ["/assets/real-20.webp", 896, 1195, "Maquette de bioréacteur, vue de dessus"],
      ["/assets/real-21.webp", 896, 1195, "Détail de vannes, leviers et manomètres à l'échelle"],
    ],
    fiche: true,
    page: {
      // BROUILLON à valider par Nolann
      h1: "Maquette de bioréacteur en inox imprimée en 3D",
      title: "Maquette de bioréacteur imprimée en 3D | Nasap3D Nantes",
      description:
        "Maquette de bioréacteur : reproduction détaillée d'une cuve en inox, de ses tubulures et raccords, vannes et manomètres imprimés à l'échelle.",
      chapo:
        "La reproduction détaillée d'une cuve de bioréacteur en inox, de ses tubulures et de ses raccords, imprimée en 3D à l'échelle dans notre atelier à Nantes.",
      sections: [
        {
          h2: "Le besoin",
          html: "<p>Présenter un bioréacteur sans l'équipement réel : une maquette industrielle fidèle, pensée pour la démonstration et le salon, qui reprenne la cuve, ses tubulures et ses raccords avec précision.</p>",
        },
        {
          h2: "Comment on l'a fabriqué",
          html: "<p>La cuve en inox, ses tubulures et ses raccords sont reproduits en détail et imprimés en 3D. Le bloc de vannes, les leviers et les manomètres sont imprimés à l'échelle, avec des stickers intégrés pour retrouver l'aspect de l'équipement réel.</p><p>Chaque détail est modélisé par nos soins avant la fabrication : l'impression 3D n'est qu'un outil au service d'une maquette fidèle.</p>",
        },
        {
          h2: "Ce que ça apporte",
          html: "<p>Une maquette détaillée, lisible de près comme de loin, qui rend l'équipement compréhensible lors d'une présentation. Chaque projet commence par l'expertise de votre besoin, puis un devis sur mesure : décrivez-nous votre équipement, même sans fichier 3D.</p>",
        },
      ],
      specs: [
        { k: "Type", v: "Maquette industrielle et de salon" },
        { k: "Reproduction", v: "Cuve en inox, tubulures et raccords" },
        { k: "Détails", v: "Vannes, leviers et manomètres imprimés à l'échelle, stickers intégrés" },
        { k: "Atelier", v: "Nantes" },
      ],
      related: ["systeme-filtration-purification", "maquette-cellule-biologique"],
      ogImage: "/assets/real-19.webp",
    },
  },
  {
    slug: "maquette-cellule-biologique",
    title: "Cellule biologique en coupe",
    cat: "Pédagogie",
    f: "pedagogie",
    text: "Maquette pédagogique en coupe : coque imprimée puis peinte à la main, organites en pièces multicolores.",
    full: [
      "Maquette pédagogique en coupe : coque imprimée puis peinte à la main, organites en pièces multicolores.",
    ],
    photos: [
      ["/assets/real-8.webp", 589, 643, "Cellule biologique : maquette pédagogique en coupe, coque imprimée puis peinte à la main"],
      ["/assets/real-9.webp", 595, 587, "Maquette de cellule, vue de trois quarts"],
      ["spin:cellule", 1600, 1200, "Maquette de cellule en 3D"],
    ],
    fiche: true,
    page: {
      // BROUILLON à valider par Nolann
      h1: "Maquette pédagogique d'une cellule biologique en coupe",
      title: "Maquette de cellule biologique en coupe | Nasap3D Nantes",
      description:
        "Maquette pédagogique de cellule en coupe : coque imprimée en 3D puis peinte à la main, organites multicolores, électronique et LED intégrées.",
      chapo:
        "Une cellule biologique en coupe pour l'enseignement et la démonstration : coque imprimée en 3D puis peinte à la main, organites en pièces multicolores.",
      sections: [
        {
          h2: "Le besoin",
          html: "<p>Rendre une cellule compréhensible d'un coup d'œil : une maquette pédagogique en coupe, qui montre l'intérieur de la cellule et permet de distinguer chaque organite.</p>",
        },
        {
          h2: "Comment on l'a fabriqué",
          html: "<p>La coque verte est imprimée en 3D, puis apprêtée et peinte à la main. Tout le reste de la maquette est de l'impression 3D. Les organites sont des pièces multicolores : toutes les petites pièces blanches sont imprimées à part, puis montées une à une, ce qui demande beaucoup d'assemblage.</p><p>L'électronique est intégrée à l'intérieur de la maquette. Le code de la chenille LED est lui aussi géré selon la demande du client.</p>",
        },
        {
          h2: "Ce que ça apporte",
          html: "<p>Un support concret pour expliquer la structure d'une cellule, à manipuler et à regarder sous tous les angles. Chaque projet commence par l'expertise de votre besoin, puis un devis sur mesure : décrivez-nous ce que la maquette doit montrer.</p>",
        },
      ],
      specs: [
        { k: "Type", v: "Maquette pédagogique et scientifique" },
        { k: "Coque", v: "Imprimée en 3D, apprêtée et peinte à la main" },
        { k: "Organites", v: "Pièces multicolores imprimées à part et assemblées" },
        { k: "Électronique", v: "Intégrée, chenille LED" },
        { k: "Atelier", v: "Nantes" },
      ],
      related: ["maquette-bioreacteur", "systeme-filtration-purification"],
      ogImage: "/assets/real-8.webp",
    },
  },
  {
    slug: "maquette-caravane",
    title: "Caravane de présentation",
    cat: "Vitrine",
    f: "vitrine",
    text: "Maquette de vitrine pour le secteur du loisir : carrosserie imprimée en plusieurs couleurs dans la masse, vitres et feux en plexiglas. Série de modèles réduits imprimés et détaillés.",
    full: [
      "Maquette de vitrine pour le secteur du loisir : carrosserie imprimée en plusieurs couleurs dans la masse, vitres et feux en plexiglas.",
      "Série de modèles réduits imprimés et détaillés.",
    ],
    photos: [
      ["/assets/real-5.webp", 1200, 1600, "Caravanes de présentation miniatures imprimées en 3D, série de modèles réduits (illustration)"],
      ["spin:caravane", 1600, 1200, "Caravane de présentation en 3D"],
    ],
    fiche: true,
    page: {
      // BROUILLON à valider par Nolann (d'après fiche-projet-caravane_brouillon_2026-11-08.md)
      h1: "Maquette de caravane pour salon, conçue et produite de A à Z",
      title: "Maquette de caravane pour salon | Nasap3D Nantes",
      description:
        "Maquette de caravane pour salon : modélisation, impression 3D multicolore, plexiglas découpé et finitions, conçue de A à Z dans notre atelier à Nantes.",
      chapo:
        "Une concession allemande devait présenter ses caravanes sur un salon. Nasap3D a pris le projet en main, de la modélisation à la livraison.",
      sections: [
        {
          h2: "Le besoin",
          html: "<p>Une concession allemande devait présenter ses caravanes sur un salon. Personne ne proposait de maquettes avec le niveau de détail et la qualité attendus. Nasap3D a pris le projet en main, de la modélisation à la livraison : modélisation, petits détails en plexiglas, contrôle total, validations et échanges avec le client.</p>",
        },
        {
          h2: "Comment on l'a fabriqué",
          html: "<p><strong>De l'image au modèle imprimable.</strong> Nous partons des images ou des fichiers 3D du client quand il en a. Mais une caravane réduite à l'échelle ne s'imprime pas telle quelle : parois trop fines, détails fragiles, assemblages impossibles. Nous réinterprétons chaque pièce pour qu'elle reste fidèle à l'originale tout en étant imprimable et solide. C'est le cœur de notre savoir-faire.</p><p><strong>Les détails qui font la différence.</strong> Toute la caravane est imprimée en 3D, pièce par pièce. Nos machines impriment plusieurs couleurs dans la masse : les détails noirs de la carrosserie blanche sont imprimés directement en bicolore, sans peinture. Seules exceptions : les vitres noires et les feux orange, des plexiglas que nous découpons puis ajoutons à la maquette. Ponçage, assemblage et finitions soignées donnent l'allure d'un vrai modèle de vitrine.</p>",
        },
        {
          h2: "Ce que ça apporte",
          html: "<p>Après validation, la maquette a été reproduite en série : près d'une centaine de caravanes produites à ce jour. Chaque projet commence par l'expertise de votre besoin, puis un devis sur mesure.</p>",
        },
      ],
      specs: [
        { k: "Type", v: "Maquette de vitrine et de salon" },
        { k: "Carrosserie", v: "Imprimée en plusieurs couleurs dans la masse" },
        { k: "Vitres et feux", v: "Plexiglas découpé" },
        { k: "Production", v: "Près d'une centaine de caravanes produites" },
        { k: "Atelier", v: "Nantes" },
      ],
      related: ["systeme-filtration-purification", "maquettes-design-produit"],
      ogImage: "/assets/real-5.webp",
    },
  },
  {
    slug: "maquettes-design-produit",
    title: "Maquettes de design produit",
    cat: "Design et prototype",
    f: "design",
    text: "Maquettes de design produit réalisées pour une présentation.",
    full: ["Maquettes de design produit réalisées pour une présentation."],
    photos: [
      ["/assets/real-17.webp", 824, 1099, "Maquettes de design produit"],
    ],
    fiche: false,
  },
];
