import { describe, it, expect } from "vitest";
import { resolveClientIp, isPrivateOrLoopback, clientIp } from "../src/lib/api/rateLimit";

describe("resolveClientIp", () => {
  it("socket privé + XFF simple : renvoie l'entrée XFF", () => {
    expect(resolveClientIp("172.18.0.5", "203.0.113.7")).toBe("203.0.113.7");
  });

  it("socket privé + XFF multiple : renvoie l'entrée la plus à droite", () => {
    expect(resolveClientIp("172.18.0.5", "1.2.3.4, 203.0.113.7")).toBe("203.0.113.7");
  });

  it("tolère les espaces et une entrée vide finale", () => {
    expect(resolveClientIp("172.18.0.5", "  203.0.113.7 , ")).toBe("203.0.113.7");
    expect(resolveClientIp("172.18.0.5", "1.2.3.4,   ,203.0.113.7")).toBe("203.0.113.7");
  });

  it("socket privé sans XFF (ou XFF vide) : renvoie l'IP socket", () => {
    expect(resolveClientIp("172.18.0.5", null)).toBe("172.18.0.5");
    expect(resolveClientIp("172.18.0.5", undefined)).toBe("172.18.0.5");
    expect(resolveClientIp("172.18.0.5", "")).toBe("172.18.0.5");
    expect(resolveClientIp("172.18.0.5", " , ")).toBe("172.18.0.5");
  });

  it("socket public : XFF toujours ignoré", () => {
    expect(resolveClientIp("198.51.100.9", "1.1.1.1")).toBe("198.51.100.9");
  });

  it("socket IPv4 mappée, ::1 ou 127.0.0.1 + XFF : renvoie XFF", () => {
    expect(resolveClientIp("::ffff:172.18.0.5", "203.0.113.7")).toBe("203.0.113.7");
    expect(resolveClientIp("::1", "203.0.113.7")).toBe("203.0.113.7");
    expect(resolveClientIp("127.0.0.1", "203.0.113.7")).toBe("203.0.113.7");
  });

  it("socket absent sans XFF : unknown", () => {
    expect(resolveClientIp(undefined, undefined)).toBe("unknown");
    expect(resolveClientIp("", null)).toBe("unknown");
  });

  it("socket absent avec XFF : unknown (XFF non fiable sans proxy identifié)", () => {
    expect(resolveClientIp(undefined, "1.1.1.1")).toBe("unknown");
  });
});

describe("isPrivateOrLoopback", () => {
  it("IPv4", () => {
    expect(isPrivateOrLoopback("127.0.0.1")).toBe(true);
    expect(isPrivateOrLoopback("10.1.2.3")).toBe(true);
    expect(isPrivateOrLoopback("172.15.0.1")).toBe(false);
    expect(isPrivateOrLoopback("172.16.0.1")).toBe(true);
    expect(isPrivateOrLoopback("172.31.255.255")).toBe(true);
    expect(isPrivateOrLoopback("172.32.0.1")).toBe(false);
    expect(isPrivateOrLoopback("192.168.1.1")).toBe(true);
    expect(isPrivateOrLoopback("192.169.0.1")).toBe(false);
    expect(isPrivateOrLoopback("8.8.8.8")).toBe(false);
    expect(isPrivateOrLoopback("300.1.1.1")).toBe(false);
  });

  it("IPv6", () => {
    expect(isPrivateOrLoopback("::1")).toBe(true);
    expect(isPrivateOrLoopback("fd12::1")).toBe(true);
    expect(isPrivateOrLoopback("FC00::1")).toBe(true);
    expect(isPrivateOrLoopback("fe80::1")).toBe(true);
    expect(isPrivateOrLoopback("febf::1")).toBe(true);
    expect(isPrivateOrLoopback("fec0::1")).toBe(false);
    expect(isPrivateOrLoopback("2001:db8::1")).toBe(false);
  });

  it("IPv4 mappée en IPv6", () => {
    expect(isPrivateOrLoopback("::ffff:172.18.0.5")).toBe(true);
    expect(isPrivateOrLoopback("::FFFF:192.168.0.1")).toBe(true);
    expect(isPrivateOrLoopback("::ffff:8.8.8.8")).toBe(false);
  });

  it("tolère espaces, chaîne vide et valeurs invalides", () => {
    expect(isPrivateOrLoopback("  172.18.0.5  ")).toBe(true);
    expect(isPrivateOrLoopback("")).toBe(false);
    expect(isPrivateOrLoopback("pas-une-ip")).toBe(false);
  });
});

describe("clientIp", () => {
  it("lit X-Forwarded-For depuis request quand le socket est privé", () => {
    const request = new Request("http://x/", { headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.7" } });
    expect(clientIp({ clientAddress: "172.18.0.5", request })).toBe("203.0.113.7");
  });

  it("ne lève pas quand le getter clientAddress lève", () => {
    const context = {
      get clientAddress(): string {
        throw new Error("ClientAddressNotAvailable");
      },
    };
    expect(clientIp(context)).toBe("unknown");
  });
});
