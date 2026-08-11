// Real-time shipping rate simulation via Boxtal's API v1 ("cotation"
// endpoint) — see server/SHIPPING.md for how this was reverse-engineered
// (Boxtal's own docs are a JS-rendered SPA we can't fetch headlessly) from
// their official open-source PHP client (github.com/boxtal/php-library) and
// verified against the real account with real credentials.
//
// Important: the account's V1 key/secret only authenticate against Boxtal's
// PRODUCTION host (www.envoimoinscher.com) — test.envoimoinscher.com returned
// 401 for these credentials (it needs separate sandbox credentials Boxtal
// hasn't issued for this account). A rate simulation ("cotation") is a free,
// read-only call with no side effect, so this is safe to call from dev too —
// but nothing in this file ever calls the label-purchase endpoint
// (api/v1/order), which is real money and is deliberately out of scope here.
import { XMLParser } from "fast-xml-parser";

const BASE_URL = "https://www.envoimoinscher.com/";
const API_VERSION = "1.3.7";

// "Pièces de rechange et accessoires (autres)" — looked up for real against
// GET /api/v1/contents on this account; closest fit for custom-printed parts.
const CONTENT_CODE = "50150";

// Generic small-parcel box. Real per-order packaging dimensions aren't
// tracked (only weight is, from the slicer) — this is a deliberate
// simplification a real operator can revisit once they know their actual
// packaging. Price for these carriers is driven mostly by weight anyway.
const DEFAULT_PARCEL_CM = { length: 30, width: 22, height: 15 };

export class BoxtalConfigError extends Error {}
export class BoxtalApiError extends Error {}

export interface ShippingAddress {
  country: string;
  zipcode: string;
  city: string;
  address: string;
}

export interface ShippingRate {
  operatorCode: string;
  serviceCode: string;
  label: string;
  cents: number;
}

export interface ShippingRates {
  relay: ShippingRate | null;
  home: ShippingRate | null;
  weightUsedG: number;
}

function authHeader(): string {
  const key = process.env.BOXTAL_API_KEY_V1;
  const secret = process.env.BOXTAL_API_SECRET_V1;
  if (!key || !secret) throw new BoxtalConfigError("BOXTAL_API_KEY_V1 / BOXTAL_API_SECRET_V1 not configured");
  // Matches boxtal/php-library exactly: raw base64(key:secret), no "Basic "
  // prefix — verified for real against the production API (401 without it
  // being wrong, 200 with this exact format).
  return Buffer.from(`${key}:${secret}`).toString("base64");
}

function shipperAddress(): ShippingAddress {
  const country = process.env.BOXTAL_SHIPPER_COUNTRY;
  const zipcode = process.env.BOXTAL_SHIPPER_ZIPCODE;
  const city = process.env.BOXTAL_SHIPPER_CITY;
  const address = process.env.BOXTAL_SHIPPER_ADDRESS;
  if (!country || !zipcode || !city || !address) {
    throw new BoxtalConfigError("BOXTAL_SHIPPER_* (business return address) not configured in .env");
  }
  return { country, zipcode, city, address };
}

const xmlParser = new XMLParser({ ignoreAttributes: true, isArray: (name) => name === "offer" });

// Packaging margin agreed with the business owner: real piece weight + 20%
// to account for box/filling material, used to pick the right carrier
// weight bracket. Boxtal's own API applies the actual bracket pricing —
// we just need to send it a realistic weight.
export function applyPackagingMargin(pieceWeightG: number): number {
  return pieceWeightG * 1.2;
}

// Calls Boxtal's real /api/v1/cotation (rate simulation, free, no side
// effect) and extracts the two offers this business actually sells:
// Mondial Relay pickup-point and Colissimo home delivery. Either can come
// back null if Boxtal has no offer for that route/weight.
export async function quoteShippingRates(recipient: ShippingAddress, pieceWeightG: number): Promise<ShippingRates> {
  const shipper = shipperAddress();
  // 50g floor: even a single light piece ships in a real box + filler, which
  // weighs something on its own — this avoids quoting an unrealistically
  // cheap rate for a near-zero-weight print.
  const weightKg = Math.max(0.05, applyPackagingMargin(pieceWeightG) / 1000);

  const params = new URLSearchParams({
    "shipper.country": shipper.country,
    "shipper.zipcode": shipper.zipcode,
    "shipper.city": shipper.city,
    "shipper.address": shipper.address,
    "shipper.type": "company",
    "recipient.country": recipient.country,
    "recipient.zipcode": recipient.zipcode,
    "recipient.city": recipient.city,
    "recipient.address": recipient.address,
    "recipient.type": "individual",
    "colis_1.poids": weightKg.toFixed(3),
    "colis_1.longueur": String(DEFAULT_PARCEL_CM.length),
    "colis_1.largeur": String(DEFAULT_PARCEL_CM.width),
    "colis_1.hauteur": String(DEFAULT_PARCEL_CM.height),
    collection_date: new Date().toISOString().slice(0, 10),
    delay: "aucun",
    content_code: CONTENT_CODE,
    platform: "nasap3d",
    platform_version: "1.0",
    module_version: "1.0",
  });

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}api/v1/cotation?${params.toString()}`, {
      headers: { "Accept-Language": "fr-FR", "Api-Version": API_VERSION, Authorization: authHeader() },
    });
  } catch (err) {
    throw new BoxtalApiError(`boxtal cotation request failed: ${(err as Error).message}`);
  }
  const xml = await res.text();
  if (!res.ok) throw new BoxtalApiError(`boxtal cotation http ${res.status}: ${xml.slice(0, 300)}`);

  const doc = xmlParser.parse(xml);
  if (doc?.error) throw new BoxtalApiError(`boxtal cotation error: ${JSON.stringify(doc.error).slice(0, 300)}`);

  const offers: any[] = doc?.cotation?.shipment?.offer ?? [];
  let relay: ShippingRate | null = null;
  let home: ShippingRate | null = null;

  for (const offer of offers) {
    const operatorCode = offer?.operator?.code;
    const serviceCode = offer?.service?.code;
    const deliveryTypeCode = offer?.delivery?.type?.code;
    const cents = Math.round(Number(offer?.price?.["tax-inclusive"]) * 100);
    if (!Number.isFinite(cents)) continue;

    if (operatorCode === "MONR" && serviceCode === "CpourToi" && deliveryTypeCode === "PICKUP_POINT") {
      if (!relay || cents < relay.cents) relay = { operatorCode, serviceCode, label: "Mondial Relay — Point Relais", cents };
    }
    if (operatorCode === "POFR" && serviceCode === "ColissimoAccess" && deliveryTypeCode === "HOME") {
      if (!home || cents < home.cents) home = { operatorCode, serviceCode, label: "Colissimo — Livraison à domicile", cents };
    }
  }

  return { relay, home, weightUsedG: Math.round(weightKg * 1000) };
}
