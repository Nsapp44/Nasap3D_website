#!/bin/sh
# Version conteneurisée de ../backup-db.sh — tourne dans le service `backup`
# de docker-compose.yml (profil full), appelée par crond (voir Dockerfile),
# pas par un cron sur l'hôte. Différence clé : pg_dump direct sur le réseau
# Docker interne (host "db") plutôt que `docker compose exec` depuis l'hôte
# — ce script tourne DANS un conteneur, il n'a pas accès à la CLI Docker de
# l'hôte (et ne devrait pas en avoir besoin).
set -eu

RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_DIR="/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/nasap3d-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

pg_dump -h db -U nasap3d nasap3d | gzip > "$OUT_FILE"
echo "$(date -Iseconds) Sauvegarde écrite : $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

find "$BACKUP_DIR" -name 'nasap3d-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
