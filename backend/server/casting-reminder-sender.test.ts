import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nodemailerMocks = vi.hoisted(() => {
  const sendMail = vi.fn(async () => ({ messageId: "message-1" }));
  return {
    sendMail,
    createTransport: vi.fn(() => ({ sendMail })),
  };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: nodemailerMocks.createTransport },
  createTransport: nodemailerMocks.createTransport,
}));

import {
  buildAuditionReminderEmail,
  buildAuditionReminderSmsBody,
  isSmsBrandConfigured,
  normalizePhoneE164,
  parseReminderPrefs,
  sendEmail,
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
  const ALL_TRUE = {
    sms24h: true,
    sms1h: true,
    email24h: true,
    email1h: true,
    whatsapp24h: true,
    whatsapp1h: true,
  };

  it("returns full defaults when input is null/undefined", () => {
    expect(parseReminderPrefs(null)).toEqual(ALL_TRUE);
    expect(parseReminderPrefs(undefined)).toEqual(ALL_TRUE);
  });

  it("merges partial prefs with defaults", () => {
    expect(parseReminderPrefs({ sms24h: false })).toEqual({
      ...ALL_TRUE,
      sms24h: false,
    });
    expect(parseReminderPrefs({ whatsapp1h: false })).toEqual({
      ...ALL_TRUE,
      whatsapp1h: false,
    });
  });

  it("ignores non-boolean fields", () => {
    expect(parseReminderPrefs({ sms24h: "no" as unknown as boolean })).toEqual(
      ALL_TRUE,
    );
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

describe("sendEmail SMTP timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nodemailerMocks.sendMail.mockResolvedValue({ messageId: "message-1" });
    nodemailerMocks.createTransport.mockReturnValue({
      sendMail: nodemailerMocks.sendMail,
    });
    process.env.GMAIL_USER = "sender@example.test";
    process.env.GMAIL_APP_PASSWORD = "app-password";
  });

  afterEach(() => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
  });

  it("applies the opt-in timeout to all SMTP wait phases", async () => {
    const result = await sendEmail({
      to: "waiting@example.test",
      subject: "Leadgrid live",
      html: "<p>Live</p>",
      fromName: "Leadgrid",
      smtpTimeoutMs: 120_000,
      messageId: "<leadgrid-app-launch-row-1@creatorhubn.com>",
    });

    expect(result).toMatchObject({
      success: true,
      provider: "gmail",
      messageId: "message-1",
    });
    expect(nodemailerMocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 30_000,
        greetingTimeout: 30_000,
        socketTimeout: 120_000,
      }),
    );
    expect(nodemailerMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "<leadgrid-app-launch-row-1@creatorhubn.com>",
      }),
    );
  });

  it("classifies timeout/disconnect after sendMail starts as uncertain", async () => {
    nodemailerMocks.sendMail.mockRejectedValueOnce(
      Object.assign(new Error("Timeout"), {
        code: "ETIMEDOUT",
        command: "CONN",
      }),
    );

    await expect(
      sendEmail({
        to: "waiting@example.test",
        subject: "Leadgrid live",
        html: "<p>Live</p>",
        fromName: "Leadgrid",
      }),
    ).resolves.toMatchObject({
      success: false,
      failureCertainty: "uncertain",
    });
  });

  it("classifies authentication rejection as definite pre-delivery", async () => {
    nodemailerMocks.sendMail.mockRejectedValueOnce(
      Object.assign(new Error("Invalid login"), {
        code: "EAUTH",
        command: "AUTH LOGIN",
      }),
    );

    await expect(
      sendEmail({
        to: "waiting@example.test",
        subject: "Leadgrid live",
        html: "<p>Live</p>",
        fromName: "Leadgrid",
      }),
    ).resolves.toMatchObject({
      success: false,
      failureCertainty: "definite_pre_delivery",
    });
  });

  it("keeps the existing transport defaults when no timeout is requested", async () => {
    await sendEmail({
      to: "reminder@example.test",
      subject: "Påminnelse",
      html: "<p>Hei</p>",
      fromName: "The Role Room",
    });

    const options = nodemailerMocks.createTransport.mock.calls[0]?.[0];
    expect(options).not.toHaveProperty("connectionTimeout");
    expect(options).not.toHaveProperty("greetingTimeout");
    expect(options).not.toHaveProperty("socketTimeout");
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
