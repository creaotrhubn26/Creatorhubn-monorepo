import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { CanvasServiceError } from "./leadgrid-canvas-service.js";

export type CanvasCursorKind = "notes" | "trash" | "history" | "library";

export type CanvasCursor = {
  timestamp: string;
  id: string;
};

export type CanvasPageRequest = {
  enabled: boolean;
  limit: number;
  cursor: CanvasCursor | null;
};

type CursorPayload = {
  v: 1;
  k: CanvasCursorKind;
  s: string;
  t: string;
  i: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIBRARY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;
const CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{43}$/u;

function signingSecret(override?: string): string {
  const candidates = override !== undefined
    ? [override]
    : [
        process.env.CANVAS_CURSOR_SECRET,
        process.env.SESSION_SECRET,
        process.env.JWT_SECRET,
        process.env.AUTH_SECRET,
        // Domain-separated HMAC use makes the existing internal cron secret a
        // safe rolling-deploy fallback until CANVAS_CURSOR_SECRET is configured.
        process.env.LEADGRID_CRON_TRIGGER_TOKEN,
        process.env.CRON_TRIGGER_TOKEN,
      ];
  const secret = candidates
    .find((candidate) => typeof candidate === "string" && candidate.trim())
    ?.trim() ?? "";
  if (Buffer.byteLength(secret, "utf8") < 16) {
    throw new CanvasServiceError(503, "canvas_cursor_signing_unavailable");
  }
  return secret;
}
function scopeFingerprint(scope: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("leadgrid-canvas-cursor-scope-v1\0")
    .update(scope)
    .digest("base64url")
    .slice(0, 22);
}

function cursorSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("leadgrid-canvas-cursor-v1\0")
    .update(payload)
    .digest("base64url");
}

function validId(kind: CanvasCursorKind, id: string): boolean {
  return kind === "library" ? LIBRARY_ID_PATTERN.test(id) : UUID_PATTERN.test(id);
}

function normalizedTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new CanvasServiceError(500, "invalid_stored_canvas_timestamp");
  }
  return date.toISOString();
}

export function encodeCanvasCursor(input: {
  kind: CanvasCursorKind;
  scope: string;
  timestamp: Date | string;
  id: string;
  secret?: string;
}): string {
  if (!validId(input.kind, input.id)) {
    throw new CanvasServiceError(500, "invalid_stored_canvas_cursor_id");
  }
  const secret = signingSecret(input.secret);
  const payload: CursorPayload = {
    v: 1,
    k: input.kind,
    s: scopeFingerprint(input.scope, secret),
    t: normalizedTimestamp(input.timestamp),
    i: input.id,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${cursorSignature(encoded, secret)}`;
}

export function decodeCanvasCursor(input: {
  value: string;
  kind: CanvasCursorKind;
  scope: string;
  secret?: string;
}): CanvasCursor {
  if (!CURSOR_PATTERN.test(input.value)) {
    throw new CanvasServiceError(400, "invalid_canvas_cursor");
  }
  const secret = signingSecret(input.secret);
  const [encoded, suppliedSignature] = input.value.split(".");
  const expectedSignature = cursorSignature(encoded, secret);
  const supplied = Buffer.from(suppliedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new CanvasServiceError(400, "invalid_canvas_cursor");
  }

  let payload: CursorPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new CanvasServiceError(400, "invalid_canvas_cursor");
  }
  const timestamp = new Date(payload?.t);
  if (
    payload?.v !== 1 ||
    payload.k !== input.kind ||
    payload.s !== scopeFingerprint(input.scope, secret) ||
    !validId(input.kind, payload.i) ||
    !Number.isFinite(timestamp.getTime()) ||
    timestamp.toISOString() !== payload.t
  ) {
    throw new CanvasServiceError(400, "invalid_canvas_cursor");
  }
  return { timestamp: payload.t, id: payload.i };
}

function singleQueryValue(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new CanvasServiceError(400, "invalid_canvas_pagination");
  }
  return value;
}

/** Pagination is opt-in: legacy requests without limit/cursor keep their exact contract. */
export function parseCanvasPageRequest(input: {
  limitValue: unknown;
  cursorValue: unknown;
  kind: CanvasCursorKind;
  scope: string;
  defaultLimit: number;
  maxLimit: number;
  secret?: string;
}): CanvasPageRequest {
  const rawLimit = singleQueryValue(input.limitValue);
  const rawCursor = singleQueryValue(input.cursorValue);
  const enabled = rawLimit !== undefined || rawCursor !== undefined;
  if (!enabled) {
    return { enabled: false, limit: input.defaultLimit, cursor: null };
  }
  // Fail deterministically before querying a page if this instance cannot
  // mint a cursor that another instance can verify.
  signingSecret(input.secret);
  const limit = rawLimit === undefined ? input.defaultLimit : Number(rawLimit);
  if (
    !/^[1-9][0-9]*$/u.test(rawLimit ?? String(input.defaultLimit)) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > input.maxLimit
  ) {
    throw new CanvasServiceError(400, "invalid_canvas_page_limit", {
      maxLimit: input.maxLimit,
    });
  }
  return {
    enabled: true,
    limit,
    cursor: rawCursor
      ? decodeCanvasCursor({
          value: rawCursor,
          kind: input.kind,
          scope: input.scope,
          secret: input.secret,
        })
      : null,
  };
}

/** Returns the largest non-empty candidate prefix within a conservative budget. */
export function selectCanvasPagePrefix<T extends { response_bytes: unknown }>(
  candidates: T[],
  requestedLimit: number,
  maxBytes: number,
): { rows: T[]; hasMore: boolean } {
  const rows: T[] = [];
  let bytes = 0;
  for (const candidate of candidates.slice(0, requestedLimit)) {
    const candidateBytes = Number(candidate.response_bytes);
    if (!Number.isSafeInteger(candidateBytes) || candidateBytes < 0) {
      throw new CanvasServiceError(500, "invalid_stored_canvas_size");
    }
    if (rows.length > 0 && bytes + candidateBytes > maxBytes) break;
    rows.push(candidate);
    bytes += candidateBytes;
  }
  return { rows, hasMore: candidates.length > rows.length };
}

/** Stable scope binding without exposing tenant/user IDs inside the cursor. */
export function canvasCursorScope(organizationId: string, userId: string): string {
  return createHash("sha256")
    .update("leadgrid-canvas-page-scope-v1\0")
    .update(organizationId)
    .update("\0")
    .update(userId)
    .digest("hex");
}
