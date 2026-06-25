/**
 * leadgrid-ai-usage-tracker.ts
 *
 * Skriver per-org AI-bruk til leadgrid_ai_usage + leadgrid_ai_usage_daily
 * (mig 321). Estimater USD-kost basert på provider/model.
 *
 * Bruk:
 *   await recordAIUsage(pool, {
 *     organizationId,
 *     provider: "claude",
 *     model: "claude-opus-4-7",
 *     operation: "meeting_notes_analyze",
 *     inputTokens: 1200,
 *     outputTokens: 450,
 *     leadId,
 *     userId,
 *   });
 *
 * Feil under skriving rapporteres som warning og kaster ikke — vi
 * vil aldri at usage-tracking skal blokkere AI-kall i hot-path.
 */

import type { Pool } from "pg";

const CLAUDE_OPUS_INPUT_PRICE_PER_1M = 15.0;  // USD
const CLAUDE_OPUS_OUTPUT_PRICE_PER_1M = 75.0;
const CLAUDE_SONNET_INPUT_PRICE_PER_1M = 3.0;
const CLAUDE_SONNET_OUTPUT_PRICE_PER_1M = 15.0;
const WHISPER_PRICE_PER_MINUTE = 0.006;

export interface UsageRecord {
  organizationId: string;
  provider: "claude" | "openai_whisper" | "openai_chat";
  model?: string;
  operation: string;
  inputTokens?: number;
  outputTokens?: number;
  audioSeconds?: number;
  leadId?: string;
  userId?: string;
  succeeded?: boolean;
  errorMessage?: string;
}

export function estimateCost(rec: UsageRecord): number {
  const inp = rec.inputTokens ?? 0;
  const out = rec.outputTokens ?? 0;
  const audio = rec.audioSeconds ?? 0;
  if (rec.provider === "claude") {
    if (rec.model?.includes("opus")) {
      return (inp * CLAUDE_OPUS_INPUT_PRICE_PER_1M / 1_000_000)
           + (out * CLAUDE_OPUS_OUTPUT_PRICE_PER_1M / 1_000_000);
    }
    return (inp * CLAUDE_SONNET_INPUT_PRICE_PER_1M / 1_000_000)
         + (out * CLAUDE_SONNET_OUTPUT_PRICE_PER_1M / 1_000_000);
  }
  if (rec.provider === "openai_whisper") {
    return (audio / 60) * WHISPER_PRICE_PER_MINUTE;
  }
  return 0;
}

export async function recordAIUsage(pool: Pool, rec: UsageRecord): Promise<void> {
  const cost = estimateCost(rec);
  try {
    await pool.query(
      `INSERT INTO leadgrid_ai_usage
         (organization_id, provider, model, operation,
          input_tokens, output_tokens, audio_seconds,
          estimated_cost_usd, lead_id, user_id, succeeded, error_message)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid, $10, $11, $12)`,
      [
        rec.organizationId, rec.provider, rec.model ?? null, rec.operation,
        rec.inputTokens ?? 0, rec.outputTokens ?? 0, rec.audioSeconds ?? null,
        cost, rec.leadId ?? null, rec.userId ?? null,
        rec.succeeded ?? true, rec.errorMessage ?? null,
      ],
    );
    // Oppdater daglig aggregat (UPSERT)
    await pool.query(
      `INSERT INTO leadgrid_ai_usage_daily
         (organization_id, usage_date, provider,
          total_calls, total_input_tokens, total_output_tokens,
          total_audio_seconds, total_cost_usd)
       VALUES ($1::uuid, CURRENT_DATE, $2, 1, $3, $4, $5, $6)
       ON CONFLICT (organization_id, usage_date, provider)
       DO UPDATE SET
         total_calls = leadgrid_ai_usage_daily.total_calls + 1,
         total_input_tokens = leadgrid_ai_usage_daily.total_input_tokens + EXCLUDED.total_input_tokens,
         total_output_tokens = leadgrid_ai_usage_daily.total_output_tokens + EXCLUDED.total_output_tokens,
         total_audio_seconds = leadgrid_ai_usage_daily.total_audio_seconds + EXCLUDED.total_audio_seconds,
         total_cost_usd = leadgrid_ai_usage_daily.total_cost_usd + EXCLUDED.total_cost_usd`,
      [
        rec.organizationId, rec.provider,
        rec.inputTokens ?? 0, rec.outputTokens ?? 0,
        rec.audioSeconds ?? 0, cost,
      ],
    );
  } catch (err) {
    console.warn("[ai-usage] insert feilet:", err);
  }
}
