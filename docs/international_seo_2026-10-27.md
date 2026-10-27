# Recherche : international et protection de Nantes (27/10/2026)

> **Pas à l'ordre du jour.** Nolann, 27/10 : « national je voulais dire que France ». Le chantier reste France + Nantes. Cette note est gardée au cas où l'international reviendrait. Recherche faite par un agent : 17 recherches, ~12 pages lues, dates « Last updated » des pages Google.

## Utile tout de suite (garder Nantes)
- **Classement local** (Google Business, aide 7091) : pertinence, distance, notoriété. Ajouter du contenu national ne change pas la distance de la fiche Nantes (déduction).
- **Lien du pied de page vers `/impression-3d-nantes`** : selon Mueller (rapporté par SEJ), Google traite les liens du pied de page comme les autres. On le garde, ce qui ne pose aucun risque.
- **Profil Business** (aide 3038177) : nom réel et adresse réelle, un seul profil par lieu. Une entreprise qui ne reçoit pas de clients sur place doit masquer son adresse. Le retrait sur rendez-vous à l'atelier justifie l'adresse affichée, à confirmer par Nolann.
- **`areaServed` / `serviceArea`** dans le JSON-LD : valide pour schema.org, mais Google ne lui documente aucun effet (doc LocalBusiness, 2026-09-08). On le laisse tel quel.
- **Pas de séries de pages villes ou pays** (règle « doorway », 2026-08-28).

## Si l'international revient un jour
1. Une seule page en français « Livraison Belgique, Luxembourg » avec les vrais transporteurs, délais et prix (Mondial Relay point relais BE/LU : environ 9,50 € TTC pour un petit colis, d'après Packlink, page non datée). Environ 2 h de travail, sans risque. Pas besoin de hreflang pour une page unique. Le français seul ne suffit pas à cibler la Belgique : il faut des signaux locaux.
2. Search Console : rapport Performances, filtre par pays (BE, LU, CH), pour mesurer la demande avant d'investir.
3. Ads Belgique/Luxembourg : seulement en test séparé, ciblage « présence », après la page livraison.
4. Version `/en/` avec hreflang en dernier. C'est un gros chantier : devis, CGV, e-mails et support en anglais, et une traduction relue.
- Suisse : pays tiers pour la douane (facture commerciale, TVA suisse, DAP ou DDP). Elle n'est pas dans la liste des pays du panier aujourd'hui.
- Concurrents : seules les plateformes mondiales sont multilingues (Craftcloud, Hubs et Protolabs en sous-répertoires de langue). Abeille 3D est en français seulement, sans page ville ni pays.

## Sources principales
- Google : developers.google.com/search/docs/specialty/international/managing-multi-regional-sites et …/localized-versions (2026-09-21) ; …/essentials/spam-policies (2026-08-28) ; …/structured-data/local-business (2026-09-08).
- Google Business : support.google.com/business/answer/7091 et /3038177.
- Google Ads : support.google.com/google-ads/answer/1722038.
- Search Engine Journal : liens d'en-tête et de pied de page (/441993).
- Search Engine Land : retrait du ciblage international de la Search Console (/387477).
