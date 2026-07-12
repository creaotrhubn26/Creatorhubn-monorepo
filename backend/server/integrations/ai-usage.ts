/**
 * ai-usage.ts — per-org AI-forbrukstellere (integrasjonsanalysen steg 9)
 *
 * Motivert av kreditt-hendelsen: når AI-forbruket er usynlig, oppdages
 * tomme kontoer først når prod-AI dør. Tellerne bokfører calls og tokens
 * per (org, dag, leverandør, operasjon) med UPSERT-inkrement.
 *
 * Kontrakt: recordAiUsage KASTER ALDRI — bokføring skal aldri velte
 * arbeidet den bokfører. Feil logges og telles som tapt observasjon.
 */

import type { Pool } from "pg";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiUsageEvent extends TokenUsage {
  organizationId: string;
  provider: string; // 'anthropic' | 'openai' | 'perplexity' | ...
  operation: string; // 'geo-probe' | 'geo-brand-extraction' | ...
  calls: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Slår sammen usage-observasjoner (for batching før én DB-skriv). */
export function sumUsage(events: TokenUsage[]): TokenUsage {
  return events.reduce(
    (acc, e) => ({
      inputTokens: acc.inputTokens + Math.max(0, e.inputTokens | 0),
      outputTokens: acc.outputTokens + Math.max(0, e.outputTokens | 0),
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
}

export async function recordAiUsage(pool: Pool, event: AiUsageEvent): Promise<boolean> {
  if (!UUID_PATTERN.test(event.organizationId)) return false;
  if (event.calls <= 0) return false;
  try {
    await pool.query(
      `INSERT INTO ai_usage_daily
         (organization_id, day, provider, operation, calls, input_tokens, output_tokens)
       VALUES ($1::uuid, CURRENT_DATE, $2, $3, $4, $5, $6)
       ON CONFLICT (organization_id, day, provider, operation) DO UPDATE SET
         calls = ai_usage_daily.calls + EXCLUDED.calls,
         input_tokens = ai_usage_daily.input_tokens + EXCLUDED.input_tokens,
         output_tokens = ai_usage_daily.output_tokens + EXCLUDED.output_tokens`,
      [
        event.organizationId,
        event.provider.slice(0, 40),
        event.operation.slice(0, 60),
        event.calls,
        Math.max(0, Math.round(event.inputTokens)),
        Math.max(0, Math.round(event.outputTokens)),
      ],
    );
    return true;
  } catch (err) {
    console.warn("[ai-usage] bokføring feilet (tapt observasjon):", String(err).slice(0, 150));
    return false;
  }
}

export interface AiUsageSummaryRow {
  provider: string;
  operation: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  days_active: number;
}

export async function getAiUsageSummary(
  pool: Pool,
  organizationId: string,
  days: number,
): Promise<AiUsageSummaryRow[]> {
  const r = await pool.query<AiUsageSummaryRow>(
    `SELECT provider, operation,
            SUM(calls)::int AS calls,
            SUM(input_tokens)::bigint AS input_tokens,
            SUM(output_tokens)::bigint AS output_tokens,
            COUNT(DISTINCT day)::int AS days_active
       FROM ai_usage_daily
      WHERE organization_id = $1::uuid
        AND day >= CURRENT_DATE - $2::int
      GROUP BY provider, operation
      ORDER BY SUM(input_tokens) + SUM(output_tokens) DESC`,
    [organizationId, days],
  );
  return r.rows.map((row) => ({
    ...row,
    input_tokens: Number(row.input_tokens),
    output_tokens: Number(row.output_tokens),
  }));
}
