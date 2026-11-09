(function () {
  "use strict";
  var P0 = "/storyboard/cellule/";
  var sb = document.querySelector(".sb");
  if (!sb) return;
  var hasG = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
  if (!hasG) sb.classList.remove("anim");
  var mo = sb.classList.contains("mo");

  if (!(hasG && mo)) return; // rendu statique complet

  gsap.registerPlugin(ScrollTrigger);
  var $ = function (s) { return sb.querySelector(s); };
  var scene = $("#sb-scene"), box = $("#sb-box"), cv = $("#sb-cv"), ctx = cv.getContext("2d");
  var poster = $("#sb-poster"), loader = $("#sb-loader");
  var pw = $("#sb-pw");
  var legs = [$("#sb-lg0"), $("#sb-lg1"), $("#sb-lg2")], pzg = $("#sb-pzg"), pzw = $("#sb-pzw");
  var small = innerWidth < 768;
  var cs = getComputedStyle(sb);
  var BG = cs.getPropertyValue("--bg").trim() || "#161514", ACC = cs.getPropertyValue("--accent").trim() || "#ff5a3c";

  /* Positions des légendes, par image du tas d'électronique (repère 640 × 480) */
  var ELEC = {"led":[[178.1,295.2],[177.3,293.5],[176.6,291.7],[175.9,290.0],[175.4,288.2],[174.9,286.5],[174.5,284.7],[174.2,283.0],[173.9,281.2],[173.7,279.5],[173.5,277.7],[173.5,276.0],[173.5,274.3],[173.5,272.5]],"esp":[[423.4,329.3],[420.9,330.6],[418.5,331.9],[415.9,333.1],[413.3,334.3],[410.6,335.5],[407.9,336.7],[405.1,337.7],[402.3,338.8],[399.4,339.9],[396.5,340.9],[393.5,341.8],[390.5,342.7],[387.4,343.6]],"bouton":[[513.9,276.2],[512.9,278.5],[511.9,280.8],[510.7,283.1],[509.4,285.4],[508.1,287.7],[506.6,289.9],[505.0,292.2],[503.3,294.4],[501.6,296.7],[499.7,298.9],[497.8,301.1],[495.7,303.2],[493.5,305.4]]};
  var LEGK = ["led", "esp", "bouton"];
  /* Gros plan des aimants dans la vue d'ensemble (repère 640 × 480) */
  var RB = [204.2, 59.1, 287.0, 215.2];

  /* ---- Images ---- */
  var SEQ = {
    ecl: { n: 28, dir: "eclate3", arr: [] },
    ele: { n: 14, dir: "elec", arr: [] },
    lum: { n: 16, dir: "lumiere3", arr: [] },
    aim: { n: 18, dir: "aimant3", arr: [] }
  };
  var HD = null, BASE = null, glowImg = null, LED = null, CELL = null, ledFail = false;
  var started = {}, ver = 0, rq = 0;
  function pad(i) { return String(i).padStart(3, "0"); }
  function bump() { ver++; if (!rq) rq = requestAnimationFrame(function () { rq = 0; render(); }); }
  function loadImg(src) {
    return new Promise(function (res) {
      var im = new Image(); im.decoding = "async"; im.src = src;
      var p = im.decode ? im.decode() : new Promise(function (a, b) { im.onload = a; im.onerror = b; });
      p.then(function () { res(im); }, function () { res(null); });
    });
  }
  function loadSeq(name) {
    if (started[name]) return; started[name] = 1;
    var s = SEQ[name], ids = [];
    for (var i = 0; i < s.n; i++) if (!small || i % 2 === 0 || i === s.n - 1) ids.push(i);
    var w = function (i) { return (i === s.n - 1 || i % 4 === 0) ? 0 : (i % 2 === 0 ? 1 : 2); };
    ids.sort(function (a, b) { return w(a) - w(b) || a - b; });
    ids.forEach(function (i) {
      if (s.arr[i]) return;
      loadImg(P0 + s.dir + "/f_" + pad(i) + ".webp").then(function (im) { if (im) { s.arr[i] = im; bump(); } });
    });
  }
  function loadHd() { return; /* HD 027 inutilisee depuis que l eclate s arrete a 17 */ if (small || HD) return; loadImg(P0 + "eclate3/hd_027.webp").then(function (im) { if (im) { HD = im; bump(); } }); }
  function loadBase() { if (started.base) return; started.base = 1; loadImg(P0 + "aimant3/base.webp").then(function (im) { if (im) { BASE = im; bump(); } }); }
  function pick(arr, i, n) {
    for (var d = 0; d < n; d++) {
      if (arr[i + d]) return [arr[i + d], d];
      if (i - d >= 0 && arr[i - d]) return [arr[i - d], d];
    }
    return [null, 99];
  }
  loadImg(P0 + "eclate3/f_000.webp").then(function (im) { if (im) { SEQ.ecl.arr[0] = im; bump(); } });

  /* ---- Chenille LED : une seule extraction, hors scrub ---- */
  var LED_W = 800, LED_H = 600, LED_FADE = 0.12;
  var sc = document.createElement("canvas"); sc.width = LED_W; sc.height = LED_H;
  var sctx = sc.getContext("2d", { willReadFrequently: true });
  var lc = document.createElement("canvas"); lc.width = LED_W; lc.height = LED_H;
  var lctx = lc.getContext("2d");
  var hc = document.createElement("canvas"); hc.width = 160; hc.height = 120;
  var hctx = hc.getContext("2d"); hctx.imageSmoothingQuality = "high";
  var idat = lctx.createImageData(LED_W, LED_H);
  var ledK = -1, ledHas = false;

  function buildLed(ri, gi) {
    sctx.clearRect(0, 0, LED_W, LED_H); sctx.drawImage(ri, 0, 0, LED_W, LED_H);
    var R = sctx.getImageData(0, 0, LED_W, LED_H).data;
    sctx.clearRect(0, 0, LED_W, LED_H); sctx.drawImage(gi, 0, 0, LED_W, LED_H);
    var G = sctx.getImageData(0, 0, LED_W, LED_H).data;
    var N = LED_W * LED_H, RK = new Float32Array(N).fill(-1), p, it, x, y;
    for (p = 0; p < N; p++) if (R[p * 4 + 3]) RK[p] = R[p * 4] / 255;
    for (it = 0; it < 6; it++) {
      var nx = RK.slice();
      for (y = 1; y < LED_H - 1; y++) for (x = 1; x < LED_W - 1; x++) {
        p = y * LED_W + x;
        if (RK[p] >= 0 || !G[p * 4 + 3]) continue;
        var best = -1, nb = [p - 1, p + 1, p - LED_W, p + LED_W, p - LED_W - 1, p - LED_W + 1, p + LED_W - 1, p + LED_W + 1];
        for (var k = 0; k < 8; k++) { var r = RK[nb[k]]; if (r >= 0 && (best < 0 || r < best)) best = r; }
        if (best >= 0) nx[p] = best;
      }
      RK.set(nx);
    }
    var n = 0;
    for (p = 0; p < N; p++) if (G[p * 4 + 3] && RK[p] >= 0) n++;
    var L = { n: n, pos: new Uint32Array(n), rank: new Float32Array(n), rgba: new Uint8Array(n * 4) }, j = 0;
    for (p = 0; p < N; p++) {
      var o = p * 4;
      if (!G[o + 3] || RK[p] < 0) continue;
      L.pos[j] = o; L.rank[j] = RK[p];
      L.rgba[j * 4] = G[o]; L.rgba[j * 4 + 1] = G[o + 1]; L.rgba[j * 4 + 2] = G[o + 2]; L.rgba[j * 4 + 3] = G[o + 3];
      j++;
    }
    return L;
  }
  function paintLed(L, t) {
    var d = idat.data, te = t * (1 + LED_FADE);
    d.fill(0);
    if (te <= 0) return false;
    for (var j = 0; j < L.n; j++) {
      var vis = (te - L.rank[j]) / LED_FADE;
      if (vis <= 0) continue;
      var o = L.pos[j], q = j * 4, f = vis >= 1 ? 1 : vis;
      d[o] = L.rgba[q]; d[o + 1] = L.rgba[q + 1]; d[o + 2] = L.rgba[q + 2]; d[o + 3] = L.rgba[q + 3] * f;
    }
    lctx.putImageData(idat, 0, 0);
    hctx.clearRect(0, 0, 160, 120); hctx.drawImage(lc, 0, 0, 160, 120);
    return true;
  }
  function loadLed() {
    if (started.led) return; started.led = 1;
    loadImg(P0 + "led/cell.webp").then(function (im) { if (im) { CELL = im; bump(); } });
    Promise.all([loadImg(P0 + "led/rank.webp"), loadImg(P0 + "led/glow.webp")]).then(function (r) {
      if (!r[0] || !r[1]) return;
      glowImg = r[1];
      try { LED = buildLed(r[0], r[1]); } catch (e) { LED = null; ledFail = true; }
      bump();
    });
  }
  function drawLed(a, t) {
    if (a < 0.004) return;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    if (LED) {
      var k = Math.round(t * 200);
      if (k !== ledK) { ledK = k; ledHas = paintLed(LED, k / 200); }
      if (ledHas) {
        ctx.globalAlpha = a; ctx.drawImage(lc, 0, 0, cw, ch);
        ctx.globalAlpha = a * 0.7; ctx.drawImage(hc, 0, 0, cw, ch);
      }
    } else if (ledFail && glowImg) {
      ctx.globalAlpha = a * t; ctx.drawImage(glowImg, 0, 0, cw, ch);
    }
    ctx.restore();
  }

  /* ---- État piloté par la timeline ---- */
  var P = { aEcl: 0, ecl: 0, zoom: 1.5, cx: 320, cy: 240, cut: 0, elec: 0,
            aLum: 0, lum: 0, aAim: 0, az: 0, gA: 0, aim: 0, ledT: 0, ledA: 0, cellA: 0 };
  var cw = 0, ch = 0, bw = 0, bh = 0, lw = [0, 0, 0], lh = [0, 0, 0], lastKey = "", dpr = 1;

  function r2(v) { return Math.round(v * 100); }
  function drawEcl(e) {
    var im, d = 0;
    if (e === 27 && HD) { im = HD; }
    else { var pk = pick(SEQ.ecl.arr, e, 28); im = pk[0]; d = pk[1]; }
    if (!im) return 99;
    var k = im.naturalWidth / 640, z = P.zoom, sw = 640 / z * k, sh = 480 / z * k;
    var sx = Math.min(Math.max(P.cx * k - sw / 2, 0), im.naturalWidth - sw);
    var sy = Math.min(Math.max(P.cy * k - sh / 2, 0), im.naturalHeight - sh);
    ctx.drawImage(im, sx, sy, sw, sh, 0, 0, cw, ch);
    return d;
  }
  /* Plan de coupe : une bande verticale révèle le tas d'électronique, puis rend l'éclaté */
  function drawCut() {
    var c = P.cut; if (c <= 0.001 || c >= 1.999) return 0;
    var x0 = Math.max(0, c - 1) * cw, x1 = Math.min(1, c) * cw;
    if (x1 - x0 < 1) return 0;
    var pk = pick(SEQ.ele.arr, Math.round(P.elec), 14);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, x1 - x0, ch); ctx.clip();
    ctx.fillStyle = BG; ctx.fillRect(0, 0, cw, ch);
    if (pk[0]) ctx.drawImage(pk[0], 0, 0, cw, ch);
    ctx.restore();
    var lwid = Math.max(2, 2 * dpr);
    ctx.save(); ctx.fillStyle = ACC; ctx.shadowColor = ACC; ctx.shadowBlur = 14 * dpr;
    ctx.fillRect((c < 1 ? x1 : x0) - lwid / 2, 0, lwid, ch);
    ctx.restore();
    return pk[1];
  }
  var mc = null, mctx = null;
  function drawLum(i) {
    var pk = pick(SEQ.lum.arr, i, 16), im = pk[0];
    if (!im) return 99;
    // « contain » centré + masque elliptique doux (fondu vers le fond, aucun bord rectangulaire)
    if (!mc || mc.width !== cw || mc.height !== ch) { mc = document.createElement("canvas"); mc.width = cw; mc.height = ch; mctx = mc.getContext("2d"); }
    var iw = cw, ih = cw * im.naturalHeight / im.naturalWidth, oy = (ch - ih) / 2, rx = cw / 2, ry = ih / 2;
    mctx.globalCompositeOperation = "source-over"; mctx.clearRect(0, 0, cw, ch);
    mctx.drawImage(im, 0, oy, iw, ih);
    mctx.globalCompositeOperation = "destination-in";
    mctx.save(); mctx.translate(cw / 2, ch / 2); mctx.scale(1, ry / rx);
    var g = mctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.55, "rgba(0,0,0,1)"); g.addColorStop(0.8, "rgba(0,0,0,0.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
    mctx.fillStyle = g; mctx.fillRect(-rx, -rx, 2 * rx, 2 * rx); mctx.restore();
    ctx.drawImage(mc, 0, 0);
    return pk[1];
  }
  function drawAim(a) {
    var worst = 0, z = P.az, k;
    if (BASE) {
      k = BASE.naturalWidth / 640;
      var sx = RB[0] * z, sy = RB[1] * z, sw = 640 + (RB[2] - 640) * z, sh = 480 + (RB[3] - 480) * z;
      ctx.drawImage(BASE, sx * k, sy * k, sw * k, sh * k, 0, 0, cw, ch);
    } else worst = 99;
    if (P.gA > 0.003) {
      var pk = pick(SEQ.aim.arr, a, 18);
      if (pk[0]) {
        var ga = ctx.globalAlpha; ctx.globalAlpha = ga * P.gA; ctx.drawImage(pk[0], 0, 0, cw, ch); ctx.globalAlpha = ga;
        worst = Math.max(worst, pk[1]);
      } else worst = 99;
    }
    return worst;
  }
  function render(force) {
    if (!cw) return;
    var e = Math.round(P.ecl), l = Math.round(P.lum), a = Math.round(P.aim);
    var key = [cw, ver, r2(P.aEcl), e, r2(P.zoom), r2(P.cx), r2(P.cy), r2(P.cut), Math.round(P.elec), r2(P.aLum), l, r2(P.aAim), r2(P.az), r2(P.gA), a, Math.round(P.ledT * 200), r2(P.ledA), r2(P.cellA)].join("|");
    if (key === lastKey && !force) return;
    lastKey = key;
    ctx.clearRect(0, 0, cw, ch);
    var worst = 0;
    if (P.aEcl > 0.003 && !SEQ.ecl.arr[0]) pw.style.opacity = "1";
    if (P.aEcl > 0.003) { ctx.globalAlpha = P.aEcl; worst = Math.max(worst, drawEcl(e), drawCut()); }
    if (P.aLum > 0.003) { ctx.globalAlpha = P.aLum; worst = Math.max(worst, drawLum(l)); }
    if (P.aAim > 0.003) {
      ctx.globalAlpha = P.aAim; worst = Math.max(worst, drawAim(a));
      if (CELL && P.cellA > 0.003 && P.az < 0.01) { var ga0 = ctx.globalAlpha; ctx.globalAlpha = ga0 * P.cellA; ctx.drawImage(CELL, 0, 0, cw, ch); ctx.globalAlpha = ga0; }
      if (P.ledA > 0.003 && P.az < 0.01) drawLed(P.ledA * P.aAim, P.ledT);
    }
    ctx.globalAlpha = 1;
    loader.style.opacity = worst > 2 ? "1" : "0";
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    bw = box.clientWidth; bh = box.clientHeight;
    cw = Math.max(1, Math.round(bw * dpr)); ch = Math.round(cw * 3 / 4);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    for (var i = 0; i < 3; i++) { lw[i] = legs[i].lastChild.offsetWidth; lh[i] = legs[i].lastChild.offsetHeight; }
    updateLegs();
    render(true);
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(box); else addEventListener("resize", resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);

  /* Légendes : suivent les coordonnées du tas d'électronique, image par image */
  function updateLegs() {
    var f = Math.min(Math.max(P.elec, 0), 13), i0 = Math.floor(f), i1 = Math.min(13, i0 + 1), t = f - i0;
    var placed = [], pts = [], i, GAP = 14, M = 6;
    for (i = 0; i < 3; i++) {
      var a = ELEC[LEGK[i]][i0], b = ELEC[LEGK[i]][i1];
      pts.push([(a[0] + (b[0] - a[0]) * t) / 640 * bw, (a[1] + (b[1] - a[1]) * t) / 480 * bh]);
    }
    var segs = [];
    function hit(r, s) { return r[0] < s[2] + 4 && r[2] > s[0] - 4 && r[1] < s[3] + 4 && r[3] > s[1] - 4; }
    /* le trait (segment [x0,y0,x1,y1]) croise-t-il le rectangle r ? échantillonné tous les ~3 px */
    function segHit(s, r) {
      if (!s) return false;
      var n = Math.max(2, Math.ceil(Math.sqrt((s[2] - s[0]) * (s[2] - s[0]) + (s[3] - s[1]) * (s[3] - s[1])) / 3)), k, px, py;
      for (k = 0; k <= n; k++) {
        px = s[0] + (s[2] - s[0]) * k / n; py = s[1] + (s[3] - s[1]) * k / n;
        if (px > r[0] - 3 && px < r[2] + 3 && py > r[1] - 3 && py < r[3] + 3) return true;
      }
      return false;
    }
    function free(r, self, sg) {
      var k, o;
      for (k = 0; k < placed.length; k++) if (hit(r, placed[k]) || segHit(sg, placed[k]) || segHit(segs[k], r)) return false;
      for (k = 0; k < 3; k++) if (k !== self) {
        o = [pts[k][0] - 9, pts[k][1] - 9, pts[k][0] + 9, pts[k][1] + 9];
        if (hit(r, o) || segHit(sg, o)) return false;
      }
      return true;
    }
    for (i = 0; i < 3; i++) {
      /* largeur/hauteur de pastille : remesurer si la mesure du resize était vide (légende masquée, police pas chargée) */
      if (!lw[i] || !lh[i]) { lw[i] = legs[i].lastChild.offsetWidth; lh[i] = legs[i].lastChild.offsetHeight; }
      var x = pts[i][0], y = pts[i][1], w = lw[i], h = lh[i] || 32;
      var inset = Math.min(h / 2, w / 2);
      /* trait du point au bord de la pastille (vertical de g px si elle est centrée sur le point) */
      var segFor = function (tx, up, g) {
        var ex = Math.min(Math.max(0, tx + inset), tx + w - inset), ey = up ? -g : g;
        return [x, y, x + ex, y + ey];
      };
      var ox = -w / 2;
      if (x + ox < 0) ox = -x; else if (x + ox + w > bw) ox = bw - w - x;
      /* essais : au-dessus, au-dessous, décalage horizontal des deux côtés, puis pastille éloignée verticalement (trait plus long) */
      var tries = [[ox, true], [ox, false]], d, best = null;
      for (d = 1; d <= 12; d++) { tries.push([ox - d * 14, true], [ox + d * 14, true], [ox - d * 14, false], [ox + d * 14, false]); }
      for (var lv = 0; lv <= 6 && !best; lv++) {
        var g = GAP + lv * 14;
        for (var q = 0; q < tries.length; q++) {
          var tx = tries[q][0], up = tries[q][1];
          if (x + tx < 0 || x + tx + w > bw) continue;
          var top = up ? y - g - h : y + g;
          if (top < 0 || top + h > bh) continue;
          var r = [x + tx, top, x + tx + w, top + h];
          if (free(r, i, segFor(tx, up, g))) { best = [tx, up, r, g]; break; }
        }
      }
      if (!best) { var up0 = y - GAP - h >= 0; best = [ox, up0, [x + ox, up0 ? y - GAP - h : y + GAP, x + ox + w, (up0 ? y - GAP - h : y + GAP) + h], GAP]; }
      placed.push(best[2]); segs.push(segFor(best[0], best[1], best[3]));
      legs[i].style.left = x.toFixed(1) + "px"; legs[i].style.top = y.toFixed(1) + "px";
      legs[i].lastChild.style.setProperty("--ox", best[0].toFixed(1) + "px");
      legs[i].lastChild.style.setProperty("--oy", best[3] + "px");
      legs[i].classList.toggle("below", !best[1]);
      /* trait fin du point au bord de la pastille (toujours : point + trait + pastille) */
      var ln = legs[i].firstChild, ex = segs[i][2] - x, ey = segs[i][3] - y;
      ln.style.width = Math.sqrt(ex * ex + ey * ey).toFixed(1) + "px";
      ln.style.transform = "rotate(" + Math.atan2(ey, ex).toFixed(4) + "rad)";
    }
  }

  /* ---- Temps courant : description du canvas ---- */
  var TH = [0, 0.08, 0.26, 0.42, 0.50, 0.62, 0.76, 0.90];
  var LAB = [
    "Cellule verte, vue de loin, en cours de mise au point",
    "Cellule verte qui s'ouvre, coques écartées",
    "Plan de coupe sur le petit tas d'électronique : bandeau LED, carte ESP, bouton capacitif",
    "Cellule qui se remonte, coques refermées",
    "Surface peinte de la cellule, un reflet clair la traverse",
    "Gros plan des pièces aimantées : elles se soulèvent puis se remettent en place",
    "Cellule complète : une pression sur le bouton, la bande de points s'allume",
    "Cellule complète, bande de points allumée"
  ];
  var curT = -1;
  function setTime(p) {
    var t = 0;
    for (var i = 0; i < TH.length; i++) if (p >= TH[i]) t = i;
    if (t === curT) return;
    curT = t; cv.setAttribute("aria-label", LAB[t]);
  }

  /* ---- Timeline maîtresse (durée 1 = toute la scène) ---- */
  var pzw2 = $("#sb-pzw2"), t5bh = $("#sb-t5b h2");
  gsap.set([pzg, pzw, pzw2], { opacity: 0, scale: 1, xPercent: -50, yPercent: -50, transformOrigin: "50% 50%" });
  var tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: scene, start: "top top", end: "bottom bottom", scrub: 1,
      onUpdate: function (self) {
        var p = self.progress;
        if (p > 0) loadSeq("ecl");
        if (p > 0.12) loadSeq("ele");
        if (p > 0.30) loadSeq("lum");
        if (p > 0.40) { loadSeq("aim"); loadBase(); loadLed(); }
      }
    },
    onUpdate: function () { setTime(tl.progress()); updateLegs(); render(); }
  });
  var inT = function (id, t) { tl.to(id, { opacity: 1, y: 0, duration: 0.015, ease: "power1.out" }, t); };
  var outT = function (id, t) { tl.to(id, { opacity: 0, duration: 0.012 }, t); };

  // 0 – 0,08 : arrivée (titre net, image floue qui zoome)
  tl.to(poster, { scale: 1.5, filter: "blur(0px)", duration: 0.08, ease: "power1.out" }, 0);
  outT("#sb-t1", 0.066);
  // 0,08 – 0,26 : éclaté
  tl.set(P, { aEcl: 1 }, 0.08);
  tl.to(pw, { opacity: 0, duration: 0.02 }, 0.08);
  inT("#sb-t2", 0.085);
  tl.to(P, { ecl: 17, duration: 0.16, ease: "power1.inOut" }, 0.10);
  tl.to(P, { zoom: 1, duration: 0.16, ease: "power1.inOut" }, 0.10);
  outT("#sb-t2", 0.25);
  // 0,26 – 0,42 : plan de coupe « Électronique intégrée »
  inT("#sb-t3", 0.265);
  tl.to(P, { cut: 1, duration: 0.05, ease: "power1.inOut" }, 0.265);
  tl.to(P, { elec: 13, duration: 0.14 }, 0.28);
  tl.to(legs[0], { opacity: 1, duration: 0.01 }, 0.295);
  tl.to(legs[1], { opacity: 1, duration: 0.01 }, 0.305);
  tl.to(legs[2], { opacity: 1, duration: 0.01 }, 0.315);
  tl.to(legs, { opacity: 0, duration: 0.01, immediateRender: false }, 0.385);
  tl.to(P, { cut: 2, duration: 0.03, ease: "power1.inOut" }, 0.39);
  outT("#sb-t3", 0.405);
  // 0,42 – 0,50 : remontage (l'éclaté à l'envers)
  tl.to(P, { ecl: 0, duration: 0.08, ease: "power1.inOut" }, 0.42);
  tl.to(P, { zoom: 1.5, duration: 0.08, ease: "power1.inOut" }, 0.42);
  // 0,50 – 0,62 : finition
  tl.to(P, { aEcl: 0, duration: 0.03 }, 0.50);
  tl.to(P, { aLum: 1, duration: 0.03 }, 0.50);
  tl.to(P, { lum: 15, duration: 0.12 }, 0.50);
  inT("#sb-t4", 0.51);
  outT("#sb-t4", 0.605);
  // 0,62 – 0,76 : aimants, zoom continu base -> gros plan -> base
  tl.to(P, { aLum: 0, duration: 0.02 }, 0.62);
  tl.to(P, { aAim: 1, duration: 0.02 }, 0.62);
  inT("#sb-t5a", 0.63);
  tl.to(P, { az: 1, duration: 0.04, ease: "power2.inOut" }, 0.62);
  tl.to(P, { gA: 1, duration: 0.012 }, 0.655);
  tl.to(P, { aim: 17, duration: 0.06 }, 0.665);
  tl.to(P, { gA: 0, duration: 0.012 }, 0.725);
  tl.to(P, { az: 0, duration: 0.03, ease: "power2.inOut" }, 0.73);
  outT("#sb-t5a", 0.745);
  // 0,76 – 0,88 : un bouton, et elle s'éclaire (pression 2D puis chenille LED)
  tl.to(P, { cellA: 1, duration: 0.012 }, 0.762);
  inT("#sb-t5b", 0.765);
  // onde de choc : un disque lumineux et deux anneaux partent du bouton, la légende et la bande réagissent à son passage
  // (variante C : lueur + 2 petits anneaux fins ; durées de la preview x 0,08)
  tl.fromTo(pzg, { opacity: 0, scale: 0.5 }, { opacity: 0.8, scale: 0.9, duration: 0.0096, ease: "power3.out", immediateRender: false }, 0.781);
  tl.to(pzg, { opacity: 0, duration: 0.04, ease: "power1.in", immediateRender: false }, 0.7906);
  tl.fromTo(pzw2, { opacity: 0.9, scale: 0.3 }, { opacity: 0, scale: 1, duration: 0.048, ease: "power3.out", immediateRender: false }, 0.781);
  tl.set(pzw, { opacity: 0.7, scale: 0.3 }, 0.781); // comme la preview : le grand anneau attend, petit, dès le clic
  tl.fromTo(pzw, { opacity: 0.7, scale: 0.3 }, { opacity: 0, scale: 1, duration: 0.056, ease: "power3.out", immediateRender: false }, 0.789);
  tl.to(t5bh, { color: "#ff5a3c", duration: 0.006 }, 0.805);
  tl.to(t5bh, { color: "#f3efe9", duration: 0.036 }, 0.812);
  tl.to(P, { ledA: 1, duration: 0.005 }, 0.80);
  tl.to(P, { ledT: 1, duration: 0.065 }, 0.805);
  outT("#sb-t5b", 0.875);
  // 0,875+ : fin de scène — le produit fini (LED allumées) reste affiché jusqu'à la sortie, sans légendes ni éclats
  tl.to(legs, { opacity: 0, duration: 0.005, immediateRender: false }, 0.875);
  tl.to([pzg, pzw, pzw2], { opacity: 0, duration: 0.005, immediateRender: false }, 0.875);
  inT("#sb-t7a", 0.90);
  tl.to({}, { duration: 0.0001 }, 1); // la timeline dure 1 : derniers ~8 % = produit tenu

  /* ---- Chargement progressif ---- */
  function first() { removeEventListener("scroll", first); loadSeq("ecl"); }
  addEventListener("scroll", first, { passive: true });
  if (scrollY > 0) loadSeq("ecl");

  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { resize(); ScrollTrigger.refresh(); });
  setTime(0);
})();