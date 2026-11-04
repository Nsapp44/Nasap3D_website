const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/Users/Nolann/Desktop/Test viraaaal/node_modules/playwright-core');

const OUT = 'C:/Users/Nolann/AppData/Local/Temp/claude/C--Users-Nolann-Desktop-Nasap3D-website-Code-html-Refonte-Nasap3D--claude-worktrees-maquettage-b2b-propre/d9ae3c99-dca5-4ae0-852f-bebc9e3bbe69/scratchpad/captures_sb';
const BASE = 'http://localhost:8765/index.html';
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const PCTS = [0, 10, 20, 26, 30, 36, 42, 48, 54, 60, 70, 80, 90, 100];
const WIDTHS = [[375, 812], [768, 1024], [1440, 900]];

function isLocal(u) {
  try { const h = new URL(u).hostname; return h === 'localhost' || h === '127.0.0.1'; } catch (e) { return true; }
}

async function run(browser, w, h, opts) {
  const m = { consoleErrors: [], pageErrors: [], failedRequests: [], httpErrors: [], externalHosts: {}, externalRequests: 0,
    scrollWidthIssues: [], imageBytes: 0, imageCount: 0, gsap: null, shots: [], fatal: null };
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...opts });
  const page = await ctx.newPage();
  const imgPromises = new Map();
  page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') m.consoleErrors.push(`[${msg.type()}] ${msg.text()}`); });
  page.on('pageerror', (e) => m.pageErrors.push(String(e && e.message ? e.message : e)));
  page.on('requestfailed', (r) => m.failedRequests.push(`${r.url()} :: ${r.failure() ? r.failure().errorText : '?'}`));
  page.on('response', (r) => {
    if (r.status() >= 400) m.httpErrors.push(`${r.status()} ${r.url()}`);
    if (r.request().resourceType() === 'image' && isLocal(r.url()) && !imgPromises.has(r.url())) {
      imgPromises.set(r.url(), r.body().then((b) => b.length).catch(() => 0));
    }
  });
  page.on('request', (r) => {
    const u = r.url();
    if (!isLocal(u)) {
      const hst = new URL(u).hostname;
      m.externalHosts[hst] = (m.externalHosts[hst] || 0) + 1;
      m.externalRequests++;
    }
  });
  const measure = () => page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    max: document.documentElement.scrollHeight - window.innerHeight,
  }));
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    m.gsap = await page.evaluate(() => ({ gsap: typeof window.gsap, ScrollTrigger: typeof window.ScrollTrigger }));
    const N = 20;
    for (let i = 0; i <= N; i++) {
      const mm = await measure();
      const y = Math.round(mm.max * i / N);
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(250);
      const s = await measure();
      if (s.sw > s.iw) m.scrollWidthIssues.push(`balayage ${i * 5}% sw=${s.sw} iw=${s.iw}`);
    }
    await page.waitForTimeout(1000);
    const bytesMap = new Map();
    for (const [u, p] of imgPromises) bytesMap.set(u, await p);
    m.imageCount = bytesMap.size;
    m.imageBytes = [...bytesMap.values()].reduce((a, b) => a + b, 0);
    if (!opts.reducedMotion) {
      for (const pct of PCTS) {
        const mm = await measure();
        const y = Math.round(mm.max * pct / 100);
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(1200);
        const s = await measure();
        if (s.sw > s.iw) m.scrollWidthIssues.push(`capture ${pct}% sw=${s.sw} iw=${s.iw}`);
        const file = path.join(OUT, `w${w}_p${String(pct).padStart(3, '0')}.png`);
        await page.screenshot({ path: file });
        m.shots.push({ pct, file, y, max: s.max });
      }
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1200);
      const file = path.join(OUT, `w${w}_reduced_full.png`);
      await page.screenshot({ path: file, fullPage: true });
      const s = await measure();
      m.shots.push({ pct: 'reduced-full', file, max: s.max });
      m.reducedInfo = await page.evaluate(() => ({ prm: window.matchMedia('(prefers-reduced-motion: reduce)').matches, sh: document.documentElement.scrollHeight }));
    }
  } catch (e) {
    m.fatal = String(e && e.message ? e.message : e).split('\n')[0];
  }
  await ctx.close();
  return m;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const res = {};
  try {
    for (const [w, h] of WIDTHS) {
      res[w] = await run(browser, w, h, {});
      console.log(`done ${w}`);
    }
    res.reduced1440 = await run(browser, 1440, 900, { reducedMotion: 'reduce' });
    console.log('done reduced');
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'mesures.json'), JSON.stringify(res, null, 2));
  console.log('written');
})().catch((e) => { console.error('FATAL', e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : e); process.exit(1); });
