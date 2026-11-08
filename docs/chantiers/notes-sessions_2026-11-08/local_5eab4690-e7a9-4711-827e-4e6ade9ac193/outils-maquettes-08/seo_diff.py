# python -I seo_diff.py <avant.html> <apres.html>
# Compare ce qui compte pour le SEO : title, meta, JSON-LD, h1-h3, liens, alts, textes visibles.
import sys, re, json, html.parser, collections

class X(html.parser.HTMLParser):
    SKIP = {'script', 'style', 'template', 'noscript'}
    def __init__(s):
        super().__init__(convert_charrefs=True)
        s.title = ''; s.meta = []; s.ld = []; s.h = []; s.href = []; s.alt = []; s.txt = []
        s.stack = []; s.cur_h = None; s.in_title = False; s.in_ld = False; s.buf = ''; s.skip = 0
    def handle_starttag(s, t, a):
        a = dict(a)
        if t in s.SKIP:
            s.skip += 1
            if t == 'script' and a.get('type') == 'application/ld+json': s.in_ld = True; s.buf = ''
        if t == 'title': s.in_title = True
        if t == 'meta': s.meta.append(tuple(sorted(a.items())))
        if t == 'link' and a.get('rel') in ('canonical', 'alternate'): s.meta.append(tuple(sorted(a.items())))
        if t in ('h1', 'h2', 'h3') and not s.skip: s.cur_h = [t, '']
        if t == 'a' and a.get('href') and not s.skip: s.href.append(a['href'])
        if t == 'img' and not s.skip: s.alt.append(a.get('alt'))
    def handle_endtag(s, t):
        if t in s.SKIP:
            s.skip = max(0, s.skip - 1)
            if t == 'script' and s.in_ld: s.ld.append(json.loads(s.buf)); s.in_ld = False
        if t == 'title': s.in_title = False
        if t in ('h1', 'h2', 'h3') and s.cur_h and s.cur_h[0] == t:
            s.h.append((t, ' '.join(s.cur_h[1].split()))); s.cur_h = None
    def handle_data(s, d):
        if s.in_ld: s.buf += d; return
        if s.in_title: s.title += d; return
        if s.skip: return
        if s.cur_h: s.cur_h[1] += d
        d = ' '.join(d.split())
        if d: s.txt.append(d)

def parse(p):
    x = X(); x.feed(open(p, encoding='utf-8').read()); return x

A, B = parse(sys.argv[1]), parse(sys.argv[2])
def show(name, a, b):
    ca, cb = collections.Counter(a), collections.Counter(b)
    lost, new = ca - cb, cb - ca
    print(f'== {name} : avant {len(a)} / après {len(b)} ; perdus {sum(lost.values())} ; ajoutés {sum(new.values())}')
    for k, n in lost.items(): print('   - PERDU', n, 'x', repr(k)[:160])
    for k, n in new.items(): print('   + ajouté', n, 'x', repr(k)[:160])
print('title avant :', A.title.strip()); print('title après :', B.title.strip())
show('meta/link', A.meta, B.meta)
print('== JSON-LD identique :', A.ld == B.ld, f'({len(A.ld)} bloc(s))')
show('h1-h3', A.h, B.h)
show('liens href', A.href, B.href)
show('alt', A.alt, B.alt)
# textes : un texte de l'avant est « conservé » s'il apparaît tel quel dans le texte complet de l'après
full_b = ' '.join(B.txt)
lost_txt = [t for t in dict.fromkeys(A.txt) if t not in full_b]
print(f'== textes visibles : {len(set(A.txt))} fragments avant ; absents après : {len(lost_txt)}')
for t in lost_txt: print('   - ABSENT', repr(t)[:200])
