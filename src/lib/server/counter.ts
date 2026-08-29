import { prisma } from "./prisma";

// Atomic increment (single SQL UPDATE via upsert) — safe under concurrent
// signups/invoices.
export async function nextCounter(key: string): Promise<number> {
  const row = await prisma.counter.upsert({
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
