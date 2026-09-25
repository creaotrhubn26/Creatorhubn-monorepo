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
  return (s.RR_POST_AGENT_BASE_URL || "https://www.creatorhubn.com/api/post-agent").replace(/\/$/, "");
}

function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

/** Er AI koblet til (Role Room-token satt)? Brukes for å vise innloggings-CTA. */
export function isAiConnected(): boolean {
  return !!getBearer();
}

/**
 * Tekst-til-tale via backend-proxyen (ElevenLabs-nøkkelen ligger på serveren).
 * Returnerer base64 mp3 (uten dataURL-prefiks), eller null hvis ikke innlogget /
 * proxy utilgjengelig (caller faller da tilbake til on-device «Nora»).
 */
export async function ttsProxy(text: string, voiceId?: string): Promise<string | null> {
  const bearer = getBearer();
  if (!bearer || !text.trim()) return null;
  try {
    const res = await fetch(`${getBaseUrl()}/tts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...(voiceId ? { voiceId } : {}) }),
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length) return null;
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) bin += String.fromCharCode(...buf.subarray(i, i + chunk));
    return btoa(bin);
  } catch {
    return null;
  }
}

export interface BrandTacticFinding {
  tactic: string;
  evidence: string;
  targetElementLabel?: string;
  hotspot?: { x: number; y: number; w: number; h: number };
  exampleBrand: string;
  exampleDescription: string;
}

/** Merkevare/taktikk-analyse via backend-cachen (embedding-treff hopper over Claude-kall). */
export async function tacticAnalysisProxy(
  domain: string,
  pageText: string,
): Promise<{ findings: BrandTacticFinding[]; cached: boolean } | null> {
  const bearer = getBearer();
  if (!bearer) return null;
  try {
    const res = await fetch(`${getBaseUrl()}/marketing/tactic-analysis`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify({ domain, pageText }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { findings: BrandTacticFinding[]; cached: boolean };
  } catch {
    return null;
  }
}

export const claudeProxyService = {
  async send(opts: {
    systemPrompt: string;
    messages: ClaudeSendMessage[];
    /** Default: claude-sonnet-4-6 (rask + dyktig). */
    model?: string;
    maxTokens?: number;
    /** Maks ventetid per forsøk (default 90 s) — henger proxyen, feiler kallet
     *  med tydelig melding i stedet for å stå på «Genererer…» evig. */
    timeoutMs?: number;
    signal?: AbortSignal;
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
    timeoutMs?: number;
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
  timeoutMs?: number;
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

  const url = `${getBaseUrl()}/anthropic/messages`;
  const payload = JSON.stringify(body);
  const timeoutMs = opts.timeoutMs ?? 90_000;

  // Ett ekstra forsøk på transiente feil (nettverksglipp, 429/5xx fra proxyen).
  // Tidsavbrudd, bruker-abort og 4xx er ikke transiente og kastes direkte —
  // uten timeout her stod UI-et på «Genererer…» for alltid ved død proxy.
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const onAbort = () => ctrl.abort();
    opts.signal?.addEventListener("abort", onAbort, { once: true });

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        body: payload,
        signal: ctrl.signal,
      });
    } catch (e) {
      if (opts.signal?.aborted) throw e; // brukeren avbrøt selv
      if (ctrl.signal.aborted) {
        throw new Error(`claude-proxy svarte ikke innen ${Math.round(timeoutMs / 1000)} s — sjekk nettverket og prøv igjen`);
      }
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1200));
        continue; // nettverksglipp → ett nytt forsøk
      }
      throw e;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }

    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1200));
      continue;
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 402) {
        throw new Error("Abonnement kreves — sjekk Role Room billing");
      }
      throw new Error(`claude-proxy: HTTP ${res.status} ${detail}`.trim());
    }

    return (await res.json()) as ClaudeResponse;
  }
}

function extractText(json: ClaudeResponse): string {
  const text = json.content
    ?.filter((c): c is Extract<ClaudeContentBlock, { type: "text" }> => c.type === "text")
    .map((c) => c.text)
    .join("\n") ?? "";
  return text.trim();
}
