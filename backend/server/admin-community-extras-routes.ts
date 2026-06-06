// Admin community-extras routes.
//
// Stub-endepunkter for AdminDashboard "Oversikt" → community-tab.
// Returnerer tomme/forutsigbare strukturer slik at UI ikke krasjer.
// Erstattes med ekte logikk når community-modulen får faktisk admin-backend.

import express from "express";
import type { Pool } from "pg";

export interface AdminCommunityExtrasRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

export function setupAdminCommunityExtrasRoutes(
  deps: AdminCommunityExtrasRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  // ─── Groups ────────────────────────────────────────────────
  app.get("/api/community/admin/groups", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ groups: [], total: 0 });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/community/admin/groups", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const { name = "", description = "" } = req.body || {};
      res.json({
        success: true,
        id: "placeholder-" + Date.now(),
        name,
        description,
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Channels ──────────────────────────────────────────────
  app.get("/api/community/admin/channels", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ channels: [], total: 0 });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/community/admin/channels", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ success: true, id: "placeholder-" + Date.now() });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/community/admin/channels/:id/rules", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ rules: [] });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/community/admin/channels/:id/rules", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Roles & badges ───────────────────────────────────────
  app.get("/api/community/admin/roles", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ roles: [] });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/community/admin/badges", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ badges: [] });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Analytics ────────────────────────────────────────────
  app.get("/api/community/admin/analytics", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ totalMembers: 0, activeMembers: 0, postCount: 0 });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Light-patterns (promotion candidates) ────────────────
  app.get(
    "/api/community/admin/light-patterns/promotion-candidates",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        res.json({ candidates: [] });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    },
  );

  app.get(
    "/api/community/admin/light-patterns/promotion-thresholds",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        res.json({ thresholds: { messageCount: 100, reactions: 10 } });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    },
  );

  app.post(
    "/api/community/admin/light-patterns/:id/promote",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    },
  );

  // ─── Moderation ───────────────────────────────────────────
  app.get("/api/community/moderation/rules", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ rules: [] });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── Onboarding (no-op fallback for admin-UI) ─────────────
  // Merk: community-routes.ts har den ekte POST /api/community/onboard-user.
  // For å unngå double-mount registrerer vi en alias-route som peker
  // til samme placeholder-respons men under et admin-prefix.
  app.post("/api/admin/community/onboard-user", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const { userId = null } = req.body || {};
      res.json({ success: true, userId });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
