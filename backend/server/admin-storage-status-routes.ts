/**
 * admin-storage-status-routes.ts
 *
 * Admin-flate for lagringsstatus.
 *
 *   GET /api/admin/storage-status/overview
 *       — utrullingsstatus, bøtter, roller, samlet forbruk og kost
 *   GET /api/admin/storage-status/productions?limit=N
 *       — de største produksjonene med kost per produksjon
 *   GET /api/admin/storage-status/egress?days=N
 *       — kontoer målt mot gratis egress-kvoten
 *
 * Alt er admin-gated. Flata viser fordelingen leverandørfakturaen aldri
 * gjør: hvilken produksjon, hvilken kunde, hvilken backend.
 */

import express from "express";
import type { Pool } from "pg";
import { describeBuckets } from "./b2-bucket-registry.js";
import { describeKeyRoles } from "./b2-key-registry.js";
import {
  accountEgress,
  platformMargin,
  productionCosts,
  rolloutStatus,
  type AccountEgressInput,
  type ProductionUsageRow,
} from "./admin-storage-status-service.js";
import {
  backendCostBasis,
  costNokPerGbMonth,
  storageMarkup,
} from "./storage-cost-model.js";
import { getStorageStatus as getObjectStoreStatus } from "./upload-storage-router.js";

export interface AdminStorageStatusRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

/** Tak på hvor mange rader én forespørsel kan be om. */
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 25;

const clampLimit = (raw: unknown): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
};

const clampDays = (raw: unknown): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return Math.min(Math.floor(parsed), 365);
};

export function setupAdminStorageStatusRoutes(
  deps: AdminStorageStatusRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  app.get("/api/admin/storage-status/overview", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const roles = describeKeyRoles();
      const buckets = describeBuckets();

      // Samlet forbruk per backend. COALESCE fordi tabellen er tom før
      // første opplasting, og SUM over null rader gir NULL — ikke 0.
      const totals = await pool
        .query<{
          b2: string;
          r2: string;
          stream: string;
          filesystem: string;
          productions: string;
        }>(
          `SELECT COALESCE(SUM(b2_bytes), 0)         AS b2,
                  COALESCE(SUM(r2_bytes), 0)         AS r2,
                  COALESCE(SUM(stream_bytes), 0)     AS stream,
                  COALESCE(SUM(filesystem_bytes), 0) AS filesystem,
                  COUNT(*)                           AS productions
             FROM role_room_production_storage`,
        )
        .catch(() => null);

      const row = totals?.rows[0];
      const usages = [
        { backend: "b2" as const, storedBytes: Number(row?.b2 ?? 0) },
        { backend: "r2" as const, storedBytes: Number(row?.r2 ?? 0) },
        {
          backend: "cloudflare_stream" as const,
          storedBytes: Number(row?.stream ?? 0),
        },
        {
          backend: "filesystem" as const,
          storedBytes: Number(row?.filesystem ?? 0),
        },
      ];

      res.json({
        rollout: rolloutStatus(roles, buckets),
        keyRoles: roles,
        buckets,
        objectStore: getObjectStoreStatus(),
        usage: {
          productionCount: Number(row?.productions ?? 0),
          byBackend: Object.fromEntries(
            usages.map((u) => [u.backend, u.storedBytes]),
          ),
          totalBytes: usages.reduce((s, u) => s + u.storedBytes, 0),
        },
        // Inntekten kjenner vi ikke her — den ligger i Stripe. Marginen
        // rapporteres derfor mot 0 og er negativ; frontend sender inn
        // faktisk inntekt når den har den. Å gjette et tall ville vært
        // verre enn å vise at det mangler.
        cost: platformMargin(usages, 0),
        costBasis: {
          perBackend: backendCostBasis(),
          blendedNokPerGbMonth: costNokPerGbMonth(),
          markupMultiplier: storageMarkup(),
        },
      });
    } catch (err) {
      console.error("[admin-storage-status] overview feilet:", err);
      res.status(500).json({ error: "overview_failed" });
    }
  });

  app.get("/api/admin/storage-status/productions", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const limit = clampLimit(req.query.limit);
    try {
      const r = await pool.query(
        `SELECT s.project_id, s.billing_user_id, s.used_bytes, s.b2_bytes,
                s.r2_bytes, s.stream_bytes, s.filesystem_bytes, s.file_count,
                p.name AS project_name
           FROM role_room_production_storage s
           LEFT JOIN casting_projects p ON p.id = s.project_id
          ORDER BY s.used_bytes DESC
          LIMIT $1`,
        [limit],
      );
      const rows: ProductionUsageRow[] = r.rows.map((x) => ({
        projectId: String(x.project_id),
        projectName: x.project_name ?? null,
        billingUserId: String(x.billing_user_id),
        usedBytes: Number(x.used_bytes),
        b2Bytes: Number(x.b2_bytes),
        r2Bytes: Number(x.r2_bytes),
        streamBytes: Number(x.stream_bytes),
        filesystemBytes: Number(x.filesystem_bytes),
        fileCount: Number(x.file_count),
      }));
      res.json({ limit, ...productionCosts(rows) });
    } catch (err) {
      console.error("[admin-storage-status] produksjoner feilet:", err);
      res.status(500).json({ error: "productions_failed" });
    }
  });

  app.get("/api/admin/storage-status/egress", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const days = clampDays(req.query.days);
    const limit = clampLimit(req.query.limit);
    try {
      // Egress og lagret mengde kommer fra hvert sitt sted: egress fra
      // hendelsesloggen, lagret mengde fra kontoledgeren. Kvoten er et
      // multiplum av det lagrede, så begge må med — én av dem alene sier
      // ingenting om hvor nær grensen kontoen er.
      const r = await pool.query(
        `SELECT e.user_id,
                u.email,
                COALESCE(SUM(e.estimated_bytes), 0) AS egress_bytes,
                COALESCE(MAX(c.total_bytes), 0)     AS stored_bytes
           FROM storage_egress_events e
           LEFT JOIN users u ON u.id = e.user_id
           LEFT JOIN user_storage_consumption c ON c.user_id = e.user_id
          WHERE e.created_at >= now() - ($1 || ' days')::interval
            AND e.backend = 'b2'
          GROUP BY e.user_id, u.email
          ORDER BY egress_bytes DESC
          LIMIT $2`,
        [String(days), limit],
      );
      const rows: AccountEgressInput[] = r.rows.map((x) => ({
        userId: String(x.user_id),
        email: x.email ?? null,
        storedBytes: Number(x.stored_bytes),
        egressBytes: Number(x.egress_bytes),
        backend: "b2" as const,
      }));
      const accounts = accountEgress(rows);
      res.json({
        days,
        limit,
        accounts,
        approachingLimit: accounts.filter((a) => a.approachingLimit).length,
        // Tallet er et estimat: vi ser aldri bytene passere, bare at en
        // signert URL ble utstedt. Flagget følger med så ingen leser det
        // som en faktura.
        estimated: true,
      });
    } catch (err) {
      console.error("[admin-storage-status] egress feilet:", err);
      res.status(500).json({ error: "egress_failed" });
    }
  });
}
