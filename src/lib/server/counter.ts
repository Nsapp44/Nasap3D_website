import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// Atomic increment (single SQL UPDATE via upsert) — safe under concurrent
// signups/invoices.
// `tx` optionnel : à passer pour que l'incrément fasse partie d'une transaction
// Prisma interactive (ex. création d'une facture libre).
export async function nextCounter(key: string, tx?: Prisma.TransactionClient): Promise<number> {
  const row = await (tx ?? prisma).counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

export async function nextCustomerNo(): Promise<string> {
  const seq = await nextCounter("customerNo");
  return "CUS-" + String(seq).padStart(6, "0");
}
