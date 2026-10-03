// Signale toutes les URLs du sitemap à Bing (et Yandex, Seznam...) via
// IndexNow, le protocole officiel pour qu'un moteur vienne indexer une page
// sans attendre de la découvrir tout seul. À relancer après chaque ajout ou
// modification importante de pages : `node scripts/indexnow.mjs`.
// La clé doit être publiée à https://nasap3d.com/<clé>.txt (fichier dans
// public/) — IndexNow vérifie ce fichier pour prouver qu'on possède le site.
const HOST = "nasap3d.com";
const KEY = "60c564032d1e534214fa52add71b56f6";

const keyRes = await fetch(`https://${HOST}/${KEY}.txt`);
const keyBody = keyRes.ok ? (await keyRes.text()).trim() : null;
if (keyBody !== KEY) {
  console.error(`Fichier clé introuvable ou incorrect sur https://${HOST}/${KEY}.txt (HTTP ${keyRes.status}) — déployer d'abord.`);
  process.exit(1);
}

const sitemap = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (urlList.length === 0) {
  console.error("Aucune URL trouvée dans le sitemap.");
  process.exit(1);
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
});
console.log(`IndexNow: HTTP ${res.status} pour ${urlList.length} URLs (200/202 = accepté)`);
if (!res.ok && res.status !== 202) console.log(await res.text());
