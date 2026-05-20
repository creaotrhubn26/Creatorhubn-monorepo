/**
 * ai-usage-tracker — Slice 9X.71
 *
 * Sentralt logging-lag for alle Anthropic Claude-kall i CreatorHub.
 * Hver call-site kaller `logAIUsage(response, { feature, ... })` etter
 * `messages.create()`. Wrapperen beregner kostnad fra usage-data og
 * inserter en rad i ai_usage_log.
 *
 * Pricing-tabellen oppdateres når Anthropic justerer prisene — sjekk
 * https://www.anthropic.com/pricing for siste tall.
 *
 * Aggregering vises i admin AI-cost-dashboard (`/api/admin/ai-usage/overview`).
 */

import type { Pool } from "pg";

// ─── Pricing (USD per 1M tokens) — oppdatert 2026-02 ────────────────
// Hvis ny modell kommer som ikke er listet, brukes Sonnet-prisen som fallback.
interface PricingTier {
  input: number;        // USD per 1M input tokens
  output: number;       // USD per 1M output tokens
  cacheRead: number;    // 90% rabatt vs input
  cacheWrite: number;   // 25% premium vs input
}

const MODEL_PRICING: Record<string, PricingTier> = {
  // Claude 4.x family
  'claude-opus-4-7':       { input: 15.00, output: 75.00, cacheRead: 1.50,  cacheWrite: 18.75 },
  'claude-opus-4-6':       { input: 15.00, output: 75.00, cacheRead: 1.50,  cacheWrite: 18.75 },
  'claude-sonnet-4-6':     { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheWrite: 3.75  },
  'claude-sonnet-4-5':     { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheWrite: 3.75  },
  'claude-haiku-4-5':      { input: 1.00,  output: 5.00,  cacheRead: 0.10,  cacheWrite: 1.25  },
  // Eldre modeller — fortsatt aktive i prod
  'claude-3-5-sonnet':     { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheWrite: 3.75  },
  'claude-3-5-haiku':      { input: 1.00,  output: 5.00,  cacheRead: 0.10,  cacheWrite: 1.25  },
  'claude-3-opus':         { input: 15.00, output: 75.00, cacheRead: 1.50,  cacheWrite: 18.75 },
};

const FALLBACK_PRICING: PricingTier = { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 };

/**
 * Normaliserer model-string (fjerner suffix som "20250101" og "[1m]")
 * og finner pricing-tier. Eksempel:
 *   "claude-opus-4-7[1m]"           → claude-opus-4-7
 *   "claude-sonnet-4-5-20250514"    → claude-sonnet-4-5
 *   "claude-3-5-sonnet-20241022"    → claude-3-5-sonnet
 */
function getPricing(model: string): PricingTier {
  const normalized = model
    .replace(/\[[^\]]*\]/g, '')   // fjern "[1m]"
    .replace(/-\d{8}$/, '')        // fjern dato-suffix
    .replace(/-latest$/, '');

  // Direkte treff
  if (MODEL_PRICING[normalized]) return MODEL_PRICING[normalized];

  // Match start-of-string for å fange varianter
  for (const [key, tier] of Object.entries(MODEL_PRICING)) {
    if (normalized.startsWith(key)) return tier;
  }
  return FALLBACK_PRICING;
}

export interface AIUsageLogParams {
  /** Hva slags funksjonalitet utløste kallet — f.eks. "brief-summary", "casting-suggestion" */
  feature: string;
  /** Optional: HTTP-route hvis dette er kalt fra en route-handler */
  route?: string;
  /** Optional: hvilken bruker som utløste det */
  userId?: string | null;
  /** Optional: hvor lang tid kallet tok */
  durationMs?: number;
  /** Optional: ekstra kontekst */
  metadata?: Record<string, any>;
}

interface AnthropicUsageShape {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface AnthropicResponseShape {
  model?: string;
  usage?: AnthropicUsageShape;
}

let pool: Pool | null = null;
export function configureAIUsageTracker(databasePool: Pool) {
  pool = databasePool;
}

/**
 * Logg vellykket AI-kall. Trekker token-count + model fra response.
 * Fire-and-forget — kaster ikke feil oppover.
 */
export async function logAIUsage(
  response: AnthropicResponseShape | null | undefined,
  params: AIUsageLogParams,
): Promise<void> {
  if (!pool || !response) return;
  try {
    const model = response.model || 'unknown';
    const usage = response.usage || {};
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;

    const pricing = getPricing(model);
    const costUsd =
      (inputTokens * pricing.input) / 1_000_000
      + (outputTokens * pricing.output) / 1_000_000
      + (cacheRead * pricing.cacheRead) / 1_000_000
      + (cacheWrite * pricing.cacheWrite) / 1_000_000;

    await pool.query(
      `INSERT INTO ai_usage_log (
         model, feature, route, user_id,
         input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
         cost_usd, duration_ms, success, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11)`,
      [
        model.slice(0, 64),
        params.feature.slice(0, 64),
        params.route?.slice(0, 128) || null,
        params.userId || null,
        inputTokens,
        outputTokens,
        cacheRead,
        cacheWrite,
        costUsd,
        params.durationMs || null,
        params.metadata ? JSON.stringify(params.metadata) : '{}',
      ],
    );
  } catch (err: any) {
    // Tabellen finnes ikke ennå → ignorer stille (migration ikke kjørt)
    if (err?.code === '42P01') return;
    console.warn('[ai-usage] log failed:', err.message);
  }
}

/**
 * Logg feilet AI-kall — fortsatt verdifullt for debug og kostnadssyn
 * (input tokens belastes selv ved feil-respons).
 */
export async function logAIError(
  model: string,
  params: AIUsageLogParams & { errorCode?: string; inputTokensEstimate?: number },
): Promise<void> {
  if (!pool) return;
  try {
    const pricing = getPricing(model);
    const inputTokens = params.inputTokensEstimate || 0;
    const costUsd = (inputTokens * pricing.input) / 1_000_000;

    await pool.query(
      `INSERT INTO ai_usage_log (
         model, feature, route, user_id, input_tokens, output_tokens,
         cost_usd, duration_ms, success, error_code, metadata
       ) VALUES ($1,$2,$3,$4,$5,0,$6,$7,FALSE,$8,$9)`,
      [
        model.slice(0, 64),
        params.feature.slice(0, 64),
        params.route?.slice(0, 128) || null,
        params.userId || null,
        inputTokens,
        costUsd,
        params.durationMs || null,
        params.errorCode?.slice(0, 64) || null,
        params.metadata ? JSON.stringify(params.metadata) : '{}',
      ],
    );
  } catch (err: any) {
    if (err?.code === '42P01') return;
    console.warn('[ai-usage] error-log failed:', err.message);
  }
}

/**
 * Convenience: wrap en async Anthropic-callback med automatisk logging.
 * Eksempel:
 *   const res = await trackAIUsage(
 *     { feature: 'brief-summary', userId, route: '/api/brief' },
 *     () => client.messages.create({ model, messages, max_tokens: 1024 }),
 *   );
 */
export async function trackAIUsage<T extends AnthropicResponseShape>(
  params: AIUsageLogParams,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const res = await fn();
    await logAIUsage(res, { ...params, durationMs: Date.now() - startedAt });
    return res;
  } catch (err: any) {
    await logAIError('unknown', {
      ...params,
      errorCode: err?.code || err?.name || 'error',
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}
