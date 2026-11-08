// node sw_each.cjs <url> <w> <h>
// Ouvre le zoom de CHACUN des 8 projets (clic sur la carte) et mesure, image par image pendant l'ouverture :
// scrollWidth du document ET de la fenêtre zoom (dialog) + de ses descendants qui défilent ; rapporte les dépassements.
const path = require('path');
const { chromium } = require(path.join('C:/Users/Nolann/Desktop/Test viraaaal', 'node_modules', 'playwright-core'));
(async () => {
  const [url, w = '375', h = '812'] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, colorScheme: 'dark', hasTouch: +w < 1024, isMobile: +w < 700 });
  await ctx.addInitScript(() => {
    window.__rec = [];
    const tick = () => {
      const de = document.documentElement, cw = de ? de.clientWidth : 0;
      if (de) {
        const out = [];
        if (de.scrollWidth > cw) out.push('doc sw=' + de.scrollWidth);
        const d = document.querySelector('dialog[open]');
        if (d) for (const e of [d, ...d.querySelectorAll('*')]) {
          if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible' && getComputedStyle(e).overflowX !== 'clip' && e.clientWidth > 0 && !e.matches('.z-thumbs, .z-thumbs *'))
            out.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).trim().split(/\s+/)[0]) + ' sw=' + e.scrollWidth + '/' + e.clientWidth + ' ovx=' + getComputedStyle(e).overflowX);
        }
        if (out.length) window.__rec.push((window.__phase || '') + ' : ' + out.join(', '));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(800);
  const n = await p.locator('.track .pc').count();
  for (let i = 0; i < n; i++) {
    await p.evaluate(i => { window.__phase = 'projet ' + (i + 1); }, i);
    await p.locator('.track .pc').nth(i).scrollIntoViewIfNeeded();
    await p.locator('.track .pc').nth(i).click({ position: { x: 40, y: 40 } });
    await p.waitForTimeout(1300);
    const info = await p.evaluate(() => { const d = document.querySelector('dialog[open]'); return { hash: location.hash, sw: document.documentElement.scrollWidth, dsw: d && d.scrollWidth, dcw: d && d.clientWidth }; });
    console.log('projet', i + 1, JSON.stringify(info));
    await p.evaluate(() => { const c = document.getElementById('z-close'); if (c) c.click(); });
    await p.waitForTimeout(900);
  }
  const rec = await p.evaluate(() => [...new Set(window.__rec)]);
  console.log('dépassements vus :', rec.length ? '\n  ' + rec.slice(0, 15).join('\n  ') : 'aucun');
  await b.close();
})();
