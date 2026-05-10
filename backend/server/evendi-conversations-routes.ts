/**
 * evendi-conversations-routes.ts
 *
 * Setup-funksjon for /api/evendi/conversations* endpoints — vendor-side
 * chat-funksjonalitet med brudepar.
 *
 * 3 endpoints:
 *   - GET  /conversations                          (list conversations for logged-in vendor)
 *   - GET  /conversations/:id/messages             (messages + mark as read)
 *   - POST /conversations/:id/messages             (send melding som vendor)
 *
 * Auth: token-basert (Bearer-token i Authorization-header → activeSessions
 * map → vendor lookup via email). Distinkt fra getVendorFromSession-
 * mønsteret: disse endpoints joiner direkte mot conversations-tabellen
 * for ownership-sjekk.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupEvendiConversationsRoutes } from "./evendi-conversations-routes";
 *
 *   setupEvendiConversationsRoutes({
 *     app, pool,
 *     getSessionByToken: (token) => activeSessions.get(token) ?? null,
 *   });
 *
 * Mode-noter: ingen Role Room-mode-branching.
 */

import type express from "express";
import type { Pool } from "pg";

interface SessionLite {
  email: string;
}

export interface EvendiConversationsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getSessionByToken: (token: string) => SessionLite | null;
}

export function setupEvendiConversationsRoutes(
  deps: EvendiConversationsRoutesDeps,
): void {
  const { app, pool, getSessionByToken } = deps;

  // GET /api/evendi/conversations — List conversations for logged-in vendor
  app.get("/api/evendi/conversations", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const session = token ? getSessionByToken(token) : null;
      if (!session) return res.status(401).json({ error: "Ikke autentisert" });

      // Find vendor by session email
      const vendorResult = await pool.query(
        "SELECT id, business_name, email FROM vendors WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [session.email],
      );
      if (!vendorResult.rows.length) {
        return res
          .status(404)
          .json({ error: "Ingen vendor-profil funnet for denne brukeren" });
      }
      const vendor = vendorResult.rows[0];

      // Get all conversations for this vendor with couple info and last message
      const result = await pool.query(
        `
        SELECT
          c.id,
          c.couple_id,
          c.vendor_id,
          c.status,
          c.last_message_at,
          c.vendor_unread_count,
          c.couple_unread_count,
          c.created_at,
          cp.display_name as couple_name,
          cp.email as couple_email,
          (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
          (SELECT m.sender_type FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_sender
        FROM conversations c
        JOIN couple_profiles cp ON cp.id = c.couple_id
        WHERE c.vendor_id = $1
          AND c.deleted_by_vendor = false
        ORDER BY c.last_message_at DESC NULLS LAST
      `,
        [vendor.id],
      );

      res.json({
        conversations: result.rows,
        vendorId: vendor.id,
        vendorName: vendor.business_name,
      });
    } catch (error) {
      console.error("Evendi conversations error:", error);
      res.status(500).json({ error: "Kunne ikke hente samtaler" });
    }
  });

  // GET /api/evendi/conversations/:id/messages — Get messages for a conversation
  app.get("/api/evendi/conversations/:id/messages", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const session = token ? getSessionByToken(token) : null;
      if (!session) return res.status(401).json({ error: "Ikke autentisert" });

      const conversationId = req.params.id;

      // Verify vendor owns this conversation
      const vendorResult = await pool.query(
        "SELECT v.id FROM vendors v JOIN conversations c ON c.vendor_id = v.id WHERE LOWER(v.email) = LOWER($1) AND c.id = $2",
        [session.email, conversationId],
      );
      if (!vendorResult.rows.length) {
        return res
          .status(403)
          .json({ error: "Ingen tilgang til denne samtalen" });
      }

      // Get messages
      const result = await pool.query(
        `
        SELECT
          m.id,
          m.conversation_id,
          m.sender_type,
          m.sender_id,
          m.body,
          m.created_at,
          m.read_at,
          m.attachment_url,
          m.attachment_type
        FROM messages m
        WHERE m.conversation_id = $1
          AND m.deleted_by_vendor = false
        ORDER BY m.created_at ASC
      `,
        [conversationId],
      );

      // Mark vendor unread count as 0
      await pool.query(
        "UPDATE conversations SET vendor_unread_count = 0 WHERE id = $1",
        [conversationId],
      );

      // Get conversation info
      const convResult = await pool.query(
        `
        SELECT c.*, cp.display_name as couple_name, cp.email as couple_email
        FROM conversations c
        JOIN couple_profiles cp ON cp.id = c.couple_id
        WHERE c.id = $1
      `,
        [conversationId],
      );

      res.json({
        messages: result.rows,
        conversation: convResult.rows[0] || null,
      });
    } catch (error) {
      console.error("Evendi messages error:", error);
      res.status(500).json({ error: "Kunne ikke hente meldinger" });
    }
  });

  // POST /api/evendi/conversations/:id/messages — Send a message as vendor
  app.post("/api/evendi/conversations/:id/messages", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const session = token ? getSessionByToken(token) : null;
      if (!session) return res.status(401).json({ error: "Ikke autentisert" });

      const conversationId = req.params.id;
      const { body } = req.body;
      if (!body?.trim())
        return res.status(400).json({ error: "Meldingstekst er påkrevd" });

      // Verify vendor owns this conversation
      const vendorResult = await pool.query(
        "SELECT v.id, v.business_name FROM vendors v JOIN conversations c ON c.vendor_id = v.id WHERE LOWER(v.email) = LOWER($1) AND c.id = $2",
        [session.email, conversationId],
      );
      if (!vendorResult.rows.length) {
        return res
          .status(403)
          .json({ error: "Ingen tilgang til denne samtalen" });
      }
      const vendorId = vendorResult.rows[0].id;

      // Insert message
      const msgResult = await pool.query(
        `
        INSERT INTO messages (conversation_id, sender_type, sender_id, body)
        VALUES ($1, 'vendor', $2, $3)
        RETURNING id, conversation_id, sender_type, sender_id, body, created_at
      `,
        [conversationId, vendorId, body.trim()],
      );

      // Update conversation
      await pool.query(
        `
        UPDATE conversations
        SET last_message_at = NOW(),
            couple_unread_count = couple_unread_count + 1
        WHERE id = $1
      `,
        [conversationId],
      );

      res.json({ message: msgResult.rows[0] });
    } catch (error) {
      console.error("Evendi send message error:", error);
      res.status(500).json({ error: "Kunne ikke sende melding" });
    }
  });
}
