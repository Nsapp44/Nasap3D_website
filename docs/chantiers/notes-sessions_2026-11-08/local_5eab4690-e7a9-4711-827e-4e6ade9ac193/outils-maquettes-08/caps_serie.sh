#!/usr/bin/env bash
# caps_serie.sh <dossier_sortie> : captures pleine page de la page-08 et du carrousel-08 à toutes les tailles + rapport de débordement.
# Exige le serveur http://127.0.0.1:4380 (python -m http.server à la racine du worktree).
OUT="$1"; mkdir -p "$OUT"
T="$(dirname "$0")"
B="http://127.0.0.1:4380/docs/maquettes"
P="$B/page-maquettiste-nantes_2026-11-08.html"
C="$B/carrousel-projets_2026-11-08.html"
for s in 375x812 768x1024 1024x768 1180x820 1440x900 1920x1080; do
  w=${s%x*}; h=${s#*x}
  echo "== page $s"; node "$T/cap.cjs" "$P?bar=0" "$OUT/page_$s" $w $h '[{"wait":600},{"shot":"vue"},{"full":"full"}]' | grep -v '^shot\|^full'
done
for s in 375x812 1440x900; do
  w=${s%x*}; h=${s#*x}
  echo "== page t=short $s"; node "$T/cap.cjs" "$P?bar=0&t=short" "$OUT/page-short_$s" $w $h '[{"wait":600},{"full":"full"}]' | grep -v '^full'
  echo "== carrousel $s"; node "$T/cap.cjs" "$C" "$OUT/carrousel_$s" $w $h '[{"wait":600},{"full":"full"}]' | grep -v '^full'
done
