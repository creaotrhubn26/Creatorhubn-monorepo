import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptWhatsAppToken,
  encryptWhatsAppToken,
  pingWhatsAppPhoneNumber,
} from "./role-room-whatsapp-config-service.js";

describe("WhatsApp token encryption", () => {
  beforeEach(() => {
    process.env.ROLE_ROOM_TOKEN_ENCRYPTION_KEY = "test-secret-32-bytes-aaaaaaaaaaaa";
  });

  afterEach(() => {
    delete process.env.ROLE_ROOM_TOKEN_ENCRYPTION_KEY;
  });

  it("round-trips a plaintext token", () => {
    const original = "EAAGblahblahMetaToken-9012345678";
    const encrypted = encryptWhatsAppToken(original);
    expect(encrypted).not.toBeNull();
    expect(encrypted).not.toContain(original);
    expect(decryptWhatsAppToken(encrypted)).toBe(original);
  });

  it("returns null for empty input", () => {
    expect(encryptWhatsAppToken("")).toBeNull();
    expect(encryptWhatsAppToken(null)).toBeNull();
    expect(decryptWhatsAppToken("")).toBeNull();
  });

  it("returns null when version mismatch in stored value", () => {
    expect(decryptWhatsAppToken("v999.x.y.z")).toBeNull();
  });

  it("throws when encryption key is missing", () => {
    delete process.env.ROLE_ROOM_TOKEN_ENCRYPTION_KEY;
    delete process.env.AUTH_SECRET;
    expect(() => encryptWhatsAppToken("anything")).toThrow();
  });
});

describe("pingWhatsAppPhoneNumber", () => {
  it("returns success with verified_name when Meta API returns 200", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        verified_name: "TestBrand",
        display_phone_number: "+47 12345678",
      }),
    }) as unknown as Response);

    const result = await pingWhatsAppPhoneNumber({
      accessToken: "tok",
      phoneNumberId: "123",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.verifiedName).toBe("TestBrand");
  });

  it("surfaces 401 from Meta as auth error", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => '{"error":{"message":"Invalid OAuth"}}',
      json: async () => ({}),
    }) as unknown as Response);

    const result = await pingWhatsAppPhoneNumber({
      accessToken: "bad",
      phoneNumberId: "123",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("meta_401");
  });

  it("handles network exceptions gracefully", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ENETUNREACH");
    });

    const result = await pingWhatsAppPhoneNumber({
      accessToken: "tok",
      phoneNumberId: "123",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("ENETUNREACH");
  });
});
