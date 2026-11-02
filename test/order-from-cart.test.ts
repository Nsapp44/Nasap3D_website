import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const deleteMany = vi.fn();
const orderCreate = vi.fn();
const getCartSummary = vi.fn();
const nextCounter = vi.fn();

const tx = {
  cartItem: { deleteMany: (...a: unknown[]) => deleteMany(...a) },
  order: { create: (...a: unknown[]) => orderCreate(...a) },
};

vi.mock("../src/lib/server/prisma", () => ({
  prisma: {
    cartItem: { findMany: (...a: unknown[]) => findMany(...a) },
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));
vi.mock("../src/lib/server/cart", () => ({ getCartSummary: (...a: unknown[]) => getCartSummary(...a) }));
vi.mock("../src/lib/server/counter", () => ({ nextCounter: (...a: unknown[]) => nextCounter(...a) }));

import { createOrderFromCart, EmptyCartError, CartChangedError } from "../src/lib/server/orders";

function line(id: string, qty: number, unitPriceCents: number, lineTotalCents: number) {
  return { id, qty, unitPriceCents, lineTotalCents, discountPct: 0, quoteJobId: "qj-" + id };
}

function summaryOf(lines: ReturnType<typeof line>[]) {
  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
  const totalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  return { lines, subtotalCents, discountCents: subtotalCents - totalCents, smallOrderFeeCents: 0, totalCents, minOrderCents: 0 };
}

function cartRow(id: string, qty: number) {
  return {
    id,
    qty,
    quoteJobId: "qj-" + id,
    quoteJob: {
      fileName: id + ".stl",
      infillPct: 20,
      scale: 1,
      material: { label: "PLA" },
      color: { colorName: "Noir", colorHex: "#000000" },
      quality: { label: "Standard" },
    },
  };
}

describe("createOrderFromCart", () => {
  beforeEach(() => {
    findMany.mockReset();
    deleteMany.mockReset();
    orderCreate.mockReset();
    getCartSummary.mockReset();
    nextCounter.mockReset();
    nextCounter.mockResolvedValue(1);
    deleteMany.mockResolvedValue({ count: 1 });
    orderCreate.mockImplementation(async ({ data }: { data: { ref: string; totalCents: number } }) => ({
      id: "order-1",
      ref: data.ref,
      totalCents: data.totalCents,
    }));
  });

  it("chemin normal : une commande avec les prix du résumé, une suppression conditionnelle par ligne", async () => {
    getCartSummary.mockResolvedValue(summaryOf([line("a", 2, 500, 1000), line("b", 1, 300, 300)]));
    findMany.mockResolvedValue([cartRow("a", 2), cartRow("b", 1)]);

    const res = await createOrderFromCart("u1", null);

    expect(res).toEqual({ orderId: "order-1", ref: "N3D-1001", totalCents: 1300 });
    expect(orderCreate).toHaveBeenCalledTimes(1);
    const data = orderCreate.mock.calls[0][0].data;
    expect(data.items.create).toHaveLength(2);
    expect(data.items.create[0]).toMatchObject({ quoteJobId: "qj-a", qty: 2, unitPriceCents: 500, lineTotalCents: 1000 });
    expect(data.items.create[1]).toMatchObject({ quoteJobId: "qj-b", qty: 1, unitPriceCents: 300, lineTotalCents: 300 });
    expect(deleteMany).toHaveBeenCalledTimes(2);
    expect(deleteMany).toHaveBeenNthCalledWith(1, { where: { id: "a", userId: "u1", qty: 2 } });
    expect(deleteMany).toHaveBeenNthCalledWith(2, { where: { id: "b", userId: "u1", qty: 1 } });
  });

  it("une ligne déjà consommée (count 0) : CartChangedError, aucune commande créée", async () => {
    getCartSummary.mockResolvedValue(summaryOf([line("a", 1, 500, 500), line("b", 1, 300, 300)]));
    findMany.mockResolvedValue([cartRow("a", 1), cartRow("b", 1)]);
    deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await expect(createOrderFromCart("u1", null)).rejects.toBeInstanceOf(CartChangedError);
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it("ligne lue mais absente du résumé (même nombre de lignes) : CartChangedError", async () => {
    getCartSummary.mockResolvedValue(summaryOf([line("a", 1, 500, 500), line("b", 1, 300, 300)]));
    findMany.mockResolvedValue([cartRow("a", 1), cartRow("c", 1)]);

    await expect(createOrderFromCart("u1", null)).rejects.toBeInstanceOf(CartChangedError);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it("nombre de lignes différent entre résumé et lecture : CartChangedError", async () => {
    getCartSummary.mockResolvedValue(summaryOf([line("a", 1, 500, 500)]));
    findMany.mockResolvedValue([cartRow("a", 1), cartRow("b", 1)]);
    await expect(createOrderFromCart("u1", null)).rejects.toBeInstanceOf(CartChangedError);

    getCartSummary.mockResolvedValue(summaryOf([line("a", 1, 500, 500), line("b", 1, 300, 300)]));
    findMany.mockResolvedValue([cartRow("a", 1)]);
    await expect(createOrderFromCart("u1", null)).rejects.toBeInstanceOf(CartChangedError);

    expect(deleteMany).not.toHaveBeenCalled();
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it("quantité différente entre résumé et lecture : CartChangedError", async () => {
    getCartSummary.mockResolvedValue(summaryOf([line("a", 1, 500, 500)]));
    findMany.mockResolvedValue([cartRow("a", 3)]);

    await expect(createOrderFromCart("u1", null)).rejects.toBeInstanceOf(CartChangedError);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it("panier vide : EmptyCartError, rien n'est lu ni créé", async () => {
    getCartSummary.mockResolvedValue(summaryOf([]));

    await expect(createOrderFromCart("u1", null)).rejects.toBeInstanceOf(EmptyCartError);
    expect(findMany).not.toHaveBeenCalled();
    expect(nextCounter).not.toHaveBeenCalled();
    expect(orderCreate).not.toHaveBeenCalled();
  });
});
