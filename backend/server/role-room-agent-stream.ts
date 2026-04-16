/**
 * SSE streaming handler for the Role Room Agent.
 *
 * Only handles the NON-TOOL-USE case — streaming through a tool-use loop
 * would require event ordering guarantees we don't need yet. When the
 * agent wants to call tools, the frontend retries via the non-streaming
 * /agent/query endpoint, which is atomic.
 *
 * Reuses the consent + pseudonymize + audit pipeline from the runner so
 * this path is just as safe as the synchronous one. Response cache is
 * skipped (streaming to cache would add complexity for marginal benefit;
 * identical queries hit cache on the sync path).
 */

import type { Request, Response } from 'express';
import type { Pool } from 'pg';

import {
  requireActiveConsent,
  RoleRoomAiConsentError,
  type RoleRoomAiConsentScope,
} from './role-room-ai-consent.js';
import { logAiCall } from './role-room-ai-audit.js';
import {
  buildBackendPseudonymMap,
  countScrubbed,
  type PseudonymizableEntity,
} from './role-room-pseudonymize.js';
import {
  ROLE_ROOM_AGENT_SYSTEM_PROMPT,
} from './role-room-agent-definition.js';
import { modelIdForTier, pickModelForMessage } from './role-room-agent-cache.js';
import { appendMessage, ensureThread } from './role-room-agent-threads.js';
import {
  checkAgentRateLimit,
  RateLimitExceededError,
} from './role-room-agent-ratelimit.js';

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

interface StreamRequestBody {
  userMessage: string;
  requiredScope?: RoleRoomAiConsentScope;
  threadId?: string | null;
  persistThread?: boolean;
  context?: {
    briefSummary?: string;
    openReviews?: Array<{ id: string; title: string; status: string }>;
    timelineHighlights?: Array<{ id: string; title: string; phase: string; status: string; dueAt?: string | null }>;
    candidates?: PseudonymizableEntity[];
    crew?: PseudonymizableEntity[];
    shootingDays?: Array<any>;
    economyItems?: Array<any>;
  };
}

function writeEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function handleAgentStream(
  pool: Pool,
  req: Request,
  res: Response,
  userId: string,
): Promise<void> {
  const projectId = req.params.projectId;
  const body = (req.body ?? {}) as StreamRequestBody;
  const userMessage = typeof body.userMessage === 'string' ? body.userMessage.trim() : '';
  if (!userMessage) {
    res.status(400).json({ error: 'userMessage required' });
    return;
  }
  if (userMessage.length > 4000) {
    res.status(400).json({ error: 'userMessage too long' });
    return;
  }

  try {
    checkAgentRateLimit(userId, projectId);
  } catch (err) {
    if (err instanceof RateLimitExceededError) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
      res.status(429).json({
        error: 'rate_limit_exceeded',
        scope: err.scope,
        retryAfterSeconds: err.retryAfterSeconds,
      });
      return;
    }
    throw err;
  }

  const requiredScope: RoleRoomAiConsentScope = body.requiredScope ?? 'brief_only';

  // Consent check BEFORE we open the SSE stream so the client can react
  // to 403 without having to parse stream events.
  let consent;
  try {
    consent = await requireActiveConsent(pool, projectId, 'anthropic', requiredScope);
  } catch (err) {
    if (err instanceof RoleRoomAiConsentError) {
      await logAiCall(pool, {
        projectId,
        userId,
        processor: 'anthropic',
        model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-5',
        action: 'stream',
        status: 'blocked_by_consent',
        errorCode: err.code,
        errorMessage: err.message,
      });
      res.status(403).json({ error: err.code, detail: err.message });
      return;
    }
    throw err;
  }

  const client = await getAnthropicClient();
  if (!client) {
    res.status(503).json({ error: 'agent_disabled', detail: 'Anthropic SDK unavailable' });
    return;
  }

  // Pseudonymize context before it leaves our server.
  const context = body.context ?? {};
  const excluded = new Set(consent.excludedEntityIds);
  const candidates = (context.candidates ?? []).filter((c) => !excluded.has(c.id));
  const crew = (context.crew ?? []).filter((c) => !excluded.has(c.id));
  const candidateMap = buildBackendPseudonymMap(candidates, 'candidate');
  const crewMap = buildBackendPseudonymMap(crew, 'crew');
  const combinedAssignments = [...candidateMap.assignments, ...crewMap.assignments];

  const pseudonymizedMessage = crewMap.toPlaceholder(candidateMap.toPlaceholder(userMessage));
  const scrubbedFromUser = countScrubbed(userMessage);

  const systemLines: string[] = [
    ROLE_ROOM_AGENT_SYSTEM_PROMPT,
    '',
    '## Prosjektkontekst',
    `Prosjekt-id: ${projectId}`,
  ];
  if (context.briefSummary) {
    systemLines.push('', '### Brief-sammendrag');
    systemLines.push(crewMap.toPlaceholder(candidateMap.toPlaceholder(context.briefSummary)));
  }
  if (context.openReviews?.length) {
    systemLines.push('', '### Aktive reviews');
    for (const r of context.openReviews) {
      systemLines.push(`- id=${r.id} status=${r.status} — ${crewMap.toPlaceholder(candidateMap.toPlaceholder(r.title))}`);
    }
  }
  if (context.timelineHighlights?.length) {
    systemLines.push('', '### Timeline-høydepunkter');
    for (const item of context.timelineHighlights) {
      const due = item.dueAt ? ` frist=${item.dueAt}` : '';
      systemLines.push(`- id=${item.id} fase=${item.phase} status=${item.status}${due}`);
    }
  }
  const cachedSystem = systemLines.join('\n');

  // Pick model + resolve thread.
  const tier = pickModelForMessage(userMessage);
  const modelId = modelIdForTier(tier);

  const persistThread = body.persistThread !== false;
  const threadId = persistThread
    ? await ensureThread(pool, projectId, userId, body.threadId, userMessage)
    : null;

  if (threadId) {
    void appendMessage(pool, { threadId, role: 'user', text: userMessage });
  }

  // Open the SSE stream. Do this only AFTER all pre-checks pass so we
  // never open an empty stream just to close it with an error.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Important for reverse proxies: flush headers.
  res.flushHeaders?.();
  writeEvent(res, 'start', { model: modelId, threadId });

  let accumulatedText = '';
  let inputTokens = 0;
  let outputTokens = 0;
  const startedAt = Date.now();

  try {
    const stream = client.messages.stream({
      model: modelId,
      max_tokens: 1200,
      system: [
        {
          type: 'text',
          text: cachedSystem,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: pseudonymizedMessage }],
    });

    stream.on('text', (delta: string) => {
      // De-pseudonymize deltas inline so the user sees real names in the
      // live stream, not {{candidate_1}} placeholders.
      let out = delta;
      for (const { placeholder, real } of combinedAssignments) {
        const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(escaped, 'g'), real);
      }
      accumulatedText += out;
      writeEvent(res, 'delta', { text: out });
    });

    const finalMessage = await stream.finalMessage();
    inputTokens = finalMessage?.usage?.input_tokens ?? 0;
    outputTokens = finalMessage?.usage?.output_tokens ?? 0;

    await logAiCall(pool, {
      projectId,
      userId,
      consentId: consent.id,
      processor: 'anthropic',
      model: modelId,
      action: 'stream',
      status: 'ok',
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
      latencyMs: Date.now() - startedAt,
      fieldCategories: [
        'stream',
        ...(context.briefSummary ? ['brief_fields'] : []),
        ...(context.openReviews?.length ? ['review_metadata'] : []),
        ...candidateMap.categoriesTouched,
        ...crewMap.categoriesTouched,
      ],
      entityCount: candidates.length + crew.length,
      emailsScrubbed: scrubbedFromUser.emails,
      phonesScrubbed: scrubbedFromUser.phones,
    });

    if (threadId) {
      void appendMessage(pool, {
        threadId,
        role: 'assistant',
        text: accumulatedText,
        response: {
          text: accumulatedText,
          toolUses: [],
          model: modelId,
          latencyMs: Date.now() - startedAt,
          usage: { inputTokens, outputTokens },
          consentId: consent.id,
          threadId,
          transparency: {
            model: modelId,
            fields: candidateMap.categoriesTouched.concat(crewMap.categoriesTouched),
            entityCount: candidates.length + crew.length,
            piiScrubbedFromInput: scrubbedFromUser,
          },
        },
      });
    }

    writeEvent(res, 'done', {
      model: modelId,
      threadId,
      usage: { inputTokens, outputTokens },
      transparency: {
        model: modelId,
        fields: candidateMap.categoriesTouched.concat(crewMap.categoriesTouched),
        entityCount: candidates.length + crew.length,
        piiScrubbedFromInput: scrubbedFromUser,
      },
    });
    res.end();
  } catch (err) {
    await logAiCall(pool, {
      projectId,
      userId,
      consentId: consent.id,
      processor: 'anthropic',
      model: modelId,
      action: 'stream',
      status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - startedAt,
    });
    writeEvent(res, 'error', { message: err instanceof Error ? err.message : String(err) });
    res.end();
  }
}
