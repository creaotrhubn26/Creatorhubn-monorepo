/**
 * Role Room Agent — Anthropic Claude client.
 *
 * Sits alongside role-room-agent.ts (Cohere rerank). Claude is used for
 * GENERATION tasks (brief summarisation, scope analysis, review digest),
 * while Cohere stays in place for reranking. The two capabilities are
 * complementary, not replacements.
 *
 * Usage is feature-flagged:
 *   ROLE_ROOM_AGENT_CLAUDE_ENABLED=true   enables this module
 *   ROLE_ROOM_AGENT_CLAUDE_MODEL=claude-sonnet-4-6   (default)
 *   ANTHROPIC_API_KEY=...
 *
 * GDPR contract: callers MUST
 *   1. pass through requireActiveConsent() first
 *   2. pseudonymize PII before handing strings to runClaudeAgent()
 *   3. call logAiCall() with the returned usage stats
 *
 * This module does NOT enforce those contracts itself — it's deliberately
 * low-level so tests can cover it without GDPR infrastructure. The
 * enforcing wrapper lives in role-room-routes.ts endpoint handlers.
 */

// NOTE: @anthropic-ai/sdk must be added to backend/package.json before first use.
// The import is written using a loose import pattern so the rest of the
// backend still compiles if the package is not yet installed during local dev.
// Once npm install runs, replace the dynamic import with a static one.

// Slice 9X.71 — cost-tracking via samme system som CreatorHub-resten.
// Lazy import for å unngå circular import-problemer ved boot.
import { logAIUsage } from './ai-usage-tracker.js';

type ClaudeMessageParam = {
  role: 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
};

export interface RunClaudeAgentInput {
  /** Cached prefix for prompt caching (project context, briefs, reviews). */
  cachedSystem: string;
  /**
   * Optional FRESH (uncached) system block appended after the cached prefix.
   * Used for volatile content — e.g. the aggregate workspace-status block —
   * that should always be current and must NOT bust the cached-prefix cache.
   */
  freshSystem?: string;
  /** Uncached user-specific message (should be small). */
  userMessage: string;
  /**
   * Optional tool definitions. When tools are passed, the caller is
   * responsible for loop-running until no tool_use appears in the response.
   * See docs/role-room/ai-gdpr-dpia.md § 6 — every tool call returns to a
   * frontend confirmation before the backend actually mutates anything.
   */
  tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
  /** Max response tokens. Keep tight to stay within budget. */
  maxTokens?: number;
  /** Override the model (default from env). */
  model?: string;
  /**
   * Slice 9X.71 — Cost-tracking. Identifiserer hvilken Role Room-feature
   * som utløste kallet (f.eks. 'role-room/breakdown', 'role-room/casting-suggest').
   * Vises i admin AI-cost-dashboard. Default: 'role-room-agent-unspecified'.
   */
  feature?: string;
  /** User-ID for per-bruker-rapportering */
  userId?: string | null;
  /** HTTP-route hvis kallet kommer fra en route-handler */
  route?: string;
}

export interface RunClaudeAgentResult {
  text: string;
  toolUses: Array<{ name: string; input: Record<string, unknown>; id: string }>;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
  model: string;
  latencyMs: number;
}

let cachedClient: unknown = null;

function isEnabled(): boolean {
  return process.env.ROLE_ROOM_AGENT_CLAUDE_ENABLED === 'true';
}

function defaultModel(): string {
  return process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-6';
}

async function getClaudeClient(): Promise<any> {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set — cannot initialise Claude client');
  }
  // Dynamic import keeps TypeScript happy if the SDK is not yet in node_modules.
  // Once the SDK is installed for real, replace with:
  //   import Anthropic from '@anthropic-ai/sdk';
  //   cachedClient = new Anthropic({ apiKey });
  // The ts-ignore here lets this file compile even before the first `npm install`.
  // @ts-ignore — optional SDK, resolved at runtime
  const mod: any = await import('@anthropic-ai/sdk').catch(() => null);
  if (!mod) {
    throw new Error(
      '@anthropic-ai/sdk is not installed. Run `npm install @anthropic-ai/sdk` in backend/.',
    );
  }
  const AnthropicCtor = mod.default ?? mod.Anthropic;
  cachedClient = new AnthropicCtor({ apiKey });
  return cachedClient;
}

export function claudeAgentEnabled(): boolean {
  return isEnabled();
}

export async function runClaudeAgent(input: RunClaudeAgentInput): Promise<RunClaudeAgentResult> {
  if (!isEnabled()) {
    throw new Error('Claude agent is disabled (ROLE_ROOM_AGENT_CLAUDE_ENABLED != "true")');
  }

  const client = await getClaudeClient();
  const model = input.model ?? defaultModel();
  const maxTokens = input.maxTokens ?? 1024;

  const messages: ClaudeMessageParam[] = [
    { role: 'user', content: input.userMessage },
  ];

  // The cached prefix is placed in a `system` block with cache_control. This
  // gives roughly 90% cost reduction for follow-up calls within the 5-minute
  // ephemeral cache TTL.
  type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };
  const system: SystemBlock[] = [
    {
      type: 'text',
      text: input.cachedSystem,
      cache_control: { type: 'ephemeral' },
    },
  ];
  // Volatile content goes in its own uncached block so it stays fresh without
  // invalidating the cached prefix above.
  if (typeof input.freshSystem === 'string' && input.freshSystem.trim().length > 0) {
    system.push({ type: 'text', text: input.freshSystem });
  }

  const start = Date.now();
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages,
    tools: input.tools,
  });
  const latencyMs = Date.now() - start;

  // Slice 9X.71 — cost-tracking (fire-and-forget)
  logAIUsage(response as any, {
    feature: input.feature || 'role-room-agent-unspecified',
    route: input.route,
    userId: input.userId || null,
    durationMs: latencyMs,
    metadata: { hasTools: !!input.tools?.length },
  }).catch(() => undefined);

  // Concatenate text blocks; collect any tool_use blocks so the caller can
  // show a confirmation dialog before actually invoking the tool.
  const toolUses: RunClaudeAgentResult['toolUses'] = [];
  let text = '';
  for (const block of response.content ?? []) {
    if (block.type === 'text' && typeof block.text === 'string') {
      text += block.text;
    } else if (block.type === 'tool_use') {
      toolUses.push({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      });
    }
  }

  return {
    text,
    toolUses,
    model,
    latencyMs,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      cacheCreationInputTokens: response.usage?.cache_creation_input_tokens,
      cacheReadInputTokens: response.usage?.cache_read_input_tokens,
    },
  };
}
