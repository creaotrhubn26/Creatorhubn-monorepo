/**
 * role-room-ig-messaging.ts — Instagram Direct-message inbox service.
 *
 * Powers a unified social inbox in The Role Room CRM: list IG DM
 * conversations for a connected IG Business account, read a thread, and
 * reply — using the existing `role_room_instagram_connections` token store
 * (Facebook-Login flavour, Page access token derived per call).
 *
 * Design notes:
 *  - DB-first. Inbound messages are persisted from the Meta webhook
 *    (`messages` field), so the inbox is functional even while the polling
 *    Conversations API is gated behind `instagram_manage_messages` review.
 *  - Graph sync (fetchConversations / fetchMessages) is best-effort: if the
 *    permission isn't granted yet the call fails gracefully and we serve the
 *    webhook-fed rows.
 *  - Replies must hit the Graph API (no offline fallback) and obey Meta's
 *    rules: only to users who messaged first (IGSID arrives via webhook),
 *    within the 24-hour standard messaging window.
 *
 * Graph (Facebook-Login IG messaging, Page token):
 *   GET  /{page-id}/conversations?platform=instagram
 *   GET  /{conversation-id}?fields=messages{...}
 *   POST /{page-id}/messages   { recipient:{id:IGSID}, message:{text} }
 *
 * Permissions: instagram_manage_messages + instagram_basic
 *   (+ pages_manage_metadata for webhook subscription).
 */

import type { Pool } from "pg";
import {
  META_GRAPH_API_VERSION,
  type InstagramConnectionRow,
} from "./role-room-instagram-oauth.js";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

export interface IgConversationRow {
  id: string;
  connectionId: string;
  userId: string;
  igBusinessAccountId: string;
  externalConversationId: string | null;
  participantIgsid: string;
  participantUsername: string | null;
  participantName: string | null;
  lastMessageAt: string | null;
  lastMessageSnippet: string | null;
  unreadCount: number;
  status: string;
  crmCustomerId: string | null;
  metadata: Record<string, unknown>;
}

export interface IgMessageRow {
  id: string;
  conversationId: string;
  externalMessageId: string | null;
  direction: "inbound" | "outbound";
  senderIgsid: string | null;
  body: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  createdAt: string;
}

let schemaReady = false;

/** Idempotent CREATE TABLE IF NOT EXISTS — mirrors the codebase convention. */
export async function ensureIgMessagingSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_instagram_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connection_id UUID NOT NULL,
      user_id TEXT NOT NULL,
      ig_business_account_id TEXT NOT NULL,
      external_conversation_id TEXT,
      participant_igsid TEXT NOT NULL,
      participant_username TEXT,
      participant_name TEXT,
      last_message_at TIMESTAMPTZ,
      last_message_snippet TEXT,
      unread_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      crm_customer_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (connection_id, participant_igsid)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_instagram_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES role_room_instagram_conversations(id) ON DELETE CASCADE,
      external_message_id TEXT UNIQUE,
      direction TEXT NOT NULL,
      sender_igsid TEXT,
      body TEXT,
      attachment_url TEXT,
      attachment_type TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_rr_ig_convos_conn ON role_room_instagram_conversations(connection_id, last_message_at DESC NULLS LAST);`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_rr_ig_convos_user ON role_room_instagram_conversations(user_id);`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_rr_ig_msgs_convo ON role_room_instagram_messages(conversation_id, created_at);`,
  );
  schemaReady = true;
}

function mapConversation(row: Record<string, unknown>): IgConversationRow {
  return {
    id: String(row.id),
    connectionId: String(row.connection_id),
    userId: String(row.user_id),
    igBusinessAccountId: String(row.ig_business_account_id),
    externalConversationId: (row.external_conversation_id as string | null) ?? null,
    participantIgsid: String(row.participant_igsid),
    participantUsername: (row.participant_username as string | null) ?? null,
    participantName: (row.participant_name as string | null) ?? null,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at as string).toISOString() : null,
    lastMessageSnippet: (row.last_message_snippet as string | null) ?? null,
    unreadCount: Number(row.unread_count ?? 0),
    status: String(row.status ?? "active"),
    crmCustomerId: (row.crm_customer_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  };
}

function mapMessage(row: Record<string, unknown>): IgMessageRow {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    externalMessageId: (row.external_message_id as string | null) ?? null,
    direction: (row.direction as "inbound" | "outbound") ?? "inbound",
    senderIgsid: (row.sender_igsid as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    attachmentUrl: (row.attachment_url as string | null) ?? null,
    attachmentType: (row.attachment_type as string | null) ?? null,
    createdAt: new Date((row.created_at as string) ?? Date.now()).toISOString(),
  };
}

/** Derive a Page access token from the stored long-lived user token. */
async function getPageToken(connection: InstagramConnectionRow): Promise<string> {
  try {
    const url =
      `${GRAPH}/${encodeURIComponent(connection.facebookPageId)}` +
      `?fields=access_token&access_token=${encodeURIComponent(connection.accessToken)}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as { access_token?: string };
    if (res.ok && json.access_token) return json.access_token;
  } catch {
    /* fall through to user token */
  }
  return connection.accessToken;
}

interface UpsertConversationInput {
  pool: Pool;
  connection: Pick<InstagramConnectionRow, "id" | "userId" | "igBusinessAccountId">;
  participantIgsid: string;
  participantUsername?: string | null;
  participantName?: string | null;
  externalConversationId?: string | null;
  lastMessageAt?: string | null;
  lastMessageSnippet?: string | null;
  bumpUnread?: number;
  metadata?: Record<string, unknown>;
}

/** Insert-or-update a conversation keyed by (connection_id, participant_igsid). */
export async function upsertConversation(input: UpsertConversationInput): Promise<IgConversationRow> {
  const { pool, connection } = input;
  const result = await pool.query(
    `INSERT INTO role_room_instagram_conversations
       (connection_id, user_id, ig_business_account_id, participant_igsid,
        participant_username, participant_name, external_conversation_id,
        last_message_at, last_message_snippet, unread_count, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (connection_id, participant_igsid) DO UPDATE SET
       participant_username = COALESCE(EXCLUDED.participant_username, role_room_instagram_conversations.participant_username),
       participant_name = COALESCE(EXCLUDED.participant_name, role_room_instagram_conversations.participant_name),
       external_conversation_id = COALESCE(EXCLUDED.external_conversation_id, role_room_instagram_conversations.external_conversation_id),
       last_message_at = COALESCE(EXCLUDED.last_message_at, role_room_instagram_conversations.last_message_at),
       last_message_snippet = COALESCE(EXCLUDED.last_message_snippet, role_room_instagram_conversations.last_message_snippet),
       unread_count = role_room_instagram_conversations.unread_count + $12,
       metadata = role_room_instagram_conversations.metadata || EXCLUDED.metadata,
       updated_at = now()
     RETURNING *`,
    [
      connection.id,
      connection.userId,
      connection.igBusinessAccountId,
      input.participantIgsid,
      input.participantUsername ?? null,
      input.participantName ?? null,
      input.externalConversationId ?? null,
      input.lastMessageAt ?? null,
      input.lastMessageSnippet ?? null,
      Math.max(0, input.bumpUnread ?? 0),
      JSON.stringify(input.metadata ?? {}),
      Math.max(0, input.bumpUnread ?? 0),
    ],
  );
  return mapConversation(result.rows[0]);
}

interface InsertMessageInput {
  pool: Pool;
  conversationId: string;
  externalMessageId?: string | null;
  direction: "inbound" | "outbound";
  senderIgsid?: string | null;
  body?: string | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  createdAt?: string | null;
}

/** Insert a message; dedups on external_message_id. Returns row or null if duplicate. */
export async function insertMessage(input: InsertMessageInput): Promise<IgMessageRow | null> {
  const { pool } = input;
  const result = await pool.query(
    `INSERT INTO role_room_instagram_messages
       (conversation_id, external_message_id, direction, sender_igsid, body,
        attachment_url, attachment_type, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8::timestamptz, now()))
     ON CONFLICT (external_message_id) DO NOTHING
     RETURNING *`,
    [
      input.conversationId,
      input.externalMessageId ?? null,
      input.direction,
      input.senderIgsid ?? null,
      input.body ?? null,
      input.attachmentUrl ?? null,
      input.attachmentType ?? null,
      input.createdAt ?? null,
    ],
  );
  return result.rows[0] ? mapMessage(result.rows[0]) : null;
}

/** List persisted conversations for a connection (DB-first, always works). */
export async function listConversations(
  pool: Pool,
  connection: Pick<InstagramConnectionRow, "id" | "userId">,
): Promise<IgConversationRow[]> {
  const result = await pool.query(
    `SELECT * FROM role_room_instagram_conversations
       WHERE connection_id = $1 AND user_id = $2 AND status <> 'deleted'
       ORDER BY last_message_at DESC NULLS LAST, updated_at DESC
       LIMIT 200`,
    [connection.id, connection.userId],
  );
  return result.rows.map(mapConversation);
}

export async function getConversation(
  pool: Pool,
  conversationId: string,
  userId: string,
): Promise<IgConversationRow | null> {
  const result = await pool.query(
    `SELECT * FROM role_room_instagram_conversations WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [conversationId, userId],
  );
  return result.rows[0] ? mapConversation(result.rows[0]) : null;
}

export async function listMessages(pool: Pool, conversationId: string): Promise<IgMessageRow[]> {
  const result = await pool.query(
    `SELECT * FROM role_room_instagram_messages
       WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 500`,
    [conversationId],
  );
  return result.rows.map(mapMessage);
}

export async function markConversationRead(pool: Pool, conversationId: string, userId: string): Promise<void> {
  await pool.query(
    `UPDATE role_room_instagram_conversations SET unread_count = 0, updated_at = now()
       WHERE id = $1 AND user_id = $2`,
    [conversationId, userId],
  );
}

/**
 * Best-effort: sync conversations from the Graph Conversations API into the DB.
 * Returns { synced, error } — error is set (and swallowed) when the permission
 * is not yet granted, so the caller can still serve DB rows.
 */
export async function syncConversationsFromGraph(
  pool: Pool,
  connection: InstagramConnectionRow,
): Promise<{ synced: number; error: string | null }> {
  try {
    const pageToken = await getPageToken(connection);
    const fields =
      "id,updated_time,unread_count,participants{id,username,name}," +
      "messages.limit(1){id,from,to,message,created_time}";
    const url =
      `${GRAPH}/${encodeURIComponent(connection.facebookPageId)}/conversations` +
      `?platform=instagram&fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as {
      data?: Array<Record<string, any>>;
      error?: { message?: string };
    };
    if (!res.ok) return { synced: 0, error: json.error?.message || `Graph ${res.status}` };
    const convos = Array.isArray(json.data) ? json.data : [];
    let synced = 0;
    for (const c of convos) {
      const participants: Array<{ id?: string; username?: string; name?: string }> =
        c?.participants?.data ?? [];
      // The participant that is not our own IG business account.
      const other =
        participants.find((p) => p.id && p.id !== connection.igBusinessAccountId) ?? participants[0];
      if (!other?.id) continue;
      const lastMsg = c?.messages?.data?.[0] ?? null;
      await upsertConversation({
        pool,
        connection,
        participantIgsid: String(other.id),
        participantUsername: other.username ?? null,
        participantName: other.name ?? null,
        externalConversationId: c.id ? String(c.id) : null,
        lastMessageAt: c.updated_time ?? lastMsg?.created_time ?? null,
        lastMessageSnippet: lastMsg?.message ?? null,
        bumpUnread: 0,
        metadata: { participants },
      });
      synced += 1;
    }
    return { synced, error: null };
  } catch (error) {
    return { synced: 0, error: String(error instanceof Error ? error.message : error) };
  }
}

/**
 * Best-effort: sync the messages of a single conversation from Graph.
 * Requires the conversation to have a known external_conversation_id.
 */
export async function syncMessagesFromGraph(
  pool: Pool,
  connection: InstagramConnectionRow,
  conversation: IgConversationRow,
): Promise<{ synced: number; error: string | null }> {
  if (!conversation.externalConversationId) {
    return { synced: 0, error: "no_external_conversation_id" };
  }
  try {
    const pageToken = await getPageToken(connection);
    const fields = "messages{id,created_time,from,to,message}";
    const url =
      `${GRAPH}/${encodeURIComponent(conversation.externalConversationId)}` +
      `?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as {
      messages?: { data?: Array<Record<string, any>> };
      error?: { message?: string };
    };
    if (!res.ok) return { synced: 0, error: json.error?.message || `Graph ${res.status}` };
    const msgs = json.messages?.data ?? [];
    let synced = 0;
    for (const m of msgs) {
      const fromId = m?.from?.id ? String(m.from.id) : null;
      const isInbound = fromId !== null && fromId !== connection.igBusinessAccountId;
      const inserted = await insertMessage({
        pool,
        conversationId: conversation.id,
        externalMessageId: m.id ? String(m.id) : null,
        direction: isInbound ? "inbound" : "outbound",
        senderIgsid: fromId,
        body: m.message ?? null,
        createdAt: m.created_time ?? null,
      });
      if (inserted) synced += 1;
    }
    return { synced, error: null };
  } catch (error) {
    return { synced: 0, error: String(error instanceof Error ? error.message : error) };
  }
}

/**
 * Send an Instagram DM reply. Hits the Graph API (no offline fallback) and
 * persists the outbound message on success.
 */
export async function sendReply(
  pool: Pool,
  connection: InstagramConnectionRow,
  conversation: IgConversationRow,
  text: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const pageToken = await getPageToken(connection);
    const url = `${GRAPH}/${encodeURIComponent(connection.facebookPageId)}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: conversation.participantIgsid },
        message: { text },
        messaging_type: "RESPONSE",
        access_token: pageToken,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      message_id?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      return { success: false, error: json.error?.message || `Graph ${res.status}` };
    }
    await insertMessage({
      pool,
      conversationId: conversation.id,
      externalMessageId: json.message_id ?? null,
      direction: "outbound",
      senderIgsid: connection.igBusinessAccountId,
      body: text,
    });
    await pool.query(
      `UPDATE role_room_instagram_conversations
          SET last_message_at = now(), last_message_snippet = $2, unread_count = 0, updated_at = now()
        WHERE id = $1`,
      [conversation.id, text.slice(0, 200)],
    );
    return { success: true, messageId: json.message_id };
  } catch (error) {
    return { success: false, error: String(error instanceof Error ? error.message : error) };
  }
}

/**
 * Persist an inbound IG DM delivered via the Meta webhook. Best-effort — never
 * throws (the webhook handler must always ack 200). Looks up the owning
 * connection by IG business account id (webhook is unauthenticated).
 */
export async function persistInboundDmFromWebhook(pool: Pool, event: unknown): Promise<number> {
  try {
    await ensureIgMessagingSchema(pool);
    const e = event as {
      object?: string;
      entry?: Array<{
        id?: string;
        messaging?: Array<{
          sender?: { id?: string };
          recipient?: { id?: string };
          timestamp?: number;
          message?: {
            mid?: string;
            text?: string;
            is_echo?: boolean;
            attachments?: Array<{ type?: string; payload?: { url?: string } }>;
          };
        }>;
      }>;
    };
    const entries = Array.isArray(e?.entry) ? e.entry : [];
    let persisted = 0;
    for (const entry of entries) {
      const accountId = entry?.id ? String(entry.id) : null;
      const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];
      if (!accountId || messaging.length === 0) continue;

      // Resolve the owning connection by IG business account id OR page id.
      const conn = await pool.query(
        `SELECT id, user_id, ig_business_account_id FROM role_room_instagram_connections
           WHERE (ig_business_account_id = $1 OR facebook_page_id = $1)
             AND connection_state = 'connected'
           ORDER BY last_refreshed_at DESC NULLS LAST LIMIT 1`,
        [accountId],
      );
      const row = conn.rows[0];
      if (!row) continue;
      const connection = {
        id: String(row.id),
        userId: String(row.user_id),
        igBusinessAccountId: String(row.ig_business_account_id),
      };

      for (const m of messaging) {
        const msg = m?.message;
        if (!msg?.mid) continue;
        const isEcho = msg.is_echo === true;
        // Echo = a message WE sent (already persisted on send); skip to avoid dupes.
        if (isEcho) continue;
        const senderId = m?.sender?.id ? String(m.sender.id) : null;
        if (!senderId) continue;
        const attachment = msg.attachments?.[0];
        const createdAt = m.timestamp ? new Date(m.timestamp).toISOString() : null;
        // Ensure the conversation exists + refresh its preview, but DON'T bump
        // unread yet — Meta retries webhooks, so bumping here would over-count.
        const convo = await upsertConversation({
          pool,
          connection,
          participantIgsid: senderId,
          lastMessageAt: createdAt,
          lastMessageSnippet: msg.text ?? (attachment ? `[${attachment.type ?? "attachment"}]` : null),
          bumpUnread: 0,
        });
        const inserted = await insertMessage({
          pool,
          conversationId: convo.id,
          externalMessageId: String(msg.mid),
          direction: "inbound",
          senderIgsid: senderId,
          body: msg.text ?? null,
          attachmentUrl: attachment?.payload?.url ?? null,
          attachmentType: attachment?.type ?? null,
          createdAt,
        });
        // Only bump unread when this message was genuinely new (insertMessage
        // dedups on external_message_id), so webhook retries stay idempotent.
        if (inserted) {
          persisted += 1;
          await pool.query(
            `UPDATE role_room_instagram_conversations
                SET unread_count = unread_count + 1, updated_at = now()
              WHERE id = $1`,
            [convo.id],
          );
        }
      }
    }
    return persisted;
  } catch (error) {
    console.warn("[ig-messaging] persistInboundDmFromWebhook failed (non-fatal)", error);
    return 0;
  }
}
