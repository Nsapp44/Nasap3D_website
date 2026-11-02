// Real-time shipping rate simulation via Boxtal's API v1 ("cotation"
// endpoint) — reverse-engineered from their official open-source PHP client
// (github.com/boxtal/php-library) and verified against the real account
// with real credentials.
//
// Important: the account's real V1 key/secret only authenticate against
// Boxtal's PRODUCTION host (www.envoimoinscher.com) — test.envoimoinscher.com
// returns 401 for them. There's now a *separate* sandbox account with its
// own V1 key/secret for local/dev testing — see BOXTAL_BASE_URL. A rate
// simulation ("cotation") is a free, read-only call with no side effect
// either way, so it's safe to call from dev even against production.
//
// purchaseShippingLabel() below is different: it calls api/v1/order, which
// is REAL MONEY on the production account (creates a real shipment, billed
// to the Boxtal account) — sandbox orders are free/unbilled instead. It is
// only ever invoked from an explicit admin action, never automatically.
import { XMLParser } from "fast-xml-parser";
import { parcelsRelayOk, type Parcel } from "./packing";

// Overridable so local/dev can point at Boxtal's sandbox
// (https://test.envoimoinscher.com/) with sandbox-only credentials instead
// of the production account — see BOXTAL_BASE_URL in .env.example.
const BASE_URL = process.env.BOXTAL_BASE_URL || "https://www.envoimoinscher.com/";
const API_VERSION = "1.3.7";

// "Pièces de rechange et accessoires (autres)" — looked up for real against
// GET /api/v1/contents on this account; closest fit for custom-printed parts.
const CONTENT_CODE = "50150";

export interface ParcelCm {
  length: number;
  width: number;
  height: number;
}

// colis_1.* … colis_N.* — poids en kg (plancher 50 g) et dimensions extérieures
// du carton en cm. Partagé par la cotation et l'achat d'étiquette.
export function parcelParams(parcels: Parcel[]): Record<string, string> {
  const out: Record<string, string> = {};
  parcels.forEach((p, i) => {
    const n = i + 1;
    out[`colis_${n}.poids`] = Math.max(0.3, p.weightG / 1000).toFixed(3);
    out[`colis_${n}.longueur`] = String(p.outerCm[0]);
    out[`colis_${n}.largeur`] = String(p.outerCm[1]);
    out[`colis_${n}.hauteur`] = String(p.outerCm[2]);
  });
  return out;
}

// Flat packaging cost (box, filler material) added on top of the carrier's
// own price (per parcel) whenever an order actually ships — agreed with the business
// owner. Not charged for in-person pickup, but there's no such option in
// the online checkout flow yet (only RELAY/HOME shipping), so every rate
// this function returns is for a real shipment and gets it added.
const PACKAGING_FEE_CENTS = 150;

// Production buffer agreed with the business owner, in business days —
// passed to Boxtal as `collection_date` below so its own `delivery.date` in
// the response already accounts for a realistic pickup day, instead of us
// having to estimate carrier transit time ourselves.
//
// - Under 12h of total print time (summed across the cart, qty-weighted):
//   flat 2 business days. Short enough jobs fit in the normal workshop
//   queue regardless of exact duration, not worth modeling more precisely.
// - 12h or more: 2 days + the print time itself, converted to whole
//   calendar days assuming the printer runs continuously (ceil(hours / 24))
//   — e.g. a 40h print adds ceil(40/24) = 2 days on top of the 2-day base,
//   4 total.
function productionBusinessDays(totalPrintMinutes: number): number {
  const printHours = totalPrintMinutes / 60;
  if (printHours < 12) return 2;
  return 2 + Math.ceil(printHours / 24);
}

function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

// Real "N business days from now" — always lands on a business day, since
// weekends are simply skipped while counting.
function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) remaining--;
  }
  return d;
}

// Today if it's already a business day, otherwise the next one — a carrier
// can't collect a parcel on a Sunday.
function nextOrSameBusinessDay(from: Date): Date {
  const d = new Date(from);
  while (!isBusinessDay(d)) d.setDate(d.getDate() + 1);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export class BoxtalConfigError extends Error {}
export class BoxtalApiError extends Error {}

// Node's global fetch() has NO default timeout — confirmed live: a fake
// endpoint that accepts the connection but never replies leaves the call
// hanging forever, with zero recovery, permanently leaking one socket per
// call. Every Boxtal call below goes through this instead of a bare
// fetch() — real risk without it: sweepOrderTracking() (the 24h tracking
// sweep, src/lib/server/orderTracking.ts) calls checkLabelStatus() once per
// in-flight order in a loop; if Boxtal is ever slow/unresponsive, each
// affected call leaks permanently and the NEXT day's sweep tick piles more
// on top (setInterval doesn't wait for the previous run), accumulating for
// as long as the process stays up — exactly the "gets worse after several
// days online" pattern this was built to close off.
const BOXTAL_FETCH_TIMEOUT_MS = 15_000;

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BOXTAL_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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
  // Boxtal's own delivery.date for this offer (YYYY-MM-DD), computed from
  // the collection_date we send it (today + PRODUCTION_BUSINESS_DAYS — see
  // above) — so this already accounts for both the production buffer and
  // the carrier's real transit time, no need to estimate transit ourselves.
  estimatedDeliveryDate: string | null;
}

export interface ShippingRates {
  relay: ShippingRate | null;
  home: ShippingRate | null;
  weightUsedG: number;
  // 1er colis (compat) ; la liste complète est dans `parcels`.
  parcelCm: ParcelCm;
  parcels: Parcel[];
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

// The real label URL (order.shipment.labels.label / order_status.labels.label
// — see checkLabelStatus above for the other, broken-for-us field this is
// NOT) is actually a signed, directly downloadable PDF link, no auth needed
// (confirmed for real: 200, real PDF bytes, straight off the sandbox host).
// The Authorization header here is harmless-but-unnecessary against that URL
// — kept mainly so this still works if Boxtal ever changes the signing
// scheme to something that does check account auth. Proxied through our own
// server (admin routes) rather than linked to directly mostly so the
// download gets a clean filename via Content-Disposition, not because the
// URL itself requires it.
export async function fetchLabelDocument(url: string): Promise<{ contentType: string; buffer: Buffer }> {
  // N'envoyer les identifiants qu'à l'hôte Boxtal, jamais à une URL tierce.
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new BoxtalApiError("boxtal label document: invalid url");
  }
  const isBoxtalHost = host === new URL(BASE_URL).hostname || host === "boxtal.com" || host.endsWith(".boxtal.com");
  let res: Response;
  try {
    res = await timedFetch(url, isBoxtalHost ? { headers: { Authorization: authHeader() } } : {});
  } catch (err) {
    throw new BoxtalApiError(`boxtal label document request failed: ${(err as Error).message}`);
  }
  if (!res.ok) throw new BoxtalApiError(`boxtal label document http ${res.status}`);
  const contentType = res.headers.get("content-type") || "application/pdf";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { contentType, buffer };
}

// Map widget access token — a completely separate auth flow from the V1
// XML API above. Confirmed directly by Boxtal support (their own OpenAPI
// spec for "Composant carte"): the front-end map widget needs a short-lived
// JWT minted via POST /iam/account-app/token (standard HTTP Basic Auth,
// "Basic base64(key:secret)"), not a long-lived static key handed straight
// to the browser.
const MAP_TOKEN_URL = "https://api.boxtal.com/iam/account-app/token";
let mapTokenCache: { accessToken: string; expiresAt: number } | null = null;

export async function getBoxtalMapAccessToken(): Promise<{ accessToken: string; expiresIn: number }> {
  const now = Date.now();
  // Refresh a minute early rather than right at expiry, so a request never
  // races a token that's valid when checked but expired by the time it
  // reaches Boxtal's map iframe.
  if (mapTokenCache && mapTokenCache.expiresAt - now > 60_000) {
    return { accessToken: mapTokenCache.accessToken, expiresIn: Math.floor((mapTokenCache.expiresAt - now) / 1000) };
  }
  const key = process.env.BOXTAL_MAP_API_KEY;
  const secret = process.env.BOXTAL_MAP_API_SECRET;
  if (!key || !secret) throw new BoxtalConfigError("BOXTAL_MAP_API_KEY / BOXTAL_MAP_API_SECRET not configured");
  let res: Response;
  try {
    res = await timedFetch(MAP_TOKEN_URL, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
    });
  } catch (err) {
    throw new BoxtalApiError(`boxtal map token request failed: ${(err as Error).message}`);
  }
  if (!res.ok) throw new BoxtalApiError(`boxtal map token request failed: ${res.status}`);
  const data = (await res.json()) as { accessToken: string; expiresIn: number };
  mapTokenCache = { accessToken: data.accessToken, expiresAt: now + data.expiresIn * 1000 };
  return { accessToken: data.accessToken, expiresIn: data.expiresIn };
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

// BOXTAL_SHIPPER_PHONE is kept in local French format ("0X XX XX XX XX",
// matches how it's used elsewhere) in the .env, but Boxtal's real order API
// rejects that bare local format outright ("shipper.phone: Le numéro de
// téléphone n'est pas valide" — hit for real on a FR-domestic order, so the
// earlier "FR-domestic accepts local format" assumption was wrong) — always
// convert to E.164 before sending, both FR and international.
export function toInternationalFrPhone(local: string): string {
  const trimmed = local.trim();
  // Already international (+33…, +32…): keep, only strip separators.
  if (trimmed.startsWith("+")) return "+" + trimmed.replace(/\D/g, "");
  const digits = local.replace(/\D/g, "");
  return "+33" + (digits.startsWith("0") ? digits.slice(1) : digits);
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

// Calls Boxtal's real /api/v1/cotation (rate simulation, free, no side
// effect) and extracts the two offers this business actually sells:
// Mondial Relay pickup-point and Colissimo home delivery. Either can come
// back null if Boxtal has no offer for that route/weight.
export async function quoteShippingRates(
  recipient: ShippingAddress,
  parcels: Parcel[],
  totalPrintMinutes: number = 0,
): Promise<ShippingRates> {
  const shipper = shipperAddress();
  if (parcels.length === 0) throw new BoxtalApiError("quoteShippingRates: no parcels");

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
    ...parcelParams(parcels),
    collection_date: isoDate(addBusinessDays(new Date(), productionBusinessDays(totalPrintMinutes))),
    delay: "aucun",
    content_code: CONTENT_CODE,
    platform: "nasap3d",
    platform_version: "1.0",
    module_version: "1.0",
  });

  let res: Response;
  try {
    res = await timedFetch(`${BASE_URL}api/v1/cotation?${params.toString()}`, {
      headers: { "Accept-Language": "fr-FR", "Api-Version": API_VERSION, Authorization: authHeader() },
    });
  } catch (err) {
    throw new BoxtalApiError(`boxtal cotation request failed: ${(err as Error).message}`);
  }
  const xml = await res.text();
  if (!res.ok) throw new BoxtalApiError(`boxtal cotation http ${res.status}: ${xml.slice(0, 300)}`);

  const doc = xmlParser.parse(xml);
  if (doc?.error) throw new BoxtalApiError(`boxtal cotation error: ${JSON.stringify(doc.error).slice(0, 300)}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- xmlParser.parse() output is untyped by design (external API's XML shape)
  const offers: any[] = doc?.cotation?.shipment?.offer ?? [];
  let relay: ShippingRate | null = null;
  let home: ShippingRate | null = null;
  // Mondial Relay n'accepte pas le carton XXL (L+l+h > 150).
  const relayAllowed = parcelsRelayOk(parcels);

  for (const offer of offers) {
    const operatorCode = offer?.operator?.code;
    const serviceCode = offer?.service?.code;
    const deliveryTypeCode = offer?.delivery?.type?.code;
    const estimatedDeliveryDate: string | null = offer?.delivery?.date ?? null;
    const carrierCents = Math.round(Number(offer?.price?.["tax-inclusive"]) * 100);
    if (!Number.isFinite(carrierCents)) continue;
    const cents = carrierCents + PACKAGING_FEE_CENTS * parcels.length;

    // "Europe" variants verified for real against the sandbox account —
    // same operator, same delivery.type.code (PICKUP_POINT/HOME), different
    // service code and price than the FR-domestic ones. Boxtal itself
    // decides which variant to offer based on recipient.country, so no
    // country branching needed here — just recognizing both code spellings.
    if (
      relayAllowed &&
      operatorCode === "MONR" &&
      (serviceCode === "CpourToi" || serviceCode === "CpourToiEurope") &&
      deliveryTypeCode === "PICKUP_POINT"
    ) {
      const label =
        serviceCode === "CpourToiEurope" ? "Mondial Relay — Point Relais (Europe)" : "Mondial Relay — Point Relais";
      if (!relay || cents < relay.cents) relay = { operatorCode, serviceCode, label, cents, estimatedDeliveryDate };
    }
    if (
      operatorCode === "POFR" &&
      (serviceCode === "ColissimoAccess" || serviceCode === "ColissimoAccessInternational") &&
      deliveryTypeCode === "HOME"
    ) {
      const label =
        serviceCode === "ColissimoAccessInternational"
          ? "Colissimo — Livraison à domicile (international)"
          : "Colissimo — Livraison à domicile";
      if (!home || cents < home.cents) home = { operatorCode, serviceCode, label, cents, estimatedDeliveryDate };
    }
  }

  const [length, width, height] = parcels[0].outerCm;
  return {
    relay,
    home,
    weightUsedG: Math.round(parcels.reduce((sum, p) => sum + p.weightG, 0)),
    parcelCm: { length, width, height },
    parcels,
  };
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
  parcels: Parcel[];
  operatorCode: string;
  serviceCode: string;
  mode: "RELAY" | "HOME";
  relayPointCode?: string | null;
  // Only used for international (non-FR) orders — see INTL_CONTENT_DESCRIPTION
  // below. Value of the goods themselves (order.subtotalCents), required by
  // Boxtal for cross-border shipments even within the EU (declared value,
  // not a real customs form).
  declaredValueCents?: number;
}

// Every order is the same kind of good — always this fixed description,
// nothing for the customer to type (per the business owner: no reason to
// vary it order to order).
const INTL_CONTENT_DESCRIPTION = "Pièces imprimées en 3D sur mesure";

export interface LabelPurchaseResult {
  boxtalOrderRef: string;
  labelUrl: string | null;
}

// Real purchase of a shipping label (api/v1/order) — REAL MONEY, billed to
// the Boxtal account, no sandbox available on this account (see the file
// header). parcelCm/weightG must be the exact values quoteShippingRates()
// returned at checkout time (see the Order.shippingParcel*/shippingWeightG
// snapshot in orders.ts) — never recomputed here, so the label always
// matches what was actually quoted and charged to the customer.
export async function purchaseShippingLabel(input: LabelPurchaseInput): Promise<LabelPurchaseResult> {
  const shipper = shipperAddress();
  const shipperId = shipperIdentity();
  const { firstname, lastname } = splitFullName(input.recipient.fullName);

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
    "shipper.phone": toInternationalFrPhone(shipperId.phone),
    "recipient.country": input.recipient.country,
    "recipient.zipcode": input.recipient.zipcode,
    "recipient.city": input.recipient.city,
    "recipient.address": input.recipient.address,
    "recipient.type": "individual",
    "recipient.firstname": firstname,
    "recipient.lastname": lastname,
    "recipient.email": input.recipient.email,
    "recipient.phone": toInternationalFrPhone(input.recipient.phone),
    ...parcelParams(input.parcels),
    collection_date: isoDate(nextOrSameBusinessDay(new Date())),
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
  // Boxtal's own mandatory_informations for the *Europe/*International offer
  // variants list these as required to place the order, on top of the usual
  // fields above — not needed for FR-domestic offers, which don't ask for
  // them.
  if (input.recipient.country !== "FR") {
    if (input.declaredValueCents == null) {
      throw new BoxtalApiError("declaredValueCents required for a non-FR shipment");
    }
    params.set("expediteur.civilite", "M.");
    params.set("destinataire.civilite", "M.");
    params.set("colis.description", INTL_CONTENT_DESCRIPTION);
    params.set("colis.valeur", (input.declaredValueCents / 100).toFixed(2));
  }

  let res: Response;
  try {
    res = await timedFetch(`${BASE_URL}api/v1/order`, {
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

export interface BoxtalOrderStatus {
  labelAvailable: boolean;
  labelUrl: string | null;
  // Real tracking number for the customer/carrier, when Boxtal has one yet
  // (confirmed via a live sandbox call). null until the carrier picks up
  // the parcel and Boxtal learns it.
  carrierReference: string | null;
  // Free-text carrier status (French), e.g. "Commande validée par le
  // transporteur" — shown as-is to the admin since we don't have the full
  // list of possible values. isLikelyDelivered is a best-effort guess (see
  // below), not authoritative — the admin can always confirm/override.
  state: string | null;
  isLikelyDelivered: boolean;
}

// Matches "livré"/"livrée" as a whole word, deliberately not just "livr" —
// that would also match "livraison" (in transit, not delivered yet) and
// "à livrer" (not delivered yet). Uses a negative lookahead rather than \b
// after the accented character: JS's \b only treats ASCII [A-Za-z0-9_] as
// "word" characters, so "é" at the end of a string breaks a trailing \b —
// this is a heuristic to surface in the admin UI, not something that
// silently auto-confirms delivery on its own.
const DELIVERED_STATE_RE = /livr[ée]e?(?![a-zà-ÿ])/i;

// Label generation can be asynchronous for some carriers — call this if
// purchaseShippingLabel() didn't return a label URL immediately. Also the
// only way to learn the tracking number and live carrier status, both only
// known to Boxtal after the fact, never at purchase time.
export async function checkLabelStatus(boxtalOrderRef: string): Promise<BoxtalOrderStatus> {
  let res: Response;
  try {
    res = await timedFetch(`${BASE_URL}api/v1/order_status/${encodeURIComponent(boxtalOrderRef)}/informations`, {
      headers: { "Accept-Language": "fr-FR", "Api-Version": API_VERSION, Authorization: authHeader() },
    });
  } catch (err) {
    throw new BoxtalApiError(`boxtal order_status request failed: ${(err as Error).message}`);
  }
  const xml = await res.text();
  if (!res.ok) throw new BoxtalApiError(`boxtal order_status http ${res.status}: ${xml.slice(0, 500)}`);

  const doc = xmlParser.parse(xml);
  if (doc?.error) throw new BoxtalApiError(`boxtal order_status error: ${JSON.stringify(doc.error).slice(0, 500)}`);

  // Boxtal's order_status response has two different label fields, easy to
  // confuse: `label_url` (singular) is a web-UI link into their customer
  // portal — needs a logged-in browser session, NOT our API key, and
  // returns "access_denied"/"unparsed error" for any programmatic fetch
  // (confirmed for real, including with the same Authorization header used
  // for every other v1 call). `labels.label` is the actual signed, directly
  // downloadable PDF URL (also confirmed for real: 200, real PDF bytes, no
  // auth needed at all — the random path segment IS the auth). Always use
  // the latter; matches how the initial purchase response already reads
  // labels the right way (`shipment.labels.label`, see purchaseShippingLabel
  // above — same field name, one level shallower here since this response
  // has no `shipment` wrapper).
  const labelAvailable =
    doc?.order?.label_available === "1" || String(doc?.order?.label_available).toLowerCase() === "true";
  const labelUrl: string | null = doc?.order?.labels?.label?.[0] ?? null;
  // Plusieurs colis : Boxtal peut renvoyer plusieurs numéros de suivi — on les
  // joint par ", " dans le champ unique trackingNumber.
  const rawRef = doc?.order?.carrier_reference;
  const carrierReference: string | null = (Array.isArray(rawRef) ? rawRef.map(String).join(", ") : rawRef) || null;
  const state: string | null = doc?.order?.state || null;
  return {
    labelAvailable,
    labelUrl,
    carrierReference,
    state,
    isLikelyDelivered: !!state && DELIVERED_STATE_RE.test(state),
  };
}
