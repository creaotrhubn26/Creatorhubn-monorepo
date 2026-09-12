import { createHash, randomBytes } from "node:crypto";
import type { Pool } from "pg";

export const LEADGRID_REALTIME_TICKET_TTL_MS = 30_000;
export const MAX_PENDING_LEADGRID_REALTIME_TICKETS = 4;

type TicketDatabase = Pick<Pool, "query">;

function hashTicket(ticket: string): string {
  return createHash("sha256").update(ticket).digest("base64url");
}

export async function issueLeadgridRealtimeTicket(
  database: TicketDatabase,
  userId: string,
  now = Date.now(),
): Promise<{ ticket: string; expiresAt: string }> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error("userId is required");
  const ticket = randomBytes(32).toString("base64url");
  const issuedAt = new Date(now);
  const expiresAt = new Date(now + LEADGRID_REALTIME_TICKET_TTL_MS);
  await database.query(
    `WITH expired AS (
       DELETE FROM leadgrid_realtime_tickets
        WHERE expires_at <= $3::timestamptz
     ), bounded AS (
       DELETE FROM leadgrid_realtime_tickets
        WHERE ticket_hash IN (
          SELECT ticket_hash
            FROM leadgrid_realtime_tickets
           WHERE user_id = $1
             AND expires_at > $3::timestamptz
           ORDER BY issued_at DESC, ticket_hash DESC
          OFFSET $4
        )
     )
     INSERT INTO leadgrid_realtime_tickets (
       ticket_hash, user_id, issued_at, expires_at
     ) VALUES ($2, $1, $3, $5)`,
    [
      normalizedUserId,
      hashTicket(ticket),
      issuedAt,
      MAX_PENDING_LEADGRID_REALTIME_TICKETS - 1,
      expiresAt,
    ],
  );
  return { ticket, expiresAt: expiresAt.toISOString() };
}

/** Shared-DB, atomic, single-use consume. Expired tickets are consumed but denied. */
export async function consumeLeadgridRealtimeTicket(
  database: TicketDatabase,
  ticket: string,
  now = Date.now(),
): Promise<{ userId: string } | null> {
  const normalized = ticket.trim();
  if (!normalized) return null;
  const result = await database.query<{ user_id: string }>(
    `WITH consumed AS (
       DELETE FROM leadgrid_realtime_tickets
        WHERE ticket_hash = $1
        RETURNING user_id, expires_at
     )
     SELECT user_id
       FROM consumed
      WHERE expires_at > $2::timestamptz`,
    [hashTicket(normalized), new Date(now)],
  );
  const userId = result.rows[0]?.user_id?.trim();
  return userId ? { userId } : null;
}

export const leadgridRealtimeTicketInternals = { hashTicket };
