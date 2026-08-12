import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyRecaptcha } from "../src/lib/recaptcha.js";

const ORIGINAL_ENV = { ...process.env };

describe("verifyRecaptcha", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("fails open (dev bypass) when no secret is configured and NODE_ENV is not production", async () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    process.env.NODE_ENV = "development";
    const result = await verifyRecaptcha(undefined, "signup", 0.5);
    expect(result.ok).toBe(true);
  });

  it("fails CLOSED when no secret is configured and NODE_ENV is production", async () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    process.env.NODE_ENV = "production";
    const result = await verifyRecaptcha(undefined, "signup", 0.5);
    expect(result.ok).toBe(false);
  });

  it("rejects a missing token once a secret is configured (never calls Google without a token)", async () => {
    process.env.RECAPTCHA_SECRET_KEY = "test-secret";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await verifyRecaptcha(undefined, "signup", 0.5);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("missing token");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects when Google reports success:false", async () => {
    process.env.RECAPTCHA_SECRET_KEY = "test-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
    }));
    const result = await verifyRecaptcha("some-token", "signup", 0.5);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid-input-response");
  });

  it("rejects a score below the configured minimum — never trusts a client-supplied score", async () => {
    process.env.RECAPTCHA_SECRET_KEY = "test-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ success: true, score: 0.2, action: "signup" }),
    }));
    const result = await verifyRecaptcha("some-token", "signup", 0.5);
    expect(result.ok).toBe(false);
    expect(result.score).toBe(0.2);
    expect(result.reason).toBe("score below threshold");
  });

  it("rejects an action mismatch even with a high score", async () => {
    process.env.RECAPTCHA_SECRET_KEY = "test-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ success: true, score: 0.9, action: "login" }),
    }));
    const result = await verifyRecaptcha("some-token", "signup", 0.5);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("action mismatch");
  });

  it("accepts a matching action with a score at or above the minimum", async () => {
    process.env.RECAPTCHA_SECRET_KEY = "test-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ success: true, score: 0.7, action: "signup" }),
    }));
    const result = await verifyRecaptcha("some-token", "signup", 0.5);
    expect(result.ok).toBe(true);
    expect(result.score).toBe(0.7);
  });
});
