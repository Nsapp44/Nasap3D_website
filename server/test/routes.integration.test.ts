import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

// Runs against the real dev database (DATABASE_URL in .env) with real
// plugins and real routes — no mocked Fastify, no mocked Prisma. This is
// the same "real infrastructure over mocks" approach used to build this
// backend in the first place (see server/README.md).
describe("routes (integration, real DB)", () => {
  let app: FastifyInstance;
  const testEmail = `vitest-${Date.now()}@nasap3d.com`;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
    await prisma.$disconnect();
  });

  it("GET /health responds ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("GET /materials returns the seeded catalogue", async () => {
    const res = await app.inject({ method: "GET", url: "/materials" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.materials)).toBe(true);
    expect(body.materials.length).toBeGreaterThan(0);
    expect(body.materials[0]).toHaveProperty("colors");
  });

  it("rejects a weak password on signup before ever touching the database", async () => {
    const previousSecret = process.env.RECAPTCHA_SECRET_KEY;
    delete process.env.RECAPTCHA_SECRET_KEY; // dev bypass — isolates this test from recaptcha_failed
    try {
      const res = await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: { email: testEmail, password: "weak" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("weak_password");
    } finally {
      if (previousSecret !== undefined) process.env.RECAPTCHA_SECRET_KEY = previousSecret;
    }
  });

  it("full signup -> email verification code -> confirm flow", async () => {
    // No RECAPTCHA_SECRET_KEY in the test environment's effective config for
    // this call -> dev bypass (see recaptcha.test.ts) so this test doesn't
    // depend on a real token.
    const previousSecret = process.env.RECAPTCHA_SECRET_KEY;
    delete process.env.RECAPTCHA_SECRET_KEY;

    const logSpy = vi.spyOn(console, "log");
    try {
      const signupRes = await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: { email: testEmail, password: "TestPwd2026!" },
      });
      expect(signupRes.statusCode).toBe(201);
      expect(signupRes.json().user.emailVerified).toBe(false);

      const setCookie = signupRes.headers["set-cookie"];
      const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      const sessionCookie = cookieHeader?.split(";")[0];
      expect(sessionCookie).toMatch(/^n3d_session=/);

      // The code was "sent" via the console-log fallback (see mailer.ts) —
      // this is also exactly how to test signup locally without SMTP
      // configured: read the code from the server's terminal output.
      const logged = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      const match = logged.match(/Votre code de vérification : (\d{6})/);
      expect(match).not.toBeNull();
      const code = match![1];

      const wrongRes = await app.inject({
        method: "POST",
        url: "/auth/verify-email",
        headers: { cookie: sessionCookie! },
        payload: { code: "000000" },
      });
      expect(wrongRes.statusCode).toBe(400);
      expect(wrongRes.json().error).toBe("wrong_code");

      const verifyRes = await app.inject({
        method: "POST",
        url: "/auth/verify-email",
        headers: { cookie: sessionCookie! },
        payload: { code },
      });
      expect(verifyRes.statusCode).toBe(200);
      expect(verifyRes.json().ok).toBe(true);

      const meRes = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: sessionCookie! } });
      expect(meRes.json().user.emailVerified).toBe(true);
    } finally {
      logSpy.mockRestore();
      if (previousSecret !== undefined) process.env.RECAPTCHA_SECRET_KEY = previousSecret;
    }
  });
});
