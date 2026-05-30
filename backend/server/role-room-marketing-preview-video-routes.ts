/**
 * Preview-video-upload for marketing-plan-posts.
 *
 * Bjarne eksporterer et lavoppløst proxy-klipp (typisk 720p H.264) av
 * timelinen sin i Post Agent og laster det opp her. URLen lagres på
 * role_room_marketing_plan_posts, og klient-portal-routen sender den
 * videre som signed URL ved siden av kommentar-feltet.
 *
 * Endepunkt:
 *   POST /api/role-room/marketing-plan-posts/:postId/preview-video
 *   multipart/form-data: field "video" = mp4/webm/mov
 *
 * Auth: RR_BEARER_TOKEN. Brukeren må eie prosjektet eller være
 * medlem (samme tilgangsmodell som rest av role-room).
 *
 * Lagring: R2 (gjenbruker capture-bucket-config). Key-prefix:
 *   marketing-preview/{projectId}/{postId}/{timestamp}-{filename}
 * Signed URL caches på raden (re-signes når klient-portalen henter).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import multer from "multer";
import crypto from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  buildCaptureR2Config,
  signAssetReadUrlForDelivery,
} from "./capture-upload-service.js";
import {
  isStreamEnabled,
  uploadToStream,
  getStreamVideoStatus,
  deleteStreamVideo,
} from "./cloudflare-stream-service.js";
import { notifyClientsOfNewPreview } from "./marketing-preview-email-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB — proxy ≪ raw
const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

const previewVideoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES },
});

function getUserIdFromRequest(
  req: Request,
  activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
  }
  return null;
}

async function viewerCanEditProject(
  pool: Pool,
  projectId: string,
  viewerId: string,
): Promise<boolean> {
  const { rows } = await pool.query<{ owns: boolean; member: boolean }>(
    `SELECT
       EXISTS(SELECT 1 FROM casting_projects
               WHERE id = $1 AND created_by = $2) AS owns,
       EXISTS(SELECT 1 FROM casting_user_roles
               WHERE project_id = $1 AND user_id = $2
                 AND deactivated_at IS NULL) AS member`,
    [projectId, viewerId],
  );
  return rows[0]?.owns === true || rows[0]?.member === true;
}

function sanitizeFilename(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^[._]+/, "")
    .slice(0, 120) || "preview.mp4";
}

function buildPreviewKey(projectId: string, postId: string, filename: string): string {
  const ts = Date.now();
  const rand = crypto.randomBytes(4).toString("hex");
  return `marketing-preview/${projectId}/${postId}/${ts}-${rand}-${sanitizeFilename(filename)}`;
}

export function registerRoleRoomMarketingPreviewVideoRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  // Liste-endepunkt Bjarne bruker fra Tauri-app for å velge hvilken
  // marketing-plan-post han skal koble preview-videoen til. Returnerer
  // kun post-felter han trenger for valg + nåværende preview-status.
  app.get(
    "/api/role-room/marketing-preview/posts",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = String(req.query.projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "mangler_project_id" }); return;
      }
      if (!(await viewerCanEditProject(pool, projectId, viewerId))) {
        res.status(403).json({ error: "ingen_tilgang" }); return;
      }
      const { rows } = await pool.query<{
        id: string; dayOffset: number | null; hook: string; format: string;
        status: string; previewStreamUid: string | null;
        previewStreamReady: boolean; previewUploadedAt: Date | null;
      }>(
        `SELECT p.id,
                p.day_offset       AS "dayOffset",
                p.hook,
                p.format,
                p.status,
                p.preview_stream_uid       AS "previewStreamUid",
                p.preview_stream_ready     AS "previewStreamReady",
                p.preview_video_uploaded_at AS "previewUploadedAt"
           FROM role_room_marketing_plan_posts p
           JOIN role_room_marketing_plans mp ON mp.id = p.plan_id
          WHERE mp.project_id = $1
            AND mp.status = 'active'
          ORDER BY p.day_offset NULLS LAST, p.sort_order`,
        [projectId],
      );
      res.status(200).json({
        ok: true,
        posts: rows.map(r => ({
          ...r,
          hasPreview: !!r.previewStreamUid,
        })),
      });
    },
  );

  app.post(
    "/api/role-room/marketing-plan-posts/:postId/preview-video",
    previewVideoUpload.single("video"),
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }

      const postId = req.params.postId;
      if (!postId) {
        res.status(400).json({ error: "mangler_post_id" }); return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "mangler_video" }); return;
      }
      if (!ALLOWED_MIME.has(file.mimetype)) {
        res.status(415).json({ error: "ugyldig_filtype", mime: file.mimetype }); return;
      }

      // Slå opp prosjekt-id via plan_id → marketing_plan → project_id
      const { rows: postRows } = await pool.query<{ projectId: string }>(
        `SELECT mp.project_id AS "projectId"
           FROM role_room_marketing_plan_posts p
           JOIN role_room_marketing_plans mp ON mp.id = p.plan_id
          WHERE p.id = $1`,
        [postId],
      );
      const projectId = postRows[0]?.projectId;
      if (!projectId) {
        res.status(404).json({ error: "post_ikke_funnet" }); return;
      }

      if (!(await viewerCanEditProject(pool, projectId, viewerId))) {
        res.status(403).json({ error: "ingen_tilgang" }); return;
      }

      // ── Pipeline 1: Cloudflare Stream (primær) ─────────────────────
      if (isStreamEnabled()) {
        try {
          const result = await uploadToStream(file.buffer, file.mimetype, {
            projectId, postId,
            filename: file.originalname || "preview.mp4",
          });
          await pool.query(
            `UPDATE role_room_marketing_plan_posts
                SET preview_stream_uid = $1,
                    preview_stream_ready = $2,
                    preview_stream_playback_url = $3,
                    preview_stream_thumbnail_url = $4,
                    preview_stream_duration_sec = $5,
                    preview_video_uploaded_at = now(),
                    preview_video_mime = $6,
                    preview_video_bytes = $7,
                    updated_at = now()
              WHERE id = $8`,
            [
              result.uid, result.ready,
              result.playbackUrl, result.thumbnailUrl,
              result.duration ?? null,
              file.mimetype, file.size, postId,
            ],
          );
          // Email-notify klient(er) i bakgrunnen — best-effort.
          void notifyClientsOfNewPreview({ pool, projectId, postId });

          res.status(200).json({
            ok: true,
            pipeline: "cloudflare-stream",
            postId,
            streamUid: result.uid,
            playbackUrl: result.playbackUrl,
            thumbnailUrl: result.thumbnailUrl,
            ready: result.ready,
            duration: result.duration,
            uploadedAt: new Date().toISOString(),
          });
          return;
        } catch (e) {
          console.error("[marketing-preview] Stream-upload feilet, faller tilbake til R2", e);
          // fall through til R2-pipelinen
        }
      }

      // ── Pipeline 2: R2 fallback ────────────────────────────────────
      const cfg = buildCaptureR2Config();
      if (!cfg.enabled || !cfg.bucket) {
        res.status(503).json({ error: "ingen_storage_konfigurert" }); return;
      }
      const client = new S3Client({
        region: "auto",
        endpoint: cfg.endpoint,
        credentials: {
          accessKeyId: cfg.accessKeyId!,
          secretAccessKey: cfg.secretAccessKey!,
        },
      });

      const key = buildPreviewKey(projectId, postId, file.originalname || "preview.mp4");
      try {
        await client.send(new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }));
      } catch (e) {
        console.error("[marketing-preview] R2 PutObject feilet", e);
        res.status(502).json({ error: "opplasting_feilet" }); return;
      }

      const signedUrl = await signAssetReadUrlForDelivery(key);

      await pool.query(
        `UPDATE role_room_marketing_plan_posts
            SET preview_video_key = $1,
                preview_video_url = $2,
                preview_video_uploaded_at = now(),
                preview_video_mime = $3,
                preview_video_bytes = $4,
                updated_at = now()
          WHERE id = $5`,
        [key, signedUrl, file.mimetype, file.size, postId],
      );

      // Email-notify klient(er) i bakgrunnen — best-effort.
      void notifyClientsOfNewPreview({ pool, projectId, postId });

      res.status(200).json({
        ok: true,
        pipeline: "r2",
        postId,
        previewVideoUrl: signedUrl,
        uploadedAt: new Date().toISOString(),
        bytes: file.size,
      });
    },
  );

  // Polling-endepunkt for å sjekke om Stream er ferdig transcoded.
  // Frontend kan ringe denne hver 3-5 sek etter upload til ready=true.
  app.get(
    "/api/role-room/marketing-plan-posts/:postId/preview-video/status",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const postId = req.params.postId;
      const { rows } = await pool.query<{
        projectId: string; streamUid: string | null;
        streamReady: boolean; playbackUrl: string | null;
        thumbnailUrl: string | null;
      }>(
        `SELECT mp.project_id AS "projectId",
                p.preview_stream_uid AS "streamUid",
                p.preview_stream_ready AS "streamReady",
                p.preview_stream_playback_url AS "playbackUrl",
                p.preview_stream_thumbnail_url AS "thumbnailUrl"
           FROM role_room_marketing_plan_posts p
           JOIN role_room_marketing_plans mp ON mp.id = p.plan_id
          WHERE p.id = $1`,
        [postId],
      );
      const row = rows[0];
      if (!row?.projectId) {
        res.status(404).json({ error: "post_ikke_funnet" }); return;
      }
      if (!(await viewerCanEditProject(pool, row.projectId, viewerId))) {
        res.status(403).json({ error: "ingen_tilgang" }); return;
      }
      if (!row.streamUid) {
        res.status(200).json({ ready: false, hasStream: false });
        return;
      }
      // Hvis allerede markert ready, returner cached. Ellers poll Stream.
      if (row.streamReady) {
        res.status(200).json({
          ready: true, hasStream: true,
          playbackUrl: row.playbackUrl, thumbnailUrl: row.thumbnailUrl,
        });
        return;
      }
      const status = await getStreamVideoStatus(row.streamUid);
      if (status?.ready) {
        await pool.query(
          `UPDATE role_room_marketing_plan_posts
              SET preview_stream_ready = TRUE,
                  preview_stream_playback_url = $1,
                  preview_stream_thumbnail_url = $2,
                  preview_stream_duration_sec = COALESCE(preview_stream_duration_sec, $3),
                  updated_at = now()
            WHERE id = $4`,
          [status.playbackUrl, status.thumbnailUrl, status.duration ?? null, postId],
        );
      }
      res.status(200).json({
        ready: status?.ready === true,
        hasStream: true,
        playbackUrl: status?.playbackUrl ?? row.playbackUrl,
        thumbnailUrl: status?.thumbnailUrl ?? row.thumbnailUrl,
      });
    },
  );

  app.delete(
    "/api/role-room/marketing-plan-posts/:postId/preview-video",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const postId = req.params.postId;
      if (!postId) {
        res.status(400).json({ error: "mangler_post_id" }); return;
      }
      const { rows } = await pool.query<{
        projectId: string; streamUid: string | null;
      }>(
        `SELECT mp.project_id AS "projectId",
                p.preview_stream_uid AS "streamUid"
           FROM role_room_marketing_plan_posts p
           JOIN role_room_marketing_plans mp ON mp.id = p.plan_id
          WHERE p.id = $1`,
        [postId],
      );
      const row = rows[0];
      if (!row?.projectId) {
        res.status(404).json({ error: "post_ikke_funnet" }); return;
      }
      if (!(await viewerCanEditProject(pool, row.projectId, viewerId))) {
        res.status(403).json({ error: "ingen_tilgang" }); return;
      }
      // Stream: best-effort sletting (orphan-tolerant).
      // R2: lar object ligge (samme mønster som capture-pipelinen).
      if (row.streamUid) {
        await deleteStreamVideo(row.streamUid);
      }
      await pool.query(
        `UPDATE role_room_marketing_plan_posts
            SET preview_stream_uid = NULL,
                preview_stream_ready = FALSE,
                preview_stream_playback_url = NULL,
                preview_stream_thumbnail_url = NULL,
                preview_stream_duration_sec = NULL,
                preview_video_key = NULL,
                preview_video_url = NULL,
                preview_video_uploaded_at = NULL,
                preview_video_mime = NULL,
                preview_video_bytes = NULL,
                updated_at = now()
          WHERE id = $1`,
        [postId],
      );
      res.status(200).json({ ok: true });
    },
  );
}
