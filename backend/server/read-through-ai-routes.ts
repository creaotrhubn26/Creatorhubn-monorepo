/**
 * Read Through AI routes.
 *
 * POST /api/ai/read-through/analyze
 *   → Claude-driven pre-pass for script read-throughs. Returns a scene
 *     brief + per-line delivery hints + voice casting suggestions. TTS
 *     consumes the delivery strings as voice "instructions" so the
 *     playback sounds like acting, not narration.
 *
 * Consent + audit: caller passes projectId. The route records every call
 * in role_room_ai_audit_log via logAiCall() og blokkerer mot
 * requireActiveConsent(anthropic, full_context) før Claude-call.
 * Bearer-Auth via requireAuth middleware.
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { loadPersistedAuthSession } from './auth-session-store.js';
import { callClaudeForJson, ClaudeJsonParseError } from './claude-json-helper.js';
import { logAiCall } from './role-room-ai-audit.js';
import { aiRateLimit } from './ai-rate-limiter.js';
import { requireActiveConsent, RoleRoomAiConsentError } from './role-room-ai-consent.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

type AuthedRequest = Request & { userId: string };

async function resolveUser(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  bearer: string | null | undefined,
): Promise<SessionData | null> {
  const token = typeof bearer === 'string' ? bearer.trim() : '';
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) {
    activeSessions?.set(token, persisted);
    return persisted;
  }
  return null;
}

function requireAuth(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    const session = await resolveUser(pool, activeSessions, bearer);
    if (!session?.userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    (req as AuthedRequest).userId = session.userId;
    next();
  };
}

const TTS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
const EMPHASIS_LEVELS = ['low', 'normal', 'high'] as const;

const analyzeBody = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().min(1),
  scene: z.object({
    sceneNumber: z.union([z.string(), z.number()]).optional(),
    heading: z.string().optional(),
    locationName: z.string().optional(),
    intExt: z.string().optional(),
    timeOfDay: z.string().optional(),
    description: z.string().optional(),
    characters: z.array(z.string()).optional(),
  }),
  dialogueLines: z
    .array(
      z.object({
        id: z.string().min(1),
        characterName: z.string().min(1),
        dialogueText: z.string().min(1),
        parenthetical: z.string().optional(),
        emotionTag: z.string().optional(),
      }),
    )
    .min(1)
    .max(200),
  characters: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        ageRange: z.string().optional(),
      }),
    )
    .default([]),
});

export type ReadThroughAnalyzeInput = z.infer<typeof analyzeBody>;

export interface ReadThroughAnalysis {
  sceneBrief: {
    logline: string;
    emotionalArc: string;
    conflict: string;
    beats: string[];
  };
  lines: Array<{
    lineId: string;
    subtext: string;
    emphasis: (typeof EMPHASIS_LEVELS)[number];
    pauseBefore: number;
    delivery: string;
  }>;
  voiceCasting: Array<{
    characterName: string;
    suggestedVoice: (typeof TTS_VOICES)[number];
    reasoning: string;
  }>;
}

function clampEmphasis(value: unknown): (typeof EMPHASIS_LEVELS)[number] {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if ((EMPHASIS_LEVELS as readonly string[]).includes(lower)) {
      return lower as (typeof EMPHASIS_LEVELS)[number];
    }
  }
  return 'normal';
}

function clampVoice(value: unknown): (typeof TTS_VOICES)[number] {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if ((TTS_VOICES as readonly string[]).includes(lower)) {
      return lower as (typeof TTS_VOICES)[number];
    }
  }
  return 'alloy';
}

function clampPause(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5000, Math.round(n)));
}

/**
 * Sanitise the raw Claude JSON so downstream consumers (TTS engine) see
 * only values within known ranges. Claude sometimes returns an extra
 * voice or forgets a line — we still want a stable shape.
 */
export function sanitiseAnalysis(
  raw: unknown,
  input: ReadThroughAnalyzeInput,
): ReadThroughAnalysis {
  const r = (raw ?? {}) as Record<string, unknown>;
  const brief = (r.sceneBrief ?? {}) as Record<string, unknown>;
  const linesRaw = Array.isArray(r.lines) ? (r.lines as Record<string, unknown>[]) : [];
  const castingRaw = Array.isArray(r.voiceCasting)
    ? (r.voiceCasting as Record<string, unknown>[])
    : [];

  const linesById = new Map<string, Record<string, unknown>>();
  for (const entry of linesRaw) {
    const id = typeof entry.lineId === 'string' ? entry.lineId : null;
    if (id) linesById.set(id, entry);
  }

  const lines: ReadThroughAnalysis['lines'] = input.dialogueLines.map((line) => {
    const entry = linesById.get(line.id) ?? {};
    return {
      lineId: line.id,
      subtext: typeof entry.subtext === 'string' ? entry.subtext : '',
      emphasis: clampEmphasis(entry.emphasis),
      pauseBefore: clampPause(entry.pauseBefore),
      delivery: typeof entry.delivery === 'string' ? entry.delivery : '',
    };
  });

  const knownCharacters = new Set(input.characters.map((c) => c.name));
  const seen = new Set<string>();
  const voiceCasting: ReadThroughAnalysis['voiceCasting'] = [];
  for (const entry of castingRaw) {
    const name = typeof entry.characterName === 'string' ? entry.characterName.trim() : '';
    if (!name || seen.has(name)) continue;
    if (knownCharacters.size > 0 && !knownCharacters.has(name)) continue;
    seen.add(name);
    voiceCasting.push({
      characterName: name,
      suggestedVoice: clampVoice(entry.suggestedVoice),
      reasoning: typeof entry.reasoning === 'string' ? entry.reasoning : '',
    });
  }

  return {
    sceneBrief: {
      logline: typeof brief.logline === 'string' ? brief.logline : '',
      emotionalArc: typeof brief.emotionalArc === 'string' ? brief.emotionalArc : '',
      conflict: typeof brief.conflict === 'string' ? brief.conflict : '',
      beats: Array.isArray(brief.beats)
        ? (brief.beats as unknown[]).filter((b): b is string => typeof b === 'string')
        : [],
    },
    lines,
    voiceCasting,
  };
}

const SYSTEM_PROMPT = `You are an experienced script supervisor and voice director preparing a table read for a film production.

Your task: analyse a single scene and produce dramaturgical guidance that a TTS engine and a cast can use for a read-through.

You MUST return a single JSON object — no prose, no code fences — with this exact shape:
{
  "sceneBrief": {
    "logline": "one-sentence summary of what happens in this scene",
    "emotionalArc": "how the tone/tension shifts from start to end",
    "conflict": "what is being fought for or against",
    "beats": ["3-5 beat descriptions in order"]
  },
  "lines": [
    {
      "lineId": "<echo back the lineId from input>",
      "subtext": "what the character actually means beneath the words",
      "emphasis": "low" | "normal" | "high",
      "pauseBefore": <milliseconds 0-3000>,
      "delivery": "short free-text instructions for TTS voice (e.g. 'quiet, resigned', 'sarcastic with a hint of anger', 'fast, anxious')"
    }
  ],
  "voiceCasting": [
    {
      "characterName": "<exact character name from input>",
      "suggestedVoice": "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      "reasoning": "why this OpenAI voice fits (age, gender, energy)"
    }
  ]
}

Voice guide (OpenAI TTS):
- alloy: neutral, versatile mid-range
- echo: calm, warm male
- fable: expressive, theatrical British
- onyx: deep, authoritative male
- nova: bright, energetic female
- shimmer: soft, gentle female

Cover EVERY dialogue line in the input. Cover EVERY character in the input in voiceCasting. Keep delivery strings short (under 12 words).`;

function buildUserMessage(input: ReadThroughAnalyzeInput): string {
  const sceneLines = [
    `Scene ${input.scene.sceneNumber ?? ''}: ${input.scene.heading ?? ''}`.trim(),
    input.scene.intExt || input.scene.timeOfDay
      ? `${input.scene.intExt ?? ''} ${input.scene.locationName ?? ''} — ${input.scene.timeOfDay ?? ''}`.trim()
      : '',
    input.scene.description ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  const charBlock = input.characters.length
    ? input.characters
        .map((c) =>
          [c.name, c.ageRange ? `(${c.ageRange})` : '', c.description ? `— ${c.description}` : '']
            .filter(Boolean)
            .join(' '),
        )
        .join('\n')
    : 'No character profiles provided; infer from dialogue.';

  const dialogueBlock = input.dialogueLines
    .map((line) => {
      const paren = line.parenthetical ? ` (${line.parenthetical})` : '';
      const emotion = line.emotionTag ? ` [emotion tag: ${line.emotionTag}]` : '';
      return `[${line.id}] ${line.characterName}${paren}${emotion}: ${line.dialogueText}`;
    })
    .join('\n');

  return `SCENE\n${sceneLines}\n\nCHARACTERS\n${charBlock}\n\nDIALOGUE\n${dialogueBlock}`;
}

export interface CreateReadThroughAiRouterDeps {
  activeSessions?: Map<string, SessionData>;
  /** Seam for tests — default calls real Claude. */
  callClaude?: typeof callClaudeForJson;
}

export function createReadThroughAiRouter(
  pool: Pool,
  deps: CreateReadThroughAiRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);
  const limit = aiRateLimit({ windowMs: 60_000, max: 20, label: 'Read-through analyze' });
  const call = deps.callClaude ?? callClaudeForJson;

  router.post('/analyze', auth, limit, async (req: Request, res: Response): Promise<void> => {
    const parsed = analyzeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const input = parsed.data;

    // GDPR Art. 6.1a — every Claude call re-verifies active consent at the
    // project scope. The frontend also gates the UI on aiConsentService, but
    // the server is the source of truth.
    let consentId: string | null = null;
    try {
      const consent = await requireActiveConsent(pool, input.projectId, 'anthropic', 'full_context');
      consentId = consent.id;
    } catch (err) {
      if (err instanceof RoleRoomAiConsentError) {
        void logAiCall(pool, {
          projectId: input.projectId,
          userId,
          processor: 'anthropic',
          model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-5',
          action: 'read_through.analyze',
          status: 'blocked_by_consent',
          errorCode: err.code,
          errorMessage: err.message,
        });
        res.status(403).json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }

    try {
      const result = await call<unknown>({
        cachedSystem: SYSTEM_PROMPT,
        userMessage: buildUserMessage(input),
        maxTokens: 3072,
      });
      const data = sanitiseAnalysis(result.data, input);
      void logAiCall(pool, {
        projectId: input.projectId,
        userId,
        consentId,
        processor: 'anthropic',
        model: result.model,
        action: 'read_through.analyze',
        status: 'ok',
        promptTokens: result.usage.inputTokens,
        completionTokens: result.usage.outputTokens,
        totalTokens: result.usage.inputTokens + result.usage.outputTokens,
        latencyMs: result.latencyMs,
        fieldCategories: ['scene.description', 'dialogue', 'character.profile'],
      });
      res.json({ success: true, data });
    } catch (error) {
      const code = error instanceof ClaudeJsonParseError ? 'claude_parse_error' : 'claude_error';
      void logAiCall(pool, {
        projectId: input.projectId,
        userId,
        consentId,
        processor: 'anthropic',
        model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-5',
        action: 'read_through.analyze',
        status: 'error',
        errorCode: code,
        errorMessage: (error as Error).message,
      });
      res.status(500).json({ error: code, message: (error as Error).message });
    }
  });

  return router;
}
