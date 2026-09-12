import { createHash, randomBytes } from "node:crypto";
import type { Pool } from "pg";
import type { UserEventsClientMetadata } from "./realtime-user-event-auth-metrics.js";

export const USER_EVENTS_TICKET_TTL_MS = 30_000;
export const MAX_PENDING_USER_EVENT_TICKETS = 4;

type TicketQueryable = Pick<Pool, "query">;

export interface IssuedUserEventsTicket {
  ticket: string;
  expiresAt: string;
}

function hashTicket(ticket: string): string {
  return createHash("sha256").update(ticket).digest("base64url");
}

/**
 * Persist a hash of a short-lived ticket in the shared PostgreSQL database.
 * The bounded cleanup and insert happen in one statement so concurrent
 * backend instances never depend on process-local state.
 */
export async function issueUserEventsTicket(
  database: TicketQueryable,
  userId: string,
  now = Date.now(),
  client: UserEventsClientMetadata = {
    clientKind: "unknown",
    clientVersion: null,
  },
): Promise<IssuedUserEventsTicket> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error("userId is required");

  const ticket = randomBytes(32).toString("base64url");
  const issuedAt = new Date(now);
  const expiresAt = new Date(now + USER_EVENTS_TICKET_TTL_MS);

  await database.query(
    `
      WITH expired AS (
        DELETE FROM realtime_user_event_tickets
        WHERE expires_at <= $3::timestamptz
      ), bounded AS (
        DELETE FROM realtime_user_event_tickets
        WHERE ticket_hash IN (
          SELECT ticket_hash
          FROM realtime_user_event_tickets
          WHERE user_id = $1
            AND expires_at > $3::timestamptz
          ORDER BY issued_at DESC, ticket_hash DESC
          OFFSET $4
        )
      )
      INSERT INTO realtime_user_event_tickets (
        ticket_hash,
        user_id,
        issued_at,
        expires_at,
        client_kind,
        client_version
      ) VALUES ($2, $1, $3, $5, $6, $7)
    `,
    [
      normalizedUserId,
      hashTicket(ticket),
      issuedAt,
      MAX_PENDING_USER_EVENT_TICKETS - 1,
      expiresAt,
      client.clientKind,
      client.clientVersion,
    ],
  );

  return { ticket, expiresAt: expiresAt.toISOString() };
}

/**
 * Atomically consume a ticket. DELETE ... RETURNING is the security boundary:
 * exactly one backend instance can receive the user id, and expired tickets
 * are deleted even though they do not authenticate the upgrade.
 */
export async function consumeUserEventsTicket(
  database: TicketQueryable,
  ticket: string,
  now = Date.now(),
): Promise<({ userId: string } & UserEventsClientMetadata) | null> {
  const normalizedTicket = ticket.trim();
  if (!normalizedTicket) return null;

  const result = await database.query<{
    user_id: string;
    client_kind: UserEventsClientMetadata["clientKind"];
    client_version: string | null;
  }>(
    `
      WITH consumed AS (
        DELETE FROM realtime_user_event_tickets
        WHERE ticket_hash = $1
        RETURNING user_id, expires_at, client_kind, client_version
      )
      SELECT user_id, client_kind, client_version
      FROM consumed
      WHERE expires_at > $2::timestamptz
    `,
    [hashTicket(normalizedTicket), new Date(now)],
  );
  const row = result.rows[0];
  const userId = row?.user_id?.trim();
  return userId
    ? {
        userId,
        clientKind: row.client_kind ?? "unknown",
        clientVersion: row.client_version ?? null,
      }
    : null;
}

export const userEventsTicketStoreInternals = { hashTicket };
