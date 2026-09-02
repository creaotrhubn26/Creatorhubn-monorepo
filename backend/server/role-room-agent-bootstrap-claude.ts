/**
 * Claude-backed synthesis layer for the producer bootstrap agent.
 *
 * Mirrors `requestOpenAiBootstrap` in role-room-agent.ts — same inputs,
 * same JSON output shape. The deterministic data-fetchers (Brreg, Google
 * Places, website scraping) stay in the OpenAI file; this module only
 * handles the final LLM reasoning + synthesis step.
 *
 * Chosen because:
 *   - Better Norwegian quality than GPT-4 class models at this price point.
 *   - Prompt caching on the large constraints block halves cost on retries.
 *   - Cleaner JSON output; fewer markdown fences to strip.
 *
 * Safety: returns `null` on any failure so the caller falls back to the
 * existing fallback payload path. Never throws.
 */

import { logAIUsage } from './ai-usage-tracker.js';
import {
  BOOTSTRAP_CONSTRAINTS,
  BOOTSTRAP_OUTPUT_SCHEMA_HINTS,
  BOOTSTRAP_SYSTEM_PROMPT,
} from './role-room-agent-bootstrap-constraints.js';
import {
  BOOTSTRAP_SYNTH_MAX_TOKENS,
  BOOTSTRAP_SYNTH_TIMEOUT_MS,
  extractJsonFromText,
  makeStructuredLogger,
  withTimeout,
} from './role-room-agent-llm-util.js';
import type {
  RoleRoomAgentAgreementSuggestion,
  RoleRoomAgentBrregCompany,
  RoleRoomAgentBusinessSignals,
  RoleRoomAgentCompanyAge,
  RoleRoomAgentCompetitorAnalysis,
  RoleRoomAgentLocalPresencePlan,
  RoleRoomAgentProducerBootstrapInput,
  RoleRoomAgentRetrievalMeta,
  RoleRoomAgentWebsiteInsights,
} from './role-room-agent.js';

let cachedAnthropicClient: unknown = null;

async function getAnthropicClient(): Promise<any> {
  if (cachedAnthropicClient) return cachedAnthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  // @ts-ignore — optional SDK, resolved at runtime
  const mod: any = await import('@anthropic-ai/sdk').catch(() => null);
  if (!mod) return null;
  const AnthropicCtor = mod.default ?? mod.Anthropic;
  cachedAnthropicClient = new AnthropicCtor({ apiKey });
  return cachedAnthropicClient;
}

/**
 * Single-line structured diagnostics, matching the orchestrator/synthesis
 * loggers. Until now this path swallowed every failure (no client, API
 * error, truncation, parse failure) and silently returned null. Grep
 * `role-room-agent:claude-bootstrap`.
 */
const logClaudeBootstrap = makeStructuredLogger('[role-room-agent:claude-bootstrap]');

// When a website provides a hero image via og:image / twitter:image we can
// feed it to Claude vision alongside the structured text signals. This
// gives noticeably better brand/tone classification because the model
// literally sees the visual identity instead of inferring from prose.
async function fetchImageAsBase64(
  url: string,
): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'RoleRoomAgent/1.0 (visual-analysis)' },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    // Claude vision accepts jpeg, png, gif, webp. Anything else → skip.
    const mediaType = contentType.split(';')[0].trim().toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    // Cap at ~5 MB so we don't blow the API request budget.
    if (buffer.byteLength > 5 * 1024 * 1024) return null;
    return { base64: buffer.toString('base64'), mediaType };
  } catch {
    return null;
  }
}

export async function requestClaudeBootstrap(
  input: RoleRoomAgentProducerBootstrapInput,
  websiteInsights: RoleRoomAgentWebsiteInsights,
  businessSignals: RoleRoomAgentBusinessSignals | null,
  brregCompany: RoleRoomAgentBrregCompany | null,
  companyAge: RoleRoomAgentCompanyAge | null,
  agreementSuggestions: RoleRoomAgentAgreementSuggestion[],
  competitorAnalysis: RoleRoomAgentCompetitorAnalysis,
  localPresencePlan: RoleRoomAgentLocalPresencePlan,
  retrievalMeta: RoleRoomAgentRetrievalMeta | null,
  marketingSetup: unknown = null,
): Promise<unknown | null> {
  const client = await getAnthropicClient();
  if (!client) {
    logClaudeBootstrap('anthropic_client_unavailable', {
      hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    });
    return null;
  }

  const model = process.env.ROLE_ROOM_BOOTSTRAP_CLAUDE_MODEL || 'claude-sonnet-4-5';
  const visionEnabled = process.env.ROLE_ROOM_BOOTSTRAP_VISION !== 'false';
  const heroImageUrl = websiteInsights.probableHeroImageUrl;
  const heroImage = visionEnabled && heroImageUrl ? await fetchImageAsBase64(heroImageUrl) : null;
  const userPayload = {
    task: 'Lag første utkast for kundeprofil, story logikk og brief for et innholdsproduksjonsprosjekt.',
    requirements: {
      language: 'nb-NO',
      audience: 'content_producer',
      constraints: BOOTSTRAP_CONSTRAINTS,
    },
    outputSchemaHints: BOOTSTRAP_OUTPUT_SCHEMA_HINTS,
    input,
    websiteInsights,
    businessSignals,
    brregCompany,
    companyAge,
    agreementSuggestions,
    socialProfileCandidates: websiteInsights.socialProfileCandidates ?? [],
    competitorAnalysis,
    localPresencePlan,
    marketingSetup,
    retrievalMeta,
  };

  try {
    // Build the user message. When we have a hero image, mix it into the
    // content array before the JSON payload so Claude sees the visual first.
    // Claude vision requires image blocks to come before related text in
    // multi-part messages for best attention weight.
    const userContent: any[] = [];
    if (heroImage) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: heroImage.mediaType,
          data: heroImage.base64,
        },
      });
      userContent.push({
        type: 'text',
        text:
          'Bildet over er kundens hovedvisuelle uttrykk (hentet fra og:image/twitter:image). Bruk det som utgangspunkt når du bedømmer tone, estetikk og brand-signaler i companyProfile.toneAndBrandSignals og storyLogicDraft.',
      });
    }
    userContent.push({
      type: 'text',
      text: JSON.stringify(userPayload),
    });

    const bootstrapStartedAt = Date.now();
    const response = await withTimeout(
      client.messages.create({
        model,
        // 4096 truncated the large synthesis JSON, failing extractJsonFromText
        // → null → silent deterministic fallback. 8192 lets it complete.
        max_tokens: BOOTSTRAP_SYNTH_MAX_TOKENS,
        // Keep the large constraints block in the cached system prefix; the
        // per-call user message is just the project data.
        system: [
          {
            type: 'text',
            text: BOOTSTRAP_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
      BOOTSTRAP_SYNTH_TIMEOUT_MS,
      'claude_bootstrap_timeout',
    );

    // Slice 9X.71 — cost-tracking (fire-and-forget)
    logAIUsage(response as any, {
      feature: 'role-room-bootstrap',
      durationMs: Date.now() - bootstrapStartedAt,
    }).catch(() => undefined);

    if ((response as any)?.stop_reason === 'max_tokens') {
      logClaudeBootstrap('response_truncated_max_tokens', { model });
    }

    const blocks = (response as any)?.content ?? [];
    let text = '';
    for (const block of blocks) {
      if (block.type === 'text' && typeof block.text === 'string') {
        text += block.text;
      }
    }
    const parsed = extractJsonFromText(text);
    if (!parsed) {
      logClaudeBootstrap('synthesis_parse_failed', {
        model,
        textLength: text.length,
        stopReason: (response as any)?.stop_reason ?? null,
      });
    }
    return parsed;
  } catch (err) {
    logClaudeBootstrap('request_threw', {
      model,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function claudeBootstrapEnabled(): boolean {
  return (
    process.env.ROLE_ROOM_BOOTSTRAP_MODEL === 'claude' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}
