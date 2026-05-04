/**
 * SSE streaming handler for the Role Room Agent.
 *
 * Streams text deltas live, then emits a `tool_use` event for any tool
 * blocks Claude returns in the same turn. The frontend collects them and
 * surfaces the same per-tool confirmation dialog as the non-streaming
 * /agent/query path. Both endpoints share the consent + pseudonymize +
 * audit pipeline.
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
  ROLE_ROOM_AGENT_TOOLS,
} from './role-room-agent-definition.js';
import { modelIdForTier, pickModelForMessage } from './role-room-agent-cache.js';
import {
  appendMessage,
  createStreamingPlaceholder,
  ensureThread,
  updateStreamingMessage,
} from './role-room-agent-threads.js';
import {
  checkAgentRateLimit,
  RateLimitExceededError,
} from './role-room-agent-ratelimit.js';
import { checkAgentEntitlement } from './role-room-agent-entitlements.js';

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
  userRole?: string | null,
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

  const entitlement = await checkAgentEntitlement(pool, userId, userRole);
  if (!entitlement.allowed) {
    res.status(402).json({
      error: 'entitlement_required',
      detail: entitlement.reason,
      entitlement,
    });
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
        model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-6',
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

  // Pre-create a placeholder assistant message so we can checkpoint the
  // growing stream into it. If the SSE connection drops mid-stream we
  // still have the accumulated text in the thread — the user can scroll
  // back and see what the agent had produced up to the point of failure.
  const streamingMessageId = threadId
    ? await createStreamingPlaceholder(pool, { threadId })
    : null;

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
  let finalToolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
  let streamFinalised = false;
  const startedAt = Date.now();

  // De-pseudonymize a text fragment using the combined assignments.
  const depseudonymize = (value: string): string => {
    let out = value;
    for (const { placeholder, real } of combinedAssignments) {
      const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(escaped, 'g'), real);
    }
    return out;
  };

  // De-pseudonymize string values inside a tool input, recursively. Only
  // strings are touched — numbers/booleans/arrays-of-objects pass through
  // unchanged. The agent's tool inputs are small JSON blobs, so the
  // recursion depth is bounded by the schema.
  const depseudonymizeToolInput = (value: unknown): unknown => {
    if (typeof value === 'string') return depseudonymize(value);
    if (Array.isArray(value)) return value.map(depseudonymizeToolInput);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = depseudonymizeToolInput(v);
      }
      return out;
    }
    return value;
  };

  // Throttle checkpoint writes so we don't hammer the DB on every token.
  // 1.5 s cadence is enough to survive a dropped connection while keeping
  // write amplification bounded (~0.5% of token throughput).
  const CHECKPOINT_INTERVAL_MS = 1500;
  let lastCheckpointAt = 0;
  let checkpointInFlight = false;
  const maybeCheckpoint = () => {
    if (!streamingMessageId) return;
    const now = Date.now();
    if (now - lastCheckpointAt < CHECKPOINT_INTERVAL_MS) return;
    if (checkpointInFlight) return;
    lastCheckpointAt = now;
    checkpointInFlight = true;
    void updateStreamingMessage(pool, {
      messageId: streamingMessageId,
      text: accumulatedText,
      partial: true,
    }).finally(() => {
      checkpointInFlight = false;
    });
  };

  // If the client disconnects (tab closed, laptop lid, proxy timeout) we
  // still want the partial text persisted. Node's Express surfaces this
  // via the 'close' event on the response's underlying socket. Skip if
  // the stream already finalised cleanly (the success path persists the
  // full payload itself).
  req.on('close', () => {
    if (streamFinalised) return;
    if (streamingMessageId) {
      void updateStreamingMessage(pool, {
        messageId: streamingMessageId,
        text: accumulatedText,
        partial: true,
      });
      return;
    }
    // Placeholder creation never returned an id but we still have a
    // thread — flush the partial text into a fresh assistant row so the
    // user can scroll back and see what they got before the drop.
    if (threadId && accumulatedText.length > 0) {
      void appendMessage(pool, {
        threadId,
        role: 'assistant',
        text: accumulatedText,
        response: { streaming: true, partial: true, droppedConnection: true },
      });
    }
  });

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
      tools: ROLE_ROOM_AGENT_TOOLS,
      messages: [{ role: 'user', content: pseudonymizedMessage }],
    });

    stream.on('text', (delta: string) => {
      // De-pseudonymize deltas inline so the user sees real names in the
      // live stream, not {{candidate_1}} placeholders.
      const out = depseudonymize(delta);
      accumulatedText += out;
      writeEvent(res, 'delta', { text: out });
      maybeCheckpoint();
    });

    const finalMessage = await stream.finalMessage();
    inputTokens = finalMessage?.usage?.input_tokens ?? 0;
    outputTokens = finalMessage?.usage?.output_tokens ?? 0;

    // Extract tool_use blocks from the final message. Anthropic returns
    // these alongside any text the agent produced before deciding to
    // call a tool — the text part is already streamed above.
    for (const block of finalMessage?.content ?? []) {
      if (block?.type === 'tool_use') {
        finalToolUses.push({
          id: String(block.id),
          name: String(block.name),
          input: depseudonymizeToolInput(block.input ?? {}) as Record<string, unknown>,
        });
      }
    }
    // Surface each tool the moment the model chose it so the frontend
    // can render the confirmation buttons immediately, even if the
    // `done` event is delayed by the audit/persistence work below.
    for (const tool of finalToolUses) {
      writeEvent(res, 'tool_use', tool);
    }

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
        ...finalToolUses.map((t) => `proposed_tool:${t.name}`),
      ],
      entityCount: candidates.length + crew.length,
      emailsScrubbed: scrubbedFromUser.emails,
      phonesScrubbed: scrubbedFromUser.phones,
    });

    // Finalize the checkpoint: flip partial=false and write the full
    // transparency payload so the thread row matches the non-streaming shape.
    if (streamingMessageId) {
      void updateStreamingMessage(pool, {
        messageId: streamingMessageId,
        text: accumulatedText,
        partial: false,
        response: {
          text: accumulatedText,
          toolUses: finalToolUses,
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
    } else if (threadId) {
      // Fallback path: placeholder creation failed but thread exists.
      void appendMessage(pool, {
        threadId,
        role: 'assistant',
        text: accumulatedText,
        response: {
          text: accumulatedText,
          toolUses: finalToolUses,
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
      toolUses: finalToolUses,
      transparency: {
        model: modelId,
        fields: candidateMap.categoriesTouched.concat(crewMap.categoriesTouched),
        entityCount: candidates.length + crew.length,
        piiScrubbedFromInput: scrubbedFromUser,
      },
    });
    streamFinalised = true;
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
    // On error, flush whatever text we have into the placeholder so the
    // thread reflects what the user actually saw in the browser.
    if (streamingMessageId) {
      void updateStreamingMessage(pool, {
        messageId: streamingMessageId,
        text: accumulatedText,
        partial: true,
        response: {
          text: accumulatedText,
          toolUses: finalToolUses,
          model: modelId,
          latencyMs: Date.now() - startedAt,
          usage: { inputTokens, outputTokens },
          consentId: consent.id,
          threadId,
          error: err instanceof Error ? err.message : String(err),
        } as unknown,
      });
    }
    writeEvent(res, 'error', { message: err instanceof Error ? err.message : String(err) });
    streamFinalised = true;
    res.end();
  }
}
