# Note pour le dev : sous-domaine shop, Caddy et IP réelle (02/11/2026)

Contexte : le site est **un seul conteneur Astro** (front + API, port 3000, réseau Docker `nasap3d`). Caddy et le DNS sont sur le serveur OVH, hors dépôt : rien de ce qui suit n'est modifié par le code, c'est à faire à la main.

## 1. DNS `shop.nasap3d.com`
- Zone OVH : enregistrement **A** `shop` → même IP que `nasap3d.com` (ou **CNAME** `shop` → `nasap3d.com.`). Ajouter aussi un AAAA s'il y en a un pour `nasap3d.com`.
- Vérifier : `nslookup shop.nasap3d.com` renvoie l'IP du serveur.

## 2. Bloc Caddy
```
shop.nasap3d.com {
	reverse_proxy api:3000
}
```
- Même cible que `nasap3d.com` (même conteneur). Caddy prend le certificat tout seul une fois le DNS propagé.
- Garder l'en-tête Host d'origine (comportement par défaut) : le code reconnaît le sous-domaine par `X-Forwarded-Host` ou `Host` (`src/middleware.ts`).
- Vérifier après rechargement :
  - `curl -I https://shop.nasap3d.com/` → 200 (page « boutique à venir ») ;
  - `curl -I https://shop.nasap3d.com/contact` → 302 vers `https://nasap3d.com/contact`.

## 3. IP réelle des visiteurs (X-Forwarded-For) : constat du 02/11
**Problème trouvé** : Astro 7 n'utilise `X-Forwarded-For` que si `security.allowedDomains` est configuré (ce n'est pas le cas). Le site voyait donc l'IP de Caddy pour tout le monde, et les limites de requêtes par IP étaient partagées par **tous** les visiteurs : connexion, inscription, mot de passe oublié, devis instantané (15/min et 100/h pour tout le site), panier, contact, tarifs de livraison.
**Correctif côté code** (en ligne au prochain push) : si la connexion vient d'une adresse privée ou locale (Caddy sur le réseau Docker), le site prend **l'entrée la plus à droite** de `X-Forwarded-For`, celle que Caddy ajoute lui-même. Sinon il ignore l'en-tête.

**Questions pour le dev :**
1. **Caddy est-il le seul intermédiaire ?** Pas de load balancer OVH, Cloudflare ni autre proxy devant. Si un autre proxy existe, le dire : l'entrée la plus à droite serait l'IP de ce proxy, pas celle du visiteur.
2. **Version de Caddy ≥ 2.5, sans `trusted_proxies`** : il ignore alors le `X-Forwarded-For` envoyé par le client et le réécrit avec la vraie IP. C'est ce qu'on veut. Une ligne explicite `header_up X-Forwarded-For {remote_host}` est possible mais pas nécessaire.
3. **Le port 3000 doit rester publié sur `127.0.0.1` seulement** (c'est le cas dans `docker-compose.yml`), et fermé au pare-feu. Sinon un client qui se connecterait directement passerait par le proxy Docker (adresse privée) et pourrait falsifier son IP.
4. **Où est la config du proxy hôte ?** Chemin du Caddyfile sur le serveur (fichier système ou conteneur Caddy séparé + volume) et commande de rechargement, pour les prochaines notes.

**Vérifier après le push** : 6 « mot de passe oublié » en moins d'une minute depuis un téléphone en 4G → le 6e est refusé (erreur 429 `rate_limited`) ; au même moment, depuis le wifi du PC, la page fonctionne encore.
