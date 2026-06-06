/**
 * role-room-ig-messaging-routes.ts — Instagram Direct-message inbox endpoints
 * for the unified social inbox in The Role Room CRM.
 *
 * Auth: requireAdminSession on all endpoints (user-isolated via the connection
 * lookup). The webhook that feeds inbound messages lives in
 * role-room-social-meta-routes.ts and calls persistInboundDmFromWebhook().
 *
 * Endpoints (all under /api/role-room/instagram/messaging):
 *   GET  /connections
 *   GET  /conversations?connectionId=...
 *   GET  /conversations/:conversationId/messages?connectionId=...
 *   POST /conversations/:conversationId/reply         { connectionId, text }
 *   POST /conversations/:conversationId/link-customer { connectionId, customerId }
 */

import type express from "express";
import type { Pool } from "pg";
import {
  getConnection,
  listInstagramConnections,
  ensureFreshConnection,
} from "./role-room-instagram-oauth.js";
import {
  ensureIgMessagingSchema,
  listConversations,
  getConversation,
  listMessages,
  markConversationRead,
  syncConversationsFromGraph,
  syncMessagesFromGraph,
  sendReply,
} from "./role-room-ig-messaging.js";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomIgMessagingRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
}

export function setupRoleRoomIgMessagingRoutes(deps: RoleRoomIgMessagingRoutesDeps): void {
  const { app, pool, requireAdminSession } = deps;

  const BASE = "/api/role-room/instagram/messaging";

  // List connected IG accounts (the inbox account-picker).
  app.get(`${BASE}/connections`, async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      await ensureIgMessagingSchema(pool);
      const connections = await listInstagramConnections(pool, session.userId);
      res.json({
        success: true,
        connections: connections.map((c) => ({
          id: c.id,
          igUsername: c.igUsername,
          igBusinessAccountId: c.igBusinessAccountId,
          facebookPageName: c.facebookPageName,
          profilePictureUrl: c.profilePictureUrl,
          hasMessagingScope: c.scopes.includes("instagram_manage_messages"),
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // List conversations for a connection (DB-first; best-effort Graph sync).
  app.get(`${BASE}/conversations`, async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const connectionId = typeof req.query.connectionId === "string" ? req.query.connectionId : "";
    if (!connectionId) {
      res.status(400).json({ success: false, error: "connectionId is required" });
      return;
    }
    try {
      await ensureIgMessagingSchema(pool);
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      let syncError: string | null = null;
      try {
        const fresh = await ensureFreshConnection(pool, connection);
        const sync = await syncConversationsFromGraph(pool, fresh);
        syncError = sync.error;
      } catch (e) {
        syncError = String(e instanceof Error ? e.message : e);
      }
      const conversations = await listConversations(pool, connection);
      res.json({
        success: true,
        conversations,
        totalUnread: conversations.reduce((n, c) => n + c.unreadCount, 0),
        // Surfaced so the UI can explain "waiting for messages / permission pending".
        syncError,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Messages of one conversation (DB-first; best-effort Graph sync; marks read).
  app.get(`${BASE}/conversations/:conversationId/messages`, async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const connectionId = typeof req.query.connectionId === "string" ? req.query.connectionId : "";
    const { conversationId } = req.params;
    if (!connectionId) {
      res.status(400).json({ success: false, error: "connectionId is required" });
      return;
    }
    try {
      await ensureIgMessagingSchema(pool);
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      const conversation = await getConversation(pool, conversationId, session.userId);
      if (!conversation) {
        res.status(404).json({ success: false, error: "conversation_not_found" });
        return;
      }
      let syncError: string | null = null;
      try {
        const fresh = await ensureFreshConnection(pool, connection);
        const sync = await syncMessagesFromGraph(pool, fresh, conversation);
        syncError = sync.error;
      } catch (e) {
        syncError = String(e instanceof Error ? e.message : e);
      }
      const messages = await listMessages(pool, conversationId);
      await markConversationRead(pool, conversationId, session.userId);
      res.json({ success: true, conversation, messages, syncError });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Send a reply (hits Graph; obeys Meta's 24h window + reply-only rules).
  app.post(`${BASE}/conversations/:conversationId/reply`, async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as { connectionId?: string; text?: string };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const { conversationId } = req.params;
    if (!connectionId || !text) {
      res.status(400).json({ success: false, error: "connectionId and text are required" });
      return;
    }
    try {
      await ensureIgMessagingSchema(pool);
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      if (connection.connectionState !== "connected") {
        res.status(409).json({ success: false, error: "connection_expired" });
        return;
      }
      const conversation = await getConversation(pool, conversationId, session.userId);
      if (!conversation) {
        res.status(404).json({ success: false, error: "conversation_not_found" });
        return;
      }
      const fresh = await ensureFreshConnection(pool, connection);
      const result = await sendReply(pool, fresh, conversation, text);
      if (!result.success) {
        res.status(502).json({ success: false, error: result.error });
        return;
      }
      const messages = await listMessages(pool, conversationId);
      res.json({ success: true, messageId: result.messageId, messages });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Link a conversation to a CRM customer (bridge via crm_conversation_links).
  app.post(`${BASE}/conversations/:conversationId/link-customer`, async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as { connectionId?: string; customerId?: string };
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
    const customerId = typeof body.customerId === "string" ? body.customerId : "";
    const { conversationId } = req.params;
    if (!connectionId || !customerId) {
      res.status(400).json({ success: false, error: "connectionId and customerId are required" });
      return;
    }
    try {
      await ensureIgMessagingSchema(pool);
      const connection = await getConnection(pool, connectionId, session.userId);
      if (!connection) {
        res.status(404).json({ success: false, error: "connection_not_found" });
        return;
      }
      const conversation = await getConversation(pool, conversationId, session.userId);
      if (!conversation) {
        res.status(404).json({ success: false, error: "conversation_not_found" });
        return;
      }
      await pool.query(
        `UPDATE role_room_instagram_conversations SET crm_customer_id = $2, updated_at = now()
           WHERE id = $1 AND user_id = $3`,
        [conversationId, customerId, session.userId],
      );
      // Best-effort bridge row for the CRM (table may not exist in all envs).
      try {
        await pool.query(
          `INSERT INTO crm_conversation_links
             (provider, conversation_id, customer_id, confidence, matched_by, metadata, created_by)
           VALUES ('instagram_dm', $1, $2, 100, 'manual', $3::jsonb, $4)
           ON CONFLICT DO NOTHING`,
          [
            conversation.id,
            customerId,
            JSON.stringify({
              igUsername: conversation.participantUsername,
              participantIgsid: conversation.participantIgsid,
            }),
            session.userId,
          ],
        );
      } catch {
        /* crm_conversation_links optional — ignore if absent */
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });
}
