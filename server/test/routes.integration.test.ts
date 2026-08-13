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
    const previousSecret = process.env.HCAPTCHA_SECRET_KEY;
    delete process.env.HCAPTCHA_SECRET_KEY; // dev bypass — isolates this test from captcha_failed
    try {
      const res = await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: { email: testEmail, password: "weak" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("weak_password");
    } finally {
      if (previousSecret !== undefined) process.env.HCAPTCHA_SECRET_KEY = previousSecret;
    }
  });

  it("full signup -> pending code -> confirm flow (account only created on confirm)", async () => {
    // No HCAPTCHA_SECRET_KEY in the test environment's effective config for
    // this call -> dev bypass (see captcha.test.ts) so this test doesn't
    // depend on a real token.
    const previousSecret = process.env.HCAPTCHA_SECRET_KEY;
    delete process.env.HCAPTCHA_SECRET_KEY;

    const logSpy = vi.spyOn(console, "log");
    try {
      // Step 1: requesting a signup only mails a code — no account, no
      // session cookie, yet (see auth.ts POST /auth/signup).
      const signupRes = await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: { email: testEmail, password: "TestPwd2026!" },
      });
      expect(signupRes.statusCode).toBe(201);
      const { pendingId, expiresAt } = signupRes.json();
      expect(typeof pendingId).toBe("string");
      expect(expiresAt).toBeTruthy();
      expect(signupRes.headers["set-cookie"]).toBeUndefined();

      const noUserYet = await prisma.user.findUnique({ where: { email: testEmail } });
      expect(noUserYet).toBeNull();

      // The code was "sent" via the console-log fallback (see mailer.ts) —
      // this is also exactly how to test signup locally without SMTP
      // configured: read the code from the server's terminal output.
      const logged = logSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      const match = logged.match(/Votre code de vérification : (\d{6})/);
      expect(match).not.toBeNull();
      const code = match![1];

      const wrongRes = await app.inject({
        method: "POST",
        url: "/auth/signup/confirm",
        payload: { pendingId, code: "000000" },
      });
      expect(wrongRes.statusCode).toBe(400);
      expect(wrongRes.json().error).toBe("wrong_code");

      // Step 2: the right code both creates the account (already verified)
      // and logs it in.
      const confirmRes = await app.inject({
        method: "POST",
        url: "/auth/signup/confirm",
        payload: { pendingId, code },
      });
      expect(confirmRes.statusCode).toBe(201);
      expect(confirmRes.json().user.emailVerified).toBe(true);

      const setCookie = confirmRes.headers["set-cookie"];
      const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      const sessionCookie = cookieHeader?.split(";")[0];
      expect(sessionCookie).toMatch(/^n3d_session=/);

      const meRes = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie: sessionCookie! } });
      expect(meRes.json().user.emailVerified).toBe(true);
    } finally {
      logSpy.mockRestore();
      if (previousSecret !== undefined) process.env.HCAPTCHA_SECRET_KEY = previousSecret;
    }
  });

  it("cancelling a pending signup (never confirming) leaves no account behind", async () => {
    const previousSecret = process.env.HCAPTCHA_SECRET_KEY;
    delete process.env.HCAPTCHA_SECRET_KEY;
    const cancelledEmail = `${testEmail}-cancelled`;
    try {
      const signupRes = await app.inject({
        method: "POST",
        url: "/auth/signup",
        payload: { email: cancelledEmail, password: "TestPwd2026!" },
      });
      expect(signupRes.statusCode).toBe(201);

      const user = await prisma.user.findUnique({ where: { email: cancelledEmail } });
      expect(user).toBeNull();
    } finally {
      if (previousSecret !== undefined) process.env.HCAPTCHA_SECRET_KEY = previousSecret;
      await prisma.user.deleteMany({ where: { email: cancelledEmail } });
    }
  });
});
