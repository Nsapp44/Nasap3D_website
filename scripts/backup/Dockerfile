# Petit conteneur dédié : pg_dump quotidien vers /backups (volume monté par
# docker-compose.yml), pour ne plus dépendre d'un cron installé à la main
# sur l'hôte. postgres:16-alpine fournit déjà pg_dump — juste besoin d'un
# vrai démon cron par-dessus (dcron, via apk).
FROM postgres:16-alpine
RUN apk add --no-cache dcron tini
COPY backup-db-cron.sh /usr/local/bin/backup-db-cron.sh
RUN chmod +x /usr/local/bin/backup-db-cron.sh
# Tous les jours à 3h du matin (heure du conteneur — UTC par défaut).
# crond (busybox) essaie par défaut d'envoyer la sortie du job par mail
# plutôt que de la laisser passer sur sa propre sortie — sans MTA configuré,
# elle disparaît silencieusement. La rediriger explicitement vers le stdout/
# stderr du PID 1 du conteneur (tini) contourne ça : confirmé en testant,
# c'est la seule façon fiable de la voir dans `docker logs`.
RUN echo "0 3 * * * /usr/local/bin/backup-db-cron.sh >>/proc/1/fd/1 2>>/proc/1/fd/2" > /etc/crontabs/root
# crond en PID 1 direct plante ("setpgid: Operation not permitted") — c'est
# un démon fait pour tourner sous un vrai init qui reparente/reap ses
# enfants, pas pour être PID 1 lui-même (restriction noyau spécifique à
# PID 1). tini comble ce rôle, confirmé en testant : sans lui, crond
# boucle en échec et ne lance jamais aucune sauvegarde.
ENTRYPOINT ["tini", "--"]
CMD ["crond", "-f", "-d", "8"]
