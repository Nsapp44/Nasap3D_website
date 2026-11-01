import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("../src/lib/server/prisma", () => ({ prisma: { cartItem: { findMany: (...a: unknown[]) => findMany(...a) } } }));

import { cartWouldExceedLimit, CART_MAX_PIECES, CART_MAX_LINES } from "../src/lib/server/cart";

const id = { sessionId: "s" };

describe("cartWouldExceedLimit", () => {
  beforeEach(() => findMany.mockReset());

  it("accepte un ajout sous le plafond", async () => {
    findMany.mockResolvedValue([{ id: "a", qty: 10 }]);
    expect(await cartWouldExceedLimit(id, 100)).toBe(false);
  });

  it("refuse un ajout qui dépasse le total de pièces", async () => {
    findMany.mockResolvedValue([{ id: "a", qty: CART_MAX_PIECES - 5 }]);
    expect(await cartWouldExceedLimit(id, 6)).toBe(true);
    expect(await cartWouldExceedLimit(id, 5)).toBe(false);
  });

  it("refuse une 31e ligne", async () => {
    findMany.mockResolvedValue(Array.from({ length: CART_MAX_LINES }, (_, i) => ({ id: String(i), qty: 1 })));
    expect(await cartWouldExceedLimit(id, 1)).toBe(true);
  });

  it("modification : la quantité actuelle de la ligne n'est pas comptée", async () => {
    findMany.mockResolvedValue([{ id: "a", qty: 400 }, { id: "b", qty: 50 }]);
    expect(await cartWouldExceedLimit(id, 450, "a")).toBe(false);
    expect(await cartWouldExceedLimit(id, 451, "a")).toBe(true);
  });
});
