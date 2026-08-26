// Real Google reviews, hardcoded — the live Google Places API integration
// (GET /google-rating) was removed: it capped at 4-5 reviews per call (a
// Places API limitation, not a bug) and the result wasn't worth the
// server-side API key/quota upkeep for a rating that barely moves. Pulled
// by hand from the actual Google Business listing (screenshots + one final
// live API response, both captured the same day) — every review below is
// real, none invented. Update by hand if new reviews come in; there is no
// automatic refresh anymore.
export interface Review {
  author: string;
  rating: number;
  text: string;
}

export const RATING = 5;

export const REVIEWS: Review[] = [
  { author: "guillaume robert", rating: 5, text: "Nickel piece qui s'installe en lieu et place communication impecable je recommande fortement pour toutes vos pieces plastiques du quotidien" },
  { author: "Kevin Attm", rating: 5, text: "Réparation de l'arceau de mon casque audio impeccable! Nolann a même renforcé la pièce pour une meilleure résistance.\nMerci !" },
  { author: "Franck MORODEI", rating: 5, text: "Pièce répliquée en parfaite cohérence avec l'ancienne et remontée à la perfection.\nBravo et merci pour ce sauvetage de dernière minute 👌" },
  { author: "Marie Christine Clair", rating: 5, text: "Pour la 2 ème fois en 2 ans, merci encore pour votre implication. Communication facile, délai rapide et travail parfait. Je recommande à tout point de vue." },
  { author: "Jean Tramalloni", rating: 5, text: "Parfaite réalisation d'une pièce complexe pour l'aéronautique de loisir. Délai tenu et prix raisonnable. Je recommande vivement cette entreprise" },
  { author: "Sarah lançon", rating: 5, text: "Nolann a su reproduire parfaitement 2 pièces à l'identique. La communication a été facile et les délais rapides et respectés. Je recommande !" },
  { author: "Valentine Sauda", rating: 5, text: "J'ai A-DO-RÉ bosser avec Nollan ! Je lui ai commandé 200 gants de boxe roses et le résultat est impeccable, la communication très fluide. C'est un sacré professionnel et qui plus est très efficace ! Vous pouvez bosser avec lui les yeux fermés 👊" },
  { author: "Yanis Mikhaïloff", rating: 5, text: "Travail fiable et rapide. Communication au top." },
  { author: "Guy André", rating: 5, text: "merci à nolann pour la fabrication à l'identique d'un engrenage d'une scie à onglet que la société métabo ne fabriquait plus" },
  { author: "Axel Boudet", rating: 5, text: "Bonne communication !\nSuper finition sur des figurines détaillées et fragiles.\nPrix très abordable." },
  { author: "LE LONDRES Direction", rating: 5, text: "Un service au top, excellent contact et produit fini totalement conforme au projet. Il m'a même été livré à l'hôtel à cause de son encombrement et parce que la patron passait par Saumur. Vraiment adorable." },
  { author: "Steeve Barber", rating: 5, text: "Grâce à eux, j'ai pu vraiment faire avancer mon projet de marque. Leur accompagnement sur les pièces 3D ou stikers m'a permis de structurer mes idées, d'y voir plus clair et de passer à l'action avec confiance. Je recommande à 100 % !" },
  { author: "Veronique Le senechal", rating: 5, text: "Merci beaucoup à Nolann qui a ete très réactif à notre demande de petite pièce de salle de bain que l'on ne trouvait plus du tout en magasin et qu'il nous a refait à l'identique. Je garde son adresse en mémoire au cas où..." },
];
