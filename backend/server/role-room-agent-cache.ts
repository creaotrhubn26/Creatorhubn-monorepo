/**
 * Response cache + model router for the Role Room Agent.
 *
 * Two cost-saving primitives in one file:
 *
 *   1. `lookupCachedResponse` / `storeCachedResponse` — DB-backed
 *      response dedup. Same question + same context within TTL returns
 *      instantly, no Anthropic call.
 *
 *   2. `pickModelForMessage` — routes easy intents to Haiku 4.5 (~5×
 *      cheaper than Sonnet) and hard intents to Sonnet 4.5. Heuristic
 *      only; fall back to Sonnet on ambiguity so quality stays intact.
 *
 * Both are opt-in via env vars so existing production behaviour is
 * preserved unless explicitly enabled.
 */

import crypto from 'crypto';
import type { Pool } from 'pg';

export const DEFAULT_CACHE_TTL_MINUTES = 30;
const HARD_MAX_TTL_DAYS = 7;

export interface CachedResponseRecord {
  cacheKey: string;
  response: unknown;
  model: string;
  cachedPromptTokens: number | null;
  cachedCompletionTokens: number | null;
  hitCount: number;
  createdAt: Date;
}

/** SHA-256 of `(projectId, contextHash, userMessage)`. Deterministic. */
export function buildCacheKey(
  projectId: string,
  contextHash: string,
  userMessage: string,
): string {
  const h = crypto.createHash('sha256');
  h.update(projectId);
  h.update('\x1f'); // ASCII unit separator to avoid accidental collisions.
  h.update(contextHash);
  h.update('\x1f');
  h.update(userMessage);
  return h.digest('hex');
}

/** Hash the pseudonymized context payload so context changes bust the cache. */
export function hashContext(contextPayload: unknown): string {
  try {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(contextPayload ?? {}))
      .digest('hex');
  } catch {
    // Should never happen — JSON.stringify on our payloads is safe.
    return 'unhashable';
  }
}

export async function lookupCachedResponse(
  pool: Pool,
  cacheKey: string,
): Promise<CachedResponseRecord | null> {
  try {
    const result = await pool.query(
      `SELECT cache_key, response, model,
              cached_prompt_tokens, cached_completion_tokens,
              hit_count, created_at
         FROM role_room_agent_response_cache
         WHERE cache_key = $1
           AND expires_at > now()
         LIMIT 1`,
      [cacheKey],
    );
    const row = result.rows[0];
    if (!row) return null;

    // Bump hit counter — fire and forget.
    pool
      .query(
        `UPDATE role_room_agent_response_cache
            SET hit_count = hit_count + 1,
                last_hit_at = now()
          WHERE cache_key = $1`,
        [cacheKey],
      )
      .catch(() => {
        /* cache counters are best-effort */
      });

    return {
      cacheKey: row.cache_key,
      response: row.response,
      model: row.model,
      cachedPromptTokens: row.cached_prompt_tokens ?? null,
      cachedCompletionTokens: row.cached_completion_tokens ?? null,
      hitCount: row.hit_count ?? 0,
      createdAt: row.created_at,
    };
  } catch {
    // Cache failures must never break the primary flow.
    return null;
  }
}

export async function storeCachedResponse(
  pool: Pool,
  params: {
    cacheKey: string;
    projectId: string;
    userId: string;
    model: string;
    response: unknown;
    promptTokens?: number | null;
    completionTokens?: number | null;
    ttlMinutes?: number;
  },
): Promise<void> {
  try {
    const ttl = Math.min(
      Math.max(1, params.ttlMinutes ?? DEFAULT_CACHE_TTL_MINUTES),
      HARD_MAX_TTL_DAYS * 24 * 60,
    );
    await pool.query(
      `INSERT INTO role_room_agent_response_cache (
        cache_key, project_id, user_id, model, response,
        cached_prompt_tokens, cached_completion_tokens,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, now() + ($8 || ' minutes')::interval)
      ON CONFLICT (cache_key) DO UPDATE SET
        response = EXCLUDED.response,
        model = EXCLUDED.model,
        cached_prompt_tokens = EXCLUDED.cached_prompt_tokens,
        cached_completion_tokens = EXCLUDED.cached_completion_tokens,
        expires_at = EXCLUDED.expires_at`,
      [
        params.cacheKey,
        params.projectId,
        params.userId,
        params.model,
        JSON.stringify(params.response),
        params.promptTokens ?? null,
        params.completionTokens ?? null,
        String(ttl),
      ],
    );
  } catch {
    /* ignore — cache is advisory */
  }
}

/**
 * Nightly pruning. Deletes expired rows + anything older than the hard
 * retention cap. Designed to run idempotently alongside the audit-log
 * prune that already lives on the app's startup cron.
 */
export async function pruneAgentCache(pool: Pool): Promise<number> {
  const result = await pool.query(
    `DELETE FROM role_room_agent_response_cache
      WHERE expires_at < now()
         OR created_at < now() - interval '7 days'`,
  );
  return result.rowCount ?? 0;
}

// =============================================================================
// Model router — picks Haiku vs Sonnet based on the user message intent.
// =============================================================================

export type RoleRoomAgentModelTier = 'sonnet' | 'haiku';

/**
 * Matches lightweight "info lookup" patterns that Haiku handles well for
 * a fraction of the cost. The fallback is always Sonnet so anything
 * ambiguous or domain-heavy gets the stronger model.
 *
 * Can be globally disabled via ROLE_ROOM_AGENT_MODEL_ROUTER=off.
 */
export function pickModelForMessage(userMessage: string): RoleRoomAgentModelTier {
  if (process.env.ROLE_ROOM_AGENT_MODEL_ROUTER === 'off') return 'sonnet';
  const trimmed = (userMessage ?? '').trim();
  if (trimmed.length === 0) return 'sonnet';

  // Very short queries are usually lookups.
  if (trimmed.length < 60) {
    const lower = trimmed.toLowerCase();
    const simpleCues = [
      'hva er',
      'når er',
      'hvem er',
      'hvor mange',
      'hvor er',
      'list',
      'vis',
      'oppsummer',
      'hva mangler',
      'neste frist',
      'sist endret',
      'hvor mye',
    ];
    if (simpleCues.some((cue) => lower.startsWith(cue))) return 'haiku';
  }

  // Long queries, multi-sentence, or containing "analyser/foreslå/utform/skriv"
  // go to Sonnet — these need reasoning.
  const lower = trimmed.toLowerCase();
  const heavyCues = [
    'analyser',
    'foreslå',
    'utform',
    'skriv',
    'strateg',
    'risiko',
    'scope',
    'konflikt',
    'budsjett',
    'prioriter',
    'draft',
    'oversett',
  ];
  if (heavyCues.some((cue) => lower.includes(cue))) return 'sonnet';

  // Default: Sonnet. Safer for quality.
  return 'sonnet';
}

export function modelIdForTier(tier: RoleRoomAgentModelTier): string {
  if (tier === 'haiku') {
    return process.env.ROLE_ROOM_AGENT_HAIKU_MODEL || 'claude-haiku-4-5-20251001';
  }
  return process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-6';
}
