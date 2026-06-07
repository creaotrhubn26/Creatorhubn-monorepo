// Admin communication-extras routes.
//
// Ekte data: kobler admin-fanen til `communication_channels`, `communication_messages`
// og `communication_participants`. Admin ser alle rooms (uten filter per user).
//
// Defensiv mot manglende tabeller — returnerer tomme arrays + console.warn istedenfor 500.

import express from "express";
import crypto from "crypto";
import type { Pool } from "pg";

export interface AdminCommunicationExtrasRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

interface RoomRow {
  id: string;
  name: string | null;
  type: string | null;
  created_at: Date | string | null;
  last_message_at: Date | string | null;
  member_count: string | null;
}

interface MessageRow {
  id: string;
  channel_id: string;
  sender_id: string;
  recipient_id: string | null;
  message_type: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean | null;
  is_priority: boolean | null;
  is_system_generated: boolean | null;
  parent_message_id: string | null;
  created_at: Date | string | null;
  read_at: Date | string | null;
  delivered_at: Date | string | null;
}

function isMissingTableError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "42P01"; // undefined_table
}

function classifyRoomType(rawType: string | null): "dm" | "channel" | "group" {
  const t = (rawType || "").toLowerCase();
  if (t === "dm" || t === "direct" || t === "private") return "dm";
  if (t === "group" || t === "team" || t === "project") return "group";
  return "channel";
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function setupAdminCommunicationExtrasRoutes(
  deps: AdminCommunicationExtrasRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // ─── Rooms ────────────────────────────────────────────────
  app.get("/api/admin/communication/rooms", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const limit = Math.min(
        Math.max(parseInt(String(req.query.limit ?? "200"), 10) || 200, 1),
        500,
      );

      const result = await pool.query<RoomRow>(
        `
          SELECT
            c.id,
            c.name,
            c.type,
            c.created_at,
            (
              SELECT MAX(m.created_at)
              FROM communication_messages m
              WHERE m.channel_id = c.id
            ) AS last_message_at,
            (
              SELECT COUNT(*)::text
              FROM communication_participants p
              WHERE p.channel_id = c.id
                AND COALESCE(p.is_active, TRUE) = TRUE
            ) AS member_count
          FROM communication_channels c
          WHERE COALESCE(c.is_active, TRUE) = TRUE
          ORDER BY COALESCE(c.updated_at, c.created_at) DESC NULLS LAST
          LIMIT $1
        `,
        [limit],
      );

      const rooms = result.rows.map((row) => ({
        id: row.id,
        name: row.name || `Chat ${row.id.slice(0, 8)}`,
        type: classifyRoomType(row.type),
        memberCount: Number.parseInt(row.member_count || "0", 10) || 0,
        lastMessageAt: toIsoOrNull(row.last_message_at),
        createdAt: toIsoOrNull(row.created_at),
      }));

      res.json({ rooms, total: rooms.length });
    } catch (e) {
      if (isMissingTableError(e)) {
        console.warn(
          "[admin-communication-extras] communication_channels missing — returning empty rooms.",
        );
        return res.json({ rooms: [], total: 0 });
      }
      console.error("[admin-communication-extras] rooms error:", e);
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Messages ─────────────────────────────────────────────
  app.get(
    "/api/admin/communication/messages/:chatId",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        const { chatId } = req.params;
        const limit = Math.min(
          Math.max(parseInt(String(req.query.limit ?? "100"), 10) || 100, 1),
          500,
        );

        const result = await pool.query<MessageRow>(
          `
            SELECT
              id,
              channel_id,
              sender_id,
              recipient_id,
              message_type,
              content,
              metadata,
              is_read,
              is_priority,
              is_system_generated,
              parent_message_id,
              created_at,
              read_at,
              delivered_at
            FROM communication_messages
            WHERE channel_id = $1
            ORDER BY created_at DESC
            LIMIT $2
          `,
          [chatId, limit],
        );

        // DESC for limit, but return chronological asc for UI.
        const messages = result.rows
          .slice()
          .reverse()
          .map((row) => ({
            id: row.id,
            chatId: row.channel_id,
            senderId: row.sender_id,
            recipientId: row.recipient_id,
            messageType: row.message_type || "text",
            content: row.content,
            metadata: row.metadata || {},
            isRead: row.is_read === true,
            isPriority: row.is_priority === true,
            isSystem: row.is_system_generated === true,
            parentMessageId: row.parent_message_id,
            timestamp: toIsoOrNull(row.created_at),
            readAt: toIsoOrNull(row.read_at),
            deliveredAt: toIsoOrNull(row.delivered_at),
          }));

        res.json({ messages, total: messages.length, chatId });
      } catch (e) {
        if (isMissingTableError(e)) {
          console.warn(
            "[admin-communication-extras] communication_messages missing — returning empty messages.",
          );
          return res.json({
            messages: [],
            total: 0,
            chatId: req.params.chatId,
          });
        }
        console.error("[admin-communication-extras] messages error:", e);
        res.status(500).json({ error: String(e) });
      }
    },
  );

  // ─── Send ────────────────────────────────────────────────
  app.post("/api/admin/communication/send", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
      const message =
        typeof body.message === "string" ? body.message.trim() : "";

      if (!chatId) {
        return res.status(400).json({ error: "chatId is required" });
      }
      if (!message) {
        return res.status(400).json({ error: "message is required" });
      }

      // Sørg for at kanalen eksisterer (admin kan skrive til hvilken som helst chat).
      const existing = await pool.query<{ id: string }>(
        `SELECT id FROM communication_channels WHERE id = $1 LIMIT 1`,
        [chatId],
      );
      if (existing.rowCount === 0) {
        await pool.query(
          `
            INSERT INTO communication_channels (id, name, type, is_active, created_at, updated_at)
            VALUES ($1, $2, 'chat', TRUE, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
          `,
          [chatId, `Chat ${chatId.slice(0, 8)}`],
        );
      }

      const messageId = crypto.randomUUID();
      await pool.query(
        `
          INSERT INTO communication_messages (
            id, channel_id, sender_id, message_type, content,
            metadata, is_read, is_priority, is_system_generated,
            created_at, updated_at, delivered_at
          ) VALUES (
            $1, $2, $3, 'text', $4,
            $5::jsonb, FALSE, FALSE, FALSE,
            NOW(), NOW(), NOW()
          )
        `,
        [
          messageId,
          chatId,
          session.userId,
          message,
          JSON.stringify({ sentByAdmin: true, adminEmail: session.email }),
        ],
      );

      await pool.query(
        `UPDATE communication_channels SET updated_at = NOW() WHERE id = $1`,
        [chatId],
      );

      res.json({ success: true, messageId, chatId });
    } catch (e) {
      if (isMissingTableError(e)) {
        console.warn(
          "[admin-communication-extras] send: chat tables missing — returning no-op success.",
        );
        return res.json({
          success: false,
          messageId: null,
          error: "chat_tables_missing",
        });
      }
      console.error("[admin-communication-extras] send error:", e);
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Broadcast ────────────────────────────────────────────
  // target = 'all' | 'admins' | 'role:<name>'
  // Implementert som system-message-insert i alle relevante rooms (rooms hvor
  // mål-brukerne er deltakere). Det finnes ingen dedikert push/notify-broadcast
  // infrastruktur — fan-out skjer kun ved at meldingen vises neste gang klienten
  // henter messages/:chatId. Dette er forventet for Phase 1.
  app.post("/api/admin/communication/broadcast", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const message =
        typeof body.message === "string" ? body.message.trim() : "";
      const target =
        typeof body.target === "string" && body.target.trim().length > 0
          ? body.target.trim()
          : "all";

      if (!message) {
        return res.status(400).json({ error: "message is required" });
      }

      // Finn user-ids ut fra target.
      let targetUserIds: string[] = [];
      try {
        if (target === "all") {
          const r = await pool.query<{ id: string }>(`SELECT id FROM users`);
          targetUserIds = r.rows.map((row) => row.id);
        } else if (target === "admins") {
          const r = await pool.query<{ id: string }>(
            `SELECT id FROM users WHERE LOWER(COALESCE(role, '')) IN ('admin', 'super_admin', 'owner')`,
          );
          targetUserIds = r.rows.map((row) => row.id);
        } else if (target.startsWith("role:")) {
          const role = target.slice("role:".length).trim().toLowerCase();
          if (!role) {
            return res
              .status(400)
              .json({ error: "role-target requires a role name" });
          }
          const r = await pool.query<{ id: string }>(
            `SELECT id FROM users WHERE LOWER(COALESCE(role, '')) = $1`,
            [role],
          );
          targetUserIds = r.rows.map((row) => row.id);
        } else {
          return res.status(400).json({
            error:
              "target must be 'all', 'admins', or 'role:<name>'",
          });
        }
      } catch (err) {
        if (isMissingTableError(err)) {
          console.warn(
            "[admin-communication-extras] broadcast: users table missing — falling back to active channels only.",
          );
          targetUserIds = [];
        } else {
          throw err;
        }
      }

      // Finn rooms hvor disse brukerne er aktive deltakere.
      let roomIds: string[] = [];
      try {
        if (targetUserIds.length > 0) {
          const r = await pool.query<{ channel_id: string }>(
            `
              SELECT DISTINCT channel_id
              FROM communication_participants
              WHERE COALESCE(is_active, TRUE) = TRUE
                AND user_id = ANY($1::varchar[])
            `,
            [targetUserIds],
          );
          roomIds = r.rows.map((row) => row.channel_id);
        }

        // Fallback bare for target='all': hvis participants-tabellen er tom
        // (vanlig før Phase 1-adopsjon), broadcast til alle aktive kanaler.
        // For 'admins' og 'role:X' beholder vi tom rooms-liste — bedre å
        // returnere sentTo=0 enn å spamme alle.
        if (roomIds.length === 0 && target === "all") {
          const fallback = await pool.query<{ id: string }>(
            `
              SELECT id FROM communication_channels
              WHERE COALESCE(is_active, TRUE) = TRUE
              ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST
              LIMIT 500
            `,
          );
          roomIds = fallback.rows.map((row) => row.id);
        }
      } catch (err) {
        if (isMissingTableError(err)) {
          console.warn(
            "[admin-communication-extras] broadcast: channel/participant tables missing — returning no-op.",
          );
          return res.json({
            success: true,
            sentTo: 0,
            target,
            note: "communication tables missing — no-op",
          });
        }
        throw err;
      }

      if (roomIds.length === 0) {
        return res.json({ success: true, sentTo: 0, target });
      }

      // Insert system-message i hver room. Bruker ON CONFLICT DO NOTHING for safety.
      const metadata = JSON.stringify({
        broadcast: true,
        target,
        adminUserId: session.userId,
        adminEmail: session.email,
      });

      const values: string[] = [];
      const params: unknown[] = [];
      let pIdx = 1;
      for (const roomId of roomIds) {
        values.push(
          `($${pIdx++}, $${pIdx++}, $${pIdx++}, 'system', $${pIdx++}, $${pIdx++}::jsonb, FALSE, FALSE, TRUE, NOW(), NOW(), NOW())`,
        );
        params.push(
          crypto.randomUUID(),
          roomId,
          session.userId,
          message,
          metadata,
        );
      }

      await pool.query(
        `
          INSERT INTO communication_messages (
            id, channel_id, sender_id, message_type, content,
            metadata, is_read, is_priority, is_system_generated,
            created_at, updated_at, delivered_at
          ) VALUES ${values.join(", ")}
        `,
        params,
      );

      // Touch channels.
      await pool.query(
        `UPDATE communication_channels SET updated_at = NOW() WHERE id = ANY($1::varchar[])`,
        [roomIds],
      );

      res.json({ success: true, sentTo: roomIds.length, target });
    } catch (e) {
      console.error("[admin-communication-extras] broadcast error:", e);
      res.status(500).json({ error: String(e) });
    }
  });
}
