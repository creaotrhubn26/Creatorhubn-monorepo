/**
 * Shared LLM-synthesis plumbing for the producer bootstrap agent.
 *
 * The three bootstrap modules — the OpenAI synthesis step in role-room-agent.ts,
 * the Claude tool-orchestrator (role-room-agent-bootstrap-orchestrator.ts) and
 * the Claude synthesis layer (role-room-agent-bootstrap-claude.ts) — used to
 * copy-paste the same helpers: a markdown-fence-stripping JSON parser, a
 * single-line structured warn-logger, the synthesis max_tokens budget, and a
 * 60s Promise.race timeout wrapper. That duplication once let the same
 * truncation bug live in two places. This module is the single source.
 */

/**
 * Token budget for the bootstrap synthesis call. 4096 routinely truncated the
 * large synthesis JSON (companyProfile + intakeDraft + planningDraft +
 * storyLogicDraft + nextRecommendedSteps); the truncated body then failed
 * JSON.parse → null synthesis → silent deterministic fallback. 8192 gives the
 * payload room to complete.
 */
export const BOOTSTRAP_SYNTH_MAX_TOKENS = 8192;

/**
 * Parse a JSON object out of an LLM text response. Strips a leading/trailing
 * markdown fence (```json … ```), then falls back to the first `{` … last `}`
 * slice if the whole string doesn't parse. Returns null on any failure.
 */
export function extractJsonFromText(text: string): unknown | null {
  if (!text) return null;
  // Claude sometimes wraps JSON in markdown despite instructions; strip common fences.
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const raw = fenceMatch ? fenceMatch[1] : trimmed;
  try {
    return JSON.parse(raw);
  } catch {
    // As a last resort, try to locate the first { ... } block and parse it.
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const slice = raw.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Build a single-line structured warn-logger bound to `prefix` so ops can grep
 * a stable tag (e.g. `role-room-agent:orchestrator`) on any log backend.
 * Diagnostics never throw.
 */
export function makeStructuredLogger(
  prefix: string,
): (reason: string, detail?: Record<string, unknown>) => void {
  return (reason: string, detail?: Record<string, unknown>): void => {
    try {
      console.warn(prefix, JSON.stringify({ reason, ...detail }));
    } catch {
      // diagnostics never throw
    }
  };
}

/**
 * Race `promise` against a timeout. On timeout the returned promise rejects
 * with `new Error(label)`, matching the inline Promise.race pattern these
 * modules previously duplicated.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(label)), ms),
    ),
  ]);
}
