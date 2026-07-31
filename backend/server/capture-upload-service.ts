import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  captureAssets,
  captureSessions,
  type InsertCaptureAsset,
} from '../migrations/capture-schema.js';

type Db = NodePgDatabase<Record<string, never>>;

export type UploadKind = 'preview' | 'full' | 'raw';

/// Hvilket S3-kompatibelt lager et capture-objekt ligger i. B2 er primær
/// for nye opplastinger; R2 leses videre fordi objektene som allerede
/// ligger der ikke flyttes av en kodeendring.
export type CaptureStoreBackend = 'b2' | 'r2';

export interface CaptureStoreConfig {
  backend: CaptureStoreBackend;
  enabled: boolean;
  endpoint?: string;
  region: string;
  /// B2 krever path-style-adressering; R2 bruker virtual-host.
  forcePathStyle: boolean;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  prefix: string;
}

/// Historisk navn. Beholdt fordi photo-delivery-service tar den som
/// parameter-type; konfigen kan nå peke på B2 like gjerne som R2.
export type CaptureR2Config = CaptureStoreConfig;

const MIN_PART_SIZE = 5 * 1024 * 1024;
const MAX_PART_SIZE = 5 * 1024 * 1024 * 1024;
const MAX_PARTS = 10_000;
const SIGNED_URL_TTL_SECONDS = 15 * 60;
const PART_URL_BATCH_MAX = 100;

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    if (v && v.trim().length > 0) return v;
  }
  return undefined;
}

export function buildCaptureR2Config(): CaptureStoreConfig {
  const endpoint = firstNonEmpty(
    process.env.CAPTURE_R2_ENDPOINT,
    process.env.CLOUDFLARE_R2_ENDPOINT,
    process.env.R2_ENDPOINT,
  );
  const bucket = firstNonEmpty(
    process.env.CAPTURE_R2_BUCKET,
    process.env.CLOUDFLARE_R2_UPLOAD_BUCKET,
    process.env.CLOUDFLARE_R2_BUCKET,
    process.env.R2_BUCKET,
  );
  const accessKeyId = firstNonEmpty(
    process.env.CAPTURE_R2_ACCESS_KEY_ID,
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    process.env.R2_ACCESS_KEY_ID,
  );
  const secretAccessKey = firstNonEmpty(
    process.env.CAPTURE_R2_SECRET_ACCESS_KEY,
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    process.env.R2_SECRET_ACCESS_KEY,
  );
  return {
    backend: 'r2',
    enabled: Boolean(endpoint && bucket && accessKeyId && secretAccessKey),
    endpoint,
    region: 'auto',
    forcePathStyle: false,
    bucket,
    accessKeyId,
    secretAccessKey,
    prefix: process.env.CAPTURE_R2_PREFIX ?? 'capture/',
  };
}

/// eu-central-003 er der the-role-room-prod ligger. Samme default som
/// b2-archive-helper — feil region gir stille skrivefeil, ikke en exception.
const B2_DEFAULT_REGION = 'eu-central-003';

/// Nøkkelrommet til B2 holdes atskilt fra R2-rommet. Det er dette som gjør
/// at en bar nøkkel kan rutes til riktig lager uten at hver av de ~40
/// signerings-kallstedene må vite hvilken backend objektet ligger i.
const CAPTURE_B2_DEFAULT_PREFIX = 'capture-b2/';

export function buildCaptureB2Config(): CaptureStoreConfig {
  const region =
    firstNonEmpty(process.env.CAPTURE_B2_REGION, process.env.B2_REGION) ??
    B2_DEFAULT_REGION;
  const endpoint =
    firstNonEmpty(process.env.CAPTURE_B2_ENDPOINT, process.env.B2_ENDPOINT) ??
    `https://s3.${region}.backblazeb2.com`;
  const bucket = firstNonEmpty(
    process.env.CAPTURE_B2_BUCKET,
    process.env.B2_ROLE_ROOM_BUCKET_NAME,
    process.env.B2_BUCKET_NAME,
  );
  const accessKeyId = firstNonEmpty(
    process.env.CAPTURE_B2_APPLICATION_KEY_ID,
    process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID,
    process.env.B2_APPLICATION_KEY_ID,
  );
  const secretAccessKey = firstNonEmpty(
    process.env.CAPTURE_B2_APPLICATION_KEY,
    process.env.B2_ROLE_ROOM_APPLICATION_KEY,
    process.env.B2_APPLICATION_KEY,
  );
  return {
    backend: 'b2',
    enabled: Boolean(endpoint && bucket && accessKeyId && secretAccessKey),
    endpoint,
    region,
    forcePathStyle: true,
    bucket,
    accessKeyId,
    secretAccessKey,
    prefix: process.env.CAPTURE_B2_PREFIX ?? CAPTURE_B2_DEFAULT_PREFIX,
  };
}

/**
 * Lageret nye capture-objekter skrives til: B2 når det er konfigurert,
 * ellers R2. CAPTURE_STORAGE_PRIMARY=r2 slår av B2 uten kodeendring.
 */
export function captureWriteStore(): CaptureStoreConfig {
  if (process.env.CAPTURE_STORAGE_PRIMARY === 'r2') return buildCaptureR2Config();
  const b2 = buildCaptureB2Config();
  return b2.enabled ? b2 : buildCaptureR2Config();
}

/**
 * Lageret en GITT nøkkel ligger i, avgjort av nøkkelprefikset alene.
 *
 * Dette er hele grunnen til at B2 og R2 har hvert sitt prefiks: nøkkelen
 * er ofte alt vi har (den kommer rett ut av en SQL-rad), og et objekt som
 * ble lastet opp til R2 i fjor må fortsatt hentes fra R2 i dag.
 */
export function captureStoreForKey(key: string): CaptureStoreConfig {
  const b2 = buildCaptureB2Config();
  if (b2.enabled && key.startsWith(b2.prefix)) return b2;
  return buildCaptureR2Config();
}

const clientCache = new Map<string, S3Client>();

function getClient(cfg: CaptureStoreConfig): S3Client | null {
  if (!cfg.enabled || !cfg.endpoint || !cfg.accessKeyId || !cfg.secretAccessKey) return null;
  const cacheKey = `${cfg.backend}|${cfg.endpoint}|${cfg.accessKeyId}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;
  const client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    ...(cfg.forcePathStyle ? { forcePathStyle: true } : {}),
  });
  clientCache.set(cacheKey, client);
  return client;
}

function computePartSize(totalSize: number, preferredPartSize?: number): number {
  const preferred = Math.max(preferredPartSize ?? MIN_PART_SIZE, MIN_PART_SIZE);
  const needed = Math.ceil(totalSize / MAX_PARTS);
  return Math.min(Math.max(preferred, needed), MAX_PART_SIZE);
}

function sanitizeFilename(input: string, fallback: string): string {
  const cleaned = input
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, 160);
  return cleaned || fallback;
}

function buildObjectKey(params: {
  prefix: string;
  ownerUserId: string;
  sessionId: string;
  assetId: string;
  kind: UploadKind;
  filename: string;
}): string {
  const name = sanitizeFilename(params.filename, 'file.bin');
  return `${params.prefix}${params.ownerUserId}/${params.sessionId}/${params.assetId}/${params.kind}/${name}`;
}

function expectedKeyPrefix(
  cfg: CaptureStoreConfig,
  ownerUserId: string,
  sessionId: string,
  assetId: string,
): string {
  return `${cfg.prefix}${ownerUserId}/${sessionId}/${assetId}/`;
}

async function fetchOwnedAsset(
  db: Db,
  ownerUserId: string,
  assetId: string,
): Promise<{ sessionId: string; originalFilename: string; mime: string } | null> {
  const rows = await db
    .select({
      sessionId: captureAssets.sessionId,
      originalFilename: captureAssets.originalFilename,
      mime: captureAssets.mime,
    })
    .from(captureAssets)
    .innerJoin(captureSessions, eq(captureAssets.sessionId, captureSessions.id))
    .where(and(eq(captureAssets.id, assetId), eq(captureSessions.ownerUserId, ownerUserId)))
    .limit(1);
  return rows[0] ?? null;
}

export type UploadError = 'not_configured' | 'not_found' | 'invalid';
type Result<T> = { ok: true; result: T } | { ok: false; error: UploadError };

export interface StartUploadResult {
  bucket: string;
  key: string;
  uploadId: string;
  partSize: number;
  partCount: number;
  signedUrlTtlSeconds: number;
  partUrlBatchMax: number;
}

export async function startMultipartUpload(
  db: Db,
  ownerUserId: string,
  assetId: string,
  kind: UploadKind,
  sizeBytes: number,
  mime: string,
  preferredPartSize?: number,
): Promise<Result<StartUploadResult>> {
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, error: 'invalid' };
  }
  const cfg = captureWriteStore();
  const client = getClient(cfg);
  if (!client || !cfg.bucket) return { ok: false, error: 'not_configured' };

  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };

  const key = buildObjectKey({
    prefix: cfg.prefix,
    ownerUserId,
    sessionId: asset.sessionId,
    assetId,
    kind,
    filename: asset.originalFilename,
  });
  const partSize = computePartSize(sizeBytes, preferredPartSize);
  const partCount = Math.ceil(sizeBytes / partSize);
  const created = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: mime,
      Metadata: {
        ownerUserId,
        sessionId: asset.sessionId,
        assetId,
        kind,
      },
    }),
  );
  if (!created.UploadId) {
    throw new Error('multipart start returned no uploadId');
  }
  return {
    ok: true,
    result: {
      bucket: cfg.bucket,
      key,
      uploadId: created.UploadId,
      partSize,
      partCount,
      signedUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
      partUrlBatchMax: PART_URL_BATCH_MAX,
    },
  };
}

export interface SignedPart {
  partNumber: number;
  url: string;
}

export async function signPartUrls(
  db: Db,
  ownerUserId: string,
  assetId: string,
  uploadId: string,
  key: string,
  partNumbers: number[],
): Promise<Result<{ parts: SignedPart[]; expiresInSeconds: number }>> {
  if (partNumbers.length === 0) return { ok: false, error: 'invalid' };
  // Nøkkelen bestemmer lageret — en pågående opplasting mot R2 må kunne
  // fullføres selv om B2 ble slått på mellom start og siste part.
  const cfg = captureStoreForKey(key);
  const client = getClient(cfg);
  if (!client || !cfg.bucket) return { ok: false, error: 'not_configured' };
  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };
  if (!key.startsWith(expectedKeyPrefix(cfg, ownerUserId, asset.sessionId, assetId))) {
    return { ok: false, error: 'not_found' };
  }
  const parts: SignedPart[] = await Promise.all(
    partNumbers.slice(0, PART_URL_BATCH_MAX).map(async (partNumber) => ({
      partNumber,
      url: await getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket: cfg.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: SIGNED_URL_TTL_SECONDS },
      ),
    })),
  );
  return {
    ok: true,
    result: { parts, expiresInSeconds: SIGNED_URL_TTL_SECONDS },
  };
}

export interface CompletedUpload {
  bucket: string;
  key: string;
  sizeBytes: number;
  etag: string | null;
  /// Originalfilnavnet fra kameraet. Brukes som objektnavn ved B2-speiling,
  /// slik at fotografen kjenner igjen filene i sin egen bøtte — nøkkelen vår
  /// er en UUID-sti og sier dem ingenting.
  originalFilename: string;
  /// Innholdstypen fra asset-raden. Ligger ikke i complete-bodyen, og B2
  /// trenger den for å lagre objektet med riktig Content-Type.
  mime: string;
}

export async function completeMultipartUpload(
  db: Db,
  ownerUserId: string,
  assetId: string,
  kind: UploadKind,
  uploadId: string,
  key: string,
  parts: Array<{ partNumber: number; etag: string }>,
  checksumSha256: string,
  sizeBytes: number,
): Promise<Result<CompletedUpload>> {
  if (parts.length === 0 || checksumSha256.length !== 64 || sizeBytes <= 0) {
    return { ok: false, error: 'invalid' };
  }
  const cfg = captureStoreForKey(key);
  const client = getClient(cfg);
  if (!client || !cfg.bucket) return { ok: false, error: 'not_configured' };

  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };
  if (!key.startsWith(expectedKeyPrefix(cfg, ownerUserId, asset.sessionId, assetId))) {
    return { ok: false, error: 'not_found' };
  }

  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: cfg.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sorted.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }),
  );
  const head = await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }));
  const verifiedSize = Number(head.ContentLength ?? sizeBytes);

  const patch: Partial<InsertCaptureAsset> = {
    checksumSha256,
    sizeBytes: verifiedSize,
    updatedAt: new Date(),
    ...(kind === 'preview' ? { previewKey: key } : {}),
    ...(kind === 'full' ? { fullKey: key } : {}),
    ...(kind === 'raw' ? { rawKey: key } : {}),
  };
  await db
    .update(captureAssets)
    .set(patch)
    .where(
      and(
        eq(captureAssets.id, assetId),
        sql`EXISTS (SELECT 1 FROM ${captureSessions}
          WHERE ${captureSessions.id} = ${captureAssets.sessionId}
          AND ${captureSessions.ownerUserId} = ${ownerUserId})`,
      ),
    );

  return {
    ok: true,
    result: {
      bucket: cfg.bucket,
      key,
      sizeBytes: verifiedSize,
      etag: head.ETag ?? null,
      originalFilename: asset.originalFilename,
      mime: asset.mime,
    },
  };
}

const READ_URL_TTL_SECONDS = 5 * 60;
/// 7 days is the AWS / Cloudflare R2 hard ceiling on presigned URL TTL.
/// Used when the URL needs to live in a database row for delivery
/// galleries — the client gallery viewer should re-sign on render once
/// the longer-term signing strategy lands, but this gets us through the
/// typical photographer-to-client delivery window.
const DELIVERY_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Generate a short-lived signed GET URL for a previously-uploaded asset key.
 * Used by client review mode so browsers can render thumbnails without
 * direct R2 credentials.
 */
/// Phase 5.1 — direct put for non-multipart objects (voice-memo
/// reply audio uploads bypass the deliver/multipart pipeline because
/// they're small ~50-200KB blobs uploaded once from the iPad on
/// each reply). The key follows a reviews-scoped prefix so audio
/// blobs live alongside review rows logically:
///   reviews/<reviewId>/audio.m4a
/// Returns the full R2 key on success or null when capture R2 isn't
/// configured (env vars missing — same path as other capture R2
/// failure modes).
export async function uploadCaptureObject(params: {
  key: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string | null> {
  // Nøkkelen kommer fra kalleren (f.eks. reviews/<id>/audio.m4a). Ligger
  // den allerede i et lagers nøkkelrom skriver vi dit; ellers til primær.
  const cfg = params.key.startsWith(buildCaptureB2Config().prefix)
    ? captureStoreForKey(params.key)
    : captureWriteStore();
  const client = getClient(cfg);
  if (!cfg.enabled || !cfg.bucket || !client) {
    return null;
  }
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
      }),
    );
    return params.key;
  } catch {
    return null;
  }
}

export async function signAssetReadUrl(
  key: string | null,
): Promise<string | null> {
  return signAssetReadUrlWithTtl(key, READ_URL_TTL_SECONDS);
}

/// Maximum-TTL signed URL for persisted contexts (e.g. gallery image rows
/// that live longer than the 5-minute review-mode default).
/**
 * TTL for URL-en B2-speilingen henter originalen fra.
 *
 * Ikke `READ_URL_TTL_SECONDS` (5 min): speilkøen er en FIFO i minnet som
 * behandles serielt, og et etterslep etter en stor overføring kan lett
 * passere fem minutter. Da ville worker'en fått 403 og filen stille aldri
 * havnet i brukerens B2 — som er nettopp feilen dette skal rette.
 */
const MIRROR_URL_TTL_SECONDS = 60 * 60;

/** Signert GET-URL beregnet på B2-speilingen. */
export async function signAssetReadUrlForMirror(key: string | null): Promise<string | null> {
  return signAssetReadUrlWithTtl(key, MIRROR_URL_TTL_SECONDS);
}

export async function signAssetReadUrlForDelivery(
  key: string | null,
): Promise<string | null> {
  return signAssetReadUrlWithTtl(key, DELIVERY_URL_TTL_SECONDS);
}

async function signAssetReadUrlWithTtl(
  key: string | null,
  ttlSeconds: number,
): Promise<string | null> {
  if (!key) return null;
  const cfg = captureStoreForKey(key);
  const client = getClient(cfg);
  if (!client || !cfg.bucket) return null;
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
    { expiresIn: ttlSeconds },
  );
}

export async function abortMultipartUpload(
  db: Db,
  ownerUserId: string,
  assetId: string,
  uploadId: string,
  key: string,
): Promise<{ ok: true } | { ok: false; error: UploadError }> {
  const cfg = captureStoreForKey(key);
  const client = getClient(cfg);
  if (!client || !cfg.bucket) return { ok: false, error: 'not_configured' };
  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };
  if (!key.startsWith(expectedKeyPrefix(cfg, ownerUserId, asset.sessionId, assetId))) {
    return { ok: false, error: 'not_found' };
  }
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: cfg.bucket,
      Key: key,
      UploadId: uploadId,
    }),
  );
  return { ok: true };
}
