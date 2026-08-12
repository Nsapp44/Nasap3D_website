import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, isValidPassword, isValidEmail } from "../src/lib/password.js";

describe("hashPassword / verifyPassword (real Argon2id, no mocking)", () => {
  it("verifies the correct plaintext against its own hash", async () => {
    const hash = await hashPassword("Correct-Horse1!");
    await expect(verifyPassword(hash, "Correct-Horse1!")).resolves.toBe(true);
  });

  it("rejects a wrong plaintext", async () => {
    const hash = await hashPassword("Correct-Horse1!");
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("never stores the plaintext in the hash", async () => {
    const hash = await hashPassword("Correct-Horse1!");
    expect(hash).not.toContain("Correct-Horse1!");
  });

  it("produces a different hash each time (random salt) even for the same input", async () => {
    const a = await hashPassword("Correct-Horse1!");
    const b = await hashPassword("Correct-Horse1!");
    expect(a).not.toBe(b);
  });
});

describe("isValidPassword", () => {
  it("accepts a password meeting all three rules", () => {
    expect(isValidPassword("Abcdefg1!")).toBe(true);
  });

  it("rejects passwords under 8 characters", () => {
    expect(isValidPassword("Ab1!")).toBe(false);
  });

  it("rejects passwords without an uppercase letter", () => {
    expect(isValidPassword("abcdefg1!")).toBe(false);
  });

  it("rejects passwords without a special character", () => {
    expect(isValidPassword("Abcdefgh1")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts a normal address", () => {
    expect(isValidEmail("client@nasap3d.com")).toBe(true);
  });

  it("rejects addresses missing an @ or a domain dot", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing-domain@")).toBe(false);
    expect(isValidEmail("no-tld@nasap3d")).toBe(false);
  });

  it("rejects addresses containing whitespace", () => {
    expect(isValidEmail("has space@nasap3d.com")).toBe(false);
  });
});
