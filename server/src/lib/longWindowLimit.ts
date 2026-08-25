// Deuxième palier de limite de débit, en complément de @fastify/rate-limit
// (qui ne gère qu'une seule fenêtre par route dans la version installée) —
// une limite par minute seule se réinitialise en permanence, donc un
// spammeur patient repasse dessous à chaque fenêtre. Celle-ci ajoute un
// plafond sur une fenêtre plus large (heure/jour) qu'un vrai visiteur
// n'atteint jamais, mais qui bloque un script en boucle sur la durée.
//
// En mémoire, comme le store par défaut de @fastify/rate-limit lui-même —
// pas besoin de survivre à un redémarrage de conteneur pour être utile.
const hits = new Map<string, number[]>();

export function checkLongWindowLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length <= max;
}
