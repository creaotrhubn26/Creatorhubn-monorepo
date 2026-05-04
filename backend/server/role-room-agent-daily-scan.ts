/**
 * Proactive daily scan — nightly cron that asks the Role Room Agent to
 * look at each active project with AI consent and flag anything that
 * needs attention (over-frist reviews, blocked timeline items, overspend,
 * missing brief fields).
 *
 * Findings land in `producer_project_notifications` so they surface in
 * the Innboks the next morning. Nothing is acted on automatically —
 * every flagged item is a suggestion for the producer.
 *
 * Safe by design:
 *   - Only scans projects with an active `role_room_ai_consent` row.
 *   - Hard cap per run (default 50 projects) so costs stay predictable.
 *   - Rate limit: one run per 20h per project via a `last_daily_scan_at`
 *     check against an internal note in the consent row's metadata.
 */

import type { Pool } from 'pg';

import { logAiCall } from './role-room-ai-audit.js';
import { claudeAgentEnabled, runClaudeAgent } from './role-room-agent-claude.js';
import { ROLE_ROOM_AGENT_SYSTEM_PROMPT } from './role-room-agent-definition.js';

const DAILY_SCAN_PROMPT = `Dette er en automatisert daglig prosjekt-scan. Kjør følgende vurdering av prosjektet:

1. Reviews: er noen over frist eller i 'changes_requested' mer enn 3 dager?
2. Timeline: er det blokkerte items? Er det items uten frist?
3. Økonomi: er det linjer hvor faktisk > godkjent? Er det 'blocked' linjer?
4. Brief: mangler det obligatoriske felt?
5. Skytedager: er det planlagte dager uten call-tid eller lokasjon?

Returner et kort JSON-objekt:
{
  "risks": [{ "area": "reviews|timeline|economy|brief|shoot", "severity": "high|medium|low", "title": "kort", "detail": "hvorfor" }],
  "headline": "én setning som beskriver helhetstilstanden"
}

Kun JSON, ingen markdown, ingen forklaring.`;

interface DailyScanProjectRow {
  projectId: string;
  consentId: string;
  userId: string;
}

async function pickScanTargets(pool: Pool, limit: number): Promise<DailyScanProjectRow[]> {
  try {
    const result = await pool.query(
      `SELECT c.project_id, c.id AS consent_id, c.user_id
         FROM role_room_ai_consent c
        WHERE c.revoked_at IS NULL
          AND c.processor = 'anthropic'
          AND c.scope IN ('brief_and_reviews', 'full_context')
          AND NOT EXISTS (
            SELECT 1 FROM role_room_ai_audit_log a
            WHERE a.project_id = c.project_id
              AND a.action = 'daily_scan'
              AND a.created_at > now() - interval '20 hours'
              AND a.status = 'ok'
          )
        ORDER BY c.granted_at DESC
        LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      projectId: row.project_id,
      consentId: row.consent_id,
      userId: row.user_id,
    }));
  } catch {
    return [];
  }
}

async function insertNotification(
  pool: Pool,
  input: {
    projectId: string;
    userId: string;
    title: string;
    message: string;
    severity: 'high' | 'medium' | 'low';
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO producer_project_notifications (
         project_id, assigned_to_user_id, inbox_type, event_type,
         title, message, read, created_at, updated_at
       ) VALUES ($1, $2, 'ai_scan', $3, $4, $5, FALSE, now(), now())`,
      [
        input.projectId,
        input.userId,
        `ai_scan_${input.severity}`,
        input.title,
        input.message,
      ],
    );
  } catch {
    // Notifications are best-effort; don't fail the scan because the
    // destination table has an unexpected schema on some environments.
  }
}

function extractJson(text: string): any | null {
  if (!text) return null;
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const raw = fence ? fence[1] : trimmed;
  try {
    return JSON.parse(raw);
  } catch {
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(raw.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function scanOneProject(pool: Pool, row: DailyScanProjectRow): Promise<void> {
  try {
    const raw = await runClaudeAgent({
      cachedSystem: ROLE_ROOM_AGENT_SYSTEM_PROMPT,
      userMessage: `${DAILY_SCAN_PROMPT}\n\nProsjekt-id: ${row.projectId}`,
      maxTokens: 1024,
    });
    await logAiCall(pool, {
      projectId: row.projectId,
      userId: row.userId,
      consentId: row.consentId,
      processor: 'anthropic',
      model: raw.model,
      action: 'daily_scan',
      status: 'ok',
      promptTokens: raw.usage.inputTokens,
      completionTokens: raw.usage.outputTokens,
      totalTokens: (raw.usage.inputTokens ?? 0) + (raw.usage.outputTokens ?? 0),
      latencyMs: raw.latencyMs,
      fieldCategories: ['daily_scan'],
    });

    const parsed = extractJson(raw.text);
    if (!parsed || !Array.isArray(parsed.risks)) return;
    for (const risk of parsed.risks) {
      if (!risk || typeof risk.title !== 'string') continue;
      const severity: 'high' | 'medium' | 'low' =
        risk.severity === 'high' || risk.severity === 'medium' ? risk.severity : 'low';
      await insertNotification(pool, {
        projectId: row.projectId,
        userId: row.userId,
        title: risk.title.slice(0, 200),
        message: (typeof risk.detail === 'string' ? risk.detail : '').slice(0, 2000),
        severity,
      });
    }
  } catch (err) {
    await logAiCall(pool, {
      projectId: row.projectId,
      userId: row.userId,
      consentId: row.consentId,
      processor: 'anthropic',
      model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-6',
      action: 'daily_scan',
      status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function runDailyAgentScan(pool: Pool): Promise<{ scanned: number }> {
  if (!claudeAgentEnabled()) return { scanned: 0 };
  const limit = Number(process.env.ROLE_ROOM_AGENT_DAILY_SCAN_LIMIT ?? '50');
  const targets = await pickScanTargets(pool, Math.max(1, Math.min(limit, 500)));
  // Serial, not parallel, to keep token cost + Anthropic rate-limit bounded.
  for (const row of targets) {
    await scanOneProject(pool, row);
  }
  return { scanned: targets.length };
}
