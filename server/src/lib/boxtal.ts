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
// read-only call with no side effect, so this is safe to call from dev too.
//
// purchaseShippingLabel() below is different: it calls api/v1/order, which
// is REAL MONEY (creates a real shipment, billed to the Boxtal account) —
// there is no sandbox for it on this account. It is only ever invoked from
// an explicit admin action (see routes/admin.ts), never automatically.
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

// Only needed for a real order (api/v1/order) — the free cotation call
// doesn't need a named contact, but a real shipment does.
interface ShipperIdentity {
  firstname: string;
  lastname: string;
  company: string;
  email: string;
  phone: string;
}

function shipperIdentity(): ShipperIdentity {
  const firstname = process.env.BOXTAL_SHIPPER_FIRSTNAME;
  const lastname = process.env.BOXTAL_SHIPPER_LASTNAME;
  const company = process.env.BOXTAL_SHIPPER_COMPANY;
  const email = process.env.BOXTAL_SHIPPER_EMAIL;
  const phone = process.env.BOXTAL_SHIPPER_PHONE;
  if (!firstname || !lastname || !company || !email || !phone) {
    throw new BoxtalConfigError("BOXTAL_SHIPPER_FIRSTNAME/LASTNAME/COMPANY/EMAIL/PHONE not configured in .env");
  }
  return { firstname, lastname, company, email, phone };
}

// Boxtal's person object only takes one name field each way — split the
// single "full name" collected at checkout on the first space. Good enough
// for a shipping label; if there's no space, treat the whole thing as the
// first name and leave the last name blank rather than guess.
function splitFullName(fullName: string): { firstname: string; lastname: string } {
  const trimmed = fullName.trim();
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) return { firstname: trimmed, lastname: "" };
  return { firstname: trimmed.slice(0, spaceIdx), lastname: trimmed.slice(spaceIdx + 1) };
}

const xmlParser = new XMLParser({ ignoreAttributes: true, isArray: (name) => name === "offer" || name === "label" });

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

export interface LabelRecipient {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  zipcode: string;
  country: string;
}

export interface LabelPurchaseInput {
  recipient: LabelRecipient;
  weightG: number;
  operatorCode: string;
  serviceCode: string;
  mode: "RELAY" | "HOME";
  relayPointCode?: string | null;
}

export interface LabelPurchaseResult {
  boxtalOrderRef: string;
  labelUrl: string | null;
}

// Real purchase of a shipping label (api/v1/order) — REAL MONEY, billed to
// the Boxtal account, no sandbox available on this account (see the file
// header). Reuses the same weight/packaging/content-code conventions as
// quoteShippingRates() above, so the label matches what was actually
// quoted and charged to the customer at checkout.
export async function purchaseShippingLabel(input: LabelPurchaseInput): Promise<LabelPurchaseResult> {
  const shipper = shipperAddress();
  const shipperId = shipperIdentity();
  const { firstname, lastname } = splitFullName(input.recipient.fullName);
  const weightKg = Math.max(0.05, input.weightG / 1000);

  const params = new URLSearchParams({
    "shipper.country": shipper.country,
    "shipper.zipcode": shipper.zipcode,
    "shipper.city": shipper.city,
    "shipper.address": shipper.address,
    "shipper.type": "company",
    "shipper.firstname": shipperId.firstname,
    "shipper.lastname": shipperId.lastname,
    "shipper.societe": shipperId.company,
    "shipper.email": shipperId.email,
    "shipper.phone": shipperId.phone,
    "recipient.country": input.recipient.country,
    "recipient.zipcode": input.recipient.zipcode,
    "recipient.city": input.recipient.city,
    "recipient.address": input.recipient.address,
    "recipient.type": "individual",
    "recipient.firstname": firstname,
    "recipient.lastname": lastname,
    "recipient.email": input.recipient.email,
    "recipient.phone": input.recipient.phone,
    "colis_1.poids": weightKg.toFixed(3),
    "colis_1.longueur": String(DEFAULT_PARCEL_CM.length),
    "colis_1.largeur": String(DEFAULT_PARCEL_CM.width),
    "colis_1.hauteur": String(DEFAULT_PARCEL_CM.height),
    collection_date: new Date().toISOString().slice(0, 10),
    delay: "aucun",
    content_code: CONTENT_CODE,
    operator: input.operatorCode,
    service: input.serviceCode,
    platform: "nasap3d",
    platform_version: "1.0",
    module_version: "1.0",
  });
  if (input.mode === "RELAY") {
    if (!input.relayPointCode) throw new BoxtalApiError("relayPointCode required for a RELAY shipment");
    params.set("retrait.pointrelais", input.relayPointCode);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}api/v1/order`, {
      method: "POST",
      headers: {
        "Accept-Language": "fr-FR",
        "Api-Version": API_VERSION,
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } catch (err) {
    throw new BoxtalApiError(`boxtal order request failed: ${(err as Error).message}`);
  }
  const xml = await res.text();
  if (!res.ok) throw new BoxtalApiError(`boxtal order http ${res.status}: ${xml.slice(0, 500)}`);

  const doc = xmlParser.parse(xml);
  if (doc?.error) throw new BoxtalApiError(`boxtal order error: ${JSON.stringify(doc.error).slice(0, 500)}`);

  const reference: string | undefined = doc?.order?.shipment?.reference;
  if (!reference || !/^[0-9a-zA-Z]{20}$/.test(reference)) {
    throw new BoxtalApiError(`boxtal order: no valid reference in response: ${xml.slice(0, 500)}`);
  }

  const labels: string[] = doc?.order?.shipment?.labels?.label ?? [];
  return { boxtalOrderRef: reference, labelUrl: labels[0] ?? null };
}

// Label generation can be asynchronous for some carriers — call this if
// purchaseShippingLabel() didn't return a label URL immediately.
export async function checkLabelStatus(boxtalOrderRef: string): Promise<{ labelAvailable: boolean; labelUrl: string | null }> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}api/v1/order_status/${encodeURIComponent(boxtalOrderRef)}/informations`, {
      headers: { "Accept-Language": "fr-FR", "Api-Version": API_VERSION, Authorization: authHeader() },
    });
  } catch (err) {
    throw new BoxtalApiError(`boxtal order_status request failed: ${(err as Error).message}`);
  }
  const xml = await res.text();
  if (!res.ok) throw new BoxtalApiError(`boxtal order_status http ${res.status}: ${xml.slice(0, 500)}`);

  const doc = xmlParser.parse(xml);
  if (doc?.error) throw new BoxtalApiError(`boxtal order_status error: ${JSON.stringify(doc.error).slice(0, 500)}`);

  const labelAvailable = String(doc?.order?.label_available).toLowerCase() === "true";
  const labelUrl: string | null = doc?.order?.label_url || null;
  return { labelAvailable, labelUrl };
}
