/**
 * Fallback-redirecten må peke på en rute som faktisk finnes.
 *
 * 2026-09-26: den gjorde ikke det. `resolveLinkedInRedirectUri` bygget
 * «/api/auth/linkedin/callback» når ROLE_ROOM_LINKEDIN_REDIRECT_URI ikke var
 * satt, mens linkedin-login-routes.ts registrerer
 * «/api/auth/linkedin/login-callback».
 *
 * LinkedIn avviste adressen som uregistrert («The redirect_uri does not
 * match the registered value»). Hadde den blitt registrert, ville den
 * truffet 404 — en feil som er verre, fordi den ser ut som et
 * LinkedIn-problem.
 */
import { describe, expect, it } from "vitest";
import { resolveLinkedInRedirectUri } from "./linkedin-oauth-config.js";

const req = (host: string, proto?: string) => ({
  get: (n: string) => (n.toLowerCase() === "host" ? host : undefined),
  headers: proto ? { "x-forwarded-proto": proto } : {},
  protocol: "http",
});

describe("resolveLinkedInRedirectUri", () => {
  it("bygger stien til ruta som faktisk er registrert i Express", () => {
    const url = resolveLinkedInRedirectUri(
      req("api.example.test", "https") as never, {} as never);
    expect(url).toBe("https://api.example.test/api/auth/linkedin/login-callback");
  });

  it("bygger ALDRI /callback — den ruta finnes ikke", () => {
    const url = resolveLinkedInRedirectUri(
      req("api.example.test", "https") as never, {} as never) ?? "";
    expect(url.endsWith("/api/auth/linkedin/callback")).toBe(false);
  });

  it("lar konfigurert verdi vinne over utledningen", () => {
    // Bak en proxy er vertsnavnet ikke nødvendigvis det LinkedIn kjenner.
    const url = resolveLinkedInRedirectUri(
      req("intern-host", "https") as never,
      { ROLE_ROOM_LINKEDIN_REDIRECT_URI:
          "https://leadgrid.no/api/auth/linkedin/login-callback" } as never);
    expect(url).toBe("https://leadgrid.no/api/auth/linkedin/login-callback");
  });

  it("respekterer x-forwarded-proto framfor req.protocol", () => {
    // Render terminerer TLS; uten dette ville vi sendt http:// til LinkedIn.
    expect(resolveLinkedInRedirectUri(
      req("a.test", "https") as never, {} as never)).toMatch(/^https:/);
  });
});
