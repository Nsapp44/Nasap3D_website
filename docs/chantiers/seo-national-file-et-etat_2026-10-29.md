### File des demandes (ouvertes)
31. [x] Plan SEO national : exécuté en local (oui de Nolann 27/10), 4 commits locaux. **Reste : son test local puis son oui pour le push.**
32. [x] « Guides » qui touchait le logo : corrigé et vérifié (au moins 49 px d'écart de 1061 à 1440 px, 1280 et 1440 identiques à avant). **À montrer à Nolann.**
33. [x] Bloc « Un projet singulier ou original ? » (accueil) : capturé à 375/768/1024/1280/1440, propre. Plausible ne suit pas `/maquette-impression-3d` (à décider). **À montrer à Nolann.**
34. [x] Nantes + « international » : c'était un malentendu, il voulait dire national. Garde-fous Nantes inscrits dans le plan §9.
4/8/19. [~] Tunnel STL → panier + Plausible (migration locale faite).
7/20. [ ] Pages villes. 9. Bing. 9b. Hors site : `docs/plan_3dnatives_frenchtech_2026-10-27.md`. 11-16 : machines, Ads maquettage (`docs/ads_maquettage_2026-10-27.md`, aucune dépense sans OK).
Shop (non urgent) : questions de SEO-COMMUN.md ; prix d'exemple 14,10 € vs 23,75 € écrit en dur ; « humain » dans maquette L19/L39 et cgu L21.
10. Fin : Nolann teste en local, push sur son oui.
35. [x] (28/10, non commité) « Europe » retiré du texte public : « partout en France » (accueil, en-ligne, nantes, particuliers, prix, contact). **Gardés tels quels, à lui de trancher** : cgu.astro l.25 (UE), confidentialite.astro, panier (liste UE-27 réelle).
36. [x] (28/10, non commité) Carte `/contact` : bouton « Recentrer » (retour NASAP3D_COORDS, zoom 6, flyTo). Vérifié 1024 px sur build local 4457.
37. [x] (28/10, non commité) Burger mobile : « Guides » repliable avec chevron, fermé par défaut (ouvert si page guide). Desktop inchangé. Vérifié sur 4457 ; **reste : capture 375 px** à montrer.
38. [ ] « Fresque moche / textes juste posés » : probablement accueil (bandeau machines + blocs de texte), à confirmer par capture. Mettre H2C / X2D / X1C en avant « imprimantes à la pointe de la technologie ».
39. [ ] À propos : ajouter du contenu SEO (page indexée, trop vide). Proposition à valider avant d'écrire.
40. [x] (29/10) Admin vu par Nolann : session de test admin recréée en base locale (test-admin@nasap3d.local, jeton du cookie 4457, 2 jours), /admin affiche les 4 onglets + commandes multi-colis (N3D-1001/1003/1004 : 2 colis, cartons XL, poids).
41. [x] (29/10) Multi-colis/cartons présents dans la branche (da6eab8, ef300b5) et visibles dans l'admin.
42. [x] (29/10) « Recentrer aussi dans le formulaire de contact » : la carte est déjà à côté du formulaire sur /contact (même composant) ; sur l'accueil aussi (ContactMap h=300). Rien à ajouter sauf si autre sens voulu.
43. [ ] Audit « perte » : faits = 35, 36, 37 ; NON faits = 38 (fresque + Bambu), 39 (À propos, attend son oui), capture 375 du menu, décision cgu/confidentialité/panier « Europe ».
44. [x] (29/10) Admin : plein de commandes d'exemple en base locale (1 colis, 2 colis, retrait atelier, refusée, à expertiser) pour que Nolann voie le rendu ; Docker :3000 reconstruit (bouton Recentrer visible). FAIT : 9 commandes N3D-2001..2009 (à expertiser 1/2 colis + retrait, attente paiement relais, payée, impression 2 colis, prête retrait, livrée, refusée) ; voir http://localhost:3000/admin. À nettoyer avant mise en prod (base locale seulement, annoncer avant).
45. [ ] (29/10) Pré-rendus Blender des 2 nouvelles maquettes (machine de purification, caravane ; fichiers OBJ+MTL dans `Nasap3D website/Source machine`), même méthode que la cellule (tour 360° images, voir docs/SUIVI_archive_2026-10-25.md, `glb/render_tour.py`), puis intégration au site. Session dédiée proposée. Session lancée (29/10) : local_98da5be2. Contrainte : retrait en une opération (marques de tiers ; Nolann a signé des accords pour les modèles de départ, ici ce sont des remodélisations, donc a priori OK) ; nom du client hors dépôt public.

### État technique
- Aperçu local : `npx astro build`, puis la config `.claude/launch.json` « nasap-seo-4457 » (`node server-entry.mjs`, PORT 4457) → http://localhost:4457.
- **L'ancien serveur 4455 tourne encore** (PID 6788, dist de l'ancien worktree). L'arrêt a été refusé par le mode auto ; Nolann peut le fermer.
- Captures avant (live) / après (local) : `C:\Users\Nolann\AppData\Roaming\Claude\side-session-notes\local_d5887c7c-3fd7-4561-8901-2eaabdcc644f\captures-2026-10-27` (`entete__*`, `bloc__*`, `mesures.json`).
- Script de capture CDP : `caps/header.mjs` dans le scratchpad de l'ancienne session. La copie d'origine est dans `local_fd5f6327…\outils-captures\header.mjs`.

### Ce qui n'a pas marché et pourquoi
- `astro check` : manque de mémoire (exit 134).
- Dev local : l'hydratation casse via la jonction (403 `@fs`), donc on sert le dist construit.
- Docker Desktop : sockets périmés → renommer `%LOCALAPPDATA%\Docker\run` et `docker-secrets-engine` en `.stale-*`.
- Captures : attendre au moins 2 s (animations d'entrée) ; le menu Guides ouvert correspond à un survol.
- Titles de la note du 27/10 trop longs une fois comptés : version raccourcie, voir le plan §2.
- Boucle de compaction le 27/10 au soir : passation vers une nouvelle conversation.

