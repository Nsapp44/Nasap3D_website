import { prisma } from "./prisma";

// Lecture du réglage « Site en maintenance » avec cache mémoire de 10 s :
// le middleware l'interroge à chaque requête, on ne veut pas une requête SQL
// par page vue. Si la base échoue, on considère maintenance = false (une
// panne de base ne doit jamais, en plus, afficher la page de maintenance).
const CACHE_TTL_MS = 10_000;
let cached: { value: boolean; at: number } | null = null;

export async function isMaintenanceOn(): Promise<boolean> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;
  try {
    const row = await prisma.settings.findUnique({ where: { id: 1 }, select: { maintenanceMode: true } });
    cached = { value: !!row?.maintenanceMode, at: now };
  } catch (err) {
    console.error("[maintenance] lecture du réglage impossible, maintenance = false", err);
    cached = { value: false, at: now };
  }
  return cached.value;
}

// Appelé après un PATCH admin réussi : le changement est visible tout de suite.
export function invalidateMaintenanceCache() {
  cached = null;
}
