import { describe, expect, it } from "vitest";
import { countBoxes } from "../src/lib/server/boxStockAuto";

describe("countBoxes", () => {
  it("compte les cartons par code", () => {
    expect(Object.fromEntries(countBoxes([{ box: "M" }, { box: "M" }, { box: "XL" }]))).toEqual({ M: 2, XL: 1 });
  });
  it("ignore null, non-tableau et entrees invalides", () => {
    expect(countBoxes(null).size).toBe(0);
    expect(countBoxes([null, {}, { box: 3 }]).size).toBe(0);
  });
});
