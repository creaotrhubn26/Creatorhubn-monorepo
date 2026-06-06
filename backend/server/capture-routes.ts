import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import { loadPersistedAuthSession } from './auth-session-store.js';
import {
  createSession,
  fetchSession,
  listSessions,
  updateSession,
  softDeleteSession,
} from './capture-sessions-service.js';
import {
  registerAsset,
  fetchAsset,
  listAssets,
  updateAssetLabels,
  updateAssetSignals,
  CaptureAuthzError,
} from './capture-assets-service.js';
import { appendEvents, listEvents } from './capture-events-service.js';
import { broadcastUserEvent } from './realtime-user-events.js';
import { addReview, listReviews } from './capture-reviews-service.js';
import {
  abortMultipartUpload,
  completeMultipartUpload,
  signAssetReadUrl,
  signPartUrls,
  startMultipartUpload,
  uploadCaptureObject,
  type UploadError,
} from './capture-upload-service.js';
import { broadcastCaptureEvent } from './capture-websocket.js';
import {
  createClientToken,
  fetchSessionForClient,
  listClientTokens,
  revokeClientToken,
  validateClientToken,
  type ValidatedClientAuth,
} from './capture-client-tokens-service.js';
import {
  fetchAsset as fetchAssetForOwner,
  listAssets as listAssetsForOwner,
} from './capture-assets-service.js';
import { addReview as addReviewRow } from './capture-reviews-service.js';
import {
  enqueuePhotoEnhancerJobFromBuffer,
  getPhotoEnhancerJobStatusSnapshot,
} from './photo-enhancer-routes.js';
import {
  broadcastToSessionPeers,
  markAbsent as markPresenceAbsent,
  markPresent as markPresencePresent,
  peersForSession,
} from './capture-presence-service.js';
import { performHandoff, type HandoffFilter } from './capture-handoff-service.js';
import { analyzePhoto, type AnalyzeError } from './capture-analyze-service.js';
import {
  bridgeCaptureSessionToGallery,
  pickAssetsFromCaptureSession,
  type BridgeError,
} from './capture-showcase-bridge.js';
import {
  createMinimalProject,
  fetchProjectDetail,
  linkCaptureSessionToProject,
  setShotCompletion,
  listProjectsForPhotographer,
} from './capture-projects-service.js';
import {
  classifySession,
  type CaptureAssetForCulling,
  type CullingStrictness,
} from './capture-culling-service.js';
import { captureAssets, captureReviews, captureSessions } from '../migrations/capture-schema.js';
import { and, asc, eq } from 'drizzle-orm';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

type AuthedRequest = Request & { userId: string };

const createSessionBody = z.object({
  name: z.string().min(1).max(255),
  clientId: z.string().uuid().optional(),
  startsAt: z.string().datetime(),
});

const updateSessionBody = z.object({
  name: z.string().min(1).max(255).optional(),
  endsAt: z.string().datetime().optional(),
  status: z.enum(['active', 'paused', 'closed']).optional(),
});

const registerAssetBody = z.object({
  originalFilename: z.string().min(1).max(512),
  captureTime: z.string().datetime(),
  mime: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative().optional(),
});

const updateAssetBody = z.object({
  rating: z.number().int().min(0).max(5).optional(),
  colorLabel: z
    .enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray'])
    .nullable()
    .optional(),
  flaggedForClient: z.boolean().optional(),
  rejected: z.boolean().optional(),
});

const createMinimalProjectBody = z.object({
  title: z.string().min(1).max(255),
  clientName: z.string().max(255).optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  location: z.string().max(255).optional(),
  projectType: z.string().max(64).optional(),
});

const linkSessionProjectBody = z.object({
  projectId: z.string().uuid().nullable(),
});

const setShotCompletionBody = z.object({
  isCompleted: z.boolean(),
});

const deliverToShowcaseBody = z.object({
  filter: z.enum(['flagged', 'rating_at_least_4', 'picks_or_4plus', 'all_non_rejected'])
    .default('picks_or_4plus'),
  clientName: z.string().min(1).max(255),
  clientEmail: z.string().email().max(255),
  projectTitle: z.string().min(1).max(255).optional(),
});

// 12 MB cap on the base64 payload — comfortably above any preview JPEG
// Canon emits at ?kind=display, well below Express's default JSON limit.
const analyzeAssetBody = z.object({
  imageBase64: z.string().min(64).max(16 * 1024 * 1024),
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

// Slice 9X.20 — EXIF metadata parset i nettleseren ved opplasting.
// Frontend sender bare felt vi faktisk bruker for tags + visning, ikke
// hele EXIF-dumpen (kan være 100k+ for noen RAW-filer).
const exifBody = z.object({
  exif: z.object({
    cameraMake: z.string().max(64).optional(),
    cameraModel: z.string().max(128).optional(),
    lensModel: z.string().max(128).optional(),
    lensMake: z.string().max(64).optional(),
    iso: z.number().int().nonnegative().max(1_000_000).optional(),
    aperture: z.number().nonnegative().max(64).optional(),       // f-stop, e.g. 2.8
    shutterSpeed: z.string().max(32).optional(),                 // "1/250" or "0.5"
    shutterSpeedSec: z.number().nonnegative().optional(),
    focalLength: z.number().nonnegative().max(2000).optional(),  // mm
    focalLengthIn35mm: z.number().nonnegative().max(2000).optional(),
    captureDate: z.string().datetime().optional(),
    gpsLat: z.number().min(-90).max(90).optional(),
    gpsLng: z.number().min(-180).max(180).optional(),
    gpsAlt: z.number().optional(),
    orientation: z.number().int().min(1).max(8).optional(),
    flashFired: z.boolean().optional(),
    whiteBalance: z.string().max(32).optional(),
    exposureMode: z.string().max(32).optional(),
    meteringMode: z.string().max(32).optional(),
    software: z.string().max(128).optional(),
  }),
});

const assetSignalsBody = z.object({
  sharpness: z.number().min(0).max(100).optional(),
  eyesOpen: z.boolean().optional(),
  faceCount: z.number().int().nonnegative().optional(),
  duplicateGroupId: z.string().uuid().optional(),
});

const postEventsBody = z.object({
  events: z
    .array(
      z.object({
        assetId: z.string().uuid().optional(),
        eventType: z.string().min(1).max(64),
        metadata: z.record(z.string(), z.unknown()).optional(),
        occurredAt: z.string().datetime(),
      }),
    )
    .min(1)
    .max(500),
});

const uploadStartBody = z.object({
  kind: z.enum(['preview', 'full', 'raw']),
  sizeBytes: z.number().int().positive(),
  mime: z.string().min(1).max(128),
  preferredPartSize: z.number().int().positive().optional(),
});

const uploadPartsBody = z.object({
  uploadId: z.string().min(1),
  key: z.string().min(1),
  partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(1000),
});

const uploadCompleteBody = z.object({
  kind: z.enum(['preview', 'full', 'raw']),
  uploadId: z.string().min(1),
  key: z.string().min(1),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10_000),
        etag: z.string().min(1),
      }),
    )
    .min(1),
  checksumSha256: z.string().length(64),
  sizeBytes: z.number().int().positive(),
});

const uploadAbortBody = z.object({
  uploadId: z.string().min(1),
  key: z.string().min(1),
});

const handoffBody = z.object({
  preset: z
    .enum(['auto', 'portrait', 'wedding', 'landscape', 'product', 'studio'])
    .optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  filter: z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('ids'), assetIds: z.array(z.string().uuid()).min(1).max(500) }),
      z.object({ kind: z.literal('flagged') }),
      z.object({
        kind: z.literal('rating_at_least'),
        rating: z.number().int().min(1).max(5),
      }),
    ])
    .default({ kind: 'flagged' }),
  preferredSource: z.enum(['full', 'preview']).optional(),
});

const createClientTokenBody = z.object({
  clientLabel: z.string().min(1).max(255).optional(),
  pin: z.string().min(4).max(16).optional(),
  ttlMinutes: z.number().int().min(5).max(30 * 24 * 60).optional(),
});

const clientReviewBody = z
  .object({
    heart: z.boolean().optional(),
    comment: z.string().max(2000).optional(),
  })
  .refine((d) => d.heart !== undefined || d.comment !== undefined, {
    message: 'At least one of heart or comment must be provided',
  });

function bridgeErrorStatus(error: BridgeError): number {
  switch (error) {
    case 'session_not_found':       return 404;
    case 'no_picks':                return 400;
    case 'sign_failed':             return 502;
    case 'gallery_persist_failed':  return 500;
  }
}

function analyzeErrorStatus(error: AnalyzeError): number {
  switch (error) {
    case 'not_configured':
      return 503;
    case 'timeout':
      return 504;
    case 'upstream_failed':
    case 'invalid_response':
      return 502;
    case 'not_found':
      return 404;
  }
}

function uploadErrorStatus(error: UploadError): number {
  switch (error) {
    case 'not_configured':
      return 503;
    case 'not_found':
      return 404;
    case 'invalid':
      return 400;
  }
}

const createReviewBody = z
  .object({
    heart: z.boolean().optional(),
    rating: z.number().int().min(0).max(5).optional(),
    comment: z.string().max(2000).optional(),
  })
  .refine(
    (data) =>
      data.heart !== undefined || data.rating !== undefined || data.comment !== undefined,
    { message: 'At least one of heart, rating, or comment must be provided' },
  );

async function resolveUser(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  bearer: string | null | undefined,
): Promise<SessionData | null> {
  const token = typeof bearer === 'string' ? bearer.trim() : '';
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) {
    activeSessions?.set(token, persisted);
    return persisted;
  }
  return null;
}

type ClientAuthedRequest = Request & { clientAuth: ValidatedClientAuth };

function requireClientToken(
  db: import('drizzle-orm/node-postgres').NodePgDatabase<Record<string, unknown>>,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawToken = req.headers['x-capture-client-token'];
    if (typeof rawToken !== 'string' || !rawToken) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const pinHeader = req.headers['x-capture-client-pin'];
    const pin = typeof pinHeader === 'string' && pinHeader.length > 0 ? pinHeader : null;
    const result = await validateClientToken(db, rawToken, pin);
    if (!result) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    (req as ClientAuthedRequest).clientAuth = result;
    next();
  };
}

function requireAuth(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    const session = await resolveUser(pool, activeSessions, bearer);
    if (!session?.userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    (req as AuthedRequest).userId = session.userId;
    next();
  };
}

function handleZod<T>(
  res: Response,
  parse: z.ZodSafeParseResult<T>,
): parse is z.ZodSafeParseSuccess<T> {
  if (!parse.success) {
    res.status(400).json({ error: 'invalid_request', details: z.treeifyError(parse.error) });
    return false;
  }
  return true;
}

/**
 * Slice 9X.20 — slugify EXIF-felter til søkbare tags.
 * "Canon EOS R5" → "canon-eos-r5"
 * 50.0 mm → "50mm" (rundet til nærmeste prime/range-bucket)
 * ISO 1600 → "iso-1600" + "iso-high" (range-bucket)
 */
function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[æå]/g, 'a').replace(/ø/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function bucketFocalLength(mm: number): string[] {
  const rounded = Math.round(mm);
  const tags = [`${rounded}mm`];
  if (mm < 24) tags.push('ultra-wide');
  else if (mm < 35) tags.push('wide');
  else if (mm < 70) tags.push('normal');
  else if (mm < 135) tags.push('short-tele');
  else if (mm < 300) tags.push('tele');
  else tags.push('super-tele');
  return tags;
}

function bucketIso(iso: number): string[] {
  const tags = [`iso-${iso}`];
  if (iso <= 200) tags.push('iso-low');
  else if (iso <= 1600) tags.push('iso-mid');
  else if (iso <= 6400) tags.push('iso-high');
  else tags.push('iso-very-high');
  return tags;
}

function bucketAperture(f: number): string[] {
  // Match til vanlige f-stop verdier
  const round = Math.round(f * 10) / 10;
  const slug = `f-${round.toString().replace('.', '-')}`;
  const tags = [slug];
  if (f <= 1.4) tags.push('very-fast');
  else if (f <= 2.8) tags.push('fast');
  else if (f <= 5.6) tags.push('medium');
  else tags.push('slow');
  return tags;
}

interface NormalizedExif {
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  iso?: number;
  aperture?: number;
  focalLength?: number;
  captureDate?: string;
  gpsLat?: number;
  gpsLng?: number;
}

export function buildExifTags(exif: NormalizedExif): string[] {
  const tags = new Set<string>();
  if (exif.cameraMake) tags.add(slugify(exif.cameraMake));
  if (exif.cameraModel) {
    tags.add(slugify(exif.cameraModel));
    if (exif.cameraMake) {
      tags.add(slugify(`${exif.cameraMake} ${exif.cameraModel}`));
    }
  }
  if (exif.lensModel) tags.add(slugify(exif.lensModel));
  if (typeof exif.iso === 'number') {
    for (const t of bucketIso(exif.iso)) tags.add(t);
  }
  if (typeof exif.aperture === 'number') {
    for (const t of bucketAperture(exif.aperture)) tags.add(t);
  }
  if (typeof exif.focalLength === 'number') {
    for (const t of bucketFocalLength(exif.focalLength)) tags.add(t);
  }
  if (exif.captureDate) {
    const d = new Date(exif.captureDate);
    if (Number.isFinite(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      tags.add(`${y}-${m}`);
      tags.add(String(y));
    }
  }
  if (typeof exif.gpsLat === 'number' && typeof exif.gpsLng === 'number') {
    tags.add('gps');
  }
  return Array.from(tags).slice(0, 50);
}

export function createCaptureRouter(
  pool: Pool,
  activeSessions?: Map<string, SessionData>,
): Router {
  const router = Router();
  const db = drizzle(pool);
  const auth = requireAuth(pool, activeSessions);

  // ── Projects (UniversalDashboard integration) ──────────────

  // List the photographer's projects so the iPad can show a project
  // picker right after sign-in. Returns a slim summary; the
  // /projects/:id detail endpoint carries the full shot list.
  router.get('/projects', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const rows = await listProjectsForPhotographer(db, userId, limit);
    res.json({ projects: rows });
  });

  router.get('/projects/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const detail = await fetchProjectDetail(db, userId, req.params.id);
    if (!detail) {
      res.status(404).json({ error: 'project_not_found' });
      return;
    }
    res.json(detail);
  });

  // Create a minimal project from the iPad — used when the photographer
  // picks "Start simple session" instead of choosing an existing
  // project. Just enough fields for the project to exist in the
  // dashboard; everything else can be filled in from the web later.
  router.post('/projects', auth, async (req, res) => {
    const parsed = createMinimalProjectBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const created = await createMinimalProject(db, {
      ownerUserId: userId,
      title: parsed.data.title,
      clientName: parsed.data.clientName,
      eventDate: parsed.data.eventDate,
      location: parsed.data.location,
      projectType: parsed.data.projectType,
    });
    res.status(201).json(created);
  });

  // Mark a shot complete / incomplete. Body is `{ isCompleted: boolean }`.
  // Lives on /projects so iPad ShotListPanel's local toggle can push
  // back without inventing a new surface — matches the existing link-
  // shot-to-asset pattern a few lines down.
  router.patch('/projects/:projectId/shots/:shotId', auth, async (req, res) => {
    const parsed = setShotCompletionBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const result = await setShotCompletion(
      db,
      userId,
      req.params.projectId,
      req.params.shotId,
      parsed.data.isCompleted,
    );
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    // Push to every iPad/web surface signed in as this photographer so
    // their Live Set dashboards refresh without polling. No-op when no
    // sockets are bound (lunch break, photographer offline) — fully
    // best-effort, mutation already persisted at this point.
    broadcastUserEvent(userId, {
      kind: 'shot.completion-toggled',
      projectId: req.params.projectId,
      shotId: req.params.shotId,
      isCompleted: parsed.data.isCompleted,
      timestamp: new Date().toISOString(),
    });
    res.status(200).json(result.data);
  });

  // Link / unlink an existing capture session to a project. Used after
  // a "simple session" auto-creates a project and we need to attach it,
  // or when the photographer changes their mind about which project a
  // session belongs to.
  router.patch('/sessions/:id/project', auth, async (req, res) => {
    const parsed = linkSessionProjectBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const result = await linkCaptureSessionToProject(
      db,
      userId,
      req.params.id,
      parsed.data.projectId,
    );
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.status(204).end();
  });

  // ── Sessions ────────────────────────────────────────────────

  router.post('/sessions', auth, async (req, res) => {
    const parsed = createSessionBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const row = await createSession(db, {
      ownerUserId: userId,
      name: parsed.data.name,
      clientId: parsed.data.clientId,
      startsAt: new Date(parsed.data.startsAt),
    });
    res.status(201).json(row);
  });

  router.get('/sessions', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    const rows = await listSessions(db, userId, limit, offset);
    res.json({ sessions: rows });
  });

  router.get('/sessions/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const row = await fetchSession(db, req.params.id, userId);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(row);
  });

  router.patch('/sessions/:id', auth, async (req, res) => {
    const parsed = updateSessionBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const patch = {
      name: parsed.data.name,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
      status: parsed.data.status,
    };
    const row = await updateSession(db, req.params.id, userId, patch);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(row);
  });

  router.delete('/sessions/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await softDeleteSession(db, req.params.id, userId);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  });

  // ── Assets ──────────────────────────────────────────────────

  router.post('/sessions/:sessionId/assets', auth, async (req, res) => {
    const parsed = registerAssetBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    try {
      const row = await registerAsset(db, userId, req.params.sessionId, {
        originalFilename: parsed.data.originalFilename,
        captureTime: new Date(parsed.data.captureTime),
        mime: parsed.data.mime,
        sizeBytes: parsed.data.sizeBytes,
      });
      res.status(201).json(row);
    } catch (err) {
      if (err instanceof CaptureAuthzError) {
        res.status(404).json({ error: 'session_not_found' });
        return;
      }
      throw err;
    }
  });

  router.get('/sessions/:sessionId/assets', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const limit = Math.min(Number(req.query.limit ?? 500), 2000);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    try {
      const rows = await listAssets(db, userId, req.params.sessionId, limit, offset);
      // Attach signed preview URLs so the web enhancer can hydrate each
      // asset into a `SessionImage` without a second round-trip. Matches
      // the shape the `/client/assets` route already returns.
      const withUrls = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          previewUrl: row.previewKey ? await signAssetReadUrl(row.previewKey) : null,
        })),
      );
      res.json({ assets: withUrls });
    } catch (err) {
      if (err instanceof CaptureAuthzError) {
        res.status(404).json({ error: 'session_not_found' });
        return;
      }
      throw err;
    }
  });

  router.get('/assets/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const row = await fetchAsset(db, userId, req.params.id);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(row);
  });

  router.patch('/assets/:id', auth, async (req, res) => {
    const parsed = updateAssetBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const row = await updateAssetLabels(db, userId, req.params.id, parsed.data);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    // Phase 5.3 — broadcast the label change to every photographer
    // currently in this session so multi-iPad shoots see each other's
    // pick/rate/color/reject toggles in real time. Receivers gate on
    // `actorUserId !== self.userId` to avoid clobbering their own
    // optimistic local update.
    broadcastToSessionPeers(row.sessionId, {
      kind: 'asset.labels-changed',
      assetId: row.id,
      sessionId: row.sessionId,
      actorUserId: userId,
      rating: row.rating ?? null,
      colorLabel: row.colorLabel ?? null,
      flaggedForClient: row.flaggedForClient ?? null,
      rejected: row.rejected ?? null,
      timestamp: new Date().toISOString(),
    });
    res.json(row);
  });

  // Phase 5.3 — explicit presence join/leave so an iPad joining
  // mid-shoot tells other connected iPads it's there, and a clean
  // disconnect clears the avatar promptly (vs. waiting 5min for the
  // stale-cleanup pass). Body: { joining: bool }.
  router.post('/sessions/:sessionId/presence', auth, async (req, res) => {
    const sessionId = req.params.sessionId;
    const { userId } = req as AuthedRequest;
    const body = (req.body ?? {}) as { joining?: unknown; displayName?: unknown };
    const joining = body.joining === true;
    const displayName = typeof body.displayName === 'string' && body.displayName.length > 0
      ? body.displayName : null;

    // Verify the user has access to this session (owner OR — Phase 6
    // — invited assistant). For now, owner-only matches the rest of
    // capture-routes' authz model.
    const sessionRows = await db
      .select({ id: captureSessions.id, ownerUserId: captureSessions.ownerUserId })
      .from(captureSessions)
      .where(eq(captureSessions.id, sessionId))
      .limit(1);
    if (sessionRows.length === 0) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }
    if (sessionRows[0].ownerUserId !== userId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    if (joining) {
      markPresencePresent(sessionId, userId, displayName);
    } else {
      markPresenceAbsent(sessionId, userId);
    }
    res.status(200).json({
      sessionId,
      peers: peersForSession(sessionId).map((peer) => ({
        userId: peer.userId,
        displayName: peer.displayName,
        joinedAt: new Date(peer.joinedAt).toISOString(),
      })),
    });
  });

  router.put('/assets/:id/signals', auth, async (req, res) => {
    const parsed = assetSignalsBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const row = await updateAssetSignals(db, userId, req.params.id, parsed.data);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(row);
  });

  // ── Claude Vision analyse ───────────────────────────────────

  router.post('/assets/:id/analyze', auth, async (req, res) => {
    const parsed = analyzeAssetBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const result = await analyzePhoto({
      db,
      ownerUserId: userId,
      assetId: req.params.id,
      imageBase64: parsed.data.imageBase64,
      mime: parsed.data.mime,
    });
    if (!result.ok) {
      res.status(analyzeErrorStatus(result.error)).json({
        error: result.error,
        detail: result.detail,
      });
      return;
    }
    res.json({ analysis: result.analysis, usage: result.usage });
  });

  // ── Uploads (R2 multipart) ──────────────────────────────────

  router.post('/assets/:id/upload/start', auth, async (req, res) => {
    const parsed = uploadStartBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const r = await startMultipartUpload(
      db,
      userId,
      req.params.id,
      parsed.data.kind,
      parsed.data.sizeBytes,
      parsed.data.mime,
      parsed.data.preferredPartSize,
    );
    if (!r.ok) {
      res.status(uploadErrorStatus(r.error)).json({ error: r.error });
      return;
    }
    res.json(r.result);
  });

  router.post('/assets/:id/upload/parts', auth, async (req, res) => {
    const parsed = uploadPartsBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const r = await signPartUrls(
      db,
      userId,
      req.params.id,
      parsed.data.uploadId,
      parsed.data.key,
      parsed.data.partNumbers,
    );
    if (!r.ok) {
      res.status(uploadErrorStatus(r.error)).json({ error: r.error });
      return;
    }
    res.json(r.result);
  });

  router.post('/assets/:id/upload/complete', auth, async (req, res) => {
    const parsed = uploadCompleteBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const r = await completeMultipartUpload(
      db,
      userId,
      req.params.id,
      parsed.data.kind,
      parsed.data.uploadId,
      parsed.data.key,
      parsed.data.parts,
      parsed.data.checksumSha256,
      parsed.data.sizeBytes,
    );
    if (!r.ok) {
      res.status(uploadErrorStatus(r.error)).json({ error: r.error });
      return;
    }
    res.json(r.result);
  });

  router.post('/assets/:id/upload/abort', auth, async (req, res) => {
    const parsed = uploadAbortBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const r = await abortMultipartUpload(
      db,
      userId,
      req.params.id,
      parsed.data.uploadId,
      parsed.data.key,
    );
    if (!r.ok) {
      res.status(uploadErrorStatus(r.error)).json({ error: r.error });
      return;
    }
    res.status(204).end();
  });

  // ── Events ──────────────────────────────────────────────────

  // Slice 9X.20 — lagre EXIF + auto-generér tags. Idempotent (PATCH-like).
  router.post('/assets/:id/exif', auth, async (req, res) => {
    const parsed = exifBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;

    // Sjekk ownership via session-join
    const ownership = await pool.query(
      `SELECT a.id FROM capture_assets a
         JOIN capture_sessions s ON s.id = a.session_id
        WHERE a.id = $1 AND s.owner_user_id = $2 LIMIT 1`,
      [req.params.id, userId],
    ).catch(() => ({ rowCount: 0 }));
    if ((ownership.rowCount ?? 0) === 0) {
      res.status(404).json({ error: 'asset_not_found' });
      return;
    }

    const exif = parsed.data.exif;
    const tags = buildExifTags(exif);

    // Schema-ensure (migrasjon 0096 idempotent)
    await pool.query(`
      ALTER TABLE capture_assets ADD COLUMN IF NOT EXISTS exif JSONB;
      ALTER TABLE capture_assets ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
    `).catch(() => undefined);

    await pool.query(
      `UPDATE capture_assets SET
         exif = $1::jsonb,
         tags = (
           SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags, '{}'::text[]) || $2::text[]))
         ),
         updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(exif), tags, req.params.id],
    );

    res.json({ tags, exif });
  });

  router.post('/sessions/:sessionId/events', auth, async (req, res) => {
    const parsed = postEventsBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const rows = await appendEvents(
      db,
      userId,
      req.params.sessionId,
      parsed.data.events.map((e) => ({
        assetId: e.assetId,
        eventType: e.eventType,
        metadata: e.metadata,
        occurredAt: new Date(e.occurredAt),
      })),
      userId,
    );
    if (rows.length === 0 && parsed.data.events.length > 0) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }
    for (const row of rows) {
      broadcastCaptureEvent(req.params.sessionId, row);
    }
    res.status(201).json({ events: rows });
  });

  router.get('/sessions/:sessionId/events', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const limit = Math.min(Number(req.query.limit ?? 1000), 5000);
    const rows = await listEvents(db, userId, req.params.sessionId, limit);
    res.json({ events: rows });
  });

  // ── Reviews ─────────────────────────────────────────────────

  router.post('/assets/:id/reviews', auth, async (req, res) => {
    const parsed = createReviewBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const row = await addReview(db, {
      assetId: req.params.id,
      reviewerId: userId,
      reviewerType: 'photographer',
      heart: parsed.data.heart,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });
    if (!row) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    res.status(201).json(row);
  });

  // Phase 5.1 — voice-memo reply attachment.
  // Multipart body: `audio` file part + `duration` text field. Bytes
  // land in capture R2 under `reviews/<reviewId>/audio.m4a` (key
  // computed with the inserted review row's id so we never have to
  // rename objects after the fact). Body cap 10 MB — generous for a
  // 60s mono AAC m4a (~2 MB at 256 kbps); larger uploads are
  // rejected at the multer layer.
  const captureAudioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  });
  router.post(
    '/assets/:id/reviews/audio',
    auth,
    captureAudioUpload.single('audio'),
    async (req, res) => {
      const { userId } = req as AuthedRequest;
      const audioFile = (req as Request & { file?: Express.Multer.File }).file;
      if (!audioFile) {
        res.status(400).json({ error: 'audio_required' });
        return;
      }
      // Validate mime — only AAC/m4a today; web client gallery may
      // post webm/opus later (Phase 6 follow-up).
      const allowed = new Set([
        'audio/m4a',
        'audio/mp4',
        'audio/aac',
        'audio/x-m4a',
      ]);
      const mime = audioFile.mimetype || 'application/octet-stream';
      if (!allowed.has(mime)) {
        res.status(415).json({ error: 'audio_mime_unsupported', mime });
        return;
      }
      const durationRaw = (req.body?.duration ?? '').toString();
      const duration = Number(durationRaw);
      if (!Number.isFinite(duration) || duration <= 0 || duration > 120) {
        res.status(400).json({ error: 'duration_invalid' });
        return;
      }
      // Pre-allocate the review id so the R2 key path is stable
      // before INSERT — keeps the FS-key the only source of truth
      // even if a race fails the INSERT (we'll just orphan the blob
      // on R2; cleanup is Phase 6).
      const reviewId = randomUUID();
      const r2Key = `reviews/${reviewId}/audio.m4a`;
      const stored = await uploadCaptureObject({
        key: r2Key,
        buffer: audioFile.buffer,
        contentType: mime,
      });
      if (!stored) {
        res.status(503).json({ error: 'r2_not_configured' });
        return;
      }
      // INSERT with the explicit id so the row's id matches the R2
      // key prefix. Drizzle's `returning()` gives us the canonical
      // row regardless of any defaults that fired.
      try {
        const [row] = await db
          .insert(captureReviews)
          .values({
            id: reviewId,
            assetId: req.params.id,
            reviewerId: userId,
            reviewerType: 'photographer',
            audioKey: stored,
            audioDurationSeconds: Math.round(duration),
            audioMimeType: mime,
          })
          .returning();
        if (!row) {
          res.status(500).json({ error: 'insert_failed' });
          return;
        }
        res.status(201).json(row);
      } catch (err) {
        res.status(500).json({ error: 'insert_threw' });
      }
    },
  );

  router.get('/assets/:id/reviews', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const rows = await listReviews(db, userId, req.params.id);
    res.json({ reviews: rows });
  });

  // Slice 6 — auto-clean variant upload. The iPad has the cleaned JPG
  // sitting locally after AutoCleanService ran; this route ingests it
  // into the capture R2 bucket and stamps the resulting key + detection
  // count onto the asset row, so the gallery render later re-signs it
  // alongside the camera-original (same machinery preview_key uses).
  //
  // Multipart body:
  //   cleaned          — JPEG/PNG file (≤ 30MB cap)
  //   detectionCount   — text field, integer ≥ 0
  //
  // Path: /sessions/:sessionId/assets/:assetId/upload-cleaned-variant
  // Auth: auth middleware + ownership-checked asset fetch.
  // Idempotent: re-uploading replaces in place at the deterministic
  // key `capture-cleaned/<sessionId>/<assetId>.jpg`. The R2 key is the
  // same for every re-upload of the same asset.
  const captureCleanedUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 },
  });
  router.post(
    '/sessions/:sessionId/assets/:assetId/upload-cleaned-variant',
    auth,
    captureCleanedUpload.single('cleaned'),
    async (req, res) => {
      const { userId } = req as AuthedRequest;
      const { sessionId, assetId } = req.params;
      const cleanedFile = (req as Request & { file?: Express.Multer.File }).file;
      if (!cleanedFile) {
        res.status(400).json({ error: 'cleaned_required' });
        return;
      }

      // Validate mime — only JPEG/PNG today (matches what /inpaint emits).
      const allowedMime = new Set(['image/jpeg', 'image/png']);
      const mime = cleanedFile.mimetype || 'application/octet-stream';
      if (!allowedMime.has(mime)) {
        res.status(415).json({ error: 'cleaned_mime_unsupported', mime });
        return;
      }

      // Validate detectionCount — integer ≥ 0.
      const countRaw = (req.body?.detectionCount ?? '').toString();
      const detectionCount = Number(countRaw);
      if (!Number.isInteger(detectionCount) || detectionCount < 0 || detectionCount > 64) {
        res.status(400).json({ error: 'detection_count_invalid' });
        return;
      }

      // Ownership-checked fetch: fails 404 if user doesn't own the
      // session that contains this asset, OR if the asset is in a
      // different session than the URL claims. The latter check
      // matters because the R2 key is derived from sessionId — without
      // it, an attacker who guessed an assetId could overwrite a
      // cleaned variant under a session they DO own.
      const owned = await fetchAsset(db, userId, assetId);
      if (!owned) {
        res.status(404).json({ error: 'asset_not_found' });
        return;
      }
      if (owned.sessionId !== sessionId) {
        res.status(404).json({ error: 'asset_session_mismatch' });
        return;
      }

      // Deterministic key — same asset re-uploaded overwrites in place.
      const r2Key = `capture-cleaned/${sessionId}/${assetId}.jpg`;
      const stored = await uploadCaptureObject({
        key: r2Key,
        buffer: cleanedFile.buffer,
        contentType: mime,
      });
      if (!stored) {
        res.status(503).json({ error: 'r2_not_configured' });
        return;
      }

      // Stamp the key + detection count onto the asset row. Drizzle's
      // returning() gives us the canonical updated row.
      try {
        const [row] = await db
          .update(captureAssets)
          .set({
            autoCleanedKey: stored,
            autoCleanedDetectionCount: detectionCount,
            updatedAt: new Date(),
          })
          .where(eq(captureAssets.id, assetId))
          .returning({
            id: captureAssets.id,
            autoCleanedKey: captureAssets.autoCleanedKey,
            autoCleanedDetectionCount: captureAssets.autoCleanedDetectionCount,
          });
        if (!row) {
          // Asset got deleted between fetch + update. Highly unlikely but possible.
          res.status(404).json({ error: 'asset_not_found' });
          return;
        }
        res.status(201).json({
          assetId: row.id,
          autoCleanedKey: row.autoCleanedKey,
          autoCleanedDetectionCount: row.autoCleanedDetectionCount ?? 0,
        });
      } catch (err) {
        // Failure here means R2 has the blob but DB doesn't reference it
        // — orphaned blob is acceptable (deterministic key means the
        // next attempt overwrites). Surface the error so the iPad can
        // retry, but don't try to delete the R2 object (deletion errors
        // would just compound the problem).
        res.status(500).json({
          error: 'attach_failed',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  // ── Handoff to photo enhancer ───────────────────────────────

  router.post('/sessions/:sessionId/handoff', auth, async (req, res) => {
    const parsed = handoffBody.safeParse(req.body ?? {});
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const result = await performHandoff(db, userId, req.params.sessionId, {
      preset: parsed.data.preset,
      settings: parsed.data.settings,
      filter: parsed.data.filter as HandoffFilter,
      preferredSource: parsed.data.preferredSource,
    });
    if (!result) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }
    broadcastCaptureEvent(req.params.sessionId, {
      type: 'handoff_triggered',
      handoffId: result.handoffId,
      submittedCount: result.submittedCount,
      requestedCount: result.requestedCount,
    });
    res.status(202).json(result);
  });

  // ── Deliver to UniversalShowcase (Phase 2B) ────────────────

  // GET /sessions/:id/cull-suggestions — review-surface helper that
  // groups the session's assets into reject / weak / keep / hero
  // buckets based on on-device signals + Claude AI notes + duplicate
  // clusters. Pure aggregator; doesn't mutate anything, so the
  // photographer can run it as many times as they want while editing.
  router.get('/sessions/:id/cull-suggestions', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const sessionId = req.params.id;
    try {
      // Ownership gate — fetchSession throws if the caller isn't the
      // session owner (or returns null). We verify before touching
      // assets so a stranger can't probe cull output for another
      // photographer's gallery.
      const session = await fetchSession(db, sessionId, userId);
      if (!session) {
        res.status(404).json({ error: 'session_not_found' });
        return;
      }
      const rows = await db
        .select({
          id: captureAssets.id,
          rating: captureAssets.rating,
          rejected: captureAssets.rejected,
          flaggedForClient: captureAssets.flaggedForClient,
          signals: captureAssets.signals,
        })
        .from(captureAssets)
        .where(eq(captureAssets.sessionId, sessionId))
        .orderBy(asc(captureAssets.captureTime));
      const forCulling: CaptureAssetForCulling[] = rows.map((r) => ({
        id: r.id,
        rating: r.rating ?? 0,
        rejected: r.rejected ?? false,
        flaggedForClient: r.flaggedForClient ?? false,
        signals: (r.signals ?? {}) as CaptureAssetForCulling['signals'],
      }));
      const strictnessRaw = typeof req.query.strictness === 'string'
        ? req.query.strictness.trim().toLowerCase()
        : '';
      const strictness: CullingStrictness =
        strictnessRaw === 'conservative' || strictnessRaw === 'aggressive'
          ? (strictnessRaw as CullingStrictness)
          : 'balanced';
      const summary = classifySession(forCulling, { strictness });
      res.json({
        sessionId,
        strictness,
        ...summary,
      });
    } catch (error) {
      console.error('[capture] cull-suggestions failed', error);
      res.status(500).json({ error: 'cull_suggestions_failed' });
    }
  });

  // Bridges a Capture session into a CreatorHub UniversalShowcase
  // gallery so the iPad's "Deliver" surface produces the same kind of
  // share link the photographer's regular gallery manager creates. Lives
  // alongside the legacy /client-tokens path — both can coexist and the
  // iPad picks whichever matches its current product mode.
  router.post('/sessions/:sessionId/deliver-to-showcase', auth, async (req, res) => {
    const parsed = deliverToShowcaseBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;

    const picks = await pickAssetsFromCaptureSession(
      db,
      userId,
      req.params.sessionId,
      parsed.data.filter,
    );
    if (picks.length === 0) {
      // Most-likely cause: session has no flagged / 4★ assets that have
      // a previewKey yet. The iPad surfaces this as "Pick at least one
      // photo before delivering".
      res.status(400).json({ error: 'no_picks' });
      return;
    }

    const result = await bridgeCaptureSessionToGallery({
      db,
      ownerUserId: userId,
      captureSessionId: req.params.sessionId,
      projectTitle: parsed.data.projectTitle,
      clientName: parsed.data.clientName,
      clientEmail: parsed.data.clientEmail,
      picks,
    });
    if (!result.ok) {
      res.status(bridgeErrorStatus(result.error)).json({
        error: result.error,
        detail: result.detail,
      });
      return;
    }
    res.status(result.reusedExisting ? 200 : 201).json({
      galleryId: result.galleryId,
      accessToken: result.accessToken,
      shareUrl: result.shareUrl,
      uploadedImageCount: result.uploadedImageCount,
      reusedExisting: result.reusedExisting,
    });
  });

  // ── Client tokens (photographer-side management) ────────────

  router.post('/sessions/:sessionId/client-tokens', auth, async (req, res) => {
    const parsed = createClientTokenBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const created = await createClientToken(db, userId, req.params.sessionId, parsed.data);
    if (!created) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }
    res.status(201).json(created);
  });

  router.get('/sessions/:sessionId/client-tokens', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const rows = await listClientTokens(db, userId, req.params.sessionId);
    res.json({ tokens: rows });
  });

  router.delete('/client-tokens/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await revokeClientToken(db, userId, req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  });

  // ── Client review endpoints (client-scoped token auth) ──────

  const clientAuth = requireClientToken(db);

  router.get('/client/session', clientAuth, async (req, res) => {
    const { clientAuth: auth } = req as ClientAuthedRequest;
    const session = await fetchSessionForClient(db, auth.sessionId);
    if (!session) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({
      session,
      clientLabel: auth.clientLabel,
    });
  });

  router.get('/client/assets', clientAuth, async (req, res) => {
    const { clientAuth: auth } = req as ClientAuthedRequest;
    const limit = Math.min(Number(req.query.limit ?? 500), 2000);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    const rows = await db
      .select()
      .from(captureAssets)
      .where(eq(captureAssets.sessionId, auth.sessionId))
      .orderBy(asc(captureAssets.captureTime))
      .limit(limit)
      .offset(offset);

    const withUrls = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        previewUrl: await signAssetReadUrl(row.previewKey),
      })),
    );
    res.json({ assets: withUrls });
  });

  router.get('/client/assets/:id', clientAuth, async (req, res) => {
    const { clientAuth: auth } = req as ClientAuthedRequest;
    const rows = await db
      .select()
      .from(captureAssets)
      .where(
        and(eq(captureAssets.id, req.params.id), eq(captureAssets.sessionId, auth.sessionId)),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({
      ...row,
      previewUrl: await signAssetReadUrl(row.previewKey),
      fullUrl: await signAssetReadUrl(row.fullKey),
    });
  });

  router.post('/client/assets/:id/reviews', clientAuth, async (req, res) => {
    const parsed = clientReviewBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { clientAuth: auth } = req as ClientAuthedRequest;
    // Verify the asset belongs to the session this client token scopes.
    const rows = await db
      .select({ id: captureAssets.id })
      .from(captureAssets)
      .where(
        and(eq(captureAssets.id, req.params.id), eq(captureAssets.sessionId, auth.sessionId)),
      )
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const row = await addReviewRow(db, {
      assetId: req.params.id,
      reviewerId: auth.reviewerId,
      reviewerType: 'client',
      heart: parsed.data.heart,
      comment: parsed.data.comment,
    });
    if (!row) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    broadcastCaptureEvent(auth.sessionId, {
      type: 'client_review',
      review: row,
    });
    res.status(201).json(row);
  });

  // ── Phase 5.4 — server-side AI enhancer round-trip ──────────────────
  //
  // The iPad's `LiveCaptureModel.kickEnhancementForLastDelivery` posts
  // here after `deliver()` succeeds. Each pick's bytes already live in
  // capture R2 (the upload step of deliver wrote them). We:
  //   1. Look up each asset row to get previewKey/fullKey
  //   2. Fetch bytes from capture R2 via `signAssetReadUrl` + fetch()
  //   3. Hand the buffer to `enqueuePhotoEnhancerJobFromBuffer` which
  //      re-uploads to PE R2 + creates the job + schedules the queue
  //   4. Track sessionId → assetId → jobId so the status route can
  //      answer "where's job for asset X" without scanning all jobs
  //
  // Idempotent on duplicate (sessionId, assetId) within process
  // lifetime: re-enqueue returns the existing job id rather than
  // creating a duplicate. The map is in-memory; on backend restart,
  // historical job mappings are lost (jobs themselves still live in
  // the photo-enhancer in-memory map until their TTL — Phase 6 may
  // persist this if needed).
  const enhancementMap = new Map<string, Map<string, string>>();

  router.post('/sessions/:sessionId/enhance-picks', auth, async (req, res) => {
    const sessionId = req.params.sessionId;
    const { userId } = req as AuthedRequest;
    const body = (req.body ?? {}) as { assetIds?: unknown; preset?: unknown };
    const assetIds = Array.isArray(body.assetIds)
      ? body.assetIds.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];
    if (assetIds.length === 0) {
      res.status(400).json({ error: 'asset_ids_required' });
      return;
    }
    const preset = typeof body.preset === 'string' ? body.preset : 'auto';

    // Verify session ownership so a different user's bearer can't
    // queue enhancement on someone else's shoot.
    const sessionRows = await db
      .select({ id: captureSessions.id, ownerUserId: captureSessions.ownerUserId })
      .from(captureSessions)
      .where(eq(captureSessions.id, sessionId))
      .limit(1);
    if (sessionRows.length === 0) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }
    if (sessionRows[0].ownerUserId !== userId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Load asset rows for the session — gives us R2 keys + filenames.
    // Filter to only the requested assetIds AND only ones in this
    // session (so an iPad bug can't accidentally enhance assets from
    // a different session).
    const assetRows = await db
      .select({
        id: captureAssets.id,
        previewKey: captureAssets.previewKey,
        fullKey: captureAssets.fullKey,
        originalFilename: captureAssets.originalFilename,
        mime: captureAssets.mime,
      })
      .from(captureAssets)
      .where(eq(captureAssets.sessionId, sessionId));
    const assetRowById = new Map(assetRows.map((row) => [row.id, row]));

    let perSession = enhancementMap.get(sessionId);
    if (!perSession) {
      perSession = new Map();
      enhancementMap.set(sessionId, perSession);
    }

    const jobs: Array<{ assetId: string; jobId: string }> = [];
    const failures: Array<{ assetId: string; reason: string }> = [];

    for (const assetId of assetIds) {
      // Idempotent — return existing job id if we've enqueued for this
      // (session, asset) pair already. Same shape the iPad expects.
      const existing = perSession.get(assetId);
      if (existing) {
        jobs.push({ assetId, jobId: existing });
        continue;
      }
      const row = assetRowById.get(assetId);
      if (!row) {
        failures.push({ assetId, reason: 'asset_not_in_session' });
        continue;
      }
      // Prefer fullKey when present (higher quality input for the
      // enhancer). Fall back to previewKey for sessions where the
      // photographer only delivered the display preview.
      const sourceKey = row.fullKey ?? row.previewKey;
      if (!sourceKey) {
        failures.push({ assetId, reason: 'no_source_key' });
        continue;
      }
      let buffer: Buffer;
      try {
        const presignedUrl = await signAssetReadUrl(sourceKey);
        if (!presignedUrl) {
          failures.push({ assetId, reason: 'sign_url_failed' });
          continue;
        }
        const response = await fetch(presignedUrl);
        if (!response.ok) {
          failures.push({ assetId, reason: `r2_fetch_${response.status}` });
          continue;
        }
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } catch (err) {
        failures.push({ assetId, reason: 'r2_fetch_threw' });
        continue;
      }

      const jobId = await enqueuePhotoEnhancerJobFromBuffer({
        buffer,
        fileName: row.originalFilename || `${assetId}.jpg`,
        mimeType: row.mime || 'image/jpeg',
        projectId: `capture-${sessionId}`,
        owner: userId,
        userId,
        preset,
      });
      if (!jobId) {
        failures.push({ assetId, reason: 'enqueue_failed' });
        continue;
      }
      perSession.set(assetId, jobId);
      jobs.push({ assetId, jobId });
    }

    res.status(202).json({ jobs, failures });
  });

  router.get('/sessions/:sessionId/enhance-status', auth, async (req, res) => {
    const sessionId = req.params.sessionId;
    const { userId } = req as AuthedRequest;

    // Reuse the same session-ownership gate as the POST so a leaked
    // session id can't be used to scrape another user's job state.
    const sessionRows = await db
      .select({ id: captureSessions.id, ownerUserId: captureSessions.ownerUserId })
      .from(captureSessions)
      .where(eq(captureSessions.id, sessionId))
      .limit(1);
    if (sessionRows.length === 0) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }
    if (sessionRows[0].ownerUserId !== userId) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const perSession = enhancementMap.get(sessionId);
    if (!perSession) {
      res.json({ jobs: [] });
      return;
    }
    const jobs = [...perSession.entries()].map(([assetId, jobId]) => {
      const snapshot = getPhotoEnhancerJobStatusSnapshot(jobId);
      if (!snapshot) {
        // Job aged out of in-memory map (TTL or restart). Treat as
        // failed so the iPad stops polling for it; photographer can
        // re-trigger via a future deliver if they want to retry.
        return { assetId, jobId, state: 'failed', enhancedUrl: null };
      }
      return {
        assetId,
        jobId,
        state: snapshot.state,
        enhancedUrl: snapshot.enhancedUrl,
      };
    });
    res.json({ jobs });
  });

  return router;
}
