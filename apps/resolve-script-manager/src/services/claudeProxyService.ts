/**
 * claudeProxyService — kaller Post Agent's anthropic-proxy med bearer-
 * auth, slik at token-bruk telles per innlogget bruker.
 *
 * Endepunkt: POST /api/post-agent/anthropic/messages
 * Returnerer Anthropic-respons direkte (model, content, usage).
 */

import { loadSettings } from "../components/SettingsModal";

/** Innholds-blokk (tekst eller bilde) — for vision sendes content som array. */
export type ClaudeContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
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
  content: Array<{ type: "text"; text: string }>;
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
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");

    const res = await fetch(`${getBaseUrl()}/anthropic/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model ?? "claude-sonnet-4-6",
        max_tokens: opts.maxTokens ?? 1024,
        system: opts.systemPrompt,
        messages: opts.messages,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 402) {
        throw new Error("Abonnement kreves — sjekk Role Room billing");
      }
      throw new Error(`claude-proxy: HTTP ${res.status} ${detail}`.trim());
    }

    const json = (await res.json()) as ClaudeResponse;
    const text = json.content
      ?.filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n") ?? "";
    return text.trim();
  },
};
