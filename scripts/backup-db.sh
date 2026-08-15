#!/bin/sh
# Sauvegarde la base Postgres (dump complet, compressé) dans ./backups/, et
# supprime les sauvegardes de plus de RETENTION_DAYS jours. Pensé pour un
# cron quotidien sur le serveur de production — voir server/README.md
# "Sauvegardes" pour l'entrée cron. Sans argument, tourne aussi bien en
# local (contre le conteneur "db" du docker-compose.yml de dev).
#
# Ne remplace pas une vraie stratégie de sauvegarde externalisée (ces
# fichiers restent sur le même disque que la base elle-même — une panne du
# serveur entier les perdrait aussi) ; copier ce dossier ailleurs
# régulièrement (rsync, stockage S3, etc.) reste à faire séparément.
set -eu

cd "$(dirname "$0")/.."

RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_DIR="backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/nasap3d-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

docker compose exec -T db pg_dump -U nasap3d nasap3d | gzip > "$OUT_FILE"
echo "Sauvegarde écrite : $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

find "$BACKUP_DIR" -name 'nasap3d-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
