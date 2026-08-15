// Real-time shipping rate simulation via Boxtal's API v1 ("cotation"
// endpoint) — see server/SHIPPING.md for how this was reverse-engineered
// (Boxtal's own docs are a JS-rendered SPA we can't fetch headlessly) from
// their official open-source PHP client (github.com/boxtal/php-library) and
// verified against the real account with real credentials.
//
// Important: the account's real V1 key/secret only authenticate against
// Boxtal's PRODUCTION host (www.envoimoinscher.com) — test.envoimoinscher.com
// returns 401 for them. There's now a *separate* sandbox account with its
// own V1 key/secret for local/dev testing — see BOXTAL_BASE_URL below and
// server/SHIPPING.md ("Tester sans facturer le compte de production"). A
// rate simulation ("cotation") is a free, read-only call with no side
// effect either way, so it's safe to call from dev even against production.
//
// purchaseShippingLabel() below is different: it calls api/v1/order, which
// is REAL MONEY on the production account (creates a real shipment, billed
// to the Boxtal account) — sandbox orders are free/unbilled instead. It is
// only ever invoked from an explicit admin action (see routes/admin.ts),
// never automatically.
import { XMLParser } from "fast-xml-parser";

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

// Real box formats the business actually keeps in stock (given by the
// owner), smallest to largest — pickParcelCm() below picks the smallest one
// that fits a piece's bounding box, one box per order (see
// server/SHIPPING.md "Un seul carton par commande").
const PARCEL_BOXES_CM: ParcelCm[] = [
  { length: 12, width: 12, height: 10 }, // 113×113×100mm, rounded up to whole cm
  { length: 20, width: 20, height: 20 },
  { length: 40, width: 35, height: 30 },
];

// ~1cm of clearance on each side of the piece, on every dimension — a piece
// modeled at exactly the box's own size wouldn't physically go in (no room
// for the piece itself to be handled, let alone any wrapping/filler).
const PARCEL_MARGIN_MM = 10;

// Real items don't tile a box with zero wasted space (irregular custom
// prints, not uniform blocks) — require the combined volume of everything
// in the cart to fit under the box's own volume with a small safety margin,
// not 100% of it exactly. This is what catches "two large pieces + one
// small one" not actually fitting together even though each is
// individually smaller than the box alone. Kept small (5%, i.e. volume must
// fit under 95% of the box) rather than a bigger margin: PARCEL_MARGIN_MM
// above already guarantees the single biggest piece has real clearance, and
// per the business owner, if the numbers say it fits, it fits — no need to
// also reserve a large chunk of "unpackable" volume on top of that.
const PACKING_EFFICIENCY = 0.95;

// Picks the smallest PARCEL_BOXES_CM entry that both (a) fits the single
// biggest item's real bounding box (allowing rotation — dimensions are
// sorted before comparing, plus PARCEL_MARGIN_MM clearance) and (b) has
// enough spare volume for everything else in the cart (PACKING_EFFICIENCY).
// Returns null if nothing satisfies both (rare: the printer bed already
// rejects most oversized single parts, see pickPrinter() in slicer.ts, but
// a large near-cubic part, or several large parts together, can still
// exceed what's available). Pure/exported so routes/admin.ts can tell a
// genuine best fit apart from the "doesn't fit anything" case without
// duplicating this logic.
export function pickParcelCm(requirement: {
  maxItemBboxMm: { xMm: number; yMm: number; zMm: number } | null;
  totalVolumeMm3: number;
} | null): ParcelCm | null {
  if (!requirement?.maxItemBboxMm) return null;
  const { maxItemBboxMm, totalVolumeMm3 } = requirement;
  const partSortedMm = [maxItemBboxMm.xMm, maxItemBboxMm.yMm, maxItemBboxMm.zMm]
    .map((mm) => mm + 2 * PARCEL_MARGIN_MM)
    .sort((a, b) => a - b);
  for (const box of PARCEL_BOXES_CM) {
    const boxSortedMm = [box.length * 10, box.width * 10, box.height * 10].sort((a, b) => a - b);
    const itemFits =
      partSortedMm[0] <= boxSortedMm[0] && partSortedMm[1] <= boxSortedMm[1] && partSortedMm[2] <= boxSortedMm[2];
    // Same 1cm-per-side margin as above (PARCEL_MARGIN_MM), subtracted from
    // the box this time instead of added to the piece — the volume check
    // uses the box's actual *usable* volume, not its raw outer volume.
    const usableVolumeMm3 = boxSortedMm
      .map((mm) => Math.max(0, mm - 2 * PARCEL_MARGIN_MM))
      .reduce((a, b) => a * b, 1);
    const volumeFits = totalVolumeMm3 <= usableVolumeMm3 * PACKING_EFFICIENCY;
    if (itemFits && volumeFits) return box;
  }
  return null;
}

const LARGEST_PARCEL_CM = PARCEL_BOXES_CM[PARCEL_BOXES_CM.length - 1];

// Flat packaging cost (box, filler material) added on top of the carrier's
// own price whenever an order actually ships — agreed with the business
// owner. Not charged for in-person pickup, but there's no such option in
// the online checkout flow yet (only RELAY/HOME shipping), so every rate
// this function returns is for a real shipment and gets it added.
const PACKAGING_FEE_CENTS = 150;

// Production buffer agreed with the business owner, in business days —
// passed to Boxtal as `collection_date` below so its own `delivery.date` in
// the response already accounts for a realistic pickup day, instead of us
// having to estimate carrier transit time ourselves.
//
// - Under 12h of total print time (summed across the cart, qty-weighted —
//   see getCartTotalPrintMinutes in cart.ts): flat 2 business days. Short
//   enough jobs fit in the normal workshop queue regardless of exact
//   duration, not worth modeling more precisely.
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
  parcelCm: ParcelCm;
  // true when the piece's bounding box didn't fit any PARCEL_BOXES_CM entry
  // — these rates still use LARGEST_PARCEL_CM as a best-effort estimate (the
  // customer isn't blocked or affected), but routes/admin.ts refuses to
  // auto-purchase a real label for an order with this flag set: see
  // server/SHIPPING.md.
  oversized: boolean;
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
// server (routes/admin.ts) rather than linked to directly mostly so the
// download gets a clean filename via Content-Disposition, not because the
// URL itself requires it.
export async function fetchLabelDocument(url: string): Promise<{ contentType: string; buffer: Buffer }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: authHeader() } });
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
// to the browser. What this project did before — pass BOXTAL_MAP_API_KEY
// itself as the widget's accessToken — loaded the map iframe fine (it
// doesn't validate the token before displaying) but silently returned zero
// parcel points for every search, since the token was never actually a
// valid one from Boxtal's point of view. BOXTAL_MAP_API_SECRET, previously
// stored but unused, is the corresponding Basic Auth password.
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
    res = await fetch(MAP_TOKEN_URL, {
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
function toInternationalFrPhone(local: string): string {
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
export async function quoteShippingRates(
  recipient: ShippingAddress,
  pieceWeightG: number,
  parcelRequirement: { maxItemBboxMm: { xMm: number; yMm: number; zMm: number } | null; totalVolumeMm3: number } | null = null,
  totalPrintMinutes: number = 0,
): Promise<ShippingRates> {
  const shipper = shipperAddress();
  // 50g floor: even a single light piece ships in a real box + filler, which
  // weighs something on its own — this avoids quoting an unrealistically
  // cheap rate for a near-zero-weight print.
  const weightKg = Math.max(0.05, applyPackagingMargin(pieceWeightG) / 1000);
  const fitted = pickParcelCm(parcelRequirement);
  const oversized = parcelRequirement?.maxItemBboxMm != null && fitted == null;
  const parcel = fitted ?? LARGEST_PARCEL_CM;

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
    "colis_1.longueur": String(parcel.length),
    "colis_1.largeur": String(parcel.width),
    "colis_1.hauteur": String(parcel.height),
    collection_date: isoDate(addBusinessDays(new Date(), productionBusinessDays(totalPrintMinutes))),
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
    const estimatedDeliveryDate: string | null = offer?.delivery?.date ?? null;
    const carrierCents = Math.round(Number(offer?.price?.["tax-inclusive"]) * 100);
    if (!Number.isFinite(carrierCents)) continue;
    const cents = carrierCents + PACKAGING_FEE_CENTS;

    // "Europe" variants verified for real against the sandbox account (see
    // server/SHIPPING.md "International (UE)") — same operator, same
    // delivery.type.code (PICKUP_POINT/HOME), different service code and
    // price than the FR-domestic ones. Boxtal itself decides which variant
    // to offer based on recipient.country, so no country branching needed
    // here — just recognizing both code spellings.
    if (
      operatorCode === "MONR" &&
      (serviceCode === "CpourToi" || serviceCode === "CpourToiEurope") &&
      deliveryTypeCode === "PICKUP_POINT"
    ) {
      const label = serviceCode === "CpourToiEurope" ? "Mondial Relay — Point Relais (Europe)" : "Mondial Relay — Point Relais";
      if (!relay || cents < relay.cents) relay = { operatorCode, serviceCode, label, cents, estimatedDeliveryDate };
    }
    if (
      operatorCode === "POFR" &&
      (serviceCode === "ColissimoAccess" || serviceCode === "ColissimoAccessInternational") &&
      deliveryTypeCode === "HOME"
    ) {
      const label = serviceCode === "ColissimoAccessInternational" ? "Colissimo — Livraison à domicile (international)" : "Colissimo — Livraison à domicile";
      if (!home || cents < home.cents) home = { operatorCode, serviceCode, label, cents, estimatedDeliveryDate };
    }
  }

  return { relay, home, weightUsedG: Math.round(weightKg * 1000), parcelCm: parcel, oversized };
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
  parcelCm: ParcelCm;
  operatorCode: string;
  serviceCode: string;
  mode: "RELAY" | "HOME";
  relayPointCode?: string | null;
  // Only used for international (non-FR) orders — see INTL_CONTENT_DESCRIPTION
  // below. Value of the goods themselves (order.subtotalCents), required by
  // Boxtal for cross-border shipments even within the EU (declared value,
  // not a real customs form — see server/SHIPPING.md "International (UE)").
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
    "shipper.phone": toInternationalFrPhone(shipperId.phone),
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
    "colis_1.longueur": String(input.parcelCm.length),
    "colis_1.largeur": String(input.parcelCm.width),
    "colis_1.hauteur": String(input.parcelCm.height),
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
  // variants (see server/SHIPPING.md) list these as required to place the
  // order, on top of the usual fields above — not needed for FR-domestic
  // offers, which don't ask for them.
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

export interface BoxtalOrderStatus {
  labelAvailable: boolean;
  labelUrl: string | null;
  // Real tracking number for the customer/carrier, when Boxtal has one yet
  // (confirmed via a live sandbox call — not documented in what we have on
  // hand, e.g. "CR260813000000000NT3"). null until the carrier picks up the
  // parcel and Boxtal learns it.
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
// "word" characters, so "é" at the end of a string breaks a trailing \b
// (verified — "Colis livré" failed to match with \b, "Colis livrée" only
// "worked" by accident because of the trailing ASCII "e"). Best-effort:
// we've only observed one state string in testing ("Commande validée par
// le transporteur"), not Boxtal's full state machine, so this is a
// heuristic to surface in the admin UI, not something that silently
// auto-confirms delivery on its own — see routes/admin.ts.
const DELIVERED_STATE_RE = /livr[ée]e?(?![a-zà-ÿ])/i;

// Label generation can be asynchronous for some carriers — call this if
// purchaseShippingLabel() didn't return a label URL immediately. Also the
// only way to learn the tracking number and live carrier status, both only
// known to Boxtal after the fact, never at purchase time.
export async function checkLabelStatus(boxtalOrderRef: string): Promise<BoxtalOrderStatus> {
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
  const labelAvailable = doc?.order?.label_available === "1" || String(doc?.order?.label_available).toLowerCase() === "true";
  const labelUrl: string | null = doc?.order?.labels?.label?.[0] ?? null;
  const carrierReference: string | null = doc?.order?.carrier_reference || null;
  const state: string | null = doc?.order?.state || null;
  return { labelAvailable, labelUrl, carrierReference, state, isLikelyDelivered: !!state && DELIVERED_STATE_RE.test(state) };
}
