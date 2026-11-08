# OBSOLETE (08/11/2026) : la page-08 est desormais la base, editee directement.
# Ce script repartait de la page 05 et ECRASERAIT les retours n2/n3. Blocs PJ : sync_pj.py.
import sys; sys.exit('build_page_0811.py est obsolete : voir sync_pj.py')
# Construit page-maquettiste-nantes_2026-11-08.html = page 05 + blocs PJ:* du carrousel 08 (recopiés tels quels).
# Chaque ancre est vérifiée (présente une seule fois) avant remplacement ; rien d'autre de la page 05 ne change.
import pathlib, re, sys
D = pathlib.Path(r"C:\Users\Nolann\Desktop\Nasap3D website\Code html\Refonte Nasap3D\.claude\worktrees\maquettage-b2b-propre\docs\maquettes")
P = (D / 'page-maquettiste-nantes_2026-11-05.html').read_text(encoding='utf-8')
C = (D / 'carrousel-projets_2026-11-08.html').read_text(encoding='utf-8')
OUT = D / 'page-maquettiste-nantes_2026-11-08.html'

def one(src, pat, flags=re.S):
    m = list(re.finditer(pat, src, flags))
    if len(m) != 1:
        sys.exit(f'ANCRE KO ({len(m)} trouvées) : {pat[:90]!r}')
    return m[0]

def rep1(src, old, new):
    if src.count(old) != 1:
        sys.exit(f'ANCRE KO ({src.count(old)}) : {old[:90]!r}')
    return src.replace(old, new)

# --- blocs du carrousel 08 ---
css = one(C, r'  /\* PJ:CSS .*?  /\* /PJ:CSS \*/').group(0)
jsflag = one(C, r"<script>document\.documentElement\.classList\.add\('js'\); document\.body\.classList\.add\('js'\);</script>").group(0)
sprite = one(C, r'<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="i-3d".*?</svg>').group(0)
ctrl = one(C, r'    <div class="pj-ctrl" id="pj-ctrl" hidden>.*?\n    </div>(?=\n  </div>\n\n  <ul class="track")').group(0)
track = one(C, r'  <ul class="track" id="pj-track".*?\n  </ul>').group(0)
allp = one(C, r'  <p class="pj-all">.*?</p>').group(0)
data = one(C, r'<!-- Photos et vues du zoom .*?<!-- /PJ:DATA -->').group(0)
tpl = one(C, r'<!-- Zoom : gabarit .*?<!-- /PJ:TPL -->').group(0)
js = one(C, r'<!-- PJ:JS -->.*?<!-- /PJ:JS -->').group(0)

# --- styles propres à la page (intégration) ---
PAGE_CSS = '''
  /* ===== Page 08 : intégration du carrousel (blocs PJ:* ci-dessus, recopiés tels quels) ===== */
  .sec.pj{--pj-wrap:var(--wrap);padding-bottom:0;background:none}  /* colonne du carrousel = colonne de la page (1120 px) */
  .pj-head .sec-head{margin:0}
  .split > *{min-width:0}  /* page 05 : une image qui ne charge pas (alt affiché) élargissait la colonne 1fr → scrollWidth 1018 à 375 (vu le 06/11) */
  html:not(.motion) .pj .track > li{opacity:1;transform:none;transition:none}  /* réglage « Sobre » de la barre de maquette */
  /* Tuiles « Faire tourner en 3D » : ouvrent le zoom du projet directement sur la vue 360° */
  .t3d-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
  .t3d-grid li{display:flex}
  .t3d{flex:1;display:flex;flex-direction:column;text-decoration:none;color:var(--fg);background:var(--bg2);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;transition:border-color .25s ease,box-shadow .25s ease}
  .t3d-img{position:relative;display:block;aspect-ratio:4/3;overflow:hidden;background:radial-gradient(ellipse at 50% 45%,#2b2724 0%,var(--bg3) 72%)}
  .t3d-img img{width:100%;height:100%;object-fit:contain;transition:transform .5s cubic-bezier(.2,.8,.2,1)}
  .t3d-img .badge{position:absolute;left:10px;top:10px}
  .t3d-txt{display:flex;flex-direction:column;gap:4px;padding:14px 16px 16px;border-top:1px solid var(--line)}
  .t3d-name{font:600 15.5px/1.35 "Space Grotesk",sans-serif;color:var(--fg)}
  .t3d-cta{font:500 13.5px/1.4 Inter,sans-serif;color:var(--mut)}
  .t3d-cta span{color:var(--acc);display:inline-block;transition:transform .25s ease}
  @media (hover:hover){
    .t3d:hover{border-color:var(--acc-line);box-shadow:0 10px 28px rgba(0,0,0,.35)}
    .t3d:hover .t3d-img img{transform:scale(1.05)}
    .t3d:hover .t3d-cta span{transform:translateX(3px)}
  }
  @media (max-width:640px){
    .sec.pj{--pj-pad:16px}  /* même marge que .wrap de la page sur mobile */
    .t3d-grid{grid-template-columns:1fr;gap:10px}
    .t3d{flex-direction:row}
    .t3d-img{flex:0 0 40%;aspect-ratio:4/3}
    .t3d-img .badge{left:6px;top:6px}
    .t3d-txt{justify-content:center;border-top:0;border-left:1px solid var(--line);padding:12px 14px}
    .vbar.min{left:auto}  /* barre de maquette repliée = petit bouton à droite */
  }
  @media (prefers-reduced-motion:reduce){
    .t3d,.t3d-img img,.t3d-cta span{transition:none}
    .t3d:hover .t3d-img img,.t3d:hover .t3d-cta span{transform:none}
  }
'''

TILES = [
    ('caravane', 'caravane-de-presentation', 'Caravane de présentation'),
    ('cellule', 'maquette-cellule-biologique', 'Cellule biologique en coupe'),
    ('purification', 'systeme-filtration-purification', 'Système de filtration et de purification'),
]
for _, slug, name in TILES:  # le titre de la tuile = titre exact de la carte du carrousel
    one(C, re.escape(f'href="/realisations/{slug}">{name}</a></h3>'))
    one(data, re.escape(f'"{slug}"'))
tiles = '\n'.join(
    f'        <li data-rv style="--i:{i}"><a class="t3d" href="/realisations/{slug}" data-pj-spin="{slug}">'
    f'<span class="t3d-img"><img src="../../public/assets/maquettes/{d}/sm/e28_a010.avif" width="640" height="480" loading="lazy" decoding="async" alt="">'
    f'<span class="badge b3d"><svg class="spin-ico" aria-hidden="true"><use href="#i-3d"/></svg>3D 360°</span></span>'
    f'<span class="t3d-txt"><span class="t3d-name">{name}</span><span class="t3d-cta">Faire tourner en 3D <span aria-hidden="true">→</span></span></span></a></li>'
    for i, (d, slug, name) in enumerate(TILES))

S3D_HEAD = '''    <div class="sec-head" data-rv style="margin:40px 0 18px"><h2 id="s-3d" style="font-size:clamp(21px,2.2vw,27px)">Explorez nos maquettes en 3D</h2>
      <p class="p">Caravane de présentation : maquette de vitrine pour le secteur du loisir, carrosserie imprimée en plusieurs couleurs dans la masse, vitres et feux en plexiglas.</p></div>'''
MACHINES = '''<div class="ph" data-rv style="margin-top:14px;padding:18px"><b>&lt;MachinesStrip /&gt; : bandeau machines existant, inchangé</b></div>'''

sec11_old = one(P, r'  <!-- 11\. Carrousel \(placeholder\) \+ blocs existants conservés -->\n.*?\n  </section>(?=\n\n  <!-- 12\. FAQ -->)').group(0)
# le texte SEO du bloc 3D doit être recopié à l'identique
assert S3D_HEAD.replace('    <div', '  <div', 1).split('\n')[0].strip() in sec11_old and S3D_HEAD.split('\n')[1].strip() in sec11_old
assert MACHINES in sec11_old

sec11_new = f'''  <!-- 11. Carrousel de projets : blocs PJ:* de carrousel-projets_2026-11-08.html (en-tête adapté : numéro 08 et h2#s-proj de la page
       à la place du surtitre et du h2#pj-title de la maquette autonome) + bloc 3D (texte conservé) + bandeau machines conservé -->
  <!-- PJ:HTML -->
  <section class="sec pj" id="nos-maquettes" aria-labelledby="s-proj">
  <div class="pj-head">
    <div class="sec-head" data-rv><div class="sec-label">08</div><h2 id="s-proj">Nos maquettes</h2>
      <p class="p">Touchez un projet pour l'agrandir : photos, détails et fiche complète.</p></div>
{ctrl}
  </div>

{track}

{allp}

  <div class="wrap">
{S3D_HEAD}
    <!-- Remplace le placeholder <MaquetteCarousel /> : chaque tuile ouvre le zoom du projet sur sa vue 360° (lien réel vers la fiche si JS absent). -->
    <ul class="t3d-grid">
{tiles}
    </ul>
    {MACHINES}
  </div>
  </section>
  <!-- /PJ:HTML -->'''

# --- assemblage, de bas en haut ---
P = rep1(P, '</script>\n</body>', '</script>\n\n' + data + '\n\n' + tpl + '\n\n' + js + '\n</body>')
vmin = one(P, r'    document\.getElementById\("vmin"\)\.onclick=.*?\n').group(0)
P = rep1(P, vmin, vmin + '    if(matchMedia("(max-width:640px)").matches){var vb=document.getElementById("vbar"),vm=document.getElementById("vmin"); vb.classList.add("min"); vm.textContent="Ouvrir"; vm.setAttribute("aria-expanded","false");}  // mobile : barre de maquette repliée au départ\n')
P = rep1(P, sec11_old, sec11_new)
P = rep1(P, '</style>\n</head>\n<body>\n', css + '\n' + PAGE_CSS + '</style>\n</head>\n<body>\n' + jsflag + '\n' + sprite + '\n')
P = rep1(P, '  - Storyboard (StoryboardCellule.astro) et carrousel (docs/maquettes/carrousel-projets_2026-11-05.html) = blocs PLACEHOLDER.\n',
         '  - v08 (08/11/2026, Opus) : section 08 « Nos maquettes » = carrousel réel (blocs PJ:CSS/HTML/DATA/TPL/JS recopiés tels quels\n'
         '    de docs/maquettes/carrousel-projets_2026-11-08.html) ; placeholder <MaquetteCarousel /> remplacé par 3 tuiles « Faire tourner en 3D »\n'
         '    qui ouvrent le zoom sur la vue 360° ; barre de maquette repliée au départ sur mobile. Aucun texte de la page retiré.\n'
         '  - Storyboard (StoryboardCellule.astro) = bloc PLACEHOLDER.\n')
P = rep1(P, '(MAQUETTE 05/11/2026)</title>', '(MAQUETTE 08/11/2026)</title>')

for m in ('HTML', 'DATA', 'TPL', 'JS'):
    assert P.count(f'<!-- PJ:{m} -->') == 1 and P.count(f'<!-- /PJ:{m} -->') == 1, m
assert P.count('id="s-proj"') == 1 and P.count('id="s-3d"') == 1 and 'id="pj-title"' not in P
assert P.count('id="i-3d"') == 1
OUT.write_text(P, encoding='utf-8', newline='\n')
print('OK', P.count('\n') + 1, 'lignes,', len(P.encode('utf-8')), 'octets')
