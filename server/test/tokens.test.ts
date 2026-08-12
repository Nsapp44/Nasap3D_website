import { describe, it, expect } from "vitest";
import { generateToken, hashToken, generateNumericCode } from "../src/lib/tokens.js";

describe("generateToken / hashToken", () => {
  it("generates a URL-safe token with enough entropy to not collide in practice", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateToken());
    expect(seen.size).toBe(1000);
  });

  it("hashToken is deterministic (same input -> same hash)", () => {
    const raw = generateToken();
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it("hashToken never returns the raw value back", () => {
    const raw = generateToken();
    expect(hashToken(raw)).not.toBe(raw);
  });

  it("hashToken output differs for different inputs", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});

describe("generateNumericCode", () => {
  it("always returns exactly 6 digits", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateNumericCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("never generates a code with a leading zero shorter than 6 digits (padding/range check)", () => {
    for (let i = 0; i < 200; i++) {
      const n = Number(generateNumericCode());
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThan(1000000);
    }
  });
});
