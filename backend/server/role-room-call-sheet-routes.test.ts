import { describe, it, expect, afterEach } from "vitest";
import { acknowledgeBlock, publicBaseUrl } from "./role-room-call-sheet-routes.js";

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

describe("publicBaseUrl", () => {
  it("foretrekker den Role Room-spesifikke variabelen", () => {
    process.env.ROLE_ROOM_PUBLIC_BASE_URL = "https://rr.example.no";
    process.env.PUBLIC_BASE_URL = "https://annet.example.no";
    expect(publicBaseUrl()).toBe("https://rr.example.no");
  });

  it("faller tilbake til den generelle", () => {
    delete process.env.ROLE_ROOM_PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = "https://annet.example.no";
    expect(publicBaseUrl()).toBe("https://annet.example.no");
  });

  it("har en fornuftig default", () => {
    delete process.env.ROLE_ROOM_PUBLIC_BASE_URL;
    delete process.env.PUBLIC_BASE_URL;
    expect(publicBaseUrl()).toBe("https://www.theroleroom.com");
  });

  it("stripper etterslepende skråstrek, så lenken ikke får dobbel", () => {
    process.env.ROLE_ROOM_PUBLIC_BASE_URL = "https://rr.example.no///";
    expect(publicBaseUrl()).toBe("https://rr.example.no");
    expect(acknowledgeBlock("tok")).toContain("https://rr.example.no/api/role-room/call-sheets/ack/tok");
  });
});

describe("acknowledgeBlock", () => {
  it("bygger bekreftelseslenken med mottakerens token", () => {
    process.env.ROLE_ROOM_PUBLIC_BASE_URL = "https://rr.example.no";
    const html = acknowledgeBlock("abc123");
    expect(html).toContain("https://rr.example.no/api/role-room/call-sheets/ack/abc123");
  });

  it("er en synlig knapp, ikke en skjult sporingspiksel", () => {
    // Bevisst valg: mottakeren skal vite at bekreftelsen registreres, og et
    // klikk skal bety «jeg har sett innkallingstiden min».
    const html = acknowledgeBlock("t");
    expect(html).toContain("Bekreft mottatt");
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/width=["']?1["']?/i);
  });

  it("forklarer hvorfor bekreftelsen registreres", () => {
    expect(acknowledgeBlock("t")).toMatch(/produksjonen/i);
  });

  it("overlever token-tegn fra base64url uten å brekke lenken", () => {
    // randomBytes(24).toString('base64url') gir [A-Za-z0-9_-].
    const token = "aB3-_xYz";
    expect(acknowledgeBlock(token)).toContain(`/ack/${token}`);
  });
});
