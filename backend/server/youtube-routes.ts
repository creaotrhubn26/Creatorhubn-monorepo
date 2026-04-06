import express, { type Request, type Response } from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import { google } from "googleapis";
import type { Pool } from "pg";
import { resolveRoleRoomGoogleConnection } from "./contract-google-signing.js";
import { loadPersistedAuthSession } from "./auth-session-store.js";

const YOUTUBE_REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.upload",
] as const;

const TEMP_UPLOAD_DIR = path.join(os.tmpdir(), "creatorhub-youtube");

type PublishingVideo = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  status: "private" | "unlisted" | "public";
  viewCount: number;
  likeCount: number;
  publishedAt: string | null;
  duration: string | null;
  url: string;
};

type PublishingPlaylist = {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  status: "private" | "unlisted" | "public";
  url: string;
};

type UploadMetadata = {
  title?: string;
  description?: string;
  tags?: unknown;
  status?: unknown;
  categoryId?: unknown;
  playlistId?: unknown;
  projectId?: unknown;
  createShowcase?: unknown;
};

fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEMP_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const videoUpload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 1024 * 1024 * 1024,
  },
});

const thumbnailUpload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

function readStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim());
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
          .map((entry) => entry.trim());
      }
    } catch {
      return trimmed
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function readBooleanValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  return false;
}

function readJsonValue<T>(value: unknown): T | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readProjectId(req: Request): string | null {
  return (
    readStringValue(req.query.projectId)
    ?? readStringValue(req.body?.projectId)
    ?? readStringValue(req.headers["x-project-id"])
  );
}

async function resolveUserId(pool: Pool, req: Request): Promise<string | null> {
  const explicitUserId =
    readStringValue(req.query.userId)
    ?? readStringValue(req.body?.userId)
    ?? readStringValue(req.headers["x-user-id"]);

  if (explicitUserId) {
    return explicitUserId;
  }

  const bearer = readStringValue(req.headers.authorization)?.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) {
    return null;
  }

  const session = await loadPersistedAuthSession<{ userId: string }>(pool, bearer);
  return readStringValue(session?.userId);
}

function normalizePrivacyStatus(value: unknown): "private" | "unlisted" | "public" {
  const normalized = readStringValue(value)?.toLowerCase();
  if (normalized === "public" || normalized === "unlisted") {
    return normalized;
  }
  return "private";
}

function normalizeCategoryId(value: unknown): string {
  return readStringValue(value) ?? "22";
}

function hasRequiredYouTubeScopes(scopes: string[]): boolean {
  return YOUTUBE_REQUIRED_SCOPES.every((scope) => scopes.includes(scope));
}

function mapPublishingVideo(item: any): PublishingVideo {
  const videoId = readStringValue(item?.id) ?? "";
  const privacyStatus = normalizePrivacyStatus(item?.status?.privacyStatus);

  return {
    id: videoId,
    title: readStringValue(item?.snippet?.title) ?? "Untitled video",
    description: readStringValue(item?.snippet?.description) ?? "",
    thumbnailUrl:
      readStringValue(item?.snippet?.thumbnails?.maxres?.url)
      ?? readStringValue(item?.snippet?.thumbnails?.high?.url)
      ?? readStringValue(item?.snippet?.thumbnails?.medium?.url)
      ?? readStringValue(item?.snippet?.thumbnails?.default?.url),
    status: privacyStatus,
    viewCount: Number(item?.statistics?.viewCount ?? 0),
    likeCount: Number(item?.statistics?.likeCount ?? 0),
    publishedAt: readStringValue(item?.snippet?.publishedAt),
    duration: readStringValue(item?.contentDetails?.duration),
    url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
  };
}

function mapPublishingPlaylist(item: any): PublishingPlaylist {
  const playlistId = readStringValue(item?.id) ?? "";
  return {
    id: playlistId,
    title: readStringValue(item?.snippet?.title) ?? "Untitled playlist",
    description: readStringValue(item?.snippet?.description) ?? "",
    itemCount: Number(item?.contentDetails?.itemCount ?? 0),
    status: normalizePrivacyStatus(item?.status?.privacyStatus),
    url: playlistId ? `https://www.youtube.com/playlist?list=${playlistId}` : "",
  };
}

async function buildAuthorizedYoutubeClient(pool: Pool, userId: string) {
  const authorized = await resolveRoleRoomGoogleConnection(pool, userId, {
    allowFallbackToAnyUser: false,
  });

  return {
    authorized,
    youtube: google.youtube({
      version: "v3",
      auth: authorized.oauthClient,
    }),
  };
}

async function resolveUploadsPlaylistId(youtube: ReturnType<typeof google.youtube>) {
  const channelResponse = await youtube.channels.list({
    part: ["snippet", "contentDetails"],
    mine: true,
    maxResults: 1,
  });

  const channel = channelResponse.data.items?.[0];
  const uploadsPlaylistId = readStringValue(channel?.contentDetails?.relatedPlaylists?.uploads);
  const channelTitle = readStringValue(channel?.snippet?.title);
  const channelId = readStringValue(channel?.id);

  return { uploadsPlaylistId, channelTitle, channelId };
}

async function getRecentPublishingVideos(youtube: ReturnType<typeof google.youtube>) {
  const { uploadsPlaylistId } = await resolveUploadsPlaylistId(youtube);
  if (!uploadsPlaylistId) {
    return [];
  }

  const uploadsResponse = await youtube.playlistItems.list({
    part: ["contentDetails"],
    playlistId: uploadsPlaylistId,
    maxResults: 24,
  });

  const videoIds = (uploadsResponse.data.items ?? [])
    .map((item) => readStringValue(item.contentDetails?.videoId))
    .filter((value): value is string => Boolean(value));

  if (videoIds.length === 0) {
    return [];
  }

  const videosResponse = await youtube.videos.list({
    part: ["snippet", "status", "statistics", "contentDetails"],
    id: videoIds,
    maxResults: 24,
  });

  const videoMap = new Map(
    (videosResponse.data.items ?? []).map((item) => [readStringValue(item.id) ?? "", item]),
  );

  return videoIds
    .map((id) => videoMap.get(id))
    .filter(Boolean)
    .map(mapPublishingVideo);
}

async function getProjectPublishingVideos(pool: Pool, youtube: ReturnType<typeof google.youtube>, projectId: string, userId: string) {
  const linkedVideos = await pool.query<{ youtube_video_id: string | null }>(
    `
      SELECT youtube_video_id
      FROM project_showcases
      WHERE project_id = $1
        AND COALESCE(user_id, created_by) = $2
        AND showcase_type = 'youtube'
        AND youtube_video_id IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    `,
    [projectId, userId],
  );

  const videoIds = [...new Set(
    linkedVideos.rows
      .map((row) => readStringValue(row.youtube_video_id))
      .filter((value): value is string => Boolean(value)),
  )];

  if (videoIds.length === 0) {
    return [];
  }

  const response = await youtube.videos.list({
    part: ["snippet", "status", "statistics", "contentDetails"],
    id: videoIds,
    maxResults: 24,
  });

  const videoMap = new Map(
    (response.data.items ?? []).map((item) => [readStringValue(item.id) ?? "", item]),
  );

  return videoIds
    .map((id) => videoMap.get(id))
    .filter(Boolean)
    .map(mapPublishingVideo);
}

async function upsertYoutubeVideoCache(pool: Pool, video: PublishingVideo) {
  if (!video.id) {
    return;
  }

  await pool.query(
    `
      INSERT INTO youtube_videos (
        video_id,
        title,
        description,
        thumbnail_url,
        duration,
        view_count,
        like_count,
        published_at,
        last_synced,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (video_id) DO UPDATE
      SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        thumbnail_url = EXCLUDED.thumbnail_url,
        duration = EXCLUDED.duration,
        view_count = EXCLUDED.view_count,
        like_count = EXCLUDED.like_count,
        published_at = EXCLUDED.published_at,
        last_synced = NOW(),
        updated_at = NOW()
    `,
    [
      video.id,
      video.title,
      video.description,
      video.thumbnailUrl,
      video.duration,
      video.viewCount,
      video.likeCount,
      video.publishedAt,
    ],
  ).catch(() => undefined);
}

async function syncProjectShowcaseForVideo(
  pool: Pool,
  options: {
    projectId: string;
    userId: string;
    video: PublishingVideo;
  },
) {
  const { projectId, userId, video } = options;

  const existing = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM project_showcases
      WHERE project_id = $1
        AND youtube_video_id = $2
      LIMIT 1
    `,
    [projectId, video.id],
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `
        UPDATE project_showcases
        SET
          title = $2,
          description = $3,
          youtube_video_url = $4,
          is_public = $5,
          seo_title = $2,
          seo_description = $3,
          visibility = $6,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        existing.rows[0].id,
        video.title,
        video.description,
        video.url,
        video.status === "public",
        video.status,
      ],
    );
    return;
  }

  await pool.query(
    `
      INSERT INTO project_showcases (
        project_id,
        title,
        description,
        showcase_type,
        youtube_video_id,
        youtube_video_url,
        tags,
        is_public,
        is_featured,
        seo_title,
        seo_description,
        created_by,
        user_id,
        status,
        visibility,
        settings,
        published_at
      )
      VALUES (
        $1,
        $2,
        $3,
        'youtube',
        $4,
        $5,
        '[]'::jsonb,
        $6,
        false,
        $2,
        $3,
        $7,
        $7,
        'published',
        $8,
        jsonb_build_object('source', 'youtube-publishing'),
        NOW()
      )
    `,
    [
      projectId,
      video.title,
      video.description,
      video.id,
      video.url,
      video.status === "public",
      userId,
      video.status,
    ],
  ).catch(() => undefined);
}

async function cleanupTempFile(filePath: string | null | undefined) {
  if (!filePath) {
    return;
  }

  try {
    await fsp.unlink(filePath);
  } catch {
    // Ignore temp cleanup failures.
  }
}

function normalizeYoutubeError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "Unknown YouTube error");
  const responsePayload = (error as { response?: { data?: unknown } } | undefined)?.response?.data;
  const message = typeof responsePayload === "string"
    ? `${rawMessage} ${responsePayload}`
    : `${rawMessage} ${JSON.stringify(responsePayload ?? {})}`;

  const normalized = message.toLowerCase();
  if (normalized.includes("insufficientpermissions") || normalized.includes("access not configured")) {
    return "Google-koblingen mangler YouTube-tilgang. Koble Google Workspace til på nytt.";
  }
  if (normalized.includes("youtube data api has not been used")) {
    return "YouTube Data API er ikke aktivert i Google Cloud-prosjektet.";
  }
  return rawMessage;
}

export function createYouTubeRouter(pool: Pool) {
  const router = express.Router();

  router.get("/status", async (req: Request, res: Response) => {
    const userId = await resolveUserId(pool, req);
    if (!userId) {
      res.status(400).json({ error: "userId er påkrevd." });
      return;
    }

    try {
      const { authorized, youtube } = await buildAuthorizedYoutubeClient(pool, userId);
      const storedScopes = authorized.connection.storedScopes ?? [];
      const hasYouTubeScopes = hasRequiredYouTubeScopes(storedScopes);

      if (!hasYouTubeScopes) {
        res.json({
          configured: true,
          connected: false,
          needsReconnect: true,
          missingScopes: YOUTUBE_REQUIRED_SCOPES.filter((scope) => !storedScopes.includes(scope)),
          scopes: storedScopes,
        });
        return;
      }

      const { uploadsPlaylistId, channelId, channelTitle } = await resolveUploadsPlaylistId(youtube);

      res.json({
        configured: true,
        connected: Boolean(channelId),
        needsReconnect: false,
        channelId,
        channelTitle,
        uploadsPlaylistId,
        scopes: storedScopes,
      });
    } catch (error) {
      const message = normalizeYoutubeError(error);
      if (message.includes("Fant ingen koblet Google Workspace-konto")) {
        res.json({
          configured: true,
          connected: false,
          needsReconnect: false,
          missingScopes: [...YOUTUBE_REQUIRED_SCOPES],
          scopes: [],
        });
        return;
      }

      res.status(500).json({ error: message });
    }
  });

  router.get("/videos", async (req: Request, res: Response) => {
    const userId = await resolveUserId(pool, req);
    if (!userId) {
      res.status(400).json({ error: "userId er påkrevd." });
      return;
    }

    const projectId = readProjectId(req);

    try {
      const { authorized, youtube } = await buildAuthorizedYoutubeClient(pool, userId);
      if (!hasRequiredYouTubeScopes(authorized.connection.storedScopes ?? [])) {
        res.status(403).json({ error: "Google-koblingen mangler YouTube-scopes." });
        return;
      }

      const videos = projectId
        ? await getProjectPublishingVideos(pool, youtube, projectId, userId)
        : await getRecentPublishingVideos(youtube);

      await Promise.all(videos.map((video) => upsertYoutubeVideoCache(pool, video)));
      res.json({ videos });
    } catch (error) {
      res.status(500).json({ error: normalizeYoutubeError(error) });
    }
  });

  router.get("/playlists", async (req: Request, res: Response) => {
    const userId = await resolveUserId(pool, req);
    if (!userId) {
      res.status(400).json({ error: "userId er påkrevd." });
      return;
    }

    try {
      const { authorized, youtube } = await buildAuthorizedYoutubeClient(pool, userId);
      if (!hasRequiredYouTubeScopes(authorized.connection.storedScopes ?? [])) {
        res.status(403).json({ error: "Google-koblingen mangler YouTube-scopes." });
        return;
      }

      const response = await youtube.playlists.list({
        part: ["snippet", "status", "contentDetails"],
        mine: true,
        maxResults: 25,
      });

      const playlists = (response.data.items ?? []).map(mapPublishingPlaylist);
      res.json({ playlists });
    } catch (error) {
      res.status(500).json({ error: normalizeYoutubeError(error) });
    }
  });

  router.post("/playlists", async (req: Request, res: Response) => {
    const userId = await resolveUserId(pool, req);
    if (!userId) {
      res.status(400).json({ error: "userId er påkrevd." });
      return;
    }

    const title = readStringValue(req.body?.title);
    if (!title) {
      res.status(400).json({ error: "Tittel er påkrevd." });
      return;
    }

    try {
      const { authorized, youtube } = await buildAuthorizedYoutubeClient(pool, userId);
      if (!hasRequiredYouTubeScopes(authorized.connection.storedScopes ?? [])) {
        res.status(403).json({ error: "Google-koblingen mangler YouTube-scopes." });
        return;
      }

      const response = await youtube.playlists.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title,
            description: readStringValue(req.body?.description) ?? "",
          },
          status: {
            privacyStatus: normalizePrivacyStatus(req.body?.status),
          },
        },
      });

      const playlist = mapPublishingPlaylist(response.data);
      res.json({ playlist });
    } catch (error) {
      res.status(500).json({ error: normalizeYoutubeError(error) });
    }
  });

  router.post("/playlists/:playlistId/items", async (req: Request, res: Response) => {
    const userId = await resolveUserId(pool, req);
    const playlistId = readStringValue(req.params.playlistId);
    const videoId = readStringValue(req.body?.videoId);

    if (!userId) {
      res.status(400).json({ error: "userId er påkrevd." });
      return;
    }

    if (!playlistId || !videoId) {
      res.status(400).json({ error: "playlistId og videoId er påkrevd." });
      return;
    }

    try {
      const { authorized, youtube } = await buildAuthorizedYoutubeClient(pool, userId);
      if (!hasRequiredYouTubeScopes(authorized.connection.storedScopes ?? [])) {
        res.status(403).json({ error: "Google-koblingen mangler YouTube-scopes." });
        return;
      }

      await youtube.playlistItems.insert({
        part: ["snippet"],
        requestBody: {
          snippet: {
            playlistId,
            resourceId: {
              kind: "youtube#video",
              videoId,
            },
          },
        },
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: normalizeYoutubeError(error) });
    }
  });

  router.post("/upload", videoUpload.single("video"), async (req: Request, res: Response) => {
    const userId = await resolveUserId(pool, req);
    const filePath = req.file?.path;

    if (!userId) {
      await cleanupTempFile(filePath);
      res.status(400).json({ error: "userId er påkrevd." });
      return;
    }

    if (!req.file || !filePath) {
      res.status(400).json({ error: "Videofil er påkrevd." });
      return;
    }

    const metadata = readJsonValue<UploadMetadata>(req.body?.metadata) ?? {};
    const projectId = readProjectId(req) ?? readStringValue(metadata.projectId);
    const createShowcase = readBooleanValue(req.body?.createShowcase ?? metadata.createShowcase);

    try {
      const { authorized, youtube } = await buildAuthorizedYoutubeClient(pool, userId);
      if (!hasRequiredYouTubeScopes(authorized.connection.storedScopes ?? [])) {
        res.status(403).json({ error: "Google-koblingen mangler YouTube-scopes." });
        return;
      }

      const uploadResponse = await youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title: readStringValue(metadata.title) ?? req.file.originalname,
            description: readStringValue(metadata.description) ?? "",
            tags: readStringArray(metadata.tags),
            categoryId: normalizeCategoryId(metadata.categoryId),
          },
          status: {
            privacyStatus: normalizePrivacyStatus(metadata.status),
          },
        },
        media: {
          mimeType: req.file.mimetype,
          body: fs.createReadStream(filePath),
        },
      });

      const videoId = readStringValue(uploadResponse.data.id);
      if (!videoId) {
        throw new Error("YouTube returnerte ikke en video-ID.");
      }

      const playlistId = readStringValue(metadata.playlistId);
      if (playlistId) {
        await youtube.playlistItems.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              playlistId,
              resourceId: {
                kind: "youtube#video",
                videoId,
              },
            },
          },
        });
      }

      const videoResponse = await youtube.videos.list({
        part: ["snippet", "status", "statistics", "contentDetails"],
        id: [videoId],
        maxResults: 1,
      });

      const videoItem = videoResponse.data.items?.[0];
      if (!videoItem) {
        throw new Error("Kunne ikke hente opplastet video fra YouTube.");
      }

      const video = mapPublishingVideo(videoItem);
      await upsertYoutubeVideoCache(pool, video);

      if (projectId && createShowcase) {
        await syncProjectShowcaseForVideo(pool, {
          projectId,
          userId,
          video,
        });
      }

      res.json({ video });
    } catch (error) {
      res.status(500).json({ error: normalizeYoutubeError(error) });
    } finally {
      await cleanupTempFile(filePath);
    }
  });

  router.patch("/videos/:videoId", async (req: Request, res: Response) => {
    const userId = await resolveUserId(pool, req);
    const videoId = readStringValue(req.params.videoId);

    if (!userId || !videoId) {
      res.status(400).json({ error: "userId og videoId er påkrevd." });
      return;
    }

    try {
      const { authorized, youtube } = await buildAuthorizedYoutubeClient(pool, userId);
      if (!hasRequiredYouTubeScopes(authorized.connection.storedScopes ?? [])) {
        res.status(403).json({ error: "Google-koblingen mangler YouTube-scopes." });
        return;
      }

      const existingResponse = await youtube.videos.list({
        part: ["snippet", "status"],
        id: [videoId],
        maxResults: 1,
      });

      const current = existingResponse.data.items?.[0];
      if (!current) {
        res.status(404).json({ error: "Fant ikke YouTube-videoen." });
        return;
      }

      await youtube.videos.update({
        part: ["snippet", "status"],
        requestBody: {
          id: videoId,
          snippet: {
            title: readStringValue(req.body?.title) ?? readStringValue(current.snippet?.title) ?? "Untitled video",
            description: readStringValue(req.body?.description) ?? readStringValue(current.snippet?.description) ?? "",
            categoryId: normalizeCategoryId(req.body?.categoryId ?? current.snippet?.categoryId),
            tags: readStringArray(req.body?.tags).length > 0
              ? readStringArray(req.body?.tags)
              : readStringArray(current.snippet?.tags ?? []),
          },
          status: {
            privacyStatus: normalizePrivacyStatus(req.body?.status ?? current.status?.privacyStatus),
            selfDeclaredMadeForKids: Boolean(current.status?.selfDeclaredMadeForKids ?? false),
          },
        },
      });

      const playlistId = readStringValue(req.body?.playlistId);
      if (playlistId) {
        await youtube.playlistItems.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              playlistId,
              resourceId: {
                kind: "youtube#video",
                videoId,
              },
            },
          },
        }).catch(() => undefined);
      }

      const refreshedResponse = await youtube.videos.list({
        part: ["snippet", "status", "statistics", "contentDetails"],
        id: [videoId],
        maxResults: 1,
      });

      const refreshedVideo = refreshedResponse.data.items?.[0];
      if (!refreshedVideo) {
        throw new Error("Kunne ikke hente oppdatert video.");
      }

      const video = mapPublishingVideo(refreshedVideo);
      await upsertYoutubeVideoCache(pool, video);

      const projectId = readProjectId(req);
      if (projectId) {
        await syncProjectShowcaseForVideo(pool, {
          projectId,
          userId,
          video,
        });
      }

      res.json({ video });
    } catch (error) {
      res.status(500).json({ error: normalizeYoutubeError(error) });
    }
  });

  router.post("/videos/:videoId/thumbnail", thumbnailUpload.single("thumbnail"), async (req: Request, res: Response) => {
    const userId = await resolveUserId(pool, req);
    const videoId = readStringValue(req.params.videoId);
    const filePath = req.file?.path;

    if (!userId || !videoId) {
      await cleanupTempFile(filePath);
      res.status(400).json({ error: "userId og videoId er påkrevd." });
      return;
    }

    if (!req.file || !filePath) {
      res.status(400).json({ error: "Thumbnail-fil er påkrevd." });
      return;
    }

    try {
      const { authorized, youtube } = await buildAuthorizedYoutubeClient(pool, userId);
      if (!hasRequiredYouTubeScopes(authorized.connection.storedScopes ?? [])) {
        res.status(403).json({ error: "Google-koblingen mangler YouTube-scopes." });
        return;
      }

      await youtube.thumbnails.set({
        videoId,
        media: {
          mimeType: req.file.mimetype,
          body: fs.createReadStream(filePath),
        },
      });

      const refreshedResponse = await youtube.videos.list({
        part: ["snippet", "status", "statistics", "contentDetails"],
        id: [videoId],
        maxResults: 1,
      });

      const refreshedVideo = refreshedResponse.data.items?.[0];
      if (!refreshedVideo) {
        throw new Error("Kunne ikke hente video etter thumbnail-oppdatering.");
      }

      const video = mapPublishingVideo(refreshedVideo);
      await upsertYoutubeVideoCache(pool, video);
      res.json({ video });
    } catch (error) {
      res.status(500).json({ error: normalizeYoutubeError(error) });
    } finally {
      await cleanupTempFile(filePath);
    }
  });

  return router;
}
