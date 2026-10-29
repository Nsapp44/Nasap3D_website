import { describe, it, expect } from "vitest";
import { toInternationalFrPhone } from "../src/lib/server/boxtal";

describe("toInternationalFrPhone", () => {
  it("converts a local FR number", () => {
    expect(toInternationalFrPhone("06 12 34 56 78")).toBe("+33612345678");
  });
  it("keeps an already international number", () => {
    expect(toInternationalFrPhone("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(toInternationalFrPhone("+32470123456")).toBe("+32470123456");
  });
});
