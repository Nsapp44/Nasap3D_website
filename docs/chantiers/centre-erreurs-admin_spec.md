# Centre d'erreurs admin (demande 65) : spec

Statut : proposé par `architecte` le 02/11/2026, **à valider par Nolann** avec la maquette
`docs/chantiers/centre-erreurs-admin_maquette.html`. Aucun code écrit.

## 1. Décision : source hybride
Les erreurs sont de deux natures, on ne les traite pas pareil :
- **Dérivées** (calculées à chaque GET, rien en base) : l'état de la commande suffit et l'alerte disparaît d'elle-même
  quand c'est réglé. Pas de bouton « ignorer ».
- **Enregistrées** (table `AdminAlert`) : des événements dont la trace n'existe que dans un `catch` (refus Boxtal, Boxtal
  injoignable, anomalie Stripe, e-mail non parti). Sans table, ils sont perdus.

Options écartées : tout dérivé (perd le refus Boxtal et l'anomalie Stripe, qui ne modifient pas la commande) ; tout en
base (doublons et alertes périmées à nettoyer pour des cas que l'état dit déjà) ; e-mail seul (c'est l'existant, Nolann
veut voir dans l'admin).

| Type (`kind`) | Source | Gravité | Condition / point d'accroche | Résolution |
|---|---|---|---|---|
| `LABEL_REFUSED` | base | critique | `catch BoxtalApiError` de `POST shipping-label.ts` | auto : `boxtalOrderRef` ou `labelManualAt` posé |
| `TRACKING_UNREACHABLE` | base | attention | `catch` de `refreshOrderTrackingStatus` (aujourd'hui avalé, retourne null) | auto : prochain appel réussi. Réseau/5xx → clé `TRACKING_UNREACHABLE:global` (UNE carte « N commandes non vérifiées ») ; 4xx/`doc.error` → clé par commande |
| `PAYMENT_ANOMALY` | base | critique | dans `notifyAdminPaymentAnomaly()` (4 appels, `stripePayment.ts`) | manuelle (« Traité ») |
| `EMAIL_FAILED` | base | attention | `catch` des `send*`/`notify*` de `orderEmails.ts` | manuelle |
| `BOXTAL_NOT_CONFIGURED` | dérivé | critique | `boxtalConfigMissing()` : variables `BOXTAL_*` absentes (sans appel réseau) | le .env est corrigé |
| `ADDRESS_INCOMPLETE` | dérivé | critique | PENDING/PRINTING, HOME/RELAY, sans `boxtalOrderRef`/`labelManualAt`/`trackingNumber`, champ destinataire manquant | données complètes ou étiquette faite |
| `RELAY_MISSING` | dérivé | critique | RELAY et `relayPointCode` nul, mêmes exclusions | idem |
| `BOX_STOCK_EMPTY` | dérivé | attention, critique si une commande ouverte en a besoin | `ShippingBoxStock.qty = 0` : UNE alerte groupée « S, XL » | stock > 0 |
| `INVOICE_MISSING` | dérivé | critique | statut PENDING..DELIVERED (DELIVERED lu pour ce type seulement) et pas d'`invoice` | facture créée |
| `WEIGHT_ONLY_QUOTE` | dérivé | critique | `shippingOversized = true`, pas de `trackingNumber`, pas DELIVERED/REJECTED | étiquette (Boxtal ou main) |

`shippingOversized` (champ existant, « toujours false désormais ») redevient le marqueur « colis non rangé, devis au poids
seul ». Pas de migration pour ça.

## 2. Modèle Prisma (migration `prisma migrate dev --name admin_alerts`)
```prisma
enum AdminAlertKind { LABEL_REFUSED TRACKING_UNREACHABLE PAYMENT_ANOMALY EMAIL_FAILED }
model AdminAlert {
  id          String         @id @default(cuid())
  kind        AdminAlertKind
  key         String         @unique   // `${kind}:${orderId ?? "global"}` (+ `:${stripeRef}` pour PAYMENT_ANOMALY)
  orderId     String?
  order       Order?         @relation(fields: [orderId], references: [id], onDelete: SetNull)
  orderRef    String?        // copie, reste lisible si la commande est supprimée
  message     String         // phrase claire en français, jamais de XML ni de JSON
  detail      String?        // raison courte (≤ 200 car., nettoyée), affichée en petit
  count       Int            @default(1)
  firstSeenAt DateTime       @default(now())
  lastSeenAt  DateTime       @default(now())
  resolvedAt  DateTime?
  resolvedBy  String?        // "auto" | "admin"
  @@index([resolvedAt])
}
```
Ajouter `alerts AdminAlert[]` sur `Order` et **`labelManualAt DateTime?`** sur `Order` (étiquette faite à la main).
Pourquoi `key` unique et pas `@@unique([kind, orderId])` : Postgres accepte plusieurs NULL, les alertes globales se
dupliqueraient. Réapparition d'une alerte résolue = `upsert` qui remet `resolvedAt = null` et fait `count + 1`.
Purge : alertes résolues depuis plus de 30 jours supprimées dans le sweep existant (`src/middleware.ts`).

## 3. Code serveur
- `src/lib/server/adminAlerts.ts` (nouveau) :
  - `recordAlert({kind, orderId?, orderRef?, message, detail?, keySuffix?})` : upsert, **ne lève jamais**
    (try/catch + `console.error`) pour ne pas casser le flux qui l'appelle.
  - `resolveAlerts(kind, orderId)` : pose `resolvedAt`, `resolvedBy: "auto"`.
  - `deriveAlerts(orders, boxStock, configMissing): AlertDTO[]` : **fonction pure** (testable sans base).
  - `shortBoxtalReason(err): string` : pure, voir §5.
- `src/lib/server/shippingChecks.ts` (nouveau) : `missingShippingFields(order): string[]`, utilisé par
  `shipping-label.ts` (remplace le gros `if`) ET par `deriveAlerts` : une seule source de vérité. Les champs destinataire
  donnent la phrase « il manque le téléphone et… » ; les champs techniques (transporteur, service, dimensions) donnent
  « données d'expédition manquantes, à vérifier ».
- `boxtal.ts` : `BoxtalApiError` reçoit un 2e argument optionnel `shortReason`. Aux 3 `if (doc?.error)` : prendre
  `doc.error.message` (texte, balises retirées, ≤ 160 car.) ; HTTP non 2xx : « Boxtal a répondu HTTP 4xx/5xx » ;
  réseau/délai : « Boxtal ne répond pas ». **Forme exacte de `doc.error` à vérifier sur une vraie réponse** (supposée
  `{code, message}`), sinon repli générique. Le message brut reste dans `console.error` seulement.
  Ajouter `boxtalConfigMissing(): string[]` (noms des variables absentes, aucun appel réseau).
- `shipping-label.ts` POST : dans le catch `BoxtalApiError` → `recordAlert(LABEL_REFUSED, …)` ; renvoyer
  `reason: shortReason` (plus jamais `err.message`, qui contient le XML). Succès → `resolveAlerts(LABEL_REFUSED)`.
  Nouveau 409 `label_done_manually` si `labelManualAt` est posé.
- `orderTracking.ts` : catch → `recordAlert(TRACKING_UNREACHABLE)` ; succès → `resolveAlerts`.
- `orderEmails.ts` : `notifyAdminPaymentAnomaly` appelle `recordAlert(PAYMENT_ANOMALY, message = problem tel quel,
  keySuffix = stripeRef)` AVANT l'envoi du mail (si le mail échoue, l'alerte existe quand même) ; son propre `catch` n'ajoute PAS d'`EMAIL_FAILED` (même événement). Les autres `catch` →
  `recordAlert(EMAIL_FAILED, message: "L'e-mail « commande payée » au client n'est pas parti.")`. Il faut l'`orderId` :
  ajouter un paramètre optionnel aux fonctions, ou retrouver la commande par `ref` dans `recordAlert`.
- `orders/index.ts` l.81 : `canBuyLabel` faux si `labelManualAt` ; exposer `labelManualAt`.
- `SHIPPING_DATA_PURGE` : ajouter `labelManualAt: null`.

## 4. API
- `GET /api/admin/alerts` (requireAdmin) → `{ alerts: AlertDTO[], total }`, critique d'abord puis plus récent, 50 max.
  Lit les commandes non DELIVERED/REJECTED (champs utiles seulement ; + DELIVERED sans facture pour `INVOICE_MISSING`), le stock cartons, `boxtalConfigMissing()`,
  et les `AdminAlert` non résolues. Résout au passage (paresseux) les `LABEL_REFUSED` dont la commande a maintenant
  `boxtalOrderRef` ou `labelManualAt`.
  `AlertDTO = { key, kind, severity: "critical"|"warning", title, message, detail?, orderId?, orderRef?, at?,
  count?, source: "derived"|"stored", actions: ActionKind[] }`.
- `PATCH /api/admin/alerts/[id]` `{ action: "resolve" }` : alertes **enregistrées** seulement (400 sur une dérivée).
- `POST /api/admin/orders/[id]/manual-label` `{ trackingNumber }` (zod, 1-60 car.) : 404 ; 409 si PICKUP, si
  `boxtalOrderRef` déjà posé, si statut ∉ {PENDING, PRINTING} (les alertes relais/poids seul naissent dès PENDING). Pose `trackingNumber` + `labelManualAt`, résout
  `LABEL_REFUSED`. Permet ensuite le passage en READY (règle existante : il suffit d'un n° de suivi).
- `api-client.ts` : `adminGetAlerts()`, `adminResolveAlert(id)`, `adminManualLabel(orderId, trackingNumber)`.

Actions (`ActionKind`) → endpoints **existants** : `retry_label` (POST shipping-label), `manual_label` (formulaire
n° de suivi), `retry_status` (GET shipping-label), `generate_invoice` (POST invoice/generate), `open_order`
(onglet Commandes + recherche = ref), `open_stock` (onglet Expédition), `open_stripe`
(`https://dashboard.stripe.com/payments/<pi_…>` si la ref commence par `pi_`), `resolve` (PATCH).
Hors périmètre : modifier l'adresse d'un client depuis l'admin (aucune route) → « Voir la commande » + e-mail client.

## 5. Messages (titre en gras + phrase + action)
| kind | Titre | Phrase (exemple) | Actions |
|---|---|---|---|
| LABEL_REFUSED | Étiquette refusée par Boxtal | N3D-2041 : « Le code postal ne correspond pas à la ville. » | Réessayer · Étiquette faite à la main · Voir la commande |
| BOXTAL_NOT_CONFIGURED | Boxtal n'est pas configuré | Il manque BOXTAL_API_KEY_V1 dans le .env du serveur : aucune étiquette ne peut être créée. | (aucune, texte d'aide) |
| ADDRESS_INCOMPLETE | Adresse incomplète | N3D-2043 : il manque le téléphone et le code postal du destinataire. | Voir la commande |
| RELAY_MISSING | Point relais manquant | N3D-2044 : livraison en point relais, mais aucun point choisi. | Voir la commande · Étiquette faite à la main |
| TRACKING_UNREACHABLE | Suivi Boxtal injoignable | N3D-2038 : Boxtal ne répond pas, le suivi n'a pas pu être vérifié (3 essais). | Réessayer · Voir la commande |
| BOX_STOCK_EMPTY | Cartons épuisés | Plus de carton M ni XL. N3D-2045 a besoin d'un M. | Voir le stock |
| PAYMENT_ANOMALY | Anomalie de paiement | N3D-2039 : paiement reçu (48,00 €) alors que la commande est refusée : vérifier et rembourser si besoin. | Ouvrir dans Stripe · Voir la commande · Traité |
| INVOICE_MISSING | Facture non générée | N3D-2040 est payée mais n'a pas de facture. | Générer la facture · Voir la commande |
| EMAIL_FAILED | E-mail non envoyé | L'e-mail « commande payée » à client@… n'est pas parti. | Voir la commande · Traité |
| WEIGHT_ONLY_QUOTE | Colis à préparer à la main | N3D-2046 : les pièces ne rentrent dans aucun carton, devis calculé au poids seul. Faire l'étiquette sur Boxtal. | Étiquette faite à la main · Voir la commande |

## 6. Interface
- `src/components/admin/AlertCenter.tsx` (nouveau, îlot dans `AdminPage`), placé dans **`.admin-quick-account`**
  (toujours visible, hors burger), avant « Compte ». Reçoit `onOpenOrder(ref)`, `onOpenTab(tab)`.
- Bouton `<button type="button" aria-label="Erreurs : 3" aria-expanded aria-controls="alert-panel"
  aria-haspopup="dialog">`, 36×36, icône Lucide `circle-alert` 20 px inline `aria-hidden="true"`
  (`currentColor`, trait 2). Pastille : `#ff5a3c`, texte `#161514` 700 10 px, cachée à 0, « 9+ » au-delà.
  0 erreur : icône grise `rgba(255,255,255,.45)` ; ≥ 1 critique : icône `#ff5a3c`.
- Panneau : desktop/tablette = popover 400 px sous l'icône (`#1a1917`, bordure `rgba(255,255,255,.1)`, rayon 12,
  ombre) ; ≤ 560 px = tiroir plein écran depuis le bas (hauteur 85vh, poignée, fond assombri). Entrée
  `translateY(6px)` + opacité 0,5 s, coupée sous `prefers-reduced-motion`.
- Accessibilité : `role="dialog" aria-labelledby`, focus sur le titre à l'ouverture, Échap et clic dehors ferment,
  focus rendu au bouton, Tab bouclé dans le tiroir mobile. Compteur annoncé par un `<span class="sr-only"
  aria-live="polite">` (« 3 erreurs à traiter ») seulement quand il change. Cibles ≥ 40 px sur mobile.
- Carte d'alerte : pastille de gravité (rouge `#ff5a3c` / ambre `#f0b35a`) + icône du type, titre Space Grotesk 600
  13 px, phrase Inter 12 px `rgba(255,255,255,.75)`, ref cliquable, heure relative, `detail` en 11 px gris, boutons
  `btn-outline` existants (vrais `<button>`). « Étiquette faite à la main » déplie un champ « N° de suivi » +
  « Enregistrer » dans la carte. Résultat d'action : texte sous la carte (pas d'`alert()`).
- Rafraîchissement : au chargement, à l'ouverture du panneau, après chaque action, et toutes les 60 s seulement si
  `document.visibilityState === "visible"`.
- `AdminPage` : `focusOrderRef` → onglet Commandes, filtre remis à « all » (`setOrderFilter`, la recherche se combine au
  filtre dans `useAdminOrders`), puis `onSearchChange(ref)` dans `OrdersTab` (prop nouvelle).
- `OrderCard` : si `labelManualAt`, afficher « Étiquette faite à la main · suivi X » et masquer « Créer l'étiquette ».
- Icônes Lucide (licence **ISC**, https://github.com/lucide-icons/lucide/blob/main/LICENSE, usage commercial OK ;
  copier les chemins depuis lucide.dev, commentaire `// Lucide (ISC)` en tête). Pas de dépendance `lucide-react` :
  9 icônes inline (`circle-alert`, `x`, `rotate-cw`, `package`, `map-pin`, `credit-card`, `file-text`, `mail`,
  `truck`) dans `src/components/admin/alertIcons.tsx`.

## 7. Lots (un agent = un lot, jamais deux sur un fichier)
1. **executant** : migration + `adminAlerts.ts` + `shippingChecks.ts` + `shortBoxtalReason` + `boxtalConfigMissing`
   + tests vitest `test/admin-alerts.test.ts` (deriveAlerts : chaque type, groupage stock, gravité critique si
   commande en besoin, rien sur DELIVERED/REJECTED/PICKUP) et `test/boxtal-reason.test.ts` (XML jamais rendu,
   ≤ 160 car., replis HTTP/réseau).
2. **executant** : branchements (`shipping-label.ts`, `orderTracking.ts`, `orderEmails.ts`, `orders/index.ts`,
   `SHIPPING_DATA_PURGE`, purge 30 j) + routes `alerts`, `alerts/[id]`, `manual-label` + `api-client.ts`.
3. **executant-ui** : `AlertCenter.tsx`, `alertIcons.tsx`, branchement `AdminPage`/`OrdersTab`/`OrderCard`, d'après
   la maquette ; skill `verif-responsive-web` 375/768/1280, Windows sombre, captures côte à côte avec la maquette.
4. **À trancher par Nolann avant tout code** : checkout quand `packPieces` échoue. Aujourd'hui 409 `order_too_big`
   (expédition grisée, retrait seul). Proposition : accepter la commande, colis = poids total réparti en XXL de
   25 kg max, `shippingOversized = true` → alerte `WEIGHT_ONLY_QUOTE`. La règle de prix n'est pas inventée ici.

Vérification : `npx vitest run`, `npx tsc --noEmit`, `npm run build` (`astro check` plante, ne fait pas foi).

## 8. Risques
- Forme réelle de `doc.error` Boxtal non vue : repli générique prévu, à confirmer au 1er refus réel.
- `recordAlert` dans le chemin du webhook Stripe : doit être sans exception (sinon 500 et Stripe renvoie l'événement).
- Sweep toutes les X min sur Boxtal en panne : une seule ligne par commande grâce à `key` (pas de spam), `count` monte.
- L'alerte stock groupée ne doit pas masquer le badge « À racheter » de l'onglet Expédition (on le garde).
