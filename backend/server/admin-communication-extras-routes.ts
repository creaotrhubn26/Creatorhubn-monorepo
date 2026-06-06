// Admin communication-extras routes.
//
// Stub-endepunkter for AdminDashboard "Oversikt" → kommunikasjon-tab.
// Returnerer tomme/forutsigbare strukturer slik at UI ikke krasjer.

import express from "express";
import type { Pool } from "pg";

export interface AdminCommunicationExtrasRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

export function setupAdminCommunicationExtrasRoutes(
  deps: AdminCommunicationExtrasRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  // ─── Rooms ────────────────────────────────────────────────
  app.get("/api/admin/communication/rooms", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ rooms: [], total: 0 });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Messages ─────────────────────────────────────────────
  app.get(
    "/api/admin/communication/messages/:chatId",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        res.json({ messages: [], total: 0 });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    },
  );

  // ─── Send ────────────────────────────────────────────────
  app.post("/api/admin/communication/send", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const { chatId = null, message = "" } = req.body || {};
      res.json({
        success: true,
        messageId: "placeholder-" + Date.now(),
        chatId,
        message,
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Broadcast ────────────────────────────────────────────
  app.post("/api/admin/communication/broadcast", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const { message = "", target = null } = req.body || {};
      res.json({ success: true, sentTo: 0, message, target });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
