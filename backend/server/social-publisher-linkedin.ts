/**
 * LinkedIn publisher backed by the versioned Marketing Posts API.
 *
 * Provider contract (202608):
 * - POST /rest/posts
 * - POST /rest/images?action=initializeUpload plus signed PUT
 * - POST /rest/videos?action=initializeUpload, multipart PUT, finalizeUpload
 * - GET /rest/organizationAcls and /rest/organizations/{id}
 *
 * Personal publishing is global-only. Organization publishing prefers a
 * project-scoped connection and safely falls back to the global connection.
 */

import crypto from "node:crypto";
import type { Pool } from "pg";
import type {
  FetchInsightsInput,
  MetricSnapshot,
  PublishResult,
  SocialMediaKind,
  SocialPlatform,
  SocialPostInput,
  SocialPublisher,
} from "./social-publisher.js";
import { registerPublisher } from "./social-publisher.js";
import {
  LINKEDIN_REST_BASE,
  linkedInRestHeaders,
} from "./linkedin-api-version.js";

const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_POSTS_ENDPOINT = LINKEDIN_REST_BASE + "/posts";
const LINKEDIN_IMAGES_INITIALIZE_ENDPOINT =
  LINKEDIN_REST_BASE + "/images?action=initializeUpload";
const LINKEDIN_VIDEOS_INITIALIZE_ENDPOINT =
  LINKEDIN_REST_BASE + "/videos?action=initializeUpload";
const LINKEDIN_VIDEOS_FINALIZE_ENDPOINT =
  LINKEDIN_REST_BASE + "/videos?action=finalizeUpload";
const LINKEDIN_ORGANIZATION_ACLS_ENDPOINT =
  LINKEDIN_REST_BASE + "/organizationAcls";
const LINKEDIN_ORGANIZATIONS_ENDPOINT =
  LINKEDIN_REST_BASE + "/organizations";

const LINKEDIN_CAPTION_HARD_CAP = 3_000;
// Application limits intentionally sit below LinkedIn's provider maxima.
// They match the durable queue so a crafted direct call cannot allocate a
// multi-gigabyte Buffer before the worker's validation boundary.
const LINKEDIN_IMAGE_BYTES_CAP = 20 * 1024 * 1024;
const LINKEDIN_MULTI_IMAGE_TOTAL_BYTES_CAP = 100 * 1024 * 1024;
const LINKEDIN_VIDEO_BYTES_CAP = 200 * 1024 * 1024;
const LINKEDIN_MULTI_IMAGE_MIN = 2;
const LINKEDIN_MULTI_IMAGE_MAX = 20;

const MEMBER_WRITE_SCOPE = "w_member_social";
const ORGANIZATION_ADMIN_SCOPE = "r_organization_admin";
const ORGANIZATION_WRITE_SCOPE = "w_organization_social";
const ORGANIZATION_PUBLISH_ROLES = new Set([
  "ADMINISTRATOR",
  "CONTENT_ADMIN",
  "CONTENT_ADMINISTRATOR",
  "DIRECT_SPONSORED_CONTENT_POSTER",
]);

export type LinkedInConnectionScope = "project" | "global";
export type LinkedInAuthorMode = "personal" | "company";
export type LinkedInAuthorUrn = string;

interface LinkedInConnectionRow {
  id: string;
  user_id: string;
  project_id: string | null;
  linkedin_member_id: string | null;
  linkedin_email: string | null;
  linkedin_name: string | null;
  access_token_encrypted: string | null;
  expiry_date: Date | string | null;
  scopes: unknown;
  connection_state: string;
  profile: unknown;
  updated_at?: Date | string | null;
}

interface LinkedInConnection {
  id: string;
  userId: string;
  projectId: string | null;
  connectionScope: LinkedInConnectionScope;
  memberId: string | null;
  email: string | null;
  name: string | null;
  accessToken: string;
  expiresAt: string | null;
  scopes: string[];
  profile: Record<string, unknown>;
}

interface LinkedInConnectionCandidates {
  rows: Array<{
    row: LinkedInConnectionRow;
    connectionScope: LinkedInConnectionScope;
  }>;
  valid: LinkedInConnection[];
  queryFailed: boolean;
}

export interface LinkedInConnectionStatus {
  connectionId: string | null;
  connected: boolean;
  scopes: string[];
  expiresAt: string | null;
  publishReady: boolean;
  organizationPublishReady: boolean;
  reconnectRequired: boolean;
  connectionScope: LinkedInConnectionScope | null;
  memberId: string | null;
  name: string | null;
  email: string | null;
  profilePictureUrl: string | null;
}

export interface LinkedInManagedCompany {
  urn: string;
  id: string;
  name: string | null;
  vanityName: string | null;
  logoUrl: string | null;
  role: string;
}

export interface LinkedInManagedCompaniesResult {
  companies: LinkedInManagedCompany[];
  scopeMissing: boolean;
  reconnectRequired: boolean;
  connectionScope: LinkedInConnectionScope | null;
}

export interface LinkedInDirectPublishInput {
  accessToken: string;
  authorUrn: LinkedInAuthorUrn;
  mediaKind: Extract<
    SocialMediaKind,
    "text" | "image" | "carousel" | "video" | "reel" | "link"
  >;
  caption: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  extras?: Record<string, unknown>;
}

interface LinkedInOrgAclElement {
  organization?: string;
  organizationTarget?: string;
  roleAssignee?: string;
  role?: string;
  state?: string;
}

interface LinkedInPostContent {
  media?: {
    id: string;
    title?: string;
    altText?: string;
  };
  multiImage?: {
    images: Array<{
      id: string;
      altText?: string;
    }>;
  };
  article?: {
    source: string;
    title?: string;
    description?: string;
    thumbnail?: string;
  };
}

interface LinkedInPostsPayload {
  author: LinkedInAuthorUrn;
  commentary: string;
  visibility: "PUBLIC";
  distribution: {
    feedDistribution: "MAIN_FEED";
    targetEntities: [];
    thirdPartyDistributionChannels: [];
  };
  lifecycleState: "PUBLISHED";
  isReshareDisabledByAuthor: false;
  content?: LinkedInPostContent;
}

interface ProviderSuccess<T> {
  ok: true;
  status: number;
  value: T;
  raw: unknown;
  headers: Headers;
}

interface ProviderFailure {
  ok: false;
  status: number;
  error: string;
  raw: unknown;
}

type ProviderResult<T> = ProviderSuccess<T> | ProviderFailure;

function isProviderFailure<T>(
  result: ProviderResult<T>,
): result is ProviderFailure {
  return result.ok === false;
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Keep this fallback chain aligned with role-room-routes.ts. The generic
 * GOOGLE_TOKEN_ENCRYPTION_KEY alias is also accepted for older deployments.
 */
function deriveLinkedInEncryptionKey(): Buffer | null {
  const secret = firstNonEmptyString(
    process.env.ROLE_ROOM_LINKEDIN_TOKEN_ENCRYPTION_KEY,
    process.env.ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY,
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
    process.env.SESSION_SECRET,
    process.env.JWT_SECRET,
    process.env.AUTH_SECRET,
  );
  return secret ? crypto.createHash("sha256").update(secret).digest() : null;
}

export function encryptLinkedInToken(value: string): string {
  const key = deriveLinkedInEncryptionKey();
  if (!key) {
    throw new Error("LinkedIn token encryption key mangler");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptLinkedInToken(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const key = deriveLinkedInEncryptionKey();
  if (!key) return null;
  const [version, ivPart, tagPart, encryptedPart] = value.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !encryptedPart) return null;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function normalizeScopes(value: unknown): string[] {
  let candidate = value;
  if (typeof candidate === "string") {
    const raw = candidate;
    try {
      candidate = JSON.parse(raw);
    } catch {
      candidate = raw.split(/[\s,]+/);
    }
  }
  if (!Array.isArray(candidate)) return [];
  return Array.from(
    new Set(
      candidate
        .filter((scope): scope is string => typeof scope === "string")
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeProfile(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Invalid legacy JSON is treated as an empty profile.
    }
  }
  return {};
}

function normalizeExpiry(value: Date | string | null): {
  iso: string | null;
  expired: boolean;
} {
  // OAuth access tokens are time-bound. A legacy row without a verifiable
  // expiry must reconnect instead of being treated as indefinitely valid.
  if (!value) return { iso: null, expired: true };
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(timestamp)) return { iso: null, expired: true };
  return {
    iso: new Date(timestamp).toISOString(),
    expired: timestamp <= Date.now(),
  };
}

function materializeConnection(
  row: LinkedInConnectionRow,
  connectionScope: LinkedInConnectionScope,
): LinkedInConnection | null {
  const token = decryptLinkedInToken(row.access_token_encrypted);
  const expiry = normalizeExpiry(row.expiry_date);
  if (!token || expiry.expired) return null;
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id ?? null,
    connectionScope,
    memberId: firstNonEmptyString(row.linkedin_member_id),
    email: firstNonEmptyString(row.linkedin_email),
    name: firstNonEmptyString(row.linkedin_name),
    accessToken: token,
    expiresAt: expiry.iso,
    scopes: normalizeScopes(row.scopes),
    profile: normalizeProfile(row.profile),
  };
}

async function loadLinkedInConnectionCandidates(
  pool: Pool,
  userId: string,
  options: {
    author: LinkedInAuthorMode;
    projectId?: string | null;
  },
): Promise<LinkedInConnectionCandidates> {
  const projectId = firstNonEmptyString(options.projectId);
  try {
    const projectSql = [
      "SELECT id, user_id, project_id, linkedin_member_id, linkedin_email,",
      "linkedin_name, access_token_encrypted, expiry_date, scopes,",
      "connection_state, profile, updated_at",
      "FROM role_room_linkedin_connections",
      "WHERE user_id = $1",
      "AND (project_id = $2 OR project_id IS NULL)",
      "AND connection_state IN ('connected', 'active')",
      "ORDER BY CASE WHEN project_id = $2 THEN 0 ELSE 1 END,",
      "updated_at DESC NULLS LAST",
      "LIMIT 2",
    ].join(" ");
    const globalSql = [
      "SELECT id, user_id, project_id, linkedin_member_id, linkedin_email,",
      "linkedin_name, access_token_encrypted, expiry_date, scopes,",
      "connection_state, profile, updated_at",
      "FROM role_room_linkedin_connections",
      "WHERE user_id = $1",
      "AND project_id IS NULL",
      "AND connection_state IN ('connected', 'active')",
      "ORDER BY updated_at DESC NULLS LAST",
      "LIMIT 1",
    ].join(" ");
    const result = options.author === "company" && projectId
      ? await pool.query<LinkedInConnectionRow>(projectSql, [userId, projectId])
      : await pool.query<LinkedInConnectionRow>(globalSql, [userId]);

    const rows = result.rows.map((row) => {
      const connectionScope: LinkedInConnectionScope =
        projectId && row.project_id === projectId ? "project" : "global";
      return { row, connectionScope };
    });
    const valid = rows
      .map(({ row, connectionScope }) =>
        materializeConnection(row, connectionScope))
      .filter((entry): entry is LinkedInConnection => Boolean(entry));
    return { rows, valid, queryFailed: false };
  } catch (error) {
    console.warn("[linkedin-publish] connection lookup failed", error);
    return { rows: [], valid: [], queryFailed: true };
  }
}

function hasScopes(connection: LinkedInConnection, required: string[]): boolean {
  return required.every((scope) => connection.scopes.includes(scope));
}

function profilePictureUrl(profile: Record<string, unknown>): string | null {
  return firstNonEmptyString(
    profile.profilePictureUrl,
    profile.picture,
    profile.avatarUrl,
  );
}

/**
 * Token-free status for route/UI use.
 */
export async function getLinkedInConnectionStatusForUser(
  pool: Pool,
  userId: string,
  options: {
    projectId?: string | null;
    author?: LinkedInAuthorMode;
  } = {},
): Promise<LinkedInConnectionStatus> {
  const author = options.author ?? "personal";
  const candidates = await loadLinkedInConnectionCandidates(pool, userId, {
    author,
    projectId: options.projectId,
  });
  const connection = candidates.valid[0] ?? null;
  const fallback = candidates.rows[0] ?? null;
  const source = connection
    ? {
      id: connection.id,
      memberId: connection.memberId,
      email: connection.email,
      name: connection.name,
      scopes: connection.scopes,
      expiresAt: connection.expiresAt,
      profile: connection.profile,
      connectionScope: connection.connectionScope,
    }
    : fallback
      ? {
        id: fallback.row.id,
        memberId: firstNonEmptyString(fallback.row.linkedin_member_id),
        email: firstNonEmptyString(fallback.row.linkedin_email),
        name: firstNonEmptyString(fallback.row.linkedin_name),
        scopes: normalizeScopes(fallback.row.scopes),
        expiresAt: normalizeExpiry(fallback.row.expiry_date).iso,
        profile: normalizeProfile(fallback.row.profile),
        connectionScope: fallback.connectionScope,
      }
      : null;
  const publishReady = Boolean(
    connection
    && connection.memberId
    && hasScopes(connection, [MEMBER_WRITE_SCOPE]),
  );
  const organizationPublishReady = Boolean(
    connection
    && hasScopes(connection, [
      ORGANIZATION_ADMIN_SCOPE,
      ORGANIZATION_WRITE_SCOPE,
    ]),
  );
  const requiredReady =
    author === "company" ? organizationPublishReady : publishReady;
  return {
    connectionId: source?.id ?? null,
    connected: Boolean(connection),
    scopes: source?.scopes ?? [],
    expiresAt: source?.expiresAt ?? null,
    publishReady,
    organizationPublishReady,
    reconnectRequired: Boolean(source && !requiredReady),
    connectionScope: source?.connectionScope ?? null,
    memberId: source?.memberId ?? null,
    name: source?.name ?? null,
    email: source?.email ?? null,
    profilePictureUrl: source ? profilePictureUrl(source.profile) : null,
  };
}

function apiHeaders(
  accessToken: string,
  contentType = false,
): Record<string, string> {
  return linkedInRestHeaders(accessToken, {
    Accept: "application/json",
    ...(contentType ? { "Content-Type": "application/json" } : {}),
  });
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function providerErrorMessage(raw: unknown, status: number): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 1_000);
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const direct = firstNonEmptyString(
      record.message,
      record.error_description,
      record.error,
    );
    if (direct) return direct.slice(0, 1_000);
    if (record.errorDetail && typeof record.errorDetail === "object") {
      const nested = firstNonEmptyString(
        (record.errorDetail as Record<string, unknown>).message,
      );
      if (nested) return nested.slice(0, 1_000);
    }
  }
  return "LinkedIn API returnerte HTTP " + status;
}

function localProviderFailure(
  error: string,
  raw: unknown = null,
  status = 0,
): ProviderFailure {
  return { ok: false, status, error, raw };
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
): Promise<ProviderResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(20_000),
    });
    const raw = await readResponseBody(response);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: providerErrorMessage(raw, response.status),
        raw,
      };
    }
    return {
      ok: true,
      status: response.status,
      value: raw as T,
      raw,
      headers: response.headers,
    };
  } catch (error) {
    return localProviderFailure(
      error instanceof Error ? error.message : String(error),
    );
  }
}

function providerFailureResult(
  failure: ProviderFailure,
  operation: string,
): PublishResult {
  if (failure.status === 401) {
    return {
      ok: false,
      status: "failed",
      reason: "reconnect_required",
      error:
        "LinkedIn-tilkoblingen er utløpt eller tilbakekalt under "
        + operation
        + ". Koble til på nytt.",
      raw: failure.raw,
    };
  }
  if (failure.status === 403) {
    return {
      ok: false,
      status: "failed",
      reason: "permission_denied",
      error:
        "LinkedIn avviste rettighetene under "
        + operation
        + ". Kontroller scopes og siderolle.",
      raw: failure.raw,
    };
  }
  if (failure.status === 429) {
    return {
      ok: false,
      status: "rate_limited",
      reason: "rate_limited",
      error:
        "LinkedIn rate-limit ble nådd under "
        + operation
        + ". Prøv igjen senere.",
      raw: failure.raw,
    };
  }
  return {
    ok: false,
    status: "failed",
    reason: failure.status === 0 ? "network_error" : "linkedin_api_error",
    error: operation + " feilet: " + failure.error,
    raw: failure.raw,
  };
}

async function fetchApprovedOrganizationAcls(
  accessToken: string,
): Promise<ProviderResult<LinkedInOrgAclElement[]>> {
  const collected: LinkedInOrgAclElement[] = [];
  let start = 0;
  const count = 100;
  for (let page = 0; page < 10; page += 1) {
    const url = new URL(LINKEDIN_ORGANIZATION_ACLS_ENDPOINT);
    url.searchParams.set("q", "roleAssignee");
    url.searchParams.set("state", "APPROVED");
    url.searchParams.set("count", String(count));
    url.searchParams.set("start", String(start));
    const result = await requestJson<{
      elements?: LinkedInOrgAclElement[];
      paging?: { start?: number; count?: number; total?: number };
    }>(url.toString(), {
      method: "GET",
      headers: apiHeaders(accessToken, true),
    });
    if (isProviderFailure(result)) return result;
    const elements = Array.isArray(result.value?.elements)
      ? result.value.elements
      : [];
    collected.push(...elements);
    const total = Number(result.value?.paging?.total);
    if (
      elements.length === 0
      || elements.length < count
      || (Number.isFinite(total) && start + elements.length >= total)
    ) {
      break;
    }
    start += elements.length;
  }
  return {
    ok: true,
    status: 200,
    value: collected,
    raw: { elements: collected },
    headers: new Headers(),
  };
}

function organizationUrnFromAcl(acl: LinkedInOrgAclElement): string | null {
  const urn = firstNonEmptyString(acl.organization, acl.organizationTarget);
  return urn?.startsWith("urn:li:organization:") ? urn : null;
}

function isApprovedPublishingAcl(acl: LinkedInOrgAclElement): boolean {
  const state = firstNonEmptyString(acl.state)?.toUpperCase();
  const role = firstNonEmptyString(acl.role)?.toUpperCase();
  return state === "APPROVED"
    && Boolean(role && ORGANIZATION_PUBLISH_ROLES.has(role));
}

function findHttpString(value: unknown, depth = 0): string | null {
  if (depth > 6) return null;
  if (typeof value === "string") {
    return /^https?:\/\//i.test(value) ? value : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findHttpString(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      const found = findHttpString(entry, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

async function fetchCompaniesForToken(
  accessToken: string,
): Promise<ProviderResult<LinkedInManagedCompany[]>> {
  const aclResult = await fetchApprovedOrganizationAcls(accessToken);
  if (isProviderFailure(aclResult)) return aclResult;
  const acls = aclResult.value.filter(
    (acl) => organizationUrnFromAcl(acl) && isApprovedPublishingAcl(acl),
  );
  const companies: LinkedInManagedCompany[] = [];
  const seen = new Set<string>();
  for (const acl of acls) {
    const urn = organizationUrnFromAcl(acl);
    if (!urn || seen.has(urn)) continue;
    seen.add(urn);
    const id = urn.slice("urn:li:organization:".length);
    const result = await requestJson<{
      id?: number | string;
      localizedName?: string;
      vanityName?: string;
      logoV2?: unknown;
    }>(LINKEDIN_ORGANIZATIONS_ENDPOINT + "/" + encodeURIComponent(id), {
      method: "GET",
      headers: apiHeaders(accessToken, true),
    });
    if (isProviderFailure(result)) {
      if (
        result.status === 401
        || result.status === 403
        || result.status === 429
      ) {
        return result;
      }
      console.warn(
        "[linkedin-publish] organization lookup "
        + id
        + " failed: "
        + result.error,
      );
      continue;
    }
    companies.push({
      urn,
      id,
      name: firstNonEmptyString(result.value?.localizedName),
      vanityName: firstNonEmptyString(result.value?.vanityName),
      logoUrl: findHttpString(result.value?.logoV2),
      role: firstNonEmptyString(acl.role) ?? "ADMINISTRATOR",
    });
  }
  return {
    ok: true,
    status: 200,
    value: companies,
    raw: { companies },
    headers: new Headers(),
  };
}

export async function listLinkedInCompanies(
  accessToken: string,
): Promise<LinkedInManagedCompany[]> {
  const result = await fetchCompaniesForToken(accessToken);
  if (isProviderFailure(result)) {
    console.warn(
      "[linkedin-publish] company listing failed "
      + result.status
      + ": "
      + result.error,
    );
    return [];
  }
  return result.value;
}

/**
 * Project-aware, token-free company helper for Role Room routes.
 */
export async function listManagedCompaniesForUser(
  pool: Pool,
  userId: string,
  projectId: string | null = null,
): Promise<LinkedInManagedCompaniesResult> {
  const candidates = await loadLinkedInConnectionCandidates(pool, userId, {
    author: "company",
    projectId,
  });
  const eligible = candidates.valid.filter((connection) =>
    hasScopes(connection, [
      ORGANIZATION_ADMIN_SCOPE,
      ORGANIZATION_WRITE_SCOPE,
    ]));
  if (eligible.length === 0) {
    return {
      companies: [],
      scopeMissing: candidates.valid.length > 0,
      reconnectRequired: candidates.rows.length > 0,
      connectionScope: candidates.rows[0]?.connectionScope ?? null,
    };
  }
  let lastFailure: ProviderFailure | null = null;
  for (const connection of eligible) {
    const result = await fetchCompaniesForToken(connection.accessToken);
    if (isProviderFailure(result)) {
      lastFailure = result;
      if (result.status === 429) break;
      continue;
    }
    return {
      companies: result.value,
      scopeMissing: false,
      reconnectRequired: false,
      connectionScope: connection.connectionScope,
    };
  }
  return {
    companies: [],
    scopeMissing: lastFailure?.status === 403,
    reconnectRequired: lastFailure?.status === 401,
    connectionScope: eligible[0]?.connectionScope ?? null,
  };
}

/**
 * Live OIDC identity verification. This is global-only.
 */
export async function verifyLinkedInIdentity(
  pool: Pool,
  userId: string,
): Promise<
  | { ok: true; name: string | null; memberId: string; scopes: string[] }
  | {
    ok: false;
    reason: "not_connected" | "reconnect_required" | "verify_failed";
  }
> {
  const candidates = await loadLinkedInConnectionCandidates(pool, userId, {
    author: "personal",
  });
  const connection = candidates.valid.find((entry) => Boolean(entry.memberId));
  if (!connection?.memberId) {
    return {
      ok: false,
      reason: candidates.rows.length > 0
        ? "reconnect_required"
        : "not_connected",
    };
  }
  try {
    const response = await fetch(LINKEDIN_API_BASE + "/v2/userinfo", {
      headers: { Authorization: "Bearer " + connection.accessToken },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "reconnect_required" };
    }
    if (!response.ok) return { ok: false, reason: "verify_failed" };
    const body = (await response.json()) as {
      name?: string;
      given_name?: string;
      family_name?: string;
    };
    const name = firstNonEmptyString(
      body.name,
      [body.given_name, body.family_name].filter(Boolean).join(" "),
    );
    return {
      ok: true,
      name,
      memberId: connection.memberId,
      scopes: connection.scopes,
    };
  } catch {
    return { ok: false, reason: "verify_failed" };
  }
}

type DataUrlInspection =
  | {
    ok: true;
    mimeType: string;
    compactBase64: string;
    estimatedBytes: number;
  }
  | {
    ok: false;
    reason: "invalid" | "too_large";
  };

function inspectDataUrl(
  dataUrl: string,
  family: "image" | "video",
  byteCap: number,
): DataUrlInspection {
  const pattern = family === "image"
    ? /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i
    : /^data:(video\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i;
  const match = dataUrl.match(pattern);
  if (!match) return { ok: false, reason: "invalid" };

  // Four base64 characters encode at most three bytes. Reject on the raw
  // encoded length before compacting or allocating decoded bytes.
  const maxEncodedLength = Math.ceil(byteCap / 3) * 4 + 4;
  if (match[2].length > maxEncodedLength) {
    return { ok: false, reason: "too_large" };
  }
  const compactBase64 = match[2].replace(/\s+/g, "");
  if (
    compactBase64.length === 0
    || compactBase64.length % 4 === 1
    || !/^[a-z0-9+/]*={0,2}$/i.test(compactBase64)
  ) {
    return { ok: false, reason: "invalid" };
  }
  const padding = compactBase64.endsWith("==")
    ? 2
    : compactBase64.endsWith("=")
      ? 1
      : 0;
  const estimatedBytes =
    Math.floor(compactBase64.length * 3 / 4) - padding;
  if (estimatedBytes <= 0) return { ok: false, reason: "invalid" };
  if (estimatedBytes > byteCap) {
    return { ok: false, reason: "too_large" };
  }
  return {
    ok: true,
    mimeType: match[1],
    compactBase64,
    estimatedBytes,
  };
}

function decodeDataUrl(
  dataUrl: string,
  family: "image" | "video",
): { mimeType: string; buffer: Buffer } | null {
  const byteCap = family === "image"
    ? LINKEDIN_IMAGE_BYTES_CAP
    : LINKEDIN_VIDEO_BYTES_CAP;
  const inspected = inspectDataUrl(dataUrl, family, byteCap);
  if (inspected.ok === false) return null;
  const buffer = Buffer.from(inspected.compactBase64, "base64");
  if (buffer.length === 0 || buffer.length > byteCap) return null;
  return { mimeType: inspected.mimeType, buffer };
}

function validateDirectInput(input: LinkedInDirectPublishInput): string | null {
  if (
    input.mediaKind !== "text"
    && input.mediaKind !== "image"
    && input.mediaKind !== "carousel"
    && input.mediaKind !== "video"
    && input.mediaKind !== "reel"
    && input.mediaKind !== "link"
  ) {
    return "LinkedIn publisher støtter text, image, carousel, video, reel og link.";
  }
  if (!input.caption?.trim()) return "LinkedIn-posten må ha tekst-innhold";
  if (input.caption.length > LINKEDIN_CAPTION_HARD_CAP) {
    return "Caption må være under "
      + LINKEDIN_CAPTION_HARD_CAP
      + " tegn (fikk "
      + input.caption.length
      + ")";
  }
  if (!/^urn:li:(person|organization):[^:]+$/.test(input.authorUrn)) {
    return "authorUrn må være en gyldig person- eller organization-URN";
  }
  if (input.mediaKind === "image") {
    if (!input.imageUrl) return "image-post krever imageUrl";
    const image = inspectDataUrl(
      input.imageUrl,
      "image",
      LINKEDIN_IMAGE_BYTES_CAP,
    );
    if (image.ok === false && image.reason === "too_large") {
      return "Bildet er over "
        + LINKEDIN_IMAGE_BYTES_CAP / 1024 / 1024
        + " MB";
    }
    if (image.ok === false) {
      return "imageUrl må være data:image/*;base64,…";
    }
  }
  if (input.mediaKind === "carousel") {
    const images = input.imageUrls ?? [];
    if (
      images.length < LINKEDIN_MULTI_IMAGE_MIN
      || images.length > LINKEDIN_MULTI_IMAGE_MAX
    ) {
      return "LinkedIn multi-image krever "
        + LINKEDIN_MULTI_IMAGE_MIN
        + "–"
        + LINKEDIN_MULTI_IMAGE_MAX
        + " bilder";
    }
    let totalImageBytes = 0;
    for (const imageUrl of images) {
      const image = inspectDataUrl(
        imageUrl,
        "image",
        LINKEDIN_IMAGE_BYTES_CAP,
      );
      if (image.ok === false && image.reason === "too_large") {
        return "Et bilde er over "
          + LINKEDIN_IMAGE_BYTES_CAP / 1024 / 1024
          + " MB";
      }
      if (image.ok === false) {
        return "Alle imageUrls må være data:image/*;base64,…";
      }
      totalImageBytes += image.estimatedBytes;
      if (totalImageBytes > LINKEDIN_MULTI_IMAGE_TOTAL_BYTES_CAP) {
        return "Samlet bildestørrelse er over "
          + LINKEDIN_MULTI_IMAGE_TOTAL_BYTES_CAP / 1024 / 1024
          + " MB";
      }
    }
  }
  if (input.mediaKind === "video" || input.mediaKind === "reel") {
    if (!input.videoUrl) return "video-post krever videoUrl";
    const video = inspectDataUrl(
      input.videoUrl,
      "video",
      LINKEDIN_VIDEO_BYTES_CAP,
    );
    if (video.ok === false && video.reason === "too_large") {
      return "Videoen er over "
        + LINKEDIN_VIDEO_BYTES_CAP / 1024 / 1024
        + " MB";
    }
    if (video.ok === false) {
      return "videoUrl må være data:video/*;base64,…";
    }
  }
  if (input.mediaKind === "link") {
    const source = firstNonEmptyString(input.extras?.link);
    if (!source) return "link-post krever extras.link";
    try {
      const url = new URL(source);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "extras.link må være en absolutt HTTP(S)-URL";
      }
    } catch {
      return "extras.link må være en absolutt HTTP(S)-URL";
    }
  }
  return null;
}

async function initializeImageUpload(
  accessToken: string,
  owner: LinkedInAuthorUrn,
): Promise<ProviderResult<{ uploadUrl: string; image: string }>> {
  const result = await requestJson<{
    value?: { uploadUrl?: string; image?: string };
  }>(LINKEDIN_IMAGES_INITIALIZE_ENDPOINT, {
    method: "POST",
    headers: apiHeaders(accessToken, true),
    body: JSON.stringify({
      initializeUploadRequest: { owner },
    }),
  });
  if (isProviderFailure(result)) return result;
  const uploadUrl = firstNonEmptyString(result.value?.value?.uploadUrl);
  const image = firstNonEmptyString(result.value?.value?.image);
  if (!uploadUrl || !image?.startsWith("urn:li:image:")) {
    return localProviderFailure(
      "LinkedIn initializeUpload svarte uten uploadUrl/image-URN",
      result.raw,
      502,
    );
  }
  return { ...result, value: { uploadUrl, image } };
}

async function uploadSignedBytes(
  uploadUrl: string,
  buffer: Buffer,
  contentType: string,
): Promise<ProviderResult<null>> {
  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: new Uint8Array(buffer),
      signal: AbortSignal.timeout(120_000),
    });
    const raw = response.ok ? null : await readResponseBody(response);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: providerErrorMessage(raw, response.status),
        raw,
      };
    }
    return {
      ok: true,
      status: response.status,
      value: null,
      raw,
      headers: response.headers,
    };
  } catch (error) {
    return localProviderFailure(
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function uploadImage(
  accessToken: string,
  owner: LinkedInAuthorUrn,
  image: { mimeType: string; buffer: Buffer },
): Promise<ProviderResult<string>> {
  const initialized = await initializeImageUpload(accessToken, owner);
  if (isProviderFailure(initialized)) return initialized;
  const uploaded = await uploadSignedBytes(
    initialized.value.uploadUrl,
    image.buffer,
    "application/octet-stream",
  );
  if (isProviderFailure(uploaded)) return uploaded;
  return {
    ok: true,
    status: uploaded.status,
    value: initialized.value.image,
    raw: initialized.raw,
    headers: uploaded.headers,
  };
}

interface VideoUploadInstruction {
  uploadUrl?: string;
  firstByte?: number;
  lastByte?: number;
}

async function initializeVideoUpload(
  accessToken: string,
  owner: LinkedInAuthorUrn,
  fileSizeBytes: number,
): Promise<ProviderResult<{
  video: string;
  uploadToken: string;
  uploadInstructions: Array<{
    uploadUrl: string;
    firstByte: number;
    lastByte: number;
  }>;
}>> {
  const result = await requestJson<{
    value?: {
      video?: string;
      uploadToken?: string;
      uploadInstructions?: VideoUploadInstruction[];
    };
  }>(LINKEDIN_VIDEOS_INITIALIZE_ENDPOINT, {
    method: "POST",
    headers: apiHeaders(accessToken, true),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner,
        fileSizeBytes,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  if (isProviderFailure(result)) return result;
  const video = firstNonEmptyString(result.value?.value?.video);
  const uploadToken =
    typeof result.value?.value?.uploadToken === "string"
      ? result.value.value.uploadToken
      : null;
  const instructions = Array.isArray(result.value?.value?.uploadInstructions)
    ? result.value.value.uploadInstructions
    : [];
  const normalized = instructions
    .map((instruction) => ({
      uploadUrl: firstNonEmptyString(instruction.uploadUrl),
      firstByte: Number(instruction.firstByte),
      lastByte: Number(instruction.lastByte),
    }))
    .filter((instruction): instruction is {
      uploadUrl: string;
      firstByte: number;
      lastByte: number;
    } => Boolean(
      instruction.uploadUrl
      && Number.isInteger(instruction.firstByte)
      && Number.isInteger(instruction.lastByte)
      && instruction.firstByte >= 0
      && instruction.lastByte >= instruction.firstByte,
    ))
    .sort((left, right) => left.firstByte - right.firstByte);
  if (
    !video?.startsWith("urn:li:video:")
    || uploadToken === null
    || normalized.length === 0
  ) {
    return localProviderFailure(
      "LinkedIn initializeUpload svarte med ugyldige video-instruksjoner",
      result.raw,
      502,
    );
  }
  return {
    ...result,
    value: { video, uploadToken, uploadInstructions: normalized },
  };
}

async function uploadVideoParts(
  buffer: Buffer,
  instructions: Array<{
    uploadUrl: string;
    firstByte: number;
    lastByte: number;
  }>,
): Promise<ProviderResult<string[]>> {
  const uploadedPartIds: string[] = [];
  let expectedFirstByte = 0;
  for (const instruction of instructions) {
    if (
      instruction.firstByte !== expectedFirstByte
      || instruction.firstByte >= buffer.length
    ) {
      return localProviderFailure(
        "LinkedIn returnerte ikke-sammenhengende byte ranges for video",
        { instruction, expectedFirstByte, fileSize: buffer.length },
        502,
      );
    }
    const exclusiveEnd = Math.min(instruction.lastByte + 1, buffer.length);
    const part = buffer.subarray(instruction.firstByte, exclusiveEnd);
    const uploaded = await uploadSignedBytes(
      instruction.uploadUrl,
      part,
      "application/octet-stream",
    );
    if (isProviderFailure(uploaded)) return uploaded;
    const etag = firstNonEmptyString(uploaded.headers.get("etag"));
    if (!etag) {
      return localProviderFailure(
        "LinkedIn video-upload svarte uten ETag for en multipart-del",
        { firstByte: instruction.firstByte, lastByte: instruction.lastByte },
        502,
      );
    }
    uploadedPartIds.push(etag);
    expectedFirstByte = exclusiveEnd;
    if (expectedFirstByte >= buffer.length) break;
  }
  if (expectedFirstByte !== buffer.length) {
    return localProviderFailure(
      "LinkedIn video-instruksjonene dekket ikke hele filen",
      { uploadedBytes: expectedFirstByte, fileSize: buffer.length },
      502,
    );
  }
  return {
    ok: true,
    status: 200,
    value: uploadedPartIds,
    raw: { uploadedPartIds },
    headers: new Headers(),
  };
}

async function finalizeVideoUpload(
  accessToken: string,
  video: string,
  uploadToken: string,
  uploadedPartIds: string[],
): Promise<ProviderResult<null>> {
  const result = await requestJson<unknown>(
    LINKEDIN_VIDEOS_FINALIZE_ENDPOINT,
    {
      method: "POST",
      headers: apiHeaders(accessToken, true),
      body: JSON.stringify({
        finalizeUploadRequest: {
          video,
          uploadToken,
          uploadedPartIds,
        },
      }),
    },
  );
  if (isProviderFailure(result)) return result;
  return { ...result, value: null };
}

async function uploadVideo(
  accessToken: string,
  owner: LinkedInAuthorUrn,
  buffer: Buffer,
): Promise<ProviderResult<string>> {
  const initialized = await initializeVideoUpload(
    accessToken,
    owner,
    buffer.length,
  );
  if (isProviderFailure(initialized)) return initialized;
  const uploaded = await uploadVideoParts(
    buffer,
    initialized.value.uploadInstructions,
  );
  if (isProviderFailure(uploaded)) return uploaded;
  const finalized = await finalizeVideoUpload(
    accessToken,
    initialized.value.video,
    initialized.value.uploadToken,
    uploaded.value,
  );
  if (isProviderFailure(finalized)) return finalized;
  return {
    ok: true,
    status: finalized.status,
    value: initialized.value.video,
    raw: finalized.raw,
    headers: finalized.headers,
  };
}

function postUrnFromId(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^urn:li:(share|ugcPost):[^:]+$/.test(trimmed)) return trimmed;
  return trimmed ? "urn:li:ugcPost:" + trimmed : null;
}

function externalIdFromPostUrn(postUrn: string | null): string | undefined {
  return postUrn
    ? postUrn.slice(postUrn.lastIndexOf(":") + 1)
    : undefined;
}

async function createLinkedInPost(
  accessToken: string,
  payload: LinkedInPostsPayload,
): Promise<ProviderResult<{ postUrn: string | null }>> {
  const result = await requestJson<{ id?: string }>(LINKEDIN_POSTS_ENDPOINT, {
    method: "POST",
    headers: apiHeaders(accessToken, true),
    body: JSON.stringify(payload),
  });
  if (isProviderFailure(result)) return result;
  const bodyId = firstNonEmptyString(result.value?.id);
  const headerId = firstNonEmptyString(result.headers.get("x-restli-id"));
  return {
    ...result,
    value: { postUrn: postUrnFromId(bodyId ?? headerId) },
  };
}

/**
 * Shared provider entry point for callers that already own a decrypted token.
 * The caller owns tenant/scope/ACL checks.
 */
export async function publishLinkedInPostWithAccessToken(
  input: LinkedInDirectPublishInput,
): Promise<PublishResult> {
  const validationError = validateDirectInput(input);
  if (validationError) {
    return {
      ok: false,
      status: "failed",
      reason: "validation_failed",
      error: validationError,
    };
  }
  let content: LinkedInPostContent | undefined;
  if (input.mediaKind === "image" && input.imageUrl) {
    const decoded = decodeDataUrl(input.imageUrl, "image")!;
    const uploaded = await uploadImage(
      input.accessToken,
      input.authorUrn,
      decoded,
    );
    if (isProviderFailure(uploaded)) {
      return providerFailureResult(uploaded, "bildeopplasting");
    }
    const altText = firstNonEmptyString(input.extras?.altText);
    content = {
      media: {
        id: uploaded.value,
        ...(altText ? { altText } : {}),
      },
    };
  } else if (input.mediaKind === "carousel") {
    const altTexts = Array.isArray(input.extras?.imageAltTexts)
      ? input.extras.imageAltTexts
      : [];
    const images: Array<{ id: string; altText?: string }> = [];
    for (let index = 0; index < (input.imageUrls ?? []).length; index += 1) {
      const decoded = decodeDataUrl(input.imageUrls![index], "image")!;
      const uploaded = await uploadImage(
        input.accessToken,
        input.authorUrn,
        decoded,
      );
      if (isProviderFailure(uploaded)) {
        return providerFailureResult(
          uploaded,
          "bildeopplasting " + (index + 1),
        );
      }
      const altText = firstNonEmptyString(altTexts[index]);
      images.push({
        id: uploaded.value,
        ...(altText ? { altText } : {}),
      });
    }
    content = { multiImage: { images } };
  } else if (
    (input.mediaKind === "video" || input.mediaKind === "reel")
    && input.videoUrl
  ) {
    const decoded = decodeDataUrl(input.videoUrl, "video")!;
    const uploaded = await uploadVideo(
      input.accessToken,
      input.authorUrn,
      decoded.buffer,
    );
    if (isProviderFailure(uploaded)) {
      return providerFailureResult(uploaded, "videoopplasting");
    }
    const title = firstNonEmptyString(input.extras?.videoTitle);
    content = {
      media: {
        id: uploaded.value,
        ...(title ? { title } : {}),
      },
    };
  } else if (input.mediaKind === "link") {
    const source = firstNonEmptyString(input.extras?.link)!;
    const title = firstNonEmptyString(input.extras?.linkTitle);
    const description = firstNonEmptyString(input.extras?.linkDescription);
    const thumbnail = firstNonEmptyString(input.extras?.linkThumbnailUrn);
    content = {
      article: {
        source,
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        ...(thumbnail?.startsWith("urn:li:image:") ? { thumbnail } : {}),
      },
    };
  }
  const payload: LinkedInPostsPayload = {
    author: input.authorUrn,
    commentary: input.caption,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
    ...(content ? { content } : {}),
  };
  const posted = await createLinkedInPost(input.accessToken, payload);
  if (isProviderFailure(posted)) {
    return providerFailureResult(posted, "publisering");
  }
  const postUrn = posted.value.postUrn;
  const authorId = input.authorUrn.slice(
    input.authorUrn.lastIndexOf(":") + 1,
  );
  return {
    ok: true,
    status: "published",
    externalPostId: externalIdFromPostUrn(postUrn),
    accountId: authorId,
    permalink: postUrn
      ? "https://www.linkedin.com/feed/update/" + postUrn + "/"
      : undefined,
    raw: posted.raw,
  };
}

function connectionFailure(
  candidates: LinkedInConnectionCandidates,
): PublishResult {
  if (candidates.queryFailed) {
    return {
      ok: false,
      status: "failed",
      reason: "connection_lookup_failed",
      error: "Kunne ikke lese LinkedIn-tilkoblingen.",
    };
  }
  if (candidates.rows.length > 0) {
    return {
      ok: false,
      status: "failed",
      reason: "reconnect_required",
      error:
        "LinkedIn-tokenet er utløpt eller kan ikke dekrypteres. Koble til på nytt.",
    };
  }
  return {
    ok: false,
    status: "failed",
    reason: "connection_not_found",
    error: "Ingen aktiv LinkedIn-tilkobling funnet for brukeren.",
  };
}

async function selectOrganizationConnection(
  candidates: LinkedInConnectionCandidates,
  organizationUrn: string,
): Promise<
  | { ok: true; connection: LinkedInConnection }
  | { ok: false; result: PublishResult }
> {
  if (candidates.valid.length === 0) {
    return { ok: false, result: connectionFailure(candidates) };
  }
  const eligible = candidates.valid.filter((connection) =>
    hasScopes(connection, [
      ORGANIZATION_ADMIN_SCOPE,
      ORGANIZATION_WRITE_SCOPE,
    ]));
  if (eligible.length === 0) {
    return {
      ok: false,
      result: {
        ok: false,
        status: "failed",
        reason: "scope_missing",
        error:
          "Tilkoblingen mangler r_organization_admin og/eller "
          + "w_organization_social. Koble LinkedIn til på nytt.",
      },
    };
  }
  let lastProviderFailure: ProviderFailure | null = null;
  let receivedAclResponse = false;
  for (const connection of eligible) {
    const aclResult = await fetchApprovedOrganizationAcls(
      connection.accessToken,
    );
    if (isProviderFailure(aclResult)) {
      lastProviderFailure = aclResult;
      if (aclResult.status === 429) break;
      continue;
    }
    receivedAclResponse = true;
    const authorized = aclResult.value.some((acl) =>
      organizationUrnFromAcl(acl) === organizationUrn
      && isApprovedPublishingAcl(acl));
    if (authorized) return { ok: true, connection };
  }
  if (!receivedAclResponse && lastProviderFailure) {
    return {
      ok: false,
      result: providerFailureResult(
        lastProviderFailure,
        "siderollekontroll",
      ),
    };
  }
  return {
    ok: false,
    result: {
      ok: false,
      status: "failed",
      reason: "organization_access_denied",
      error:
        "LinkedIn-kontoen har ikke en godkjent publiseringsrolle "
        + "for den valgte bedriften.",
    },
  };
}

export function makeLinkedInPublisher(pool: Pool): SocialPublisher {
  const platform: SocialPlatform = "linkedin";
  return {
    platform,
    validate(post: SocialPostInput): string | null {
      const organizationUrn = firstNonEmptyString(
        post.extras?.linkedInOrganizationUrn,
      );
      if (
        organizationUrn
        && !/^urn:li:organization:[^:]+$/.test(organizationUrn)
      ) {
        return "extras.linkedInOrganizationUrn må være en gyldig organization-URN";
      }
      const authorUrn = organizationUrn ?? "urn:li:person:validation";
      return validateDirectInput({
        accessToken: "validation-only",
        authorUrn,
        mediaKind: post.mediaKind as LinkedInDirectPublishInput["mediaKind"],
        caption: post.caption,
        imageUrl: post.imageUrl,
        imageUrls: post.imageUrls,
        videoUrl: post.videoUrl,
        extras: post.extras,
      });
    },
    async publish(post: SocialPostInput): Promise<PublishResult> {
      const organizationUrn = firstNonEmptyString(
        post.extras?.linkedInOrganizationUrn,
      );
      let connection: LinkedInConnection;
      let authorUrn: LinkedInAuthorUrn;
      if (organizationUrn) {
        if (!/^urn:li:organization:[^:]+$/.test(organizationUrn)) {
          return {
            ok: false,
            status: "failed",
            reason: "validation_failed",
            error: "Ugyldig LinkedIn organization-URN.",
          };
        }
        const candidates = await loadLinkedInConnectionCandidates(
          pool,
          post.userId,
          { author: "company", projectId: post.projectId },
        );
        const selected = await selectOrganizationConnection(
          candidates,
          organizationUrn,
        );
        if (selected.ok === false) return selected.result;
        connection = selected.connection;
        authorUrn = organizationUrn;
      } else {
        const candidates = await loadLinkedInConnectionCandidates(
          pool,
          post.userId,
          { author: "personal" },
        );
        if (candidates.valid.length === 0) {
          return connectionFailure(candidates);
        }
        const selected = candidates.valid.find((candidate) =>
          Boolean(candidate.memberId)
          && hasScopes(candidate, [MEMBER_WRITE_SCOPE]));
        if (!selected) {
          const hasMemberConnection = candidates.valid.some((candidate) =>
            Boolean(candidate.memberId));
          return {
            ok: false,
            status: "failed",
            reason: hasMemberConnection
              ? "scope_missing"
              : "reconnect_required",
            error: hasMemberConnection
              ? "Tilkoblingen mangler w_member_social. Koble LinkedIn til på nytt."
              : "LinkedIn-tilkoblingen mangler medlemsidentitet. Koble til på nytt.",
          };
        }
        connection = selected;
        authorUrn = "urn:li:person:" + selected.memberId;
      }
      return publishLinkedInPostWithAccessToken({
        accessToken: connection.accessToken,
        authorUrn,
        mediaKind: post.mediaKind as LinkedInDirectPublishInput["mediaKind"],
        caption: post.caption,
        imageUrl: post.imageUrl,
        imageUrls: post.imageUrls,
        videoUrl: post.videoUrl,
        extras: post.extras,
      });
    },
    async fetchInsights(_input: FetchInsightsInput): Promise<MetricSnapshot[]> {
      return [];
    },
  };
}

export function registerLinkedInPublisher(pool: Pool): void {
  registerPublisher(makeLinkedInPublisher(pool));
}
