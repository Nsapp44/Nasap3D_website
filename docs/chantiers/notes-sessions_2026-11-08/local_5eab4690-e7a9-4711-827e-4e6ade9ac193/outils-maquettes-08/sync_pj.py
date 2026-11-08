# sync_pj.py (08/11/2026) : la page-08 est la base ; carrousel-08 = source unique des blocs PJ.
# python sync_pj.py            -> compare les blocs PJ des deux fichiers (rien n'est écrit)
# python sync_pj.py --write    -> recopie les blocs PJ de carrousel-08 dans page-08
import re, sys, difflib, pathlib
M = pathlib.Path(r"C:\Users\Nolann\Desktop\Nasap3D website\Code html\Refonte Nasap3D\.claude\worktrees\maquettage-b2b-propre\docs\maquettes")
SRC, DST = M / "carrousel-projets_2026-11-08.html", M / "page-maquettiste-nantes_2026-11-08.html"
PAT = {
    "CSS": r"/\* PJ:CSS[^\n]*\n.*?/\* /PJ:CSS \*/",
    # PJ:HTML n'est PAS synchronisé : la page-08 a sa propre en-tête de section + les tuiles 3D.
    # Toute retouche HTML du carrousel se reporte à la main dans les deux fichiers.
    "DATA": r"<!-- PJ:DATA -->.*?<!-- /PJ:DATA -->",
    "TPL": r"<!-- PJ:TPL -->.*?<!-- /PJ:TPL -->",
    "JS": r"<!-- PJ:JS -->.*?<!-- /PJ:JS -->",
}
def norm(s):  # l'indentation peut différer d'un fichier à l'autre
    return [l.strip() for l in s.splitlines() if l.strip()]
src, dst = SRC.read_text(encoding="utf-8"), DST.read_text(encoding="utf-8")
write = "--write" in sys.argv
for k, p in PAT.items():
    a, b = re.search(p, src, re.S), re.search(p, dst, re.S)
    if not a or not b:
        print(k, "MARQUEUR MANQUANT", bool(a), bool(b)); continue
    d = list(difflib.unified_diff(norm(b.group(0)), norm(a.group(0)), "page-08", "carrousel-08", n=0, lineterm=""))
    print(f"{k}: {'identique' if not d else str(len([x for x in d if x[:1] in '+-'])-2) + ' lignes differentes'}")
    for x in d[2:40]: print("   ", x[:160])
    if write and d:
        dst = dst[:b.start()] + a.group(0) + dst[b.end():]
if write:
    DST.write_text(dst, encoding="utf-8"); print("page-08 mise a jour")
