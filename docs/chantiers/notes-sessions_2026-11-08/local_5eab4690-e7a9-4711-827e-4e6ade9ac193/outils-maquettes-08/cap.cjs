// node cap.cjs <url> <outPrefix> <w> <h> [steps-json]
// steps: [{"scroll":"#sel"},{"click":"#sel"},{"wait":800},{"shot":"name"},{"full":"name"},{"el":["name","#sel"]},{"eval":"js"}]
const path = require('path');
const { chromium } = require(path.join('C:/Users/Nolann/Desktop/Test viraaaal', 'node_modules', 'playwright-core'));
(async () => {
  const [url, out, w = '1440', h = '900', stepsJson = '[]'] = process.argv.slice(2);
  const steps = JSON.parse(stepsJson);
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, colorScheme: 'dark', reducedMotion: process.env.RM ? 'reduce' : 'no-preference', deviceScaleFactor: +(process.env.DPR || 1), hasTouch: +w < 1024, isMobile: +w < 700 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('requestfailed', r => errs.push('reqfail: ' + r.url().replace(/^.*\/(docs|public)\//, '$1/') + ' ' + (r.failure() || {}).errorText));
  p.on('response', r => { if (r.status() >= 400) errs.push('http ' + r.status() + ': ' + r.url()); });
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(900);
  for (const s of steps) {
    if (s.scroll) { await p.locator(s.scroll).first().scrollIntoViewIfNeeded(); await p.evaluate(sel => { const e = document.querySelector(sel); if (e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - (window.__off || 60)); }, s.scroll); await p.waitForTimeout(700); }
    if (s.click) { await p.locator(s.click).first().click(); await p.waitForTimeout(s.after || 900); }
    if (s.wait) await p.waitForTimeout(s.wait);
    if (s.eval) { const r = await p.evaluate(s.eval); if (r !== undefined) console.log('eval:', JSON.stringify(r)); }
    if (s.shot) { await p.screenshot({ path: `${out}_${s.shot}.png` }); console.log('shot', s.shot); }
    if (s.full) { await p.screenshot({ path: `${out}_${s.full}.png`, fullPage: true }); console.log('full', s.full); }
    if (s.el) { await p.locator(s.el[1]).first().screenshot({ path: `${out}_${s.el[0]}.png` }); console.log('el', s.el[0]); }
  }
  const sw = await p.evaluate(() => { const cw = document.documentElement.clientWidth; const bad = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); if (r.right <= cw + 1 || !r.width) return false; for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== 'visible') return false; } return true; }).slice(0, 6).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '') + ' r=' + Math.round(e.getBoundingClientRect().right)); return { sw: document.documentElement.scrollWidth, cw, bad }; });
  console.log('scrollWidth', JSON.stringify(sw));
  if (errs.length) console.log('ERRORS', errs.join(' | ')); else console.log('0 errors');
  await b.close();
})();
