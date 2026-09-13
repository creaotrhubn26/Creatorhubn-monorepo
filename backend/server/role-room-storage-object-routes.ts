import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

import {
  ensureRoleRoomOrganizationStorageAccount,
  readRoleRoomOrganizationAccess,
} from "./role-room-storage-billing.js";
import {
  getRoleRoomObjectStorage,
  type RoleRoomObjectStorage,
} from "./role-room-object-storage.js";

const GIB = 1024 ** 3;
const DEFAULT_MAX_UPLOAD_BYTES = 2 * GIB;
const MAX_SINGLE_PUT_BYTES = 5 * GIB;
const RESERVATION_MINUTES = 30;

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic",
  "image/heif", "image/avif",
  "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm",
  "audio/aac", "audio/x-m4a", "audio/m4a",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

const initiateSchema = z.object({
  organizationId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  contentType: z.string().trim().max(200),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  projectId: z.string().trim().min(1).max(255).optional(),
  sourceModule: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/).optional(),
  metadata: z.record(z.unknown()).default({}),
}).strict();

const organizationBodySchema = z.object({ organizationId: z.string().uuid() }).strict();

type SessionData = { userId: string; role?: string; email?: string };
type Signer = (
  client: S3Client,
  command: PutObjectCommand | GetObjectCommand,
  expiresIn: number,
) => Promise<string>;

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  storage?: RoleRoomObjectStorage | null;
  signer?: Signer;
}

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.slice(7).trim()) ?? null;
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.sessionToken;
  return cookieToken ? sessions.get(cookieToken) ?? null : null;
}

function maximumUploadBytes(): number {
  const configured = Number(process.env.ROLE_ROOM_STORAGE_MAX_SINGLE_UPLOAD_BYTES);
  if (!Number.isSafeInteger(configured) || configured <= 0) return DEFAULT_MAX_UPLOAD_BYTES;
  return Math.min(configured, MAX_SINGLE_PUT_BYTES);
}

function safeExtension(displayName: string): string {
  return displayName.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || "bin";
}

function safeDownloadName(displayName: string): string {
  return displayName
    .replace(/[\r\n"\\]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .slice(0, 200) || "download";
}

export function buildOrganizationStorageObjectKey(input: {
  organizationId: string;
  userId: string;
  objectId: string;
  displayName: string;
  projectId?: string;
}): string {
  const extension = safeExtension(input.displayName);
  return input.projectId
    ? `organizations/${input.organizationId}/projects/${input.projectId}/uploads/${input.objectId}/original.${extension}`
    : `organizations/${input.organizationId}/members/${input.userId}/uploads/${input.objectId}/original.${extension}`;
}

async function defaultSigner(
  client: S3Client,
  command: PutObjectCommand | GetObjectCommand,
  expiresIn: number,
): Promise<string> {
  return getSignedUrl(client, command, { expiresIn });
}

async function releaseReservation(pool: Pool | PoolClient, accountId: string, bytes: number): Promise<void> {
  await pool.query(`SELECT role_room_release_storage_reservation($1::uuid, $2::bigint)`, [accountId, bytes]);
}

async function cleanupExpiredReservations(
  pool: Pool,
  storage: RoleRoomObjectStorage,
  accountId: string,
): Promise<void> {
  const expired = await pool.query<{ id: string; object_key: string; size_bytes: string }>(
    `SELECT id, object_key, size_bytes
       FROM role_room_storage_objects
      WHERE storage_account_id = $1::uuid
        AND status = 'pending'
        AND reservation_expires_at <= NOW()
      ORDER BY reservation_expires_at ASC
      LIMIT 100`,
    [accountId],
  );
  for (const row of expired.rows) {
    const deletedFromStorage = await storage.client.send(new DeleteObjectCommand({
      Bucket: storage.bucket,
      Key: row.object_key,
    })).then(() => true).catch(() => false);
    if (!deletedFromStorage) continue;
    const changed = await pool.query(
      `UPDATE role_room_storage_objects
          SET status = 'deleted', deleted_at = NOW()
        WHERE id = $1::uuid AND status = 'pending'
        RETURNING id`,
      [row.id],
    );
    if ((changed.rowCount ?? 0) > 0) {
      await releaseReservation(pool, accountId, Number(row.size_bytes));
    }
  }
}

async function requireProjectInOrganization(
  pool: Pool,
  projectId: string | undefined,
  organizationId: string,
): Promise<boolean> {
  if (!projectId) return true;
  const result = await pool.query(
    `SELECT 1 FROM casting_projects
      WHERE id = $1 AND organization_id = $2::uuid
      LIMIT 1`,
    [projectId, organizationId],
  );
  return result.rows.length > 0;
}

async function readAccessibleObject(
  pool: Pool,
  objectId: string,
  organizationId: string,
) {
  const result = await pool.query<{
    id: string;
    storage_account_id: string;
    object_key: string;
    display_name: string;
    size_bytes: string;
    content_type: string | null;
    checksum_sha256: string | null;
    project_id: string | null;
    source_module: string | null;
    created_by_user_id: string | null;
    metadata: Record<string, unknown>;
    status: string;
    created_at: Date;
  }>(
    `SELECT object_row.id, object_row.storage_account_id, object_row.object_key,
            object_row.display_name, object_row.size_bytes,
            object_row.content_type, object_row.checksum_sha256,
            object_row.project_id, object_row.source_module,
            object_row.created_by_user_id, object_row.metadata,
            object_row.status, object_row.created_at
       FROM role_room_storage_objects object_row
       JOIN role_room_storage_accounts account
         ON account.id = object_row.storage_account_id
      WHERE object_row.id = $1::uuid
        AND account.organization_id = $2::uuid
        AND object_row.deleted_at IS NULL
      LIMIT 1`,
    [objectId, organizationId],
  );
  return result.rows[0] ?? null;
}

export function registerRoleRoomStorageObjectRoutes({
  app,
  pool,
  activeSessions,
  storage = getRoleRoomObjectStorage(),
  signer = defaultSigner,
}: Deps): void {
  app.post("/api/role-room/storage/objects/initiate", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "krever_innlogging" });
    const parsed = initiateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "ugyldig_foresporsel" });
    const input = parsed.data;
    if (!ALLOWED_CONTENT_TYPES.has(input.contentType.toLowerCase())) {
      return res.status(415).json({ error: "filtype_ikke_tillatt" });
    }
    if (input.sizeBytes > maximumUploadBytes()) {
      return res.status(413).json({ error: "fil_for_stor", maxBytes: maximumUploadBytes() });
    }
    if (JSON.stringify(input.metadata).length > 16_384) {
      return res.status(413).json({ error: "metadata_for_stor" });
    }
    if (!storage) return res.status(503).json({ error: "lagring_ikke_konfigurert" });
    try {
      const organization = await readRoleRoomOrganizationAccess(pool, input.organizationId, session.userId);
      if (!organization) return res.status(403).json({ error: "ingen_organisasjonstilgang" });
      if (organization.membershipRole === "viewer" && !organization.canAdminister) {
        return res.status(403).json({ error: "lagringskonto_er_skrivebeskyttet" });
      }
      if (!await requireProjectInOrganization(pool, input.projectId, organization.id)) {
        return res.status(403).json({ error: "prosjekt_tilhorer_ikke_organisasjonen" });
      }
      const account = await ensureRoleRoomOrganizationStorageAccount(pool, organization);
      await cleanupExpiredReservations(pool, storage, account.id);
      const reservation = await pool.query<{ role_room_reserve_storage: boolean }>(
        `SELECT role_room_reserve_storage($1::uuid, $2::bigint)`,
        [account.id, input.sizeBytes],
      );
      if (reservation.rows[0]?.role_room_reserve_storage !== true) {
        return res.status(507).json({ error: "kvote_overskredet_eller_skrivebeskyttet" });
      }

      const objectId = randomUUID();
      const objectKey = buildOrganizationStorageObjectKey({
        organizationId: organization.id,
        userId: session.userId,
        objectId,
        displayName: input.displayName,
        projectId: input.projectId,
      });
      const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60_000);
      let objectRegistered = false;
      try {
        await pool.query(
          `INSERT INTO role_room_storage_objects (
             id, storage_account_id, object_key, display_name, size_bytes,
             content_type, checksum_sha256, project_id, source_module,
             created_by_user_id, metadata, status, reservation_expires_at
           ) VALUES (
             $1::uuid, $2::uuid, $3, $4, $5::bigint,
             $6, $7, $8, $9, $10, $11::jsonb, 'pending', $12
           )`,
          [
            objectId, account.id, objectKey, input.displayName, input.sizeBytes,
            input.contentType.toLowerCase(), input.checksumSha256.toLowerCase(),
            input.projectId ?? null, input.sourceModule ?? null, session.userId,
            JSON.stringify(input.metadata), expiresAt,
          ],
        );
        objectRegistered = true;
        const checksumBase64 = Buffer.from(input.checksumSha256, "hex").toString("base64");
        const uploadUrl = await signer(storage.client, new PutObjectCommand({
          Bucket: storage.bucket,
          Key: objectKey,
          ContentType: input.contentType.toLowerCase(),
          ChecksumSHA256: checksumBase64,
        }), RESERVATION_MINUTES * 60);
        return res.status(201).json({
          objectId,
          uploadUrl,
          expiresAt: expiresAt.toISOString(),
          requiredHeaders: {
            "content-type": input.contentType.toLowerCase(),
            "x-amz-checksum-sha256": checksumBase64,
          },
        });
      } catch (error) {
        if (!objectRegistered) {
          await releaseReservation(pool, account.id, input.sizeBytes).catch(() => undefined);
        } else {
          const changed = await pool.query(
            `UPDATE role_room_storage_objects
                SET status = 'deleted', deleted_at = NOW()
              WHERE id = $1::uuid AND status = 'pending'
              RETURNING id`,
            [objectId],
          ).catch(() => null);
          if ((changed?.rowCount ?? 0) > 0) {
            await releaseReservation(pool, account.id, input.sizeBytes).catch(() => undefined);
          }
        }
        throw error;
      }
    } catch (error) {
      console.error("[role-room-storage-objects] initiate failed", error);
      return res.status(503).json({ error: "opplasting_kunne_ikke_startes" });
    }
  });

  app.post("/api/role-room/storage/objects/:id/complete", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "krever_innlogging" });
    const objectId = z.string().uuid().safeParse(req.params.id);
    const body = organizationBodySchema.safeParse(req.body);
    if (!objectId.success || !body.success) return res.status(400).json({ error: "ugyldig_foresporsel" });
    if (!storage) return res.status(503).json({ error: "lagring_ikke_konfigurert" });
    try {
      const organization = await readRoleRoomOrganizationAccess(pool, body.data.organizationId, session.userId);
      if (!organization) return res.status(403).json({ error: "ingen_organisasjonstilgang" });
      if (organization.membershipRole === "viewer" && !organization.canAdminister) {
        return res.status(403).json({ error: "lagringskonto_er_skrivebeskyttet" });
      }
      const objectRow = await readAccessibleObject(pool, objectId.data, organization.id);
      if (!objectRow) return res.status(404).json({ error: "objekt_ikke_funnet" });
      if (objectRow.status === "active") return res.json({ ok: true, objectId: objectRow.id, status: "active" });
      if (objectRow.status !== "pending") return res.status(409).json({ error: "objekt_kan_ikke_ferdigstilles" });

      const head = await storage.client.send(new HeadObjectCommand({
        Bucket: storage.bucket,
        Key: objectRow.object_key,
        ChecksumMode: "ENABLED",
      }));
      const expectedChecksum = objectRow.checksum_sha256
        ? Buffer.from(objectRow.checksum_sha256, "hex").toString("base64")
        : null;
      const validSize = head.ContentLength === Number(objectRow.size_bytes);
      const validChecksum = expectedChecksum !== null && head.ChecksumSHA256 === expectedChecksum;
      if (!validSize || !validChecksum) {
        const deletedFromStorage = await storage.client.send(new DeleteObjectCommand({
          Bucket: storage.bucket,
          Key: objectRow.object_key,
        })).then(() => true).catch(() => false);
        if (!deletedFromStorage) {
          return res.status(503).json({
            error: "ugyldig_objekt_kunne_ikke_slettes",
            retryable: true,
          });
        }
        const quarantined = await pool.query(
          `UPDATE role_room_storage_objects
              SET status = 'quarantined', deleted_at = NOW()
            WHERE id = $1::uuid AND status = 'pending'`,
          [objectRow.id],
        );
        if ((quarantined.rowCount ?? 0) > 0) {
          await releaseReservation(pool, objectRow.storage_account_id, Number(objectRow.size_bytes));
        }
        return res.status(422).json({ error: "storrelse_eller_checksum_avviker" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const locked = await client.query<{ status: string }>(
          `SELECT status FROM role_room_storage_objects WHERE id = $1::uuid FOR UPDATE`,
          [objectRow.id],
        );
        if (locked.rows[0]?.status === "pending") {
          await client.query(
            `UPDATE role_room_storage_objects
                SET status = 'active', reservation_expires_at = NULL
              WHERE id = $1::uuid`,
            [objectRow.id],
          );
          await client.query(
            `SELECT role_room_release_storage_reservation($1::uuid, $2::bigint)`,
            [objectRow.storage_account_id, Number(objectRow.size_bytes)],
          );
          await client.query(
            `SELECT role_room_apply_storage_usage(
               $1::uuid, $2::uuid, $3, $4::bigint, 1, 'upload', $5::jsonb
             )`,
            [
              objectRow.storage_account_id,
              objectRow.id,
              `upload:${objectRow.id}`,
              Number(objectRow.size_bytes),
              JSON.stringify({ completedByUserId: session.userId }),
            ],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      return res.json({ ok: true, objectId: objectRow.id, status: "active" });
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return res.status(409).json({ error: "opplasting_ikke_funnet_i_s3" });
      console.error("[role-room-storage-objects] complete failed", error);
      return res.status(503).json({ error: "opplasting_kunne_ikke_ferdigstilles" });
    }
  });

  app.get("/api/role-room/storage/objects", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "krever_innlogging" });
    const organizationId = z.string().uuid().safeParse(req.query.organizationId);
    if (!organizationId.success) return res.status(400).json({ error: "ugyldig_organization_id" });
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    try {
      const organization = await readRoleRoomOrganizationAccess(pool, organizationId.data, session.userId);
      if (!organization) return res.status(403).json({ error: "ingen_organisasjonstilgang" });
      const result = await pool.query<{
        id: string; display_name: string; size_bytes: string; content_type: string | null;
        project_id: string | null; source_module: string | null; metadata: Record<string, unknown>;
        created_by_user_id: string | null; created_at: Date;
      }>(
        `SELECT object_row.id, object_row.display_name, object_row.size_bytes,
                object_row.content_type, object_row.project_id,
                object_row.source_module, object_row.metadata,
                object_row.created_by_user_id, object_row.created_at
           FROM role_room_storage_objects object_row
           JOIN role_room_storage_accounts account ON account.id = object_row.storage_account_id
          WHERE account.organization_id = $1::uuid
            AND object_row.status = 'active' AND object_row.deleted_at IS NULL
          ORDER BY object_row.created_at DESC
          LIMIT $2`,
        [organization.id, limit],
      );
      return res.json({
        objects: result.rows.map((row) => ({
          id: row.id,
          displayName: row.display_name,
          sizeBytes: Number(row.size_bytes),
          contentType: row.content_type,
          projectId: row.project_id,
          sourceModule: row.source_module,
          metadata: row.metadata,
          createdByUserId: row.created_by_user_id,
          createdAt: row.created_at.toISOString(),
        })),
      });
    } catch (error) {
      console.error("[role-room-storage-objects] list failed", error);
      return res.status(503).json({ error: "objekter_kunne_ikke_hentes" });
    }
  });

  app.get("/api/role-room/storage/objects/:id/download", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "krever_innlogging" });
    const objectId = z.string().uuid().safeParse(req.params.id);
    const organizationId = z.string().uuid().safeParse(req.query.organizationId);
    if (!objectId.success || !organizationId.success) return res.status(400).json({ error: "ugyldig_foresporsel" });
    if (!storage) return res.status(503).json({ error: "lagring_ikke_konfigurert" });
    try {
      const organization = await readRoleRoomOrganizationAccess(pool, organizationId.data, session.userId);
      if (!organization) return res.status(403).json({ error: "ingen_organisasjonstilgang" });
      const objectRow = await readAccessibleObject(pool, objectId.data, organization.id);
      if (!objectRow || objectRow.status !== "active") return res.status(404).json({ error: "objekt_ikke_funnet" });
      const url = await signer(storage.client, new GetObjectCommand({
        Bucket: storage.bucket,
        Key: objectRow.object_key,
        ResponseContentDisposition: `attachment; filename="${safeDownloadName(objectRow.display_name)}"`,
      }), 300);
      await pool.query(
        `INSERT INTO role_room_storage_daily_metrics (
           storage_account_id, usage_date, egress_bytes, get_requests
         ) VALUES ($1::uuid, CURRENT_DATE, $2::bigint, 1)
         ON CONFLICT (storage_account_id, usage_date)
         DO UPDATE SET egress_bytes = role_room_storage_daily_metrics.egress_bytes + EXCLUDED.egress_bytes,
                       get_requests = role_room_storage_daily_metrics.get_requests + 1,
                       updated_at = NOW()`,
        [objectRow.storage_account_id, Number(objectRow.size_bytes)],
      ).catch((error) => {
        console.warn(
          "[role-room-storage-objects] download metric failed",
          error instanceof Error ? error.message : error,
        );
      });
      res.setHeader("Cache-Control", "no-store");
      return res.json({ url, expiresInSeconds: 300 });
    } catch (error) {
      console.error("[role-room-storage-objects] download failed", error);
      return res.status(503).json({ error: "nedlastingslenke_kunne_ikke_lages" });
    }
  });

  app.delete("/api/role-room/storage/objects/:id", async (req: Request, res: Response) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "krever_innlogging" });
    const objectId = z.string().uuid().safeParse(req.params.id);
    const body = organizationBodySchema.safeParse(req.body);
    if (!objectId.success || !body.success) return res.status(400).json({ error: "ugyldig_foresporsel" });
    if (!storage) return res.status(503).json({ error: "lagring_ikke_konfigurert" });
    try {
      const organization = await readRoleRoomOrganizationAccess(pool, body.data.organizationId, session.userId);
      if (!organization) return res.status(403).json({ error: "ingen_organisasjonstilgang" });
      const objectRow = await readAccessibleObject(pool, objectId.data, organization.id);
      if (!objectRow || objectRow.status !== "active") return res.status(404).json({ error: "objekt_ikke_funnet" });
      if (!organization.canAdminister && objectRow.created_by_user_id !== session.userId) {
        return res.status(403).json({ error: "kun_opplaster_eller_organisasjonsadmin" });
      }
      await storage.client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: objectRow.object_key }));
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const changed = await client.query(
          `UPDATE role_room_storage_objects
              SET status = 'deleted', deleted_at = NOW()
            WHERE id = $1::uuid AND status = 'active'
            RETURNING id`,
          [objectRow.id],
        );
        if (changed.rows.length > 0) {
          await client.query(
            `SELECT role_room_apply_storage_usage(
               $1::uuid, $2::uuid, $3, $4::bigint, -1, 'delete', $5::jsonb
             )`,
            [
              objectRow.storage_account_id,
              objectRow.id,
              `delete:${objectRow.id}`,
              -Number(objectRow.size_bytes),
              JSON.stringify({ deletedByUserId: session.userId }),
            ],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      return res.json({ ok: true, freedBytes: Number(objectRow.size_bytes) });
    } catch (error) {
      console.error("[role-room-storage-objects] delete failed", error);
      return res.status(503).json({ error: "objekt_kunne_ikke_slettes" });
    }
  });
}
