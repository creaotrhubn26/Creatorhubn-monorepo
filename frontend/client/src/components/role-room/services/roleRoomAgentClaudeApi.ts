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
  threadId?: string | null;
  transparency: {
    model: string;
    fields: string[];
    entityCount: number;
    piiScrubbedFromInput: { emails: number; phones: number };
  };
}

export interface RoleRoomAgentThread {
  id: string;
  projectId: string;
  userId: string;
  title: string | null;
  createdAt: string;
  lastActiveAt: string;
  archivedAt: string | null;
}

export interface RoleRoomAgentStoredMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  response: RoleRoomAgentResponse | null;
  createdAt: string;
}

export interface RoleRoomAgentErrorShape {
  code:
    | 'agent_disabled'
    | 'missing_consent'
    | 'wrong_scope'
    | 'entity_excluded'
    | 'entitlement_required'
    | 'rate_limit_exceeded'
    | 'agent_failed'
    | 'http_error';
  detail: string;
  httpStatus: number;
  /** Populated on 402 entitlement_required responses. */
  entitlement?: unknown;
}

export class RoleRoomAgentClaudeError extends Error {
  code: RoleRoomAgentErrorShape['code'];
  httpStatus: number;
  detail: string;
  entitlement?: unknown;
  constructor(shape: RoleRoomAgentErrorShape) {
    super(shape.detail);
    this.name = 'RoleRoomAgentClaudeError';
    this.code = shape.code;
    this.httpStatus = shape.httpStatus;
    this.detail = shape.detail;
    this.entitlement = shape.entitlement;
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
  threadId?: string | null;
  persistThread?: boolean;
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
        threadId: input.threadId ?? null,
        persistThread: input.persistThread ?? true,
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

export async function listAgentThreads(projectId: string, includeArchived = false): Promise<RoleRoomAgentThread[]> {
  const qs = new URLSearchParams();
  if (includeArchived) qs.set('includeArchived', 'true');
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/agent/threads${qs.size ? `?${qs}` : ''}`,
    { headers: buildHeaders() },
  );
  if (!response.ok) return [];
  const body = await response.json();
  return Array.isArray(body.threads) ? body.threads : [];
}

export async function getAgentThread(
  projectId: string,
  threadId: string,
): Promise<{ thread: RoleRoomAgentThread; messages: RoleRoomAgentStoredMessage[] } | null> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/agent/threads/${encodeURIComponent(threadId)}`,
    { headers: buildHeaders() },
  );
  if (!response.ok) return null;
  const body = await response.json();
  return {
    thread: body.thread,
    messages: Array.isArray(body.messages) ? body.messages : [],
  };
}

export async function archiveAgentThread(projectId: string, threadId: string): Promise<boolean> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/agent/threads/${encodeURIComponent(threadId)}`,
    { method: 'DELETE', headers: buildHeaders() },
  );
  return response.ok;
}

export async function renameAgentThread(
  projectId: string,
  threadId: string,
  title: string,
): Promise<boolean> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/agent/threads/${encodeURIComponent(threadId)}`,
    {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify({ title }),
    },
  );
  return response.ok;
}

export interface AgentStreamEvents {
  onStart?: (payload: { model: string; threadId: string | null }) => void;
  onDelta?: (chunk: string) => void;
  onDone?: (payload: {
    model: string;
    threadId: string | null;
    usage: { inputTokens: number; outputTokens: number };
    transparency: RoleRoomAgentResponse['transparency'];
  }) => void;
  onError?: (message: string) => void;
}

/**
 * Streams an agent response via SSE-style POST. Returns a promise that
 * resolves when the stream completes. Caller can abort via AbortSignal.
 */
export async function streamAgentQuery(
  input: {
    projectId: string;
    userMessage: string;
    requiredScope?: RoleRoomAgentScope;
    context?: RoleRoomAgentContext;
    threadId?: string | null;
    persistThread?: boolean;
  },
  events: AgentStreamEvents,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/agent/stream`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        userMessage: input.userMessage,
        requiredScope: input.requiredScope ?? 'brief_only',
        context: input.context ?? {},
        threadId: input.threadId ?? null,
        persistThread: input.persistThread ?? true,
      }),
      signal,
    },
  );

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let parsed: { error?: string; detail?: string } | null = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    const code = (parsed?.error ?? 'http_error') as RoleRoomAgentErrorShape['code'];
    const detail = parsed?.detail ?? parsed?.error ?? (raw || `HTTP ${response.status}`);
    throw new RoleRoomAgentClaudeError({
      code,
      detail,
      httpStatus: response.status,
      entitlement: (parsed as any)?.entitlement,
    });
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body for stream');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  // Simple SSE parser: accumulate until `\n\n` separator, then parse the
  // `event:` + `data:` fields.
  const dispatch = (rawBlock: string) => {
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of rawBlock.split('\n')) {
      if (line.startsWith('event: ')) eventName = line.slice(7).trim();
      else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
    }
    if (dataLines.length === 0) return;
    let payload: any;
    try {
      payload = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }
    if (eventName === 'start') events.onStart?.(payload);
    else if (eventName === 'delta') events.onDelta?.(payload.text ?? '');
    else if (eventName === 'done') events.onDone?.(payload);
    else if (eventName === 'error') events.onError?.(payload.message ?? 'stream_error');
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sepIndex: number;
    while ((sepIndex = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      if (block.trim().length === 0) continue;
      dispatch(block);
    }
  }
  if (buffer.trim().length > 0) dispatch(buffer);
}
