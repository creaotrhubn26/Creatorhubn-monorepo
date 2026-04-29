import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTemplateBodyParameters,
  normalizePhoneE164,
  readEnvFallbackConfig,
  sendWhatsAppAuditionReminder,
  sendWhatsAppTeamInvite,
  type WhatsAppSenderConfig,
} from "./casting-whatsapp-sender.js";

const TEST_CONFIG: WhatsAppSenderConfig = {
  accessToken: "test-token",
  phoneNumberId: "123456789",
  displayName: "TestBrand",
  templateLanguage: "nb_NO",
  template24hName: "audition_reminder_24h_no",
  template1hName: "audition_reminder_1h_no",
};

describe("normalizePhoneE164", () => {
  it("converts NO national to E.164", () => {
    expect(normalizePhoneE164("99887766")).toBe("+4799887766");
  });

  it("returns null for invalid input", () => {
    expect(normalizePhoneE164("notaphone")).toBeNull();
    expect(normalizePhoneE164(null)).toBeNull();
  });
});

describe("buildTemplateBodyParameters", () => {
  it("includes name, project, date, time + location when provided", () => {
    const params = buildTemplateBodyParameters({
      candidateName: "Lise",
      projectName: "Holy Crust",
      date: "2026-04-30",
      startTime: "15:00",
      location: "Studio 7",
      threshold: "24h",
    });
    expect(params).toHaveLength(5);
    expect(params[0]).toEqual({ type: "text", text: "Lise" });
    expect(params[1]).toEqual({ type: "text", text: "Holy Crust" });
    expect(params[2]).toEqual({ type: "text", text: "30. april" });
    expect(params[3]).toEqual({ type: "text", text: "15:00" });
    expect(params[4]).toEqual({ type: "text", text: "Studio 7" });
  });

  it("omits location when not provided", () => {
    const params = buildTemplateBodyParameters({
      candidateName: "Lise",
      projectName: "Audition",
      date: "2026-04-29",
      startTime: "15:00",
      threshold: "1h",
    });
    expect(params).toHaveLength(4);
  });
});

describe("readEnvFallbackConfig", () => {
  beforeEach(() => {
    delete process.env.META_WHATSAPP_ACCESS_TOKEN;
    delete process.env.META_APP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  afterEach(() => {
    delete process.env.META_WHATSAPP_ACCESS_TOKEN;
    delete process.env.META_APP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  it("returns null when env vars missing", () => {
    expect(readEnvFallbackConfig()).toBeNull();
  });

  it("returns config when both env vars set", () => {
    process.env.META_APP_ACCESS_TOKEN = "tok";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    const config = readEnvFallbackConfig();
    expect(config?.accessToken).toBe("tok");
    expect(config?.phoneNumberId).toBe("123");
    expect(config?.displayName).toBe("The Role Room");
  });
});

describe("sendWhatsAppAuditionReminder", () => {
  it("posts template message to Meta Graph API", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      expect(body.messaging_product).toBe("whatsapp");
      expect(body.type).toBe("template");
      expect(String(url)).toContain("123456789/messages");
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          messages: [{ id: "wamid.test123", conversation: { id: "conv-123" } }],
        }),
      } as Response;
    });

    const result = await sendWhatsAppAuditionReminder({
      config: TEST_CONFIG,
      to: "+4799887766",
      context: {
        candidateName: "Lise",
        projectName: "Audition",
        date: "2026-04-30",
        startTime: "15:00",
        threshold: "24h",
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("wamid.test123");
    expect(result.conversationId).toBe("conv-123");
    expect(result.templateName).toBe("audition_reminder_24h_no");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses 1h template when threshold is 1h", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { template: { name: string } };
      expect(body.template.name).toBe("audition_reminder_1h_no");
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({ messages: [{ id: "x" }] }),
      } as Response;
    });

    await sendWhatsAppAuditionReminder({
      config: TEST_CONFIG,
      to: "+4799887766",
      context: {
        candidateName: "Lise",
        projectName: "Audition",
        date: "2026-04-29",
        startTime: "15:00",
        threshold: "1h",
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
  });

  it("returns invalid_phone for unparseable input", async () => {
    const fetchMock = vi.fn();
    const result = await sendWhatsAppAuditionReminder({
      config: TEST_CONFIG,
      to: "notaphone",
      context: {
        candidateName: "Lise",
        projectName: "Audition",
        date: "2026-04-30",
        startTime: "15:00",
        threshold: "24h",
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("invalid_phone");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces 4xx error with code from Meta", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () =>
        '{"error":{"code":131026,"message":"Recipient not on WhatsApp"}}',
      json: async () => ({}),
    }) as unknown as Response);
    const result = await sendWhatsAppAuditionReminder({
      config: TEST_CONFIG,
      to: "+4799887766",
      context: {
        candidateName: "Lise",
        projectName: "Audition",
        date: "2026-04-30",
        startTime: "15:00",
        threshold: "24h",
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(131026);
    expect(result.error).toContain("Recipient not on WhatsApp");
  });
});

describe("sendWhatsAppTeamInvite", () => {
  it("includes button URL parameter with invite-link suffix", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        template: {
          components: Array<{
            type: string;
            sub_type?: string;
            parameters: Array<{ type: string; text: string }>;
          }>;
        };
      };
      const buttonComponent = body.template.components.find(
        (c) => c.type === "button",
      );
      expect(buttonComponent?.sub_type).toBe("url");
      expect(buttonComponent?.parameters[0]?.text).toBe("AbCdEf123");
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({ messages: [{ id: "wamid.x" }] }),
      } as Response;
    });

    const result = await sendWhatsAppTeamInvite({
      config: TEST_CONFIG,
      to: "+4799887766",
      recipientName: "Per",
      projectName: "Holy Crust",
      inviteLink: "https://chat.whatsapp.com/AbCdEf123",
      templateName: "production_team_invite_no",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
