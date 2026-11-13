import { describe, it, expect, afterEach } from "vitest";
import {
  BoxtalApiError,
  boxtalConfigMissing,
  boxtalDocErrorReason,
  boxtalHttpReason,
  shortBoxtalReason,
  BOXTAL_REASON_UNREACHABLE,
} from "../src/lib/server/boxtal";

describe("boxtalDocErrorReason", () => {
  it("prend error.message, balises retirées", () => {
    expect(boxtalDocErrorReason({ code: "x", message: "Le code postal <b>ne</b> correspond pas." })).toBe(
      "Le code postal ne correspond pas.",
    );
  });
  it("jamais de XML, même si le message en contient", () => {
    const r = boxtalDocErrorReason({ message: '<?xml version="1.0"?><error><code>1</code>Adresse invalide</error>' });
    expect(r).not.toMatch(/[<>]/);
    expect(r).toContain("Adresse invalide");
  });
  it("plafonne à 160 caractères", () => {
    expect(boxtalDocErrorReason({ message: "a".repeat(500) }).length).toBeLessThanOrEqual(160);
  });
  it("repli générique si forme inconnue", () => {
    for (const e of [undefined, null, {}, { code: 3 }, 42, { message: "   " }]) {
      expect(boxtalDocErrorReason(e)).toBe("Boxtal a refusé la demande");
    }
  });
});

describe("shortBoxtalReason", () => {
  it("utilise shortReason, jamais message (qui contient le XML)", () => {
    const err = new BoxtalApiError("boxtal order http 400: <xml>secret</xml>", boxtalHttpReason(400));
    expect(shortBoxtalReason(err)).toBe("Boxtal a répondu HTTP 400");
  });
  it("repli réseau / HTTP", () => {
    expect(shortBoxtalReason(new BoxtalApiError("x", BOXTAL_REASON_UNREACHABLE))).toBe("Boxtal ne répond pas");
    expect(boxtalHttpReason(503)).toBe("Boxtal a répondu HTTP 503");
  });
  it("repli générique sans shortReason ou pour une erreur quelconque", () => {
    expect(shortBoxtalReason(new BoxtalApiError("<xml/>"))).toBe("Boxtal a refusé la demande");
    expect(shortBoxtalReason(new Error("<xml/>"))).toBe("Boxtal a refusé la demande");
    expect(shortBoxtalReason("oops")).toBe("Boxtal a refusé la demande");
  });
  it("nettoie et plafonne même un shortReason trop long ou balisé", () => {
    const r = shortBoxtalReason(new BoxtalApiError("m", "<p>" + "b".repeat(400) + "</p>"));
    expect(r).not.toMatch(/[<>]/);
    expect(r.length).toBeLessThanOrEqual(160);
  });
});

describe("boxtalConfigMissing", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  it("liste les variables absentes, sans appel réseau", () => {
    for (const k of Object.keys(process.env)) if (k.startsWith("BOXTAL_")) delete process.env[k];
    expect(boxtalConfigMissing()).toContain("BOXTAL_API_KEY_V1");
    process.env.BOXTAL_API_KEY_V1 = "k";
    expect(boxtalConfigMissing()).not.toContain("BOXTAL_API_KEY_V1");
    expect(boxtalConfigMissing()).toContain("BOXTAL_API_SECRET_V1");
  });
  it("vide quand tout est défini", () => {
    for (const n of boxtalConfigMissing()) process.env[n] = "x";
    expect(boxtalConfigMissing()).toEqual([]);
  });
});
