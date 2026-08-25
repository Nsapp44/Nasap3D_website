# Image Caddy pré-construite : le Caddyfile et le front-end statique sont
# copiés DANS l'image au moment du build (CI, voir
# .github/workflows/docker-publish-caddy.yml), pas montés depuis le disque
# du serveur au démarrage — plus besoin que le dépôt soit cloné/à jour sur
# l'hôte pour que le site soit servi, un `docker compose pull` suffit,
# exactement comme pour l'image API (server/Dockerfile).
#
# Copie explicite par motif plutôt qu'un `COPY . /srv` global : ne copie que
# ce qui doit vraiment être servi publiquement (pages, JS/CSS partagés,
# assets, sitemap) — jamais server/, .git, .env, docker-compose.yml ou ce
# Dockerfile lui-même, même par erreur.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY *.dc.html /srv/
COPY *.js /srv/
COPY *.css /srv/
COPY sitemap.xml robots.txt /srv/
COPY assets/ /srv/assets/
COPY vendor/ /srv/vendor/
