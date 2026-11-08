# Planches avant/après : chaque ligne = images côte à côte avec une légende au-dessus.
from PIL import Image, ImageDraw, ImageFont
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
F = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 22); f2 = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 17)
def sheet(name, title, rows, w):
    pad, cap = 18, 34
    rows = [[(lab, Image.open(p).convert('RGB')) for lab, p in r] for r in rows]
    rows = [[(lab, im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)) for lab, im in r] for r in rows]
    W = pad + max(len(r) for r in rows) * (w + pad); H = 56 + sum(cap + max(im.height for _, im in r) + pad for r in rows)
    out = Image.new('RGB', (W, H), (238, 236, 232)); d = ImageDraw.Draw(out); d.text((pad, 14), title, font=F, fill=(20, 20, 20))
    y = 56
    for r in rows:
        x = pad
        for lab, im in r:
            col = (190, 50, 30) if lab.startswith('APRÈS') else (90, 90, 90)
            d.text((x, y + 6), lab, font=f2, fill=col); out.paste(im, (x, y + cap)); x += w + pad
        y += cap + max(im.height for _, im in r) + pad
    out.save(f'planches/{name}.png'); print(name, out.size)
sheet('1_carrousel_1440', 'Carrousel de projets à 1440 : avant (05 et 06) / après (08)', [
    [('AVANT 05 (base validée)', 'avant/c05_top.png'), ('AVANT 06 (Sonnet)', 'avant/c06_top.png'), ('APRÈS 08', 'apres/c08_1440_top.png')],
    [('AVANT 05 zoom', 'avant/c05_zoom.png'), ('AVANT 06 zoom', 'avant/c06_zoom.png'), ('APRÈS 08 zoom', 'apres/c08_1440_zoom.png')],
    [('APRÈS 08 zoom, vue 360°', 'apres/c08_1440_spin.png'), ('APRÈS 08 projet suivant', 'apres/c08_1440_next.png'), ('APRÈS 08 mouvement réduit', 'apres/c08_rm_1440_spin.png')]], 640)
sheet('2_carrousel_375_768', 'Carrousel de projets à 375 et 768 : avant (06) / après (08)', [
    [('AVANT 06 zoom 375', 'avant/c06_375_zoom.png'), ('APRÈS 08 375', 'apres/c08_375_top.png'), ('APRÈS 08 zoom 375', 'apres/c08_375_zoom.png'), ('APRÈS 08 bas du zoom', 'apres/c08_375_zoombas.png'), ('APRÈS 08 vue 360°', 'apres/c08_375_spin.png')],
    [('APRÈS 08 768', 'apres/c08_768_top.png'), ('APRÈS 08 zoom 768', 'apres/c08_768_zoom.png'), ('APRÈS 08 bas du zoom 768', 'apres/c08_768_zoombas.png'), ('APRÈS 08 vue 360° 768', 'apres/c08_768_spin.png')]], 300)
sheet('3_page_1440', 'Page /maquettiste-nantes à 1440, section 08 : avant (05 et 06) / après (08)', [
    [('AVANT 05 (placeholder)', 'avant/p05_1440_sec08.png'), ('AVANT 06 (Sonnet)', 'avant/p06_1440_sec08.png'), ('APRÈS 08', 'apres/p08_1440_top.png')],
    [('APRÈS 08 tuiles 3D', 'apres/p08_1440_tiles.png'), ('APRÈS 08 zoom', 'apres/p08_1440_zoom.png'), ('APRÈS 08 tuile -> vue 360°', 'apres/p08_1440_spin.png')]], 640)
sheet('4_page_375_768', 'Page /maquettiste-nantes à 375 et 768, section 08 : avant / après', [
    [('AVANT 05 375', 'avant/p05_375_sec08.png'), ('AVANT 06 375', 'avant/p06_375_sec08.png'), ('APRÈS 08 375', 'apres/p08_375_top.png'), ('APRÈS 08 tuiles', 'apres/p08_375_tiles.png'), ('APRÈS 08 zoom', 'apres/p08_375_zoom.png'), ('APRÈS 08 vue 360°', 'apres/p08_375_spin.png')],
    [('APRÈS 08 768', 'apres/p08_768_top.png'), ('APRÈS 08 tuiles 768', 'apres/p08_768_tiles.png'), ('APRÈS 08 zoom 768', 'apres/p08_768_zoom.png'), ('APRÈS 08 vue 360° 768', 'apres/p08_768_spin.png')]], 280)
