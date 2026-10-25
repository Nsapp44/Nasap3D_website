// Convertit les rendus pré-calculés (PNG RGBA 1600x1200) en images web pour le viewer MaquetteCarousel.
// Usage : node scripts/build-maquette-frames.mjs [dossier_final] [id_maquette]
//   dossier_final : contient base/, rank/, glow/ avec des e<elev>_a<NNN>.png (défaut ci-dessous)
//   id_maquette   : sous-dossier de sortie dans public/assets/maquettes/ (défaut : cellule)
// Sortie : public/assets/maquettes/<id>/{base,sm,rank,glow}/e<elev>_a<NNN>.{webp,avif}
//   base : 1200x900 (webp+avif q80) ; sm : 640x480 (mobile) ; rank/glow : 800x600 fixe, sans perte,
//   redimensionnés au plus proche voisin (le rang R*255 ne doit jamais être interpolé).
// Relançable : saute les fichiers déjà à jour (date de modification).
import sharp from "sharp";
import { readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2] || "C:/Users/Nolann/Desktop/Nasap3D website/Source machine/glb/final";
const id = process.argv[3] || "cellule";
const out = path.join(root, "public", "assets", "maquettes", id);
const Q = 80;

const fresh = async (a, b) => {
  try { return (await stat(b)).mtimeMs >= (await stat(a)).mtimeMs; } catch { return false; }
};

async function list(dir) {
  try { return (await readdir(dir)).filter((f) => /^e\d+_a\d+\.png$/.test(f)).sort(); } catch { return []; }
}

let total = { base: 0, sm: 0, rank: 0, glow: 0 };
let count = 0, skipped = 0;
const add = async (kind, file) => { total[kind] += (await stat(file)).size; };

async function job(kind, inFile, name, w, h, opts) {
  const dir = path.join(out, kind);
  await mkdir(dir, { recursive: true });
  const jobs = [];
  const targets = [["webp", opts.webp]];
  if (opts.avif) targets.push(["avif", opts.avif]);
  for (const [ext, o] of targets) {
    const dest = path.join(dir, `${name}.${ext}`);
    if (await fresh(inFile, dest)) { skipped++; await add(kind, dest); continue; }
    jobs.push(
      sharp(inFile)
        .resize(w, h, { fit: "fill", kernel: opts.kernel })
        [ext](o)
        .toFile(dest)
        .then(() => add(kind, dest)),
    );
    count++;
  }
  await Promise.all(jobs);
}

const base = await list(path.join(src, "base"));
const rank = await list(path.join(src, "rank"));
const glow = await list(path.join(src, "glow"));
console.log(`Source : ${src}\n  base ${base.length}, rank ${rank.length}, glow ${glow.length} images`);
if (!base.length) { console.log("Aucune image de base : rien à faire."); process.exit(0); }

// Par lots pour limiter la mémoire.
const run = async (files, fn) => {
  for (let i = 0; i < files.length; i += 4) await Promise.all(files.slice(i, i + 4).map(fn));
};
const nm = (f) => f.replace(/\.png$/, "");
const lossy = { webp: { quality: Q, effort: 5 }, avif: { quality: Q - 15, effort: 4 } };
await run(base, async (f) => {
  const i = path.join(src, "base", f);
  await job("base", i, nm(f), 1200, 900, { ...lossy, kernel: "lanczos3" });
  await job("sm", i, nm(f), 640, 480, { ...lossy, kernel: "lanczos3" });
});
// Calques LED : sans perte, plus proche voisin, 800x600 pour les deux. `exact` garde R sous alpha partiel.
const lossless = { webp: { lossless: true, exact: true, effort: 4 }, kernel: "nearest" };
for (const [kind, files] of [["rank", rank], ["glow", glow]]) {
  await run(files, (f) => job(kind, path.join(src, kind, f), nm(f), 800, 600, lossless));
}

const mb = (n) => (n / 1048576).toFixed(2) + " Mo";
console.log(`Écrit ${count} fichiers (${skipped} déjà à jour) dans ${out}`);
console.log(`Poids (webp+avif) : base ${mb(total.base)}, sm ${mb(total.sm)}, rank ${mb(total.rank)}, glow ${mb(total.glow)}`);
console.log(`Desktop (base+rank+glow) ≈ ${mb(total.base + total.rank + total.glow)} ; mobile (sm+rank+glow) ≈ ${mb(total.sm + total.rank + total.glow)}`);
console.log("Note : le poids chargé par un visiteur est celui d'UN format (avif OU webp), soit environ la moitié si les deux sont présents.");
