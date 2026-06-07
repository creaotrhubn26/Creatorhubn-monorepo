// Admin Google Wallet extras routes.
//
// Stub-endepunkt for AdminDashboard "Lab" → google-wallet-tab.
// Den eksisterende google-wallet-routes.ts har bare per-user-endepunkt
// (/api/google-wallet/membership-cards/:userId). Denne fila legger til
// en liste-all-variant uten :userId, slik at admin-UI kan vise et globalt
// overblikk.

import express from "express";
import type { Pool } from "pg";

export interface AdminGoogleWalletExtrasRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

export function setupAdminGoogleWalletExtrasRoutes(
  deps: AdminGoogleWalletExtrasRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  // ─── List all membership-cards ───────────────────────────
  app.get("/api/google-wallet/membership-cards", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      res.json({ cards: [], total: 0 });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
}
