/**
 * HTTP client for the Claude-backed Role Room Agent.
 *
 * All requests flow through `/api/role-room/projects/:projectId/agent/query`
 * which runs consent gating, PII pseudonymization and audit logging on the
 * backend before calling Anthropic. The frontend must never hit Anthropic
 * directly.
 */

import authSessionService from './authSessionService';

const API_BASE = '/api/role-room';

export type RoleRoomAgentScope = 'brief_only' | 'brief_and_reviews' | 'full_context';
export type RoleRoomAgentAction = 'query' | 'summarize_brief' | 'suggest_next_decision';

export interface RoleRoomAgentCandidate {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
}

export interface RoleRoomAgentContext {
  briefSummary?: string;
  openReviews?: Array<{ id: string; title: string; status: string }>;
  timelineHighlights?: Array<{
    id: string;
    title: string;
    phase: string;
    status: string;
    dueAt?: string | null;
  }>;
  candidates?: RoleRoomAgentCandidate[];
  crew?: RoleRoomAgentCandidate[];
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
}

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
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
  consentId: string;
  transparency: {
    model: string;
    fields: string[];
    entityCount: number;
    piiScrubbedFromInput: { emails: number; phones: number };
  };
}

export interface RoleRoomAgentErrorShape {
  code:
    | 'agent_disabled'
    | 'missing_consent'
    | 'wrong_scope'
    | 'entity_excluded'
    | 'agent_failed'
    | 'http_error';
  detail: string;
  httpStatus: number;
}

export class RoleRoomAgentClaudeError extends Error {
  code: RoleRoomAgentErrorShape['code'];
  httpStatus: number;
  detail: string;
  constructor(shape: RoleRoomAgentErrorShape) {
    super(shape.detail);
    this.name = 'RoleRoomAgentClaudeError';
    this.code = shape.code;
    this.httpStatus = shape.httpStatus;
    this.detail = shape.detail;
  }
}

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const sessionHeaders = authSessionService.getAuthHeadersSync?.() ?? {};
  Object.assign(headers, sessionHeaders);
  const session = authSessionService.getSessionSync?.();
  const userId = session?.currentUserId;
  if (typeof userId === 'string' && userId.trim().length > 0) {
    headers['x-role-room-user-id'] = userId.trim();
  }
  return headers;
}

export async function postAgentQuery(input: {
  projectId: string;
  userMessage: string;
  requiredScope?: RoleRoomAgentScope;
  action?: RoleRoomAgentAction;
  context?: RoleRoomAgentContext;
}): Promise<RoleRoomAgentResponse> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/agent/query`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        userMessage: input.userMessage,
        requiredScope: input.requiredScope ?? 'brief_only',
        action: input.action ?? 'query',
        context: input.context ?? {},
      }),
    },
  );

  if (!response.ok) {
    const rawBody = await response.text().catch(() => '');
    let parsed: { error?: string; detail?: string } | null = null;
    if (rawBody) {
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        parsed = null;
      }
    }
    const code = (parsed?.error ?? 'http_error') as RoleRoomAgentErrorShape['code'];
    const detail = parsed?.detail ?? parsed?.error ?? (rawBody || `HTTP ${response.status}`);
    throw new RoleRoomAgentClaudeError({
      code,
      detail,
      httpStatus: response.status,
    });
  }

  return (await response.json()) as RoleRoomAgentResponse;
}
