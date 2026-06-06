/**
 * Live Set AI routes — on-set guidance from Claude.
 *
 *   POST /api/live-set/ai/coverage-check     → detect missing coverage before crew wraps
 *   POST /api/live-set/ai/replan-day         → re-optimise remaining shots when running late
 *   POST /api/live-set/ai/continuity-check   → flag wardrobe/prop/eyeline drift between shots
 *   POST /api/live-set/ai/end-of-day         → brief + crew message draft
 *
 * Same auth/audit contract as read-through-ai-routes.ts: caller passes
 * projectId; every call goes through logAiCall + requireActiveConsent
 * (Anthropic, full_context). Bearer-Auth via requireAuth middleware.
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

// ──────────────────────────── Shared shapes ────────────────────────────

const shotShape = z.object({
  id: z.string().min(1),
  shotType: z.string().optional(),
  cameraAngle: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  estimatedTime: z.number().optional(),
  completedAt: z.string().optional(),
});

const sceneShape = z.object({
  id: z.string().optional(),
  sceneNumber: z.union([z.string(), z.number()]).optional(),
  heading: z.string().optional(),
  description: z.string().optional(),
  intExt: z.string().optional(),
  timeOfDay: z.string().optional(),
  characters: z.array(z.string()).optional(),
});

const SEVERITY_LEVELS = ['critical', 'recommended', 'nice-to-have'] as const;
const CONFLICT_SEVERITY = ['critical', 'warning', 'info'] as const;
const CONFLICT_TYPES = ['wardrobe', 'prop', 'screen-direction', 'eyeline', 'time'] as const;
const COVERAGE_STATUS = ['complete', 'gaps', 'critical'] as const;
const CONTINUITY_STATUS = ['clean', 'warnings', 'conflicts'] as const;
const RISK_LEVELS = ['low', 'medium', 'high'] as const;

function clampFromList<const T extends readonly string[]>(
  list: T,
  value: unknown,
  fallback: T[number],
): T[number] {
  if (typeof value === 'string' && (list as readonly string[]).includes(value)) {
    return value as T[number];
  }
  return fallback;
}

// ──────────────────────────── 1. Coverage check ───────────────────────

const coverageBody = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().min(1),
  scene: sceneShape,
  shotsCompleted: z.array(shotShape).default([]),
  plannedShots: z.array(shotShape).default([]),
});

export type CoverageCheckInput = z.infer<typeof coverageBody>;

export interface CoverageCheckResult {
  status: (typeof COVERAGE_STATUS)[number];
  missingCoverage: Array<{
    type: string;
    reason: string;
    severity: (typeof SEVERITY_LEVELS)[number];
  }>;
  summary: string;
}

export function sanitiseCoverage(raw: unknown): CoverageCheckResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawMissing = Array.isArray(r.missingCoverage)
    ? (r.missingCoverage as Record<string, unknown>[])
    : [];
  return {
    status: clampFromList(COVERAGE_STATUS, r.status, 'gaps'),
    summary: typeof r.summary === 'string' ? r.summary : '',
    missingCoverage: rawMissing.map((entry) => ({
      type: typeof entry.type === 'string' ? entry.type : 'unknown',
      reason: typeof entry.reason === 'string' ? entry.reason : '',
      severity: clampFromList(SEVERITY_LEVELS, entry.severity, 'recommended'),
    })),
  };
}

const COVERAGE_SYSTEM_PROMPT = `You are a seasoned on-set script supervisor and DP assistant. Before the crew wraps a scene you verify coverage is complete for the editor.

Return ONE JSON object only, shape:
{
  "status": "complete" | "gaps" | "critical",
  "missingCoverage": [
    { "type": "master|close-up|OTS|reaction|cutaway|insert|<other>", "reason": "why this is needed for this scene", "severity": "critical|recommended|nice-to-have" }
  ],
  "summary": "2 short sentences for the producer"
}

Rules:
- If a scene has dialogue between 2+ characters, OTS or paired singles are usually critical.
- Reaction shots are critical when the scene has emotional turns.
- Inserts/cutaways matter when scene description names specific props/actions.
- Call "critical" only if missing coverage forces a reshoot; otherwise "recommended" or "nice-to-have".`;

function buildCoverageMessage(input: CoverageCheckInput): string {
  const scene = [
    `Scene ${input.scene.sceneNumber ?? ''}: ${input.scene.heading ?? ''}`.trim(),
    `${input.scene.intExt ?? ''} ${input.scene.timeOfDay ?? ''}`.trim(),
    input.scene.description ?? '',
    input.scene.characters?.length ? `Characters: ${input.scene.characters.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const shotLine = (s: z.infer<typeof shotShape>): string => {
    const parts = [
      s.shotType ?? 'shot',
      s.cameraAngle ? `(${s.cameraAngle})` : '',
      s.description ? `— ${s.description}` : '',
      s.notes ? `| notes: ${s.notes}` : '',
    ];
    return `- [${s.id}] ${parts.filter(Boolean).join(' ')}`;
  };

  return [
    'SCENE\n' + scene,
    'SHOTS COMPLETED\n' + (input.shotsCompleted.map(shotLine).join('\n') || '(none)'),
    'SHOTS PLANNED\n' + (input.plannedShots.map(shotLine).join('\n') || '(none)'),
  ].join('\n\n');
}

// ──────────────────────────── 2. Replan day ───────────────────────────

const replanBody = z.object({
  projectId: z.string().uuid(),
  dayId: z.string().min(1),
  shotsCompleted: z.array(shotShape).default([]),
  shotsRemaining: z.array(shotShape.extend({ sceneId: z.string().optional() })).default([]),
  minutesRemaining: z.number().nonnegative(),
  constraints: z
    .object({
      sunsetAt: z.string().optional(),
      locationLockAt: z.string().optional(),
    })
    .optional(),
});

export type ReplanDayInput = z.infer<typeof replanBody>;

export interface ReplanDayResult {
  recommendation: {
    keep: string[];
    combine: Array<{ shotIds: string[]; note: string }>;
    push: Array<{ shotId: string; suggestedPickupNote: string }>;
    drop: Array<{ shotId: string; reasoning: string }>;
  };
  summary: string;
  riskLevel: (typeof RISK_LEVELS)[number];
}

export function sanitiseReplan(raw: unknown, input: ReplanDayInput): ReplanDayResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rec = (r.recommendation ?? {}) as Record<string, unknown>;
  const validIds = new Set(input.shotsRemaining.map((s) => s.id));

  const keep = Array.isArray(rec.keep)
    ? (rec.keep as unknown[]).filter((v): v is string => typeof v === 'string' && validIds.has(v))
    : [];

  const combine = Array.isArray(rec.combine)
    ? (rec.combine as Record<string, unknown>[])
        .map((c) => ({
          shotIds: Array.isArray(c.shotIds)
            ? (c.shotIds as unknown[]).filter(
                (v): v is string => typeof v === 'string' && validIds.has(v),
              )
            : [],
          note: typeof c.note === 'string' ? c.note : '',
        }))
        .filter((c) => c.shotIds.length >= 2)
    : [];

  const push = Array.isArray(rec.push)
    ? (rec.push as Record<string, unknown>[])
        .map((p) => ({
          shotId: typeof p.shotId === 'string' ? p.shotId : '',
          suggestedPickupNote:
            typeof p.suggestedPickupNote === 'string' ? p.suggestedPickupNote : '',
        }))
        .filter((p) => validIds.has(p.shotId))
    : [];

  const drop = Array.isArray(rec.drop)
    ? (rec.drop as Record<string, unknown>[])
        .map((d) => ({
          shotId: typeof d.shotId === 'string' ? d.shotId : '',
          reasoning: typeof d.reasoning === 'string' ? d.reasoning : '',
        }))
        .filter((d) => validIds.has(d.shotId))
    : [];

  return {
    recommendation: { keep, combine, push, drop },
    summary: typeof r.summary === 'string' ? r.summary : '',
    riskLevel: clampFromList(RISK_LEVELS, r.riskLevel, 'medium'),
  };
}

const REPLAN_SYSTEM_PROMPT = `You are a line producer with decades of on-set experience. The crew is behind schedule and you must decide which remaining shots to keep, combine, push to a pickup day, or drop.

Weight decisions by story importance (dialogue beats, character turns, action payoffs) — NOT by how fun they are to shoot.

Return ONE JSON object only, shape:
{
  "recommendation": {
    "keep": ["shotId", ...],
    "combine": [{ "shotIds": ["a","b"], "note": "why these can be one setup" }],
    "push": [{ "shotId": "x", "suggestedPickupNote": "what's needed for the pickup" }],
    "drop": [{ "shotId": "x", "reasoning": "why losing this is acceptable" }]
  },
  "summary": "one paragraph, producer-tone",
  "riskLevel": "low" | "medium" | "high"
}

Rules:
- Every remaining shotId must appear in exactly one of keep/combine/push/drop.
- "drop" should be rare — only for true nice-to-haves.
- If time budget is tight, prefer combine and push over keep.`;

function buildReplanMessage(input: ReplanDayInput): string {
  const shotLine = (s: z.infer<typeof shotShape> & { sceneId?: string }): string => {
    const parts = [
      s.shotType ?? 'shot',
      s.cameraAngle ? `(${s.cameraAngle})` : '',
      s.sceneId ? `scene=${s.sceneId}` : '',
      s.priority ? `priority=${s.priority}` : '',
      s.estimatedTime ? `est=${s.estimatedTime}min` : '',
      s.description ? `— ${s.description}` : '',
    ];
    return `- [${s.id}] ${parts.filter(Boolean).join(' ')}`;
  };

  const cons = input.constraints ?? {};
  const consLines = [
    cons.sunsetAt ? `sunset at ${cons.sunsetAt}` : '',
    cons.locationLockAt ? `location lock at ${cons.locationLockAt}` : '',
  ].filter(Boolean);

  return [
    `MINUTES REMAINING: ${input.minutesRemaining}`,
    consLines.length ? 'CONSTRAINTS\n' + consLines.join('\n') : '',
    'SHOTS COMPLETED (' + input.shotsCompleted.length + ')\n' +
      (input.shotsCompleted.map(shotLine).join('\n') || '(none)'),
    'SHOTS REMAINING\n' +
      (input.shotsRemaining.map(shotLine).join('\n') || '(none)'),
  ]
    .filter(Boolean)
    .join('\n\n');
}

// ──────────────────────────── 3. Continuity check ─────────────────────

const continuityBody = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().min(1),
  newShot: shotShape.extend({ notes: z.string().default('') }),
  previousShots: z.array(shotShape.extend({ notes: z.string().default('') })).default([]),
});

export type ContinuityCheckInput = z.infer<typeof continuityBody>;

export interface ContinuityCheckResult {
  status: (typeof CONTINUITY_STATUS)[number];
  conflicts: Array<{
    type: (typeof CONFLICT_TYPES)[number] | string;
    description: string;
    severity: (typeof CONFLICT_SEVERITY)[number];
    referenceShotIds: string[];
  }>;
}

export function sanitiseContinuity(
  raw: unknown,
  input: ContinuityCheckInput,
): ContinuityCheckResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const validIds = new Set([input.newShot.id, ...input.previousShots.map((s) => s.id)]);
  const conflictsRaw = Array.isArray(r.conflicts)
    ? (r.conflicts as Record<string, unknown>[])
    : [];
  const conflicts = conflictsRaw.map((c) => ({
    type: typeof c.type === 'string' ? c.type : 'unknown',
    description: typeof c.description === 'string' ? c.description : '',
    severity: clampFromList(CONFLICT_SEVERITY, c.severity, 'warning'),
    referenceShotIds: Array.isArray(c.referenceShotIds)
      ? (c.referenceShotIds as unknown[]).filter(
          (v): v is string => typeof v === 'string' && validIds.has(v),
        )
      : [],
  }));

  let status: ContinuityCheckResult['status'] = 'clean';
  if (conflicts.some((c) => c.severity === 'critical')) status = 'conflicts';
  else if (conflicts.length > 0) status = 'warnings';

  return { status, conflicts };
}

const CONTINUITY_SYSTEM_PROMPT = `You are an experienced script supervisor catching continuity drift before editorial does.

Compare the NEW shot notes to PREVIOUS shots from the same scene. Flag anything that would break continuity.

Return ONE JSON object only, shape:
{
  "conflicts": [
    {
      "type": "wardrobe" | "prop" | "screen-direction" | "eyeline" | "time",
      "description": "specifically what differs, citing shot ids",
      "severity": "critical" | "warning" | "info",
      "referenceShotIds": ["shotId", ...]
    }
  ]
}

Rules:
- severity "critical" = will require reshoot/VFX to fix
- severity "warning" = visible but defensible in edit
- severity "info" = might be worth a note for the DIT log
- If nothing drifts, return { "conflicts": [] }
- Only cite shot ids that actually appear in the input.`;

function buildContinuityMessage(input: ContinuityCheckInput): string {
  const shotBlock = (s: z.infer<typeof shotShape> & { notes: string }): string => {
    return `[${s.id}] ${s.shotType ?? ''} ${s.cameraAngle ?? ''}\n  description: ${s.description ?? ''}\n  notes: ${s.notes ?? ''}`.trim();
  };
  return [
    'NEW SHOT\n' + shotBlock(input.newShot),
    'PREVIOUS SHOTS\n' +
      (input.previousShots.map(shotBlock).join('\n\n') || '(none)'),
  ].join('\n\n');
}

// ──────────────────────────── 4. End of day ───────────────────────────

const endOfDayBody = z.object({
  projectId: z.string().uuid(),
  dayId: z.string().min(1),
  shotsCompleted: z.array(shotShape).default([]),
  shotsMissing: z.array(shotShape).default([]),
  crew: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        contact: z.string().optional(),
      }),
    )
    .default([]),
  nextDayFirstCall: z.string().optional(),
  issues: z.array(z.string()).default([]),
});

export type EndOfDayInput = z.infer<typeof endOfDayBody>;

export interface EndOfDayBrief {
  summary: {
    shotsCompleted: number;
    shotsMissing: number;
    highlights: string[];
    concerns: string[];
  };
  tomorrowBrief: {
    priority: string[];
    editorNeeds: string[];
  };
  crewMessageDraft: string;
}

export function sanitiseEndOfDay(raw: unknown, input: EndOfDayInput): EndOfDayBrief {
  const r = (raw ?? {}) as Record<string, unknown>;
  const summary = (r.summary ?? {}) as Record<string, unknown>;
  const tomorrow = (r.tomorrowBrief ?? {}) as Record<string, unknown>;
  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  return {
    summary: {
      shotsCompleted: input.shotsCompleted.length,
      shotsMissing: input.shotsMissing.length,
      highlights: asStringArray(summary.highlights),
      concerns: asStringArray(summary.concerns),
    },
    tomorrowBrief: {
      priority: asStringArray(tomorrow.priority),
      editorNeeds: asStringArray(tomorrow.editorNeeds),
    },
    crewMessageDraft: typeof r.crewMessageDraft === 'string' ? r.crewMessageDraft : '',
  };
}

const END_OF_DAY_SYSTEM_PROMPT = `You are a 1st AD writing the end-of-day brief after wrap. Be concrete, producer-tone, and never invent details that aren't in the input.

Return ONE JSON object only, shape:
{
  "summary": {
    "shotsCompleted": <number>,
    "shotsMissing": <number>,
    "highlights": ["2-4 short bullets of what went well"],
    "concerns": ["2-4 short bullets of issues/risks"]
  },
  "tomorrowBrief": {
    "priority": ["top 3-5 tomorrow in shooting order"],
    "editorNeeds": ["what editor needs delivered tonight"]
  },
  "crewMessageDraft": "a Slack/SMS-ready message, 2-4 short lines, friendly tone, ending with the next call time if provided"
}`;

function buildEndOfDayMessage(input: EndOfDayInput): string {
  const shotLine = (s: z.infer<typeof shotShape>) =>
    `- [${s.id}] ${s.shotType ?? ''} ${s.description ?? ''}`.trim();
  const sections = [
    `DAY ${input.dayId}`,
    input.nextDayFirstCall ? `NEXT CALL: ${input.nextDayFirstCall}` : '',
    `COMPLETED (${input.shotsCompleted.length})\n` +
      (input.shotsCompleted.map(shotLine).join('\n') || '(none)'),
    `MISSING (${input.shotsMissing.length})\n` +
      (input.shotsMissing.map(shotLine).join('\n') || '(none)'),
    input.issues.length ? 'ISSUES\n' + input.issues.map((i) => '- ' + i).join('\n') : '',
    input.crew.length
      ? 'CREW\n' +
        input.crew
          .map((c) => `- ${c.name}${c.role ? ` (${c.role})` : ''}`)
          .join('\n')
      : '',
  ].filter(Boolean);
  return sections.join('\n\n');
}

// ──────────────────────────── Router factory ──────────────────────────

export interface CreateLiveSetAiRouterDeps {
  activeSessions?: Map<string, SessionData>;
  callClaude?: typeof callClaudeForJson;
}

export function createLiveSetAiRouter(
  pool: Pool,
  deps: CreateLiveSetAiRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);
  const limit = aiRateLimit({ windowMs: 60_000, max: 20, label: 'Live-set AI' });
  const call = deps.callClaude ?? callClaudeForJson;

  const model = (): string =>
    process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || 'claude-sonnet-4-5';

  const runRoute = async <Input extends { projectId: string }, Output>(
    req: Request,
    res: Response,
    action: string,
    parse: z.ZodSafeParseResult<Input>,
    systemPrompt: string,
    buildMessage: (input: Input) => string,
    sanitise: (raw: unknown, input: Input) => Output,
    fieldCategories: string[],
  ): Promise<void> => {
    if (!parse.success) {
      res.status(400).json({ error: 'invalid_request', details: parse.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const input = parse.data;

    // GDPR Art. 6.1a — verify active consent for Anthropic at full_context
    // scope before any scene/shot/crew data crosses to Claude.
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
          model: model(),
          action,
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
        cachedSystem: systemPrompt,
        userMessage: buildMessage(input),
        maxTokens: 2048,
      });
      const data = sanitise(result.data, input);
      void logAiCall(pool, {
        projectId: input.projectId,
        userId,
        consentId,
        processor: 'anthropic',
        model: result.model,
        action,
        status: 'ok',
        promptTokens: result.usage.inputTokens,
        completionTokens: result.usage.outputTokens,
        totalTokens: result.usage.inputTokens + result.usage.outputTokens,
        latencyMs: result.latencyMs,
        fieldCategories,
      });
      res.json({ success: true, data });
    } catch (error) {
      const code = error instanceof ClaudeJsonParseError ? 'claude_parse_error' : 'claude_error';
      void logAiCall(pool, {
        projectId: input.projectId,
        userId,
        consentId,
        processor: 'anthropic',
        model: model(),
        action,
        status: 'error',
        errorCode: code,
        errorMessage: (error as Error).message,
      });
      res.status(500).json({ error: code, message: (error as Error).message });
    }
  };

  router.post('/coverage-check', auth, limit, (req, res) =>
    runRoute(
      req,
      res,
      'live_set.coverage_check',
      coverageBody.safeParse(req.body),
      COVERAGE_SYSTEM_PROMPT,
      buildCoverageMessage,
      sanitiseCoverage,
      ['scene.description', 'shot.notes'],
    ),
  );

  router.post('/replan-day', auth, limit, (req, res) =>
    runRoute(
      req,
      res,
      'live_set.replan_day',
      replanBody.safeParse(req.body),
      REPLAN_SYSTEM_PROMPT,
      buildReplanMessage,
      sanitiseReplan,
      ['shot.description', 'shot.notes', 'schedule'],
    ),
  );

  router.post('/continuity-check', auth, limit, (req, res) =>
    runRoute(
      req,
      res,
      'live_set.continuity_check',
      continuityBody.safeParse(req.body),
      CONTINUITY_SYSTEM_PROMPT,
      buildContinuityMessage,
      sanitiseContinuity,
      ['shot.notes', 'shot.description'],
    ),
  );

  router.post('/end-of-day', auth, limit, (req, res) =>
    runRoute(
      req,
      res,
      'live_set.end_of_day',
      endOfDayBody.safeParse(req.body),
      END_OF_DAY_SYSTEM_PROMPT,
      buildEndOfDayMessage,
      sanitiseEndOfDay,
      ['shot.description', 'crew.names', 'schedule'],
    ),
  );

  return router;
}
