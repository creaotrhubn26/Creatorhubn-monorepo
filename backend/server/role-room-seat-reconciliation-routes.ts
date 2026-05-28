/**
 * Reconciliation-endepunkt: sjekker alle aktive Role Room-abonnementer
 * mot faktisk antall aktive medlemmer, og rapporterer/synker drift.
 *
 * To moduser:
 *   - dryRun: rapporter drift uten å gjøre Stripe-endringer (default)
 *   - apply: kjør faktisk syncRoleRoomSeatQuantity for hver drift
 *
 * Brukes:
 *   - Manuelt fra Admin Room ("Kjør reconciliation nå")
 *   - Av Render cron-job (POST med X-Reconcile-Token-header)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { countActiveSeats, syncRoleRoomSeatQuantity, logBillingAlert } from "./role-room-seat-stripe-sync.js";

interface Deps {
  pool: Pool;
  requireAdminSession?: (req: Request, res: Response) => { userId: string } | null;
}

interface ReconcileItem {
  ownerUserId: string;
  ownerEmail: string | null;
  stripeSubscriptionId: string;
  stripeQuantity: number;
  projects: Array<{
    projectId: string;
    projectName: string | null;
    activeMembers: number;
  }>;
  totalActiveAcrossProjects: number;
  drift: number; // stripeQuantity - totalActiveAcrossProjects
  synced?: { ok: boolean; reason?: string; newQuantity?: number };
}

export function registerRoleRoomSeatReconciliationRoutes(app: Express, deps: Deps): void {
  const { pool, requireAdminSession } = deps;

  async function authorize(req: Request, res: Response): Promise<string | null> {
    // 1. Admin-session via cookie
    if (requireAdminSession) {
      const admin = requireAdminSession(req, res);
      if (admin) return admin.userId;
    }
    // 2. Cron-token via header (for Render cron-job)
    const cronToken = process.env.ROLE_ROOM_RECONCILE_CRON_TOKEN;
    const reqToken = String(req.headers["x-reconcile-token"] ?? "").trim();
    if (cronToken && reqToken && cronToken === reqToken) {
      return "cron-job";
    }
    if (!res.headersSent) res.status(401).json({ error: "unauthorized" });
    return null;
  }

  app.post(
    "/api/admin-room/role-room/reconcile-seats",
    async (req: Request, res: Response) => {
      const actorId = await authorize(req, res);
      if (!actorId) return;

      const apply = String(req.query.apply ?? req.body?.apply ?? "").toLowerCase() === "true";

      try {
        // Alle eier-brukere med aktive abonnementer som har minst ett prosjekt
        const { rows: owners } = await pool.query(
          `SELECT DISTINCT s.user_id, s.stripe_subscription_id, u.email
             FROM subscriptions s
             JOIN users u ON u.id = s.user_id
            WHERE s.status IN ('active', 'trialing')
              AND s.stripe_subscription_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM casting_projects WHERE created_by = s.user_id
              )`,
        );

        const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
        if (!stripeKey) {
          res.status(503).json({ error: "stripe_ikke_konfigurert" }); return;
        }
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(stripeKey);

        const items: ReconcileItem[] = [];
        const seenDrift: number[] = [];

        for (const owner of owners as Array<{ user_id: string; stripe_subscription_id: string; email: string | null }>) {
          let stripeQuantity = 0;
          try {
            const sub = await stripe.subscriptions.retrieve(owner.stripe_subscription_id);
            stripeQuantity = sub.items?.data?.[0]?.quantity ?? 0;
          } catch (err) {
            // Sub kan være slettet i Stripe — DB lyver
            await logBillingAlert(pool, {
              projectId: "(reconcile)",
              ownerUserId: owner.user_id,
              actorUserId: actorId,
              kind: "stripe_sync_failed",
              detail: `Reconcile: Stripe.subscriptions.retrieve feilet for ${owner.stripe_subscription_id}: ${(err as Error).message}`,
              stripeSubscriptionId: owner.stripe_subscription_id,
            });
            continue;
          }

          const { rows: projRows } = await pool.query(
            `SELECT id, name FROM casting_projects WHERE created_by = $1`,
            [owner.user_id],
          );
          const projectMembers: Array<{ projectId: string; projectName: string | null; activeMembers: number }> = [];
          let totalActive = 0;
          for (const proj of projRows as Array<{ id: string; name: string | null }>) {
            const used = await countActiveSeats(pool, owner.user_id, proj.id);
            projectMembers.push({
              projectId: proj.id,
              projectName: proj.name,
              activeMembers: used,
            });
            // Eier teller for ALLE prosjekter i countActiveSeats — vi tar
            // bare maks-prosjektet siden samme eier ikke skal multipliseres
            if (used > totalActive) totalActive = used;
          }

          const drift = stripeQuantity - totalActive;
          const item: ReconcileItem = {
            ownerUserId: owner.user_id,
            ownerEmail: owner.email,
            stripeSubscriptionId: owner.stripe_subscription_id,
            stripeQuantity,
            projects: projectMembers,
            totalActiveAcrossProjects: totalActive,
            drift,
          };

          if (drift !== 0) {
            seenDrift.push(drift);
            if (apply) {
              // Bruk det prosjektet som har høyest active-count som "main"
              const top = projectMembers.sort((a, b) => b.activeMembers - a.activeMembers)[0];
              if (top) {
                const sync = await syncRoleRoomSeatQuantity({
                  pool,
                  ownerUserId: owner.user_id,
                  projectId: top.projectId,
                  targetActiveUsers: totalActive,
                  actorUserId: actorId,
                });
                item.synced = {
                  ok: sync.ok,
                  reason: sync.reason,
                  newQuantity: sync.newQuantity,
                };
              }
            } else {
              // Dry-run: logg alert så admin ser drift uten å auto-fikse
              await logBillingAlert(pool, {
                projectId: projectMembers[0]?.projectId ?? "(reconcile)",
                ownerUserId: owner.user_id,
                actorUserId: actorId,
                kind: "stripe_quantity_drift",
                detail: `Reconcile dry-run: Stripe=${stripeQuantity}, aktive=${totalActive}, drift=${drift}. Kjør med apply=true for å synke.`,
                stripeSubscriptionId: owner.stripe_subscription_id,
              });
            }
          }

          items.push(item);
        }

        res.json({
          scannedOwners: owners.length,
          driftCount: seenDrift.length,
          totalDriftMagnitude: seenDrift.reduce((a, b) => a + Math.abs(b), 0),
          mode: apply ? "applied" : "dry_run",
          items,
        });
      } catch (err) {
        console.error("[rr-reconcile] failed:", err);
        res.status(500).json({ error: "intern_feil", detail: (err as Error).message });
      }
    },
  );
}
