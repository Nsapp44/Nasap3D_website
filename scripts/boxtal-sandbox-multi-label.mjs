// Achète une étiquette à 2 colis (S + XL) sur le BAC À SABLE Boxtal, pour
// vérifier que api/v1/order accepte colis_1 + colis_2 et ce que renvoie la
// réponse (référence, étiquettes). Refuse de tourner hors bac à sable.
//
// Usage : node scripts/boxtal-sandbox-multi-label.mjs
// Même format de paramètres que purchaseShippingLabel() (src/lib/server/boxtal.ts).
import { XMLParser } from "fast-xml-parser";

try {
  process.loadEnvFile(".env");
} catch {
  /* variables déjà dans l'environnement */
}

const BASE_URL = process.env.BOXTAL_BASE_URL || "https://www.envoimoinscher.com/";
if (!BASE_URL.includes("test.")) {
  console.error(`REFUS : BOXTAL_BASE_URL (${BASE_URL}) n'est pas le bac à sable (doit contenir "test.").`);
  process.exit(1);
}

const env = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Variable manquante : ${k}`);
    process.exit(1);
  }
  return v;
};

const auth = Buffer.from(`${env("BOXTAL_API_KEY_V1")}:${env("BOXTAL_API_SECRET_V1")}`).toString("base64");
const phone = "+33" + env("BOXTAL_SHIPPER_PHONE").replace(/\D/g, "").replace(/^0/, "");

// S (15×15×11 cm) + XL (62×42×33 cm), poids en kg.
const parcels = [
  { weightKg: 0.3, outerCm: [15, 15, 11] },
  { weightKg: 4.0, outerCm: [62, 42, 33] },
];

const nextBusinessDay = () => {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

const params = new URLSearchParams({
  "shipper.country": env("BOXTAL_SHIPPER_COUNTRY"),
  "shipper.zipcode": env("BOXTAL_SHIPPER_ZIPCODE"),
  "shipper.city": env("BOXTAL_SHIPPER_CITY"),
  "shipper.address": env("BOXTAL_SHIPPER_ADDRESS"),
  "shipper.type": "company",
  "shipper.firstname": env("BOXTAL_SHIPPER_FIRSTNAME"),
  "shipper.lastname": env("BOXTAL_SHIPPER_LASTNAME"),
  "shipper.societe": env("BOXTAL_SHIPPER_COMPANY"),
  "shipper.email": env("BOXTAL_SHIPPER_EMAIL"),
  "shipper.phone": phone,
  "recipient.country": "FR",
  "recipient.zipcode": "75001",
  "recipient.city": "Paris",
  "recipient.address": "1 rue de Rivoli",
  "recipient.type": "individual",
  "recipient.firstname": "Test",
  "recipient.lastname": "Multicolis",
  "recipient.email": env("BOXTAL_SHIPPER_EMAIL"),
  "recipient.phone": phone,
  collection_date: nextBusinessDay(),
  delay: "aucun",
  content_code: "50150",
  operator: "POFR",
  service: "ColissimoAccess",
  platform: "nasap3d",
  platform_version: "1.0",
  module_version: "1.0",
});
parcels.forEach((p, i) => {
  const n = i + 1;
  params.set(`colis_${n}.poids`, Math.max(0.05, p.weightKg).toFixed(3));
  params.set(`colis_${n}.longueur`, String(p.outerCm[0]));
  params.set(`colis_${n}.largeur`, String(p.outerCm[1]));
  params.set(`colis_${n}.hauteur`, String(p.outerCm[2]));
});

console.log(`POST ${BASE_URL}api/v1/order (2 colis : S + XL)`);
const res = await fetch(`${BASE_URL}api/v1/order`, {
  method: "POST",
  headers: {
    "Accept-Language": "fr-FR",
    "Api-Version": "1.3.7",
    Authorization: auth,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: params.toString(),
});
const xml = await res.text();
console.log(`HTTP ${res.status}`);
const doc = new XMLParser({ ignoreAttributes: true, isArray: (n) => n === "label" }).parse(xml);
if (doc?.error) {
  console.error("Erreur Boxtal :", JSON.stringify(doc.error).slice(0, 800));
  process.exit(1);
}
console.log("Référence :", doc?.order?.shipment?.reference);
console.log("Étiquettes :", JSON.stringify(doc?.order?.shipment?.labels?.label));
console.log("Réponse brute (800 premiers car.) :", xml.slice(0, 800));
