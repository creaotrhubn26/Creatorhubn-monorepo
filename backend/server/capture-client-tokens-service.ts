import crypto from 'crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  captureClientTokens,
  captureSessions,
  type CaptureClientToken,
} from '../migrations/capture-schema.js';

type Db = NodePgDatabase<Record<string, unknown>>;

const DEFAULT_TTL_MINUTES = 24 * 60;
const MAX_TTL_MINUTES = 30 * 24 * 60;

export interface CreatedClientToken {
  id: string;
  token: string; // raw, returned ONCE
  clientLabel: string | null;
  expiresAt: Date;
  hasPin: boolean;
}

export interface ValidatedClientAuth {
  tokenId: string;
  sessionId: string;
  reviewerId: string;
  clientLabel: string | null;
}

function generateRawToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function hashPin(pin: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}::${pin}`).digest('hex');
}

export async function createClientToken(
  db: Db,
  ownerUserId: string,
  sessionId: string,
  input: {
    clientLabel?: string;
    pin?: string;
    ttlMinutes?: number;
  },
): Promise<CreatedClientToken | null> {
  const owns = await db
    .select({ id: captureSessions.id })
    .from(captureSessions)
    .where(
      and(eq(captureSessions.id, sessionId), eq(captureSessions.ownerUserId, ownerUserId)),
    )
    .limit(1);
  if (owns.length === 0) return null;

  const ttlMinutes = Math.min(
    Math.max(input.ttlMinutes ?? DEFAULT_TTL_MINUTES, 5),
    MAX_TTL_MINUTES,
  );
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const reviewerId = `client-${crypto.randomUUID()}`;
  const pinHash = input.pin ? hashPin(input.pin, tokenHash) : null;

  const [row] = await db
    .insert(captureClientTokens)
    .values({
      sessionId,
      tokenHash,
      pinHash,
      clientLabel: input.clientLabel ?? null,
      reviewerId,
      expiresAt,
    })
    .returning();

  return {
    id: row.id,
    token: rawToken,
    clientLabel: row.clientLabel,
    expiresAt: row.expiresAt,
    hasPin: Boolean(row.pinHash),
  };
}

export interface ClientTokenSummary {
  id: string;
  clientLabel: string | null;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  hasPin: boolean;
}

export async function listClientTokens(
  db: Db,
  ownerUserId: string,
  sessionId: string,
): Promise<ClientTokenSummary[]> {
  const rows = await db
    .select({
      token: captureClientTokens,
    })
    .from(captureClientTokens)
    .innerJoin(captureSessions, eq(captureClientTokens.sessionId, captureSessions.id))
    .where(
      and(
        eq(captureClientTokens.sessionId, sessionId),
        eq(captureSessions.ownerUserId, ownerUserId),
      ),
    )
    .orderBy(desc(captureClientTokens.createdAt));
  return rows.map(({ token }) => ({
    id: token.id,
    clientLabel: token.clientLabel,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    lastUsedAt: token.lastUsedAt,
    hasPin: Boolean(token.pinHash),
  }));
}

export async function revokeClientToken(
  db: Db,
  ownerUserId: string,
  tokenId: string,
): Promise<boolean> {
  const [row] = await db
    .update(captureClientTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(captureClientTokens.id, tokenId),
        sql`EXISTS (SELECT 1 FROM ${captureSessions}
          WHERE ${captureSessions.id} = ${captureClientTokens.sessionId}
          AND ${captureSessions.ownerUserId} = ${ownerUserId})`,
        isNull(captureClientTokens.revokedAt),
      ),
    )
    .returning({ id: captureClientTokens.id });
  return row !== undefined;
}

export async function validateClientToken(
  db: Db,
  rawToken: string,
  pin: string | null,
): Promise<ValidatedClientAuth | null> {
  if (!rawToken || rawToken.length < 32) return null;
  const tokenHash = hashToken(rawToken);
  const rows = await db
    .select()
    .from(captureClientTokens)
    .where(
      and(
        eq(captureClientTokens.tokenHash, tokenHash),
        isNull(captureClientTokens.revokedAt),
        gt(captureClientTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  if (row.pinHash) {
    if (!pin) return null;
    const expected = hashPin(pin, tokenHash);
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(row.pinHash))) {
      return null;
    }
  }

  // Fire-and-forget touch of lastUsedAt.
  db.update(captureClientTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(captureClientTokens.id, row.id))
    .catch(() => {
      // intentionally ignored; last-used is best-effort
    });

  return {
    tokenId: row.id,
    sessionId: row.sessionId,
    reviewerId: row.reviewerId,
    clientLabel: row.clientLabel,
  };
}

export async function fetchSessionForClient(
  db: Db,
  sessionId: string,
): Promise<{ id: string; name: string; status: string } | null> {
  const rows = await db
    .select({
      id: captureSessions.id,
      name: captureSessions.name,
      status: captureSessions.status,
    })
    .from(captureSessions)
    .where(eq(captureSessions.id, sessionId))
    .limit(1);
  return rows[0] ?? null;
}
