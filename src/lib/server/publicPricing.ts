import { prisma } from "./prisma";

// Prix « à partir de » affichés sur les pages publiques. Source de vérité :
// réglages admin (table Settings, id 1). Jamais d'exception : repli sur les
// valeurs par défaut si la DB échoue ou tarde, pour que la page s'affiche toujours.

const DEFAULTS = { minUnitPriceCents: 890, minOrderCents: 1800, smallOrderFeeCents: 500 };
const CACHE_MS = 60_000;
const TIMEOUT_MS = 1500;

export interface PublicPricing {
  minUnitPriceCents: number;
  minOrderCents: number;
  smallOrderFeeCents: number;
  floorLabel: string;
  minOrderLabel: string;
  feeLabel: string;
  /** Vrai si un minimum de commande et des frais de petite commande sont configurés. */
  hasSmallOrderFee: boolean;
  /** Prix plancher en décimal avec point, ex. "8.90" (JSON-LD). */
  floorDecimal: string;
  priceLine: string;
  priceNote: string;
}

type Cents = Pick<PublicPricing, "minUnitPriceCents" | "minOrderCents" | "smallOrderFeeCents">;

// Espace insécable ordinaire (U+00A0) avant « € », virgule décimale, pas de ",00".
function eurLabel(cents: number, forceDecimals = false): string {
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  const num = rest === 0 && !forceDecimals ? String(euros) : `${euros},${String(rest).padStart(2, "0")}`;
  return `${num} €`;
}

function build(c: Cents): PublicPricing {
  const floorLabel = eurLabel(c.minUnitPriceCents, true);
  const minOrderLabel = eurLabel(c.minOrderCents);
  const feeLabel = eurLabel(c.smallOrderFeeCents);
  const priceLine = `À partir de ${floorLabel} la pièce, hors livraison`;
  const hasSmallOrderFee = c.minOrderCents > 0 && c.smallOrderFeeCents > 0;
  const priceNote =
    hasSmallOrderFee
      ? `Commande minimum de ${minOrderLabel} : en dessous, ${feeLabel} de frais de petite commande s'ajoutent. Prix exact calculé sur votre fichier.`
      : "Prix exact calculé sur votre fichier.";
  return {
    ...c,
    floorLabel,
    minOrderLabel,
    feeLabel,
    hasSmallOrderFee,
    floorDecimal: (c.minUnitPriceCents / 100).toFixed(2),
    priceLine,
    priceNote,
  };
}

let cache: { at: number; value: PublicPricing } | null = null;

async function load(): Promise<Cents> {
  const row = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { minUnitPriceCents: true, minOrderCents: true, smallOrderFeeCents: true },
  });
  if (!row) return DEFAULTS;
  return {
    minUnitPriceCents: row.minUnitPriceCents ?? DEFAULTS.minUnitPriceCents,
    minOrderCents: row.minOrderCents ?? DEFAULTS.minOrderCents,
    smallOrderFeeCents: row.smallOrderFeeCents ?? DEFAULTS.smallOrderFeeCents,
  };
}

export async function getPublicPricing(): Promise<PublicPricing> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.value;
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
    });
    const cents = await Promise.race([load(), timeout]).finally(() => clearTimeout(timer));
    cache = { at: now, value: build(cents) };
  } catch (e) {
    console.warn("[publicPricing] repli sur les valeurs par défaut :", (e as Error).message);
    // Cache court du repli pour ne pas retenter la DB à chaque requête.
    cache = { at: now - CACHE_MS + 10_000, value: build(DEFAULTS) };
  }
  return cache.value;
}
