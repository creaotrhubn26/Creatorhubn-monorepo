/**
 * Claude JSON helper — wraps runClaudeAgent() for routes that expect the
 * model to return a single JSON object. Handles markdown-fence stripping
 * and surfaces parse errors with the raw text so callers can log/debug.
 *
 * Caller is still responsible for consent (requireActiveConsent) and
 * audit (logAiCall) — mirroring the split documented in
 * role-room-agent-claude.ts.
 */

import { runClaudeAgent, type RunClaudeAgentResult } from './role-room-agent-claude.js';

export interface CallClaudeForJsonInput {
  cachedSystem: string;
  userMessage: string;
  maxTokens?: number;
  model?: string;
}

export interface CallClaudeForJsonResult<T> {
  data: T;
  usage: RunClaudeAgentResult['usage'];
  model: string;
  latencyMs: number;
  raw: string;
}

export class ClaudeJsonParseError extends Error {
  constructor(
    message: string,
    readonly raw: string,
  ) {
    super(message);
    this.name = 'ClaudeJsonParseError';
  }
}

function stripMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (fence) return fence[1].trim();
  return trimmed;
}

/**
 * Extract the first top-level JSON object from the text. Tolerant of
 * prose prefix/suffix Claude sometimes wraps around JSON output.
 */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export async function callClaudeForJson<T>(
  input: CallClaudeForJsonInput,
): Promise<CallClaudeForJsonResult<T>> {
  const result = await runClaudeAgent({
    cachedSystem: input.cachedSystem,
    userMessage: input.userMessage,
    maxTokens: input.maxTokens ?? 2048,
    model: input.model,
  });
  const stripped = stripMarkdownFence(result.text);
  const candidate = extractFirstJsonObject(stripped) ?? stripped;
  let parsed: T;
  try {
    parsed = JSON.parse(candidate) as T;
  } catch (err) {
    throw new ClaudeJsonParseError(
      `Claude did not return valid JSON: ${(err as Error).message}`,
      result.text,
    );
  }
  return {
    data: parsed,
    usage: result.usage,
    model: result.model,
    latencyMs: result.latencyMs,
    raw: result.text,
  };
}

// Exported for direct unit testing.
export const __test__ = { stripMarkdownFence, extractFirstJsonObject };
