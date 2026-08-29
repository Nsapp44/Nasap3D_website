import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyCaptcha } from "../src/lib/server/captcha";

const ORIGINAL_ENV = { ...process.env };

describe("verifyCaptcha", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("fails open (dev bypass) when no secret is configured and NODE_ENV is not production", async () => {
    delete process.env.HCAPTCHA_SECRET_KEY;
    process.env.NODE_ENV = "development";
    const result = await verifyCaptcha(undefined);
    expect(result.ok).toBe(true);
  });

  it("fails CLOSED when no secret is configured and NODE_ENV is production", async () => {
    delete process.env.HCAPTCHA_SECRET_KEY;
    process.env.NODE_ENV = "production";
    const result = await verifyCaptcha(undefined);
    expect(result.ok).toBe(false);
  });

  it("rejects a missing token once a secret is configured (never calls hCaptcha without a token)", async () => {
    process.env.HCAPTCHA_SECRET_KEY = "test-secret";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await verifyCaptcha(undefined);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("missing token");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects when hCaptcha reports success:false", async () => {
    process.env.HCAPTCHA_SECRET_KEY = "test-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
      }),
    );
    const result = await verifyCaptcha("some-token");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid-input-response");
  });

  it("accepts when hCaptcha reports success:true — deterministic, no score involved", async () => {
    process.env.HCAPTCHA_SECRET_KEY = "test-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true }),
      }),
    );
    const result = await verifyCaptcha("some-token");
    expect(result.ok).toBe(true);
  });
});
