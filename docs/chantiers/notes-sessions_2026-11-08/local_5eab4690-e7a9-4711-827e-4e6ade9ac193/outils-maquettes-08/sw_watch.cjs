// node sw_watch.cjs <url> <w> <h> <runs>
// Mesure documentElement.scrollWidth à CHAQUE image (rAF) depuis le tout début du chargement, pendant :
// chargement, défilement jusqu'au carrousel, ouverture/fermeture du zoom, flèche suivante, glisser tactile.
// Rapporte le maximum vu et les éléments qui dépassaient à ce moment-là.
const path = require('path');
const { chromium } = require(path.join('C:/Users/Nolann/Desktop/Test viraaaal', 'node_modules', 'playwright-core'));
(async () => {
  const [url, w = '375', h = '812', runs = '4'] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  for (let i = 0; i < +runs; i++) {
    const ctx = await b.newContext({ viewport: { width: +w, height: +h }, colorScheme: 'dark', hasTouch: +w < 1024, isMobile: +w < 700 });
    await ctx.addInitScript(() => {
      window.__mx = { sw: 0, t: 0, phase: 'load', who: [] };
      const t0 = performance.now();
      const tick = () => {
        const de = document.documentElement;
        if (de) {
          const sw = de.scrollWidth, cw = de.clientWidth;
          if (sw > cw && sw > window.__mx.sw) {
            const who = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > cw + 1)
              .filter(e => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') return false; return true; })
              .slice(0, 5).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '') + ' r=' + Math.round(e.getBoundingClientRect().right) + ' tf=' + getComputedStyle(e).transform.slice(0, 40));
            window.__mx = { sw, cw, t: Math.round(performance.now() - t0), phase: window.__phase || 'load', who };
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const p = await ctx.newPage();
    const ph = async s => p.evaluate(s => { window.__phase = s; }, s);
    await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(800);
    await ph('scroll'); await p.locator('.track').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(900);
    await ph('zoom-open'); await p.locator('.track .pc').first().click(); await p.waitForTimeout(1200);
    await ph('zoom-close'); await p.evaluate(() => document.getElementById('z-close') && document.getElementById('z-close').click()); await p.waitForTimeout(900);
    await ph('next'); const nx = p.locator('#pj-next, .pj-next, [data-pj-next]').first(); if (await nx.count()) { try { await nx.click({ timeout: 1500 }); } catch (e) {} } await p.waitForTimeout(800);
    await ph('swipe');
    const box = await p.locator('.track').first().boundingBox();
    if (box) { const y = box.y + 120; await p.mouse.move(box.x + 300, y); await p.mouse.down(); for (let k = 0; k < 12; k++) { await p.mouse.move(box.x + 300 - k * 22, y); await p.waitForTimeout(16); } await p.mouse.up(); }
    await p.waitForTimeout(900);
    const mx = await p.evaluate(() => window.__mx);
    console.log(`run ${i + 1}:`, JSON.stringify(mx));
    await ctx.close();
  }
  await b.close();
})();
