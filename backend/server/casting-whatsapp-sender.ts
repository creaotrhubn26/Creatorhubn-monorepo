// WhatsApp Cloud API sender for audition-reminders + team-invitasjoner.
//
// Multi-tenant: tar config (access_token + phone_number_id + display_name)
// som argument fra caller. Runner-en henter config fra
// role_room_org_whatsapp_config-tabellen basert på prosjekt → bedrift.
// Falls back til env-vars (META_APP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID)
// for The Role Room sin egen demo-konto.

import { parsePhoneNumberFromString } from "libphonenumber-js";

const META_GRAPH_VERSION = "v22.0";

export type WhatsAppThreshold = "24h" | "1h";

export interface WhatsAppSenderConfig {
  accessToken: string;
  phoneNumberId: string;
  displayName: string;
  templateLanguage: string;
  template24hName: string;
  template1hName: string;
}

export function readEnvFallbackConfig(): WhatsAppSenderConfig | null {
  const accessToken =
    (process.env.META_WHATSAPP_ACCESS_TOKEN || "").trim() ||
    (process.env.META_APP_ACCESS_TOKEN || "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!accessToken || !phoneNumberId) return null;
  return {
    accessToken,
    phoneNumberId,
    displayName: "The Role Room",
    templateLanguage:
      (process.env.META_WHATSAPP_TEMPLATE_LANGUAGE || "nb_NO").trim(),
    template24hName:
      (process.env.META_WHATSAPP_TEMPLATE_24H_NAME || "").trim() ||
      "audition_reminder_24h_no",
    template1hName:
      (process.env.META_WHATSAPP_TEMPLATE_1H_NAME || "").trim() ||
      "audition_reminder_1h_no",
  };
}

export function normalizePhoneE164(
  raw: string | null | undefined,
  defaultCountry: "NO" | "SE" | "DK" | "FI" | "GB" | "US" = "NO",
): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.format("E.164");
  } catch {
    return null;
  }
}

export interface WhatsAppContext {
  candidateName: string;
  projectName: string;
  date: string;
  startTime: string;
  location?: string | null;
  threshold: WhatsAppThreshold;
}

export interface WhatsAppSendResult {
  success: boolean;
  provider: "meta-cloud" | null;
  messageId?: string;
  conversationId?: string | null;
  templateName?: string;
  displayName?: string;
  error?: string;
  errorCode?: number;
}

function formatNorwegianDate(iso: string): string {
  const months = [
    "januar","februar","mars","april","mai","juni",
    "juli","august","september","oktober","november","desember",
  ];
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])}. ${months[Number(m[2]) - 1] ?? m[2]}`;
}

export function buildTemplateBodyParameters(
  ctx: WhatsAppContext,
): Array<{ type: "text"; text: string }> {
  const params = [
    ctx.candidateName,
    ctx.projectName,
    formatNorwegianDate(ctx.date),
    ctx.startTime,
  ];
  if (ctx.location) params.push(ctx.location);
  return params.map((text) => ({ type: "text" as const, text }));
}

interface SendTemplateInput {
  config: WhatsAppSenderConfig;
  to: string;
  context: WhatsAppContext;
  fetchImpl?: typeof fetch;
}

export async function sendWhatsAppAuditionReminder(
  input: SendTemplateInput,
): Promise<WhatsAppSendResult> {
  const e164 = normalizePhoneE164(input.to);
  if (!e164) {
    return {
      success: false,
      provider: "meta-cloud",
      error: "invalid_phone",
      displayName: input.config.displayName,
    };
  }

  const templateName =
    input.context.threshold === "24h"
      ? input.config.template24hName
      : input.config.template1hName;
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${input.config.phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: e164.replace(/^\+/, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: input.config.templateLanguage },
      components: [
        {
          type: "body",
          parameters: buildTemplateBodyParameters(input.context),
        },
      ],
    },
  };

  return await postToMeta({
    config: input.config,
    url,
    body,
    fetchImpl: input.fetchImpl,
    templateName,
  });
}

interface SendTeamInviteInput {
  config: WhatsAppSenderConfig;
  to: string;
  recipientName: string;
  projectName: string;
  inviteLink: string;
  templateName: string;
  fetchImpl?: typeof fetch;
}

export async function sendWhatsAppTeamInvite(
  input: SendTeamInviteInput,
): Promise<WhatsAppSendResult> {
  const e164 = normalizePhoneE164(input.to);
  if (!e164) {
    return {
      success: false,
      provider: "meta-cloud",
      error: "invalid_phone",
      displayName: input.config.displayName,
    };
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${input.config.phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: e164.replace(/^\+/, ""),
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.config.templateLanguage },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: input.recipientName },
            { type: "text", text: input.projectName },
          ],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            {
              type: "text",
              text: input.inviteLink.replace("https://chat.whatsapp.com/", ""),
            },
          ],
        },
      ],
    },
  };

  return await postToMeta({
    config: input.config,
    url,
    body,
    fetchImpl: input.fetchImpl,
    templateName: input.templateName,
  });
}

interface PostMetaInput {
  config: WhatsAppSenderConfig;
  url: string;
  body: unknown;
  templateName: string;
  fetchImpl?: typeof fetch;
}

async function postToMeta(input: PostMetaInput): Promise<WhatsAppSendResult> {
  const fetchFn = input.fetchImpl ?? fetch;

  try {
    const response = await fetchFn(input.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.body),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      let parsed: { error?: { code?: unknown; message?: unknown } } = {};
      try {
        parsed = JSON.parse(errBody) as typeof parsed;
      } catch {}
      const errorCode =
        typeof parsed.error?.code === "number" ? parsed.error.code : undefined;
      const errorMessage =
        (typeof parsed.error?.message === "string" && parsed.error.message) ||
        `whatsapp_${response.status}`;
      return {
        success: false,
        provider: "meta-cloud",
        templateName: input.templateName,
        displayName: input.config.displayName,
        errorCode,
        error: `${errorMessage}${errBody ? ` (${errBody.slice(0, 200)})` : ""}`,
      };
    }

    const json = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: unknown; conversation?: { id?: unknown } }>;
    };
    const firstMessage = json.messages?.[0];
    const messageId =
      firstMessage && typeof firstMessage.id === "string"
        ? firstMessage.id
        : undefined;
    const conversationId =
      firstMessage?.conversation &&
      typeof firstMessage.conversation.id === "string"
        ? firstMessage.conversation.id
        : null;

    return {
      success: true,
      provider: "meta-cloud",
      messageId,
      conversationId,
      templateName: input.templateName,
      displayName: input.config.displayName,
    };
  } catch (error) {
    return {
      success: false,
      provider: "meta-cloud",
      templateName: input.templateName,
      displayName: input.config.displayName,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
