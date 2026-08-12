import { PrismaClient } from "@prisma/client";
import { nextCustomerNo } from "../src/lib/counter.js";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

// Mirrors the color catalogue currently hardcoded in the front-end's stock.js
// (RAW), so the admin stock screen shows exactly the same items once wired
// to the API. `key` matches the configurator's material keys (stock.js'
// MATERIAL_KEY_MAP); `label` matches the display name used in the admin UI.
const MATERIALS: {
  key: string;
  label: string;
  densityGCm3: number;
  pricePerKgCents: number;
  colors: [string, string][];
}[] = [
  {
    key: "PLA",
    label: "PLA",
    densityGCm3: 1.26,
    pricePerKgCents: 2200,
    colors: [
      ["Jade White", "#f4f4ef"], ["Beige", "#dcc6a0"], ["Green", "#00744d"],
      ["Mistletoe Green", "#37603c"], ["Grass Green", "#61c680"], ["Turquoise", "#00b1a9"],
      ["Cobalt Blue", "#0056b3"], ["Blue", "#0057ba"], ["Ice Blue", "#a0dce8"],
      ["Cyan", "#0093c3"], ["Purple", "#6b3fa0"], ["Magenta", "#ec008c"],
      ["Pink", "#f5a7c4"], ["Red", "#c0141b"], ["Maroon Red", "#9d2235"],
      ["Orange", "#ff6a13"], ["Yellow", "#f4ee2a"], ["Gold", "#c8a951"],
      ["Silver", "#a6a9aa"], ["Gray", "#8e9089"], ["Charcoal", "#3f3f3f"],
      ["Black", "#0f0f0f"], ["Brown", "#7a4a2b"], ["Bronze", "#8c6239"],
    ],
  },
  {
    key: "PETG",
    label: "PETG HF",
    densityGCm3: 1.28,
    pricePerKgCents: 2600,
    colors: [
      ["White", "#f4f4ef"], ["Black", "#0f0f0f"], ["Gray", "#8e9089"],
      ["Blue", "#0057ba"], ["Green", "#3c8c47"], ["Orange", "#ff6a13"],
      ["Red", "#c0141b"], ["Yellow", "#f4ee2a"], ["Lime Green", "#a6ce39"],
      ["Peanut Brown", "#7a4a2b"], ["Translucent Teal", "#4fb3a9"], ["Dark Red", "#7c1723"],
    ],
  },
  {
    key: "ABS",
    label: "ABS",
    densityGCm3: 1.04,
    pricePerKgCents: 2400,
    colors: [
      ["Black", "#0f0f0f"], ["White", "#f4f4ef"], ["Red", "#c0141b"],
      ["Blue", "#0057ba"], ["Gray", "#8e9089"], ["Orange", "#ff6a13"],
      ["Yellow", "#f4ee2a"], ["Green", "#3c8c47"], ["Tangerine Yellow", "#ffb100"],
      ["Navy Blue", "#1c2b4a"],
    ],
  },
  {
    key: "ASA",
    label: "ASA",
    densityGCm3: 1.05,
    pricePerKgCents: 2800,
    colors: [
      ["White", "#f4f4ef"], ["Black", "#0f0f0f"], ["Gray", "#8e9089"],
      ["Red", "#c0141b"], ["Blue", "#0057ba"], ["Green", "#3c8c47"],
    ],
  },
  {
    key: "TPU",
    label: "TPU 95A",
    densityGCm3: 1.22,
    pricePerKgCents: 3200,
    colors: [
      ["Black", "#0f0f0f"], ["White", "#f4f4ef"], ["Red", "#c0141b"],
      ["Yellow", "#f4ee2a"], ["Blue", "#0057ba"],
    ],
  },
  {
    key: "Nylon",
    label: "PA (Nylon)",
    densityGCm3: 1.09,
    pricePerKgCents: 4500,
    colors: [
      ["Black (CF)", "#0f0f0f"], ["Gray (CF)", "#6b6d66"], ["Natural", "#d8d3c8"],
    ],
  },
  {
    key: "PP",
    label: "PP",
    densityGCm3: 0.90,
    pricePerKgCents: 3000,
    colors: [
      ["Black", "#0f0f0f"], ["White", "#f4f4ef"], ["Gray", "#8e9089"],
    ],
  },
];

// Mirrors Devis Instantane.dc.html's quality steps.
const QUALITIES = [
  { key: "Rapide", label: "Rapide", layerHeightMm: 0.28, timeMultiplier: 0.7 },
  { key: "Standard", label: "Standard", layerHeightMm: 0.20, timeMultiplier: 1.0 },
  { key: "Fine", label: "Fine", layerHeightMm: 0.12, timeMultiplier: 1.6 },
];

// Mirrors cart.js' DISCOUNT_TIERS exactly, so the front behaves the same
// once discounts are read from the API instead of being hardcoded.
const DISCOUNT_TIERS = [
  { minQty: 5, pct: 5 },
  { minQty: 15, pct: 10 },
  { minQty: 50, pct: 15 },
  { minQty: 100, pct: 20 },
  { minQty: 500, pct: 30 },
];

async function main() {
  console.log("Seeding materials, colors, quality profiles, discount tiers...");
  for (const m of MATERIALS) {
    const material = await prisma.material.upsert({
      where: { key: m.key },
      create: {
        key: m.key,
        label: m.label,
        densityGCm3: m.densityGCm3,
        pricePerKgCents: m.pricePerKgCents,
      },
      update: {
        label: m.label,
        densityGCm3: m.densityGCm3,
      },
    });
    for (const [colorName, colorHex] of m.colors) {
      await prisma.materialColor.upsert({
        where: { materialId_colorName: { materialId: material.id, colorName } },
        create: { materialId: material.id, colorName, colorHex },
        update: { colorHex },
      });
    }
  }

  for (const q of QUALITIES) {
    await prisma.qualityProfile.upsert({
      where: { key: q.key },
      create: q,
      update: q,
    });
  }

  for (const t of DISCOUNT_TIERS) {
    await prisma.discountTier.upsert({
      where: { minQty: t.minQty },
      create: t,
      update: t,
    });
  }

  console.log("Seeding pricing/quote settings (placeholders — tune from the admin panel)...");
  await prisma.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      quoteEnabled: true,
      hourlyRateCents: 500,
      minUnitPriceCents: 890,
      quoteExpiryMinutes: 60,
      minOrderCents: 1800,
      smallOrderFeeCents: 500,
    },
    update: {},
  });

  console.log("Seeding accounts...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@nasap3d.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Ugz9Pb7VrVLjQEN538-8!";
  const adminHash = await hashPassword(adminPassword);
  const adminExisting = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminExisting) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: adminHash,
        customerNo: await nextCustomerNo(),
        role: "ADMIN",
        // Seeded, not signed up through the real flow — no verification
        // email was ever sent, so there's nothing to confirm.
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`  created admin account: ${adminEmail}`);
  } else {
    console.log(`  admin account already exists: ${adminEmail} (left untouched)`);
  }

  // Kept as-is at the user's request: same credentials as the current
  // front-end demo account (client@nasap3d.com / Client2026!), now backed
  // by a real seeded row instead of localStorage.
  const testEmail = "client@nasap3d.com";
  const testPassword = "Client2026!";
  const testHash = await hashPassword(testPassword);
  const testExisting = await prisma.user.findUnique({ where: { email: testEmail } });
  if (!testExisting) {
    await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: testHash,
        customerNo: await nextCustomerNo(),
        role: "CLIENT",
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`  created test account: ${testEmail}`);
  } else {
    console.log(`  test account already exists: ${testEmail} (left untouched)`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
