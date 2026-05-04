/**
 * Role Room Agent runner — the single orchestration point for every
 * Claude-backed agent call.
 *
 * Responsibilities (in strict order):
 *   1. requireActiveConsent() with the scope the caller asked for.
 *   2. Load project context from DB according to the consent scope.
 *   3. Pseudonymize kandidat/crew PII before it leaves our server.
 *   4. Build the cached system block + uncached user message.
 *   5. Call runClaudeAgent() with ROLE_ROOM_AGENT_TOOLS.
 *   6. De-pseudonymize the response text so the UI sees real names again
 *      (names stay inside the server's trust boundary until rendered).
 *   7. Write an audit row via logAiCall() — metadata only.
 *   8. Return shape matching RoleRoomAgentResponse.
 *
 * Callers (routes) MUST NOT skip any of these steps. That is why there is
 * only one exported function.
 */

import type { Pool } from 'pg';

import {
  requireActiveConsent,
  RoleRoomAiConsentError,
  type RoleRoomAiConsentRecord,
  type RoleRoomAiConsentScope,
} from './role-room-ai-consent.js';
import { logAiCall } from './role-room-ai-audit.js';
import {
  claudeAgentEnabled,
  runClaudeAgent,
  type RunClaudeAgentResult,
} from './role-room-agent-claude.js';
import {
  ROLE_ROOM_AGENT_SYSTEM_PROMPT,
  ROLE_ROOM_AGENT_TOOLS,
  ROLE_ROOM_AGENT_DEFAULT_MAX_TOKENS,
} from './role-room-agent-definition.js';
import {
  buildBackendPseudonymMap,
  countScrubbed,
  type PseudonymizableEntity,
} from './role-room-pseudonymize.js';
import {
  buildCacheKey,
  hashContext,
  lookupCachedResponse,
  modelIdForTier,
  pickModelForMessage,
  storeCachedResponse,
} from './role-room-agent-cache.js';
import { appendMessage, ensureThread } from './role-room-agent-threads.js';
import {
  checkAgentEntitlement,
  type EntitlementResult,
} from './role-room-agent-entitlements.js';

export type RoleRoomAgentAction =
  | 'query'
  | 'summarize_brief'
  | 'suggest_next_decision';

export interface RoleRoomAgentToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface RoleRoomAgentResponse {
  text: string;
  toolUses: RoleRoomAgentToolUse[];
  model: string;
  latencyMs: number;
  /** Present when the call was persisted to a thread. */
  threadId?: string | null;
  usage: RunClaudeAgentResult['usage'];
  consentId: string;
  transparency: {
    model: string;
    fields: string[];
    entityCount: number;
    piiScrubbedFromInput: { emails: number; phones: number };
  };
}

export interface RoleRoomAgentInvokeInput {
  pool: Pool;
  projectId: string;
  userId: string;
  /** The caller's role for privileged-bypass detection (admin/owner). */
  userRole?: string | null;
  action: RoleRoomAgentAction;
  /** User's natural-language question. Short (max ~1 KB). */
  userMessage: string;
  /** Optional thread-id. When provided (or null to auto-create), the user
   *  message and the assistant response are persisted to the thread. */
  threadId?: string | null;
  /** If true, will create a new thread when threadId is null/invalid. */
  persistThread?: boolean;
  /**
   * Required scope for this call. The runner verifies the active consent
   * covers at least this level before sending anything to Claude.
   */
  requiredScope: RoleRoomAiConsentScope;
  /** Project context the caller has already assembled. The runner is the
   *  one that pseudonymizes — caller MUST pass real entities here. */
  context: {
    briefSummary?: string;
    openReviews?: Array<{ id: string; title: string; status: string }>;
    timelineHighlights?: Array<{ id: string; title: string; phase: string; status: string; dueAt?: string | null }>;
    candidates?: PseudonymizableEntity[];
    crew?: PseudonymizableEntity[];
    /** Recent / upcoming shooting days — call time, wrap, location, status. */
    shootingDays?: Array<{
      id: string;
      dayNumber: number;
      date: string;
      callTime?: string | null;
      wrapTime?: string | null;
      location?: string | null;
      status: string;
      weather?: { condition: string; temperature: number } | null;
    }>;
    /** Economy items — budget lines, estimates, actuals, statuses. */
    economyItems?: Array<{
      id: string;
      phase: string;
      category: string;
      itemName: string;
      estimate?: string | number | null;
      approved?: string | number | null;
      actual?: string | number | null;
      currency?: string;
      status: string;
      clientVisible?: boolean;
    }>;
  };
}

export class RoleRoomAgentDisabledError extends Error {
  constructor() {
    super('Role Room Agent (Claude) is feature-flagged off');
    this.name = 'RoleRoomAgentDisabledError';
  }
}

export class RoleRoomAgentEntitlementError extends Error {
  readonly entitlement: EntitlementResult;
  constructor(entitlement: EntitlementResult) {
    super(`Agent entitlement missing: ${entitlement.reason}`);
    this.name = 'RoleRoomAgentEntitlementError';
    this.entitlement = entitlement;
  }
}

function buildCachedSystem(input: RoleRoomAgentInvokeInput, pseudo: ReturnType<typeof buildBackendPseudonymMap>) {
  const lines: string[] = [ROLE_ROOM_AGENT_SYSTEM_PROMPT, '', '## Prosjektkontekst'];
  lines.push(`Prosjekt-id: ${input.projectId}`);
  if (input.context.briefSummary) {
    lines.push('', '### Brief-sammendrag');
    lines.push(pseudo.toPlaceholder(input.context.briefSummary));
  }
  if (input.context.openReviews?.length) {
    lines.push('', '### Aktive reviews');
    for (const review of input.context.openReviews) {
      lines.push(`- id=${review.id} status=${review.status} — ${pseudo.toPlaceholder(review.title)}`);
    }
  }
  if (input.context.timelineHighlights?.length) {
    lines.push('', '### Timeline-høydepunkter');
    for (const item of input.context.timelineHighlights) {
      const due = item.dueAt ? ` frist=${item.dueAt}` : '';
      lines.push(`- id=${item.id} fase=${item.phase} status=${item.status}${due} — ${pseudo.toPlaceholder(item.title)}`);
    }
  }
  if (input.context.candidates?.length) {
    lines.push('', '### Kandidater (pseudonymisert)');
    for (const [i, c] of input.context.candidates.entries()) {
      const placeholderName = `{{candidate_${i + 1}}}`;
      lines.push(`- ${placeholderName} rolle=${c.role ?? 'ukjent'}`);
    }
  }
  if (input.context.crew?.length) {
    lines.push('', '### Crew (pseudonymisert)');
    for (const [i, c] of input.context.crew.entries()) {
      const placeholderName = `{{crew_${i + 1}}}`;
      lines.push(`- ${placeholderName} rolle=${c.role ?? 'ukjent'}`);
    }
  }
  if (input.context.shootingDays?.length) {
    lines.push('', '### Skytedager');
    for (const day of input.context.shootingDays) {
      const weather = day.weather
        ? ` vær=${day.weather.condition}/${day.weather.temperature}°`
        : '';
      const times = [day.callTime ? `kall=${day.callTime}` : null, day.wrapTime ? `wrap=${day.wrapTime}` : null]
        .filter(Boolean)
        .join(' ');
      lines.push(
        `- id=${day.id} dag=${day.dayNumber} dato=${day.date} status=${day.status} ${times}${weather}${
          day.location ? ` — ${day.location}` : ''
        }`,
      );
    }
  }
  if (input.context.economyItems?.length) {
    lines.push('', '### Økonomi (pseudonymisert kun for navn)');
    for (const item of input.context.economyItems) {
      const est = item.estimate != null ? `est=${item.estimate}` : '';
      const appr = item.approved != null ? `godkjent=${item.approved}` : '';
      const actual = item.actual != null ? `faktisk=${item.actual}` : '';
      const parts = [est, appr, actual].filter(Boolean).join(' ');
      const visibility = item.clientVisible === false ? ' [kun internt]' : '';
      lines.push(
        `- id=${item.id} fase=${item.phase} status=${item.status} ${parts} ${item.currency ?? ''} — ${
          item.category
        } / ${item.itemName}${visibility}`,
      );
    }
  }
  return lines.join('\n');
}

export async function invokeRoleRoomAgent(
  input: RoleRoomAgentInvokeInput,
): Promise<RoleRoomAgentResponse> {
  const { pool, projectId, userId } = input;

  if (!claudeAgentEnabled()) {
    throw new RoleRoomAgentDisabledError();
  }

  const entitlement = await checkAgentEntitlement(pool, userId, input.userRole);
  if (!entitlement.allowed) {
    throw new RoleRoomAgentEntitlementError(entitlement);
  }

  let consent: RoleRoomAiConsentRecord;
  try {
    consent = await requireActiveConsent(pool, projectId, 'anthropic', input.requiredScope);
  } catch (err) {
    if (err instanceof RoleRoomAiConsentError) {
      await logAiCall(pool, {
        projectId,
        userId,
        processor: 'anthropic',
        model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-6',
        action: input.action,
        status: 'blocked_by_consent',
        errorCode: err.code,
        errorMessage: err.message,
      });
    }
    throw err;
  }

  // Filter candidates/crew through consent exclusion list.
  const excluded = new Set(consent.excludedEntityIds);
  const candidates = (input.context.candidates ?? []).filter((c) => !excluded.has(c.id));
  const crew = (input.context.crew ?? []).filter((c) => !excluded.has(c.id));

  // Build the maps. Candidates and crew use their own prefix so the agent
  // can tell them apart in text.
  const candidateMap = buildBackendPseudonymMap(candidates, 'candidate');
  const crewMap = buildBackendPseudonymMap(crew, 'crew');

  // Combined map for pseudonymize/de-pseudonymize — iterate in a stable order.
  const combinedAssignments = [...candidateMap.assignments, ...crewMap.assignments];

  // Pseudonymize user message too (user might type candidate name by hand).
  const pseudonymizedUserMessage = (() => {
    let out = input.userMessage;
    out = candidateMap.toPlaceholder(out);
    out = crewMap.toPlaceholder(out);
    return out;
  })();

  const scrubbedFromUser = countScrubbed(input.userMessage);

  const cachedSystem = buildCachedSystem(
    { ...input, context: { ...input.context, candidates, crew } },
    // Use the candidate map to pseudonymize the system content; crew names
    // are replaced via their own map in a second pass below.
    {
      ...candidateMap,
      toPlaceholder: (value: string) => crewMap.toPlaceholder(candidateMap.toPlaceholder(value)),
      fromPlaceholder: (value: string) => crewMap.fromPlaceholder(candidateMap.fromPlaceholder(value)),
    },
  );

  const fieldCategories: string[] = [];
  if (input.context.briefSummary) fieldCategories.push('brief_fields');
  if (input.context.openReviews?.length) fieldCategories.push('review_metadata');
  if (input.context.timelineHighlights?.length) fieldCategories.push('timeline_metadata');
  if (input.context.shootingDays?.length) fieldCategories.push('shooting_day_metadata');
  if (input.context.economyItems?.length) fieldCategories.push('economy_metadata');
  fieldCategories.push(...candidateMap.categoriesTouched, ...crewMap.categoriesTouched);

  // =========================================================================
  // Cost-saving layer: response cache + model router.
  //   - cacheKey = sha256(projectId, contextHash, pseudonymizedUserMessage).
  //   - Cache lookup is best-effort; a miss or DB error just means we call
  //     Claude as usual.
  //   - Model router routes short info-lookup queries to Haiku (~5×
  //     cheaper). Heavier queries stay on Sonnet.
  // =========================================================================
  // Resolve the persistent thread (creates one if needed) before any LLM
  // call so even cache-hits get persisted to the conversation.
  const persistThread = input.persistThread !== false && (input.threadId !== undefined || input.persistThread === true);
  const resolvedThreadId = persistThread
    ? await ensureThread(pool, projectId, userId, input.threadId, input.userMessage)
    : null;

  if (resolvedThreadId) {
    void appendMessage(pool, {
      threadId: resolvedThreadId,
      role: 'user',
      text: input.userMessage,
    });
  }

  const cacheEnabled = process.env.ROLE_ROOM_AGENT_CACHE !== 'off';
  const contextHash = hashContext({
    briefSummary: input.context.briefSummary ?? null,
    openReviews: input.context.openReviews ?? [],
    timelineHighlights: input.context.timelineHighlights ?? [],
    shootingDays: input.context.shootingDays ?? [],
    economyItems: input.context.economyItems ?? [],
    // Pseudonymized candidate/crew placeholders — inclusion changes the
    // cache bucket when the consented set changes.
    candidatePlaceholders: candidateMap.assignments.map((a) => a.placeholder).sort(),
    crewPlaceholders: crewMap.assignments.map((a) => a.placeholder).sort(),
  });
  const cacheKey = buildCacheKey(projectId, contextHash, pseudonymizedUserMessage);

  if (cacheEnabled) {
    const cached = await lookupCachedResponse(pool, cacheKey);
    if (cached) {
      await logAiCall(pool, {
        projectId,
        userId,
        consentId: consent.id,
        processor: 'anthropic',
        model: cached.model,
        action: input.action,
        status: 'ok',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: 0,
        fieldCategories: [...fieldCategories, 'cache_hit'],
        entityCount: candidates.length + crew.length,
        emailsScrubbed: scrubbedFromUser.emails,
        phonesScrubbed: scrubbedFromUser.phones,
      });
      const cachedResponse = { ...(cached.response as RoleRoomAgentResponse), threadId: resolvedThreadId };
      if (resolvedThreadId) {
        void appendMessage(pool, {
          threadId: resolvedThreadId,
          role: 'assistant',
          text: cachedResponse.text,
          response: cachedResponse,
        });
      }
      return cachedResponse;
    }
  }

  const modelTier = pickModelForMessage(input.userMessage);
  const modelId = modelIdForTier(modelTier);

  try {
    const raw = await runClaudeAgent({
      cachedSystem,
      userMessage: pseudonymizedUserMessage,
      tools: ROLE_ROOM_AGENT_TOOLS,
      maxTokens: ROLE_ROOM_AGENT_DEFAULT_MAX_TOKENS,
      model: modelId,
    });

    // De-pseudonymize text so the UI renders real names to the user (who
    // already has the right to see them — placeholders are only a
    // transport-layer precaution).
    const depseudonymized = (() => {
      let out = raw.text;
      for (const { placeholder, real } of combinedAssignments) {
        const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(escaped, 'g'), real);
      }
      return out;
    })();

    await logAiCall(pool, {
      projectId,
      userId,
      consentId: consent.id,
      processor: 'anthropic',
      model: raw.model,
      action: input.action,
      status: 'ok',
      promptTokens: raw.usage.inputTokens,
      completionTokens: raw.usage.outputTokens,
      totalTokens: (raw.usage.inputTokens ?? 0) + (raw.usage.outputTokens ?? 0),
      latencyMs: raw.latencyMs,
      fieldCategories: [
        ...fieldCategories,
        ...raw.toolUses.map((t) => `proposed_tool:${t.name}`),
      ],
      entityCount: candidates.length + crew.length,
      emailsScrubbed: scrubbedFromUser.emails,
      phonesScrubbed: scrubbedFromUser.phones,
    });

    const response: RoleRoomAgentResponse = {
      text: depseudonymized,
      toolUses: raw.toolUses.map((t) => ({ id: t.id, name: t.name, input: t.input })),
      model: raw.model,
      latencyMs: raw.latencyMs,
      usage: raw.usage,
      consentId: consent.id,
      threadId: resolvedThreadId,
      transparency: {
        model: raw.model,
        fields: fieldCategories,
        entityCount: candidates.length + crew.length,
        piiScrubbedFromInput: scrubbedFromUser,
      },
    };

    if (cacheEnabled) {
      // Do not block the response on cache write.
      void storeCachedResponse(pool, {
        cacheKey,
        projectId,
        userId,
        model: raw.model,
        response,
        promptTokens: raw.usage.inputTokens,
        completionTokens: raw.usage.outputTokens,
      });
    }

    if (resolvedThreadId) {
      void appendMessage(pool, {
        threadId: resolvedThreadId,
        role: 'assistant',
        text: depseudonymized,
        response,
      });
    }

    return response;
  } catch (err) {
    await logAiCall(pool, {
      projectId,
      userId,
      consentId: consent.id,
      processor: 'anthropic',
      model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-5',
      action: input.action,
      status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
