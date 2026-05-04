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

/**
 * Posts a tool-execution audit row. Fire-and-forget — never throws so a
 * logging failure can't mask a successful tool execution. Use this after
 * the user confirms a tool_use and the resulting write either succeeds
 * or fails.
 */
export async function logAgentToolResult(input: {
  projectId: string;
  toolName: string;
  toolUseId?: string | null;
  status: 'ok' | 'error' | 'invalid_input';
  errorMessage?: string;
}): Promise<void> {
  try {
    await fetch(
      `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/agent/tool-result`,
      {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          toolName: input.toolName,
          toolUseId: input.toolUseId ?? null,
          status: input.status,
          errorMessage: input.errorMessage ?? null,
        }),
      },
    );
  } catch {
    /* audit failures are advisory */
  }
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
  onToolUse?: (tool: RoleRoomAgentToolUse) => void;
  onDone?: (payload: {
    model: string;
    threadId: string | null;
    usage: { inputTokens: number; outputTokens: number };
    toolUses?: RoleRoomAgentToolUse[];
    transparency: RoleRoomAgentResponse['transparency'];
  }) => void;
  onError?: (message: string) => void;
}

export type MerchMockupProductId =
  | 'tshirt'
  | 'hoodie'
  | 'polo'
  | 'cap'
  | 'totebag'
  | 'mug';

export interface MerchMockupResult {
  mockupUrl: string;
  cached: boolean;
  productLabel: string;
}

export interface MerchMockupErrorShape {
  code:
    | 'mockup_provider_unconfigured'
    | 'invalid_product'
    | 'invalid_design_url'
    | 'mockup_generation_failed';
  detail: string;
  httpStatus: number;
}

export class MerchMockupError extends Error {
  code: MerchMockupErrorShape['code'];
  httpStatus: number;
  detail: string;
  constructor(shape: MerchMockupErrorShape) {
    super(shape.detail);
    this.name = 'MerchMockupError';
    this.code = shape.code;
    this.httpStatus = shape.httpStatus;
    this.detail = shape.detail;
  }
}

/**
 * Generate a Printful-rendered mockup for the given product +
 * customer-logo URL. Synchronous from the caller's perspective; the
 * backend polls Printful internally for up to 30s.
 */
export async function generateMerchMockup(input: {
  projectId: string;
  productId: MerchMockupProductId;
  designImageUrl: string;
}): Promise<MerchMockupResult> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/agent/merch-mockup`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        productId: input.productId,
        designImageUrl: input.designImageUrl,
      }),
    },
  );
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let parsed: { error?: string; detail?: string } | null = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    throw new MerchMockupError({
      code: (parsed?.error ?? 'mockup_generation_failed') as MerchMockupErrorShape['code'],
      detail: parsed?.detail ?? `HTTP ${response.status}`,
      httpStatus: response.status,
    });
  }
  return (await response.json()) as MerchMockupResult;
}

export type MerchPartnerType = 'sportsklubb' | 'event' | 'skole' | 'forening' | 'bedrift';
export type MerchDealType =
  | 'sponsor'
  | 'kit_supplier'
  | 'cross_promo'
  | 'give_away'
  | 'long_term_partnership';

export interface MerchCooperationDraft {
  generatedAt: string;
  model: string;
  dealHeadline: string;
  openingPitch: string;
  weProposeToOffer: string[];
  theyOffer: string[];
  commercialFraming: string;
  draftAgreementParagraphs: string[];
  riskNotes: string[];
  nextSteps: string[];
}

export interface MerchCooperationInput {
  projectId: string;
  customerName: string;
  customerIndustry?: string | null;
  customerBriefSummary?: string | null;
  partnerName: string;
  partnerType: MerchPartnerType;
  partnerNotes?: string | null;
  dealType: MerchDealType;
  supplierContext?: {
    name: string;
    techniques: string[];
    productCategories: string[];
  } | null;
}

export class MerchCooperationApiError extends Error {
  code: string;
  httpStatus: number;
  detail: string;
  constructor(opts: { code: string; detail: string; httpStatus: number }) {
    super(opts.detail);
    this.name = 'MerchCooperationApiError';
    this.code = opts.code;
    this.httpStatus = opts.httpStatus;
    this.detail = opts.detail;
  }
}

export async function generateMerchCooperationDraft(
  input: MerchCooperationInput,
): Promise<MerchCooperationDraft> {
  const { projectId, ...body } = input;
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/agent/merch-cooperation`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let parsed: { error?: string; detail?: string } | null = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    throw new MerchCooperationApiError({
      code: parsed?.error ?? 'cooperation_generation_failed',
      detail: parsed?.detail ?? `HTTP ${response.status}`,
      httpStatus: response.status,
    });
  }
  return (await response.json()) as MerchCooperationDraft;
}

// =============================================================================
// Slice 6 — partner discovery + enrichment + customer legal-entity lookup.
// =============================================================================

export interface MerchPartnerCandidate {
  source: 'brreg' | 'google_places';
  organizationNumber?: string | null;
  placeId?: string | null;
  name: string;
  websiteUrl?: string | null;
  formattedAddress?: string | null;
  distanceKm?: number | null;
  naceCode?: string | null;
  naceLabel?: string | null;
  areaMatch?: string | null;
  score: number;
  evidence: string[];
}

export interface MerchPartnerEnrichment {
  candidate: MerchPartnerCandidate;
  brreg?: {
    daglig_leder_navn?: string | null;
    foundedYear?: number | null;
    employeeCount?: number | null;
    statusFlags?: { bankrupt?: boolean; underLiquidation?: boolean };
  };
  website?: {
    title?: string | null;
    metaDescription?: string | null;
    sponsorLine?: string | null;
    memberCountHint?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
  };
  metaPage?: {
    pageId?: string | null;
    pageName?: string | null;
    followersCount?: number | null;
    fanCount?: number | null;
    category?: string | null;
    about?: string | null;
    pageUrl?: string | null;
    verified?: boolean;
  };
  enrichmentSummary: string;
}

export async function discoverPartners(input: {
  projectId: string;
  partnerType: MerchPartnerType;
  customerOrgnr: string;
  areaOverride?: string | null;
}): Promise<{
  candidates: MerchPartnerCandidate[];
  customer: { orgnr: string; name: string; kommunenummer: string | null; businessAddress: string | null };
}> {
  const params = new URLSearchParams();
  params.set('partnerType', input.partnerType);
  params.set('customerOrgnr', input.customerOrgnr);
  if (input.areaOverride) params.set('areaOverride', input.areaOverride);
  const r = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/agent/partner-discovery?${params.toString()}`,
    { headers: buildHeaders() },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function enrichPartnerCandidate(input: {
  projectId: string;
  candidate: MerchPartnerCandidate;
}): Promise<MerchPartnerEnrichment> {
  const r = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/agent/partner-enrichment`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ candidate: input.candidate }),
    },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export interface CustomerLegalEntityCandidate {
  organizationNumber: string;
  name: string;
  registeredAddress: string | null;
  postalCode: string | null;
  postalCity: string | null;
  municipality: string | null;
  municipalityNumber: string | null;
  website: string | null;
  industryCode: { code: string | null; description: string | null };
  score: number;
  matchReasons: string[];
  websiteHostMatch: boolean;
  scrapedFromBrandWebsite: boolean;
}

export async function findCustomerLegalEntities(input: {
  projectId: string;
  brandName: string;
  websiteUrl?: string | null;
  municipalityNumber?: string | null;
}): Promise<{ candidates: CustomerLegalEntityCandidate[] }> {
  const params = new URLSearchParams();
  if (input.brandName) params.set('brand', input.brandName);
  if (input.websiteUrl) params.set('website', input.websiteUrl);
  if (input.municipalityNumber) params.set('kommunenummer', input.municipalityNumber);
  const r = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/agent/legal-entity-candidates?${params.toString()}`,
    { headers: buildHeaders() },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// Slice 7b — send + log merch-partner emails through the existing
// Gmail SMTP transport, BCC the producer.

export interface SendMerchPartnerEmailInput {
  projectId: string;
  partnerOrgnr?: string | null;
  partnerName: string;
  partnerEmail: string;
  producerCcEmail?: string | null;
  subject: string;
  bodyMarkdown: string;
  replyToEmail?: string | null;
}

export interface SendMerchPartnerEmailResult {
  ok: boolean;
  messageId: string | null;
  reason?: string;
  loggedRowId?: string;
}

export async function sendMerchPartnerEmail(
  input: SendMerchPartnerEmailInput,
): Promise<SendMerchPartnerEmailResult> {
  const { projectId, ...body } = input;
  const r = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/agent/merch-partner-email/send`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    },
  );
  if (!r.ok) {
    const raw = await r.text().catch(() => '');
    let parsed: { error?: string } | null = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
    return { ok: false, messageId: null, reason: parsed?.error ?? `HTTP ${r.status}` };
  }
  return r.json();
}

export interface MerchPartnerEmailLogEntry {
  id: string;
  projectId: string;
  partnerOrgnr: string | null;
  partnerName: string;
  partnerEmail: string;
  ccEmail: string | null;
  subject: string;
  bodyMarkdown: string;
  status: string;
  gmailMessageId: string | null;
  errorMessage: string | null;
  sentByUserId: string | null;
  sentAt: string;
}

export async function listMerchPartnerEmailHistory(input: {
  projectId: string;
  partnerOrgnr?: string | null;
  limit?: number;
}): Promise<{ entries: MerchPartnerEmailLogEntry[] }> {
  const params = new URLSearchParams();
  if (input.partnerOrgnr) params.set('partnerOrgnr', input.partnerOrgnr);
  if (input.limit) params.set('limit', String(input.limit));
  const qs = params.toString();
  const r = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/agent/merch-partner-email/history${qs ? `?${qs}` : ''}`,
    { headers: buildHeaders() },
  );
  if (!r.ok) return { entries: [] };
  return r.json();
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
    else if (eventName === 'tool_use') {
      if (payload && typeof payload.id === 'string' && typeof payload.name === 'string') {
        events.onToolUse?.({
          id: payload.id,
          name: payload.name,
          input: (payload.input ?? {}) as Record<string, unknown>,
        });
      }
    }
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
