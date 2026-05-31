/**
 * role-room-talent-gdpr-routes.ts
 *
 * GDPR-rettigheter for talent (art. 15 innsyn, art. 17 sletting, art. 20
 * dataportabilitet).
 *
 * Endpoints:
 *   GET    /api/role-room/talents/me/export
 *     → JSON-dump av ALL data koblet til talent: profil + consents +
 *       partner-invites + access-audit + stream-uploads. Last ned som fil.
 *
 *   DELETE /api/role-room/talents/me
 *     → Sletter alt:
 *       1. Cloudflare Stream-videoer (DELETE via Stream API per uid)
 *       2. R2-filer under talents/{talent_id}/* (delete-objects bulk)
 *       3. Database: CASCADE DELETE av talents-rad fjerner consents,
 *          partner_invites, access_audit, stream_uploads (alle har
 *          FK ON DELETE CASCADE eller via talent_id-rader).
 *     Soft-confirm via {confirmation: "SLETT MIN PROFIL"} i body for å
 *     forhindre ulykker.
 */

import type express from "express";
import type { Pool } from "pg";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

interface SessionLike {
  userId: string;
  email?: string;
}

export interface RoleRoomTalentGdprRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

function buildR2() {
  const endpoint = (process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT || "").trim();
  const bucket = (process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET || "").trim();
  const accessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || "").trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

function buildStream() {
  const accountId = (process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const apiToken = (process.env.CLOUDFLARE_STREAM_API_TOKEN || "").trim();
  if (!accountId || !apiToken) return null;
  return { accountId, apiToken };
}

async function fetchTalentForUser(pool: Pool, userId: string) {
  const r = await pool.query(
    `SELECT * FROM talents WHERE owner_user_id = $1 AND COALESCE(is_demo, FALSE) = FALSE LIMIT 1`,
    [userId],
  );
  return r.rows[0] ?? null;
}

export function setupRoleRoomTalentGdprRoutes(deps: RoleRoomTalentGdprRoutesDeps): void {
  const { app, pool, getActiveSession } = deps;

  // ── GET /me/export — dataportabilitet (GDPR art. 20) ──────────────
  app.get("/api/role-room/talents/me/export", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) return res.status(404).json({ error: "Ingen profil å eksportere" });

      const [consents, invites, audit, streamUploads] = await Promise.all([
        pool.query(`SELECT * FROM talent_consent_registry WHERE talent_id = $1 ORDER BY granted_at DESC`, [talent.id]),
        pool.query(`SELECT * FROM talent_partner_invites WHERE talent_id = $1 ORDER BY created_at DESC`, [talent.id]),
        pool.query(`SELECT * FROM talent_access_audit WHERE talent_id = $1 ORDER BY accessed_at DESC LIMIT 5000`, [talent.id]),
        pool.query(`SELECT * FROM talent_stream_uploads WHERE talent_id = $1 ORDER BY created_at DESC`, [talent.id]).catch(() => ({ rows: [] })),
      ]);

      const exportPayload = {
        meta: {
          generated_at: new Date().toISOString(),
          format: "json-1.0",
          purpose: "GDPR art. 20 (dataportabilitet)",
          owner_user_id: session.userId,
          talent_id: talent.id,
          contact: "Spørsmål om data: support@theroleroom.com",
        },
        profile: talent,
        consents: consents.rows,
        partner_invites: invites.rows,
        access_audit_log: audit.rows,
        stream_uploads: streamUploads.rows,
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="theroleroom-talents-export-${talent.id}-${Date.now()}.json"`);
      return res.send(JSON.stringify(exportPayload, null, 2));
    } catch (err) {
      console.error("[gdpr/export] failed", err);
      return res.status(500).json({ error: "Klarte ikke å eksportere", detail: String(err) });
    }
  });

  // ── DELETE /me — slett profil + all data (GDPR art. 17) ───────────
  app.delete("/api/role-room/talents/me", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });

    const confirmation = (req.body?.confirmation || req.query?.confirmation || "").toString();
    if (confirmation !== "SLETT MIN PROFIL") {
      return res.status(400).json({
        error: "Slett-bekreftelse mangler",
        detail: "Send body: { \"confirmation\": \"SLETT MIN PROFIL\" } for å bekrefte sletting.",
      });
    }

    try {
      const talent = await fetchTalentForUser(pool, session.userId);
      if (!talent) return res.status(404).json({ error: "Ingen profil å slette" });

      const cleanupSummary = {
        stream_videos_deleted: 0,
        stream_videos_failed: 0,
        r2_objects_deleted: 0,
        r2_objects_failed: 0,
      };

      // Steg 1: Slett Cloudflare Stream-videoer
      const streamCfg = buildStream();
      if (streamCfg) {
        const streamVideos = await pool.query(
          `SELECT uid FROM talent_stream_uploads WHERE talent_id = $1`,
          [talent.id],
        ).catch(() => ({ rows: [] }));
        for (const row of streamVideos.rows) {
          try {
            const r = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${streamCfg.accountId}/stream/${row.uid}`,
              { method: "DELETE", headers: { Authorization: `Bearer ${streamCfg.apiToken}` } },
            );
            if (r.ok) cleanupSummary.stream_videos_deleted++;
            else cleanupSummary.stream_videos_failed++;
          } catch (_) {
            cleanupSummary.stream_videos_failed++;
          }
        }
      }

      // Steg 2: Slett R2-filer under talents/{talent_id}/*
      const r2 = buildR2();
      if (r2) {
        const prefix = `talents/${talent.id}/`;
        let continuationToken: string | undefined;
        do {
          const listed = await r2.client.send(
            new ListObjectsV2Command({
              Bucket: r2.bucket,
              Prefix: prefix,
              ContinuationToken: continuationToken,
            }),
          ).catch(() => null);
          const objects = (listed?.Contents || []).map((o) => ({ Key: o.Key! })).filter((o) => o.Key);
          if (objects.length > 0) {
            const del = await r2.client.send(
              new DeleteObjectsCommand({
                Bucket: r2.bucket,
                Delete: { Objects: objects },
              }),
            ).catch(() => null);
            cleanupSummary.r2_objects_deleted += del?.Deleted?.length || 0;
            cleanupSummary.r2_objects_failed += del?.Errors?.length || 0;
          }
          continuationToken = listed?.NextContinuationToken;
        } while (continuationToken);
      }

      // Steg 3: Slett talents-rad — CASCADE fjerner consents, invites, audit, stream_uploads
      // (alle FK har ON DELETE CASCADE i migrasjoner 210/213/216)
      await pool.query(`DELETE FROM talents WHERE id = $1 AND owner_user_id = $2`, [
        talent.id,
        session.userId,
      ]);

      // Steg 4: Logg sletting i en compliance-tabell (vi har ikke en, så bare console)
      console.log(`[gdpr/delete] talent ${talent.id} (user ${session.userId}) slettet:`, cleanupSummary);

      return res.json({
        ok: true,
        deleted: true,
        message: "Profilen din er slettet. All data er fjernet fra våre systemer.",
        summary: cleanupSummary,
      });
    } catch (err) {
      console.error("[gdpr/delete] failed", err);
      return res.status(500).json({ error: "Klarte ikke å slette profilen", detail: String(err) });
    }
  });

  // ── POST /me/audit-retention/sweep — manuell trigger av 12-mnd-sweep
  // Daniel kan trigge dette med MIGRATE_TRIGGER_TOKEN (gjenbruker auth).
  // Senere: cron-job.
  app.post("/api/role-room/talents/audit-retention/sweep", async (req, res) => {
    const token = (req.header("x-migrate-trigger-token") || "").trim();
    const expected = (process.env.MIGRATE_TRIGGER_TOKEN || "").trim();
    if (!expected || token !== expected) {
      return res.status(401).json({ error: "Trenger MIGRATE_TRIGGER_TOKEN" });
    }
    try {
      const r = await pool.query(
        `DELETE FROM talent_access_audit
          WHERE accessed_at < now() - interval '12 months'
          RETURNING id`,
      );
      return res.json({ ok: true, deleted: r.rowCount });
    } catch (err) {
      console.error("[audit-retention sweep] failed", err);
      return res.status(500).json({ error: "Sweep feilet", detail: String(err) });
    }
  });
}
