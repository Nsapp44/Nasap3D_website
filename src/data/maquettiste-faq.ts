// FAQ de /maquettiste-nantes : source unique du rendu <details> ET du JSON-LD FAQPage.
// Texte mot pour mot de docs/maquettes/page-maquettiste-nantes_2026-11-08.html (l.771-783).
export interface FaqItem {
  q: string;
  a: string; // texte brut
  html?: string; // version HTML (liens) si la réponse en contient
}

export const MAQUETTISTE_FAQ: FaqItem[] = [
  {
    q: "Pouvez-vous nous aider à concevoir la maquette à partir d'une simple idée ?",
    a: "Oui. Nous menons l'idéation et la conception avec vous : ce que la maquette doit montrer, l'échelle, les parties mobiles ou lumineuses, puis nous la modélisons en 3D et la fabriquons dans notre atelier à Nantes.",
  },
  {
    q: "Êtes-vous un maquettiste ou un service d'impression 3D ?",
    a: "Un maquettiste : l'impression 3D est l'un de nos outils, à côté de la découpe, du ponçage, de la peinture et de l'électronique. Notre métier, c'est la conception de la maquette (modélisation 3D, design produit, choix des finitions) jusqu'à sa livraison.",
  },
  {
    q: "Réalisez-vous des maquettes d'architecture, industrielles, commerciales, de design produit, pédagogiques ou scientifiques ?",
    a: "Oui : maquette d'architecture, maquette industrielle, commerciale et de salon (démonstration, présentation client), maquette de design produit, maquette pédagogique et scientifique. Chaque maquette est conçue sur mesure à partir de vos plans, fichiers, photos ou d'une simple idée.",
  },
  {
    q: "Quels matériaux et quelles finitions pour une maquette ?",
    a: "Nous choisissons la matière selon l'usage de la maquette (présentation, manipulation, démonstration). Ponçage, apprêt et peinture sont possibles selon le rendu attendu ; décrivez votre projet et nous vous conseillons dès l'étude de votre projet.",
  },
  {
    q: "Quelle échelle et quelles dimensions maximales ?",
    a: "L'échelle se choisit librement selon votre projet. Une pièce unique est limitée par le volume de nos machines ; au-delà, la maquette est découpée en plusieurs parties puis assemblée.",
  },
  {
    q: "Faut-il un fichier 3D pour commander une maquette ?",
    a: "Non. Avec des plans, des photos, des cotes ou même une simple description, nous pouvons modéliser la maquette nous-mêmes avant de la fabriquer.",
  },
  {
    q: "Quels sont les délais ?",
    a: "Les délais vont en général de 2 semaines à 3 mois… et parfois davantage : tout dépend du projet (complexité, quantité à produire), ce n'est qu'un ordre d'idée. Nous sommes très réactifs et ferons toujours au mieux pour tenir votre échéance : chaque projet est sur devis sur mesure, demandez-nous le vôtre en précisant votre échéance.",
  },
  {
    q: "Peut-on avoir une maquette peinte ou multicolore ?",
    a: "Oui. Une maquette peut être imprimée en plusieurs couleurs ou peinte après impression, par exemple pour distinguer les parties d'un modèle pédagogique.",
  },
  {
    q: "Livrez-vous les maquettes hors de Nantes ?",
    a: "Oui, partout en France et à l'international : nous expédions déjà dans le monde entier. Vous pouvez aussi retirer votre maquette à Nantes (Canclaux).",
  },
  {
    q: "Mon projet est confidentiel : signez-vous un accord de confidentialité ?",
    a: "Oui, sur demande nous signons un accord de confidentialité (NDA) avant que vous nous transmettiez plans et fichiers. Vos documents ne sont utilisés que pour votre maquette.",
  },
  {
    q: "La maquette peut-elle être démontable et transportable pour un salon ?",
    a: "Oui. Nous pouvons concevoir la maquette en plusieurs modules démontables, avec un emballage adapté, pour qu'elle voyage et se remonte facilement sur votre stand. Précisez-le dans votre demande.",
  },
  {
    q: "Fabriquez-vous aussi des objets ou des produits pour une marque ?",
    a: "Oui : objets et petits produits pour l'exposition, le marketing, le retail et les petites séries. Décrivez votre idée, même sans dessin, nous la rendons faisable et la fabriquons dans notre atelier à Nantes.",
  },
  {
    q: "Combien coûte une maquette sur mesure ?",
    a: "Chaque maquette est unique : le devis est sur mesure et gratuit, après étude de votre projet. Nous n'affichons pas de tarif public, car il dépend de la taille, du niveau de détail et des options (LED, pièces mobiles, finitions). Décrivez votre besoin, nous vous répondons rapidement.",
  },
];
