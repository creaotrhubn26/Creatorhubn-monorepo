import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuditionReminderEmail,
  buildAuditionReminderSmsBody,
  isSmsBrandConfigured,
  normalizePhoneE164,
  parseReminderPrefs,
  sendSms,
} from "./casting-reminder-sender.js";

describe("normalizePhoneE164", () => {
  it("converts a Norwegian national number to E.164", () => {
    expect(normalizePhoneE164("99887766")).toBe("+4799887766");
  });

  it("preserves an already-E.164 number", () => {
    expect(normalizePhoneE164("+4799887766")).toBe("+4799887766");
  });

  it("handles common formatting (spaces, dashes)", () => {
    expect(normalizePhoneE164("998 87 766")).toBe("+4799887766");
    expect(normalizePhoneE164("99-88-77-66")).toBe("+4799887766");
  });

  it("returns null for empty / nullish input", () => {
    expect(normalizePhoneE164("")).toBeNull();
    expect(normalizePhoneE164(null)).toBeNull();
    expect(normalizePhoneE164(undefined)).toBeNull();
  });

  it("returns null for invalid number", () => {
    expect(normalizePhoneE164("notaphone")).toBeNull();
    expect(normalizePhoneE164("12")).toBeNull();
  });

  it("respects defaultCountry override", () => {
    const result = normalizePhoneE164("070123456789", "DE");
    expect(typeof result === "string" && result.startsWith("+49")).toBe(true);
  });
});

describe("parseReminderPrefs", () => {
  it("returns full defaults when input is null/undefined", () => {
    expect(parseReminderPrefs(null)).toEqual({
      sms24h: true,
      sms1h: true,
      email24h: true,
      email1h: true,
    });
    expect(parseReminderPrefs(undefined)).toEqual({
      sms24h: true,
      sms1h: true,
      email24h: true,
      email1h: true,
    });
  });

  it("merges partial prefs with defaults", () => {
    expect(parseReminderPrefs({ sms24h: false })).toEqual({
      sms24h: false,
      sms1h: true,
      email24h: true,
      email1h: true,
    });
  });

  it("ignores non-boolean fields", () => {
    expect(parseReminderPrefs({ sms24h: "no" as unknown as boolean })).toEqual({
      sms24h: true,
      sms1h: true,
      email24h: true,
      email1h: true,
    });
  });
});

describe("buildAuditionReminderSmsBody", () => {
  it("includes project name, date, time and 'i morgen' for 24h threshold", () => {
    const body = buildAuditionReminderSmsBody({
      candidateName: "Lise",
      projectName: "Tromsø-prosjektet",
      date: "2026-04-30",
      startTime: "15:00",
      location: "Studio 7",
      threshold: "24h",
      brandLabel: "The Role Room",
    });
    expect(body).toContain("i morgen");
    expect(body).toContain("Tromsø-prosjektet");
    expect(body).toContain("30. april");
    expect(body).toContain("15:00");
    expect(body).toContain("Studio 7");
    expect(body).toContain("The Role Room");
  });

  it("uses 'om ca 1 time' for 1h threshold", () => {
    const body = buildAuditionReminderSmsBody({
      candidateName: "Lise",
      projectName: "Audition",
      date: "2026-04-29",
      startTime: "15:00",
      threshold: "1h",
      brandLabel: "The Role Room",
    });
    expect(body).toContain("om ca 1 time");
  });

  it("omits location row when not provided", () => {
    const body = buildAuditionReminderSmsBody({
      candidateName: "Lise",
      projectName: "Audition",
      date: "2026-04-29",
      startTime: "15:00",
      threshold: "1h",
    });
    expect(body).not.toContain("Sted:");
  });
});

describe("buildAuditionReminderEmail", () => {
  it("escapes HTML in candidate name", () => {
    const built = buildAuditionReminderEmail({
      candidateName: "<script>alert('xss')</script>",
      projectName: "Audition",
      date: "2026-04-29",
      startTime: "15:00",
      threshold: "1h",
    });
    expect(built.html).not.toContain("<script>");
    expect(built.html).toContain("&lt;script&gt;");
  });

  it("includes portal URL CTA when provided", () => {
    const built = buildAuditionReminderEmail({
      candidateName: "Lise",
      projectName: "Audition",
      date: "2026-04-29",
      startTime: "15:00",
      threshold: "1h",
      portalUrl: "https://example.com/portal",
    });
    expect(built.html).toContain("https://example.com/portal");
    expect(built.html).toContain("Åpne talent-portalen");
  });
});

describe("isSmsBrandConfigured + sendSms with mocked fetch", () => {
  beforeEach(() => {
    process.env.ROLE_ROOM_TWILIO_ACCOUNT_SID = "ACtest";
    process.env.ROLE_ROOM_TWILIO_AUTH_TOKEN = "tokentest";
    process.env.ROLE_ROOM_TWILIO_MESSAGING_SERVICE_SID = "MGtest_role";
    process.env.CREATORHUB_TWILIO_ACCOUNT_SID = "ACtestCH";
    process.env.CREATORHUB_TWILIO_AUTH_TOKEN = "tokentestCH";
    process.env.CREATORHUB_TWILIO_MESSAGING_SERVICE_SID = "MGtest_ch";
  });

  afterEach(() => {
    delete process.env.ROLE_ROOM_TWILIO_ACCOUNT_SID;
    delete process.env.ROLE_ROOM_TWILIO_AUTH_TOKEN;
    delete process.env.ROLE_ROOM_TWILIO_MESSAGING_SERVICE_SID;
    delete process.env.CREATORHUB_TWILIO_ACCOUNT_SID;
    delete process.env.CREATORHUB_TWILIO_AUTH_TOKEN;
    delete process.env.CREATORHUB_TWILIO_MESSAGING_SERVICE_SID;
  });

  it("reports configured for both brands", () => {
    expect(isSmsBrandConfigured("role-room")).toBe(true);
    expect(isSmsBrandConfigured("creatorhub")).toBe(true);
  });

  it("posts to correct Twilio messaging service per brand", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = String(init.body ?? "");
      const params = new URLSearchParams(body);
      return {
        ok: true,
        status: 201,
        text: async () => "",
        json: async () => ({ sid: `SM-${params.get("MessagingServiceSid")}` }),
      } as Response;
    });

    const roleRoomResult = await sendSms({
      brand: "role-room",
      to: "+4799887766",
      body: "hi",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(roleRoomResult.success).toBe(true);
    expect(roleRoomResult.messageSid).toBe("SM-MGtest_role");

    const creatorhubResult = await sendSms({
      brand: "creatorhub",
      to: "+4799887766",
      body: "hi",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(creatorhubResult.success).toBe(true);
    expect(creatorhubResult.messageSid).toBe("SM-MGtest_ch");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = fetchMock.mock.calls[0][0] as string;
    expect(firstUrl).toContain("ACtest");
  });

  it("returns invalid_phone for unparseable number", async () => {
    const fetchMock = vi.fn();
    const result = await sendSms({
      brand: "role-room",
      to: "notaphone",
      body: "hi",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("invalid_phone");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns twilio_not_configured when env vars are missing", async () => {
    delete process.env.ROLE_ROOM_TWILIO_MESSAGING_SERVICE_SID;
    const fetchMock = vi.fn();
    const result = await sendSms({
      brand: "role-room",
      to: "+4799887766",
      body: "hi",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("twilio_not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces 4xx from Twilio as an error", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => '{"code":21610,"message":"unsubscribed"}',
      json: async () => ({}),
    }) as unknown as Response);
    const result = await sendSms({
      brand: "role-room",
      to: "+4799887766",
      body: "hi",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("twilio_400");
  });
});
