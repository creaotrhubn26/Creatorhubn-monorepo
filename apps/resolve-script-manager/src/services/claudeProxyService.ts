/**
 * claudeProxyService — kaller Post Agent's anthropic-proxy med bearer-
 * auth, slik at token-bruk telles per innlogget bruker.
 *
 * Endepunkt: POST /api/post-agent/anthropic/messages
 * Returnerer Anthropic-respons direkte (model, content, usage).
 */

import { loadSettings } from "../components/SettingsModal";

/**
 * Content-blokker som Claude API støtter i messages og tool_result.
 * Vision-modeller leser image-blokkene direkte — text-blokker er det
 * vanlige tekst-laget. Tool-use og tool-result brukes av tool-loop.
 */
export type ClaudeContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: "image/png" | "image/jpeg"; data: string };
    }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | {
      type: "tool_result";
      tool_use_id: string;
      content:
        | string
        | Array<
            | { type: "text"; text: string }
            | {
                type: "image";
                source: { type: "base64"; media_type: "image/png" | "image/jpeg"; data: string };
              }
          >;
      is_error?: boolean;
    };

export interface ClaudeMessage {
  role: "user" | "assistant";
  /** String-only for tekst, eller array av blokker for vision/tools. */
  content: string | ClaudeContentBlock[];
}

/** Send-melding som også kan bære bilde-blokker (vision). ClaudeMessage er
 *  assignbar hit, så eksisterende tekst-kallere er uberørt. Proxyen
 *  videresender content rått til Anthropic. */
export interface ClaudeSendMessage {
  role: "user" | "assistant";
  content: string | ClaudeContentBlock[];
}

export interface ClaudeResponse {
  id: string;
  model: string;
  content: ClaudeContentBlock[];
  stop_reason?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

function getBaseUrl(): string {
  const s = loadSettings();
  return (s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent").replace(/\/$/, "");
}

function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

/** Er AI koblet til (Role Room-token satt)? Brukes for å vise innloggings-CTA. */
export function isAiConnected(): boolean {
  return !!getBearer();
}

export const claudeProxyService = {
  async send(opts: {
    systemPrompt: string;
    messages: ClaudeSendMessage[];
    /** Default: claude-sonnet-4-6 (rask + dyktig). */
    model?: string;
    maxTokens?: number;
  }): Promise<string> {
    const json = await sendRaw(opts);
    return extractText(json);
  },

  /**
   * Full Claude-respons inkludert tool_use-blokker og stop_reason.
   * Brukes av tool-use-loops (AI Creative Director) som trenger å se
   * tool_use-blokker direkte for å dispatche dem mot Photoshop.
   */
  async sendRaw(opts: {
    systemPrompt: string;
    messages: ClaudeMessage[];
    tools?: Array<{ name: string; description: string; input_schema: unknown }>;
    model?: string;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<ClaudeResponse> {
    return sendRaw(opts);
  },
};

async function sendRaw(opts: {
  systemPrompt: string;
  messages: ClaudeMessage[];
  tools?: Array<{ name: string; description: string; input_schema: unknown }>;
  model?: string;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<ClaudeResponse> {
  const bearer = getBearer();
  if (!bearer) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");

  const body: Record<string, unknown> = {
    model: opts.model ?? "claude-sonnet-4-6",
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.systemPrompt,
    messages: opts.messages,
  };
  if (opts.tools && opts.tools.length > 0) body.tools = opts.tools;

  const res = await fetch(`${getBaseUrl()}/anthropic/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 402) {
      throw new Error("Abonnement kreves — sjekk Role Room billing");
    }
    throw new Error(`claude-proxy: HTTP ${res.status} ${detail}`.trim());
  }

  return (await res.json()) as ClaudeResponse;
}

function extractText(json: ClaudeResponse): string {
  const text = json.content
    ?.filter((c): c is Extract<ClaudeContentBlock, { type: "text" }> => c.type === "text")
    .map((c) => c.text)
    .join("\n") ?? "";
  return text.trim();
}
