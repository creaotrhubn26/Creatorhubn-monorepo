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
import type { Pool } from 'pg';
import { resolveB2Key, type B2KeyRole } from './b2-key-registry.js';
import {
  bucketForClass,
  bucketForKey,
  classForKeySegment,
  keyMarkerFor,
  type StorageClass,
} from './b2-bucket-registry.js';
import {
  discardVersion,
  promoteVersion,
  reserveVersion,
  versionForKey,
  versionSegment,
} from './capture-asset-version-service.js';
import {
  captureAssets,
  captureSessions,
  type InsertCaptureAsset,
} from '../migrations/capture-schema.js';

type Db = NodePgDatabase<Record<string, never>>;

export type UploadKind = 'preview' | 'full' | 'raw';

/**
 * Hvilken bøtte-klasse en variant hører hjemme i.
 *
 * Previews kan gjenskapes fra originalen når som helst, og hører derfor i
 * proxy-bøtta der livssyklusregler kan rydde aggressivt. `full` og `raw`
 * er masterne — de skal ligge et sted som ikke ryddes automatisk.
 */
export function storageClassForKind(kind: UploadKind): StorageClass {
  return kind === 'preview' ? 'proxies' : 'originals';
}

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

/**
 * Bøtta et nytt objekt av en gitt klasse skal skrives til.
 *
 * Bare B2 er splittet opp; R2 har én bøtte og beholder den. Å late som
 * noe annet ville gitt en klasse-inndeling som ikke finnes i lageret.
 */
function writeBucket(
  cfg: CaptureStoreConfig,
  storageClass: StorageClass,
): string | undefined {
  if (cfg.backend !== 'b2') return cfg.bucket;
  return bucketForClass(storageClass)?.bucket ?? cfg.bucket;
}

/**
 * Bøtta en GITT nøkkel ligger i.
 *
 * Klassen leses av det reserverte leddet i nøkkelen, etter lager-
 * prefikset. Nøkler skrevet før splitten mangler leddet og havner i
 * fellesbøtta — det er nettopp dette som gjør at ingenting må kopieres.
 */
function readBucket(cfg: CaptureStoreConfig, key: string): string | undefined {
  if (cfg.backend !== 'b2') return cfg.bucket;
  const withoutPrefix = key.startsWith(cfg.prefix)
    ? key.slice(cfg.prefix.length)
    : key;
  return bucketForKey(withoutPrefix)?.bucket ?? cfg.bucket;
}

export interface CaptureStoreHandle {
  client: S3Client;
  bucket: string;
  backend: CaptureStoreBackend;
  /// Prefiks nye nøkler må skrives under for at captureStoreForKey skal
  /// finne dem igjen. Tom streng for R2 er ikke riktig — R2 har sitt eget
  /// prefiks — så bruk alltid dette framfor å gjette.
  prefix: string;
}

/**
 * Klient for lageret nye objekter skal skrives til.
 *
 * Modulene som lagrer sine egne ting — dansevideo, koreografimusikk,
 * referansearkiv, foto-leveranse, marketing-preview — bygde tidligere
 * hver sin S3-klient rett fra R2-konfigen. Fem kopier av samme oppsett
 * som alle måtte endres hver for seg når primærlageret flyttet seg.
 */
export function captureStoreForWrite(
  storageClass: StorageClass = 'working',
): CaptureStoreHandle | null {
  const cfg = captureWriteStore();
  const client = getClient(cfg, 'capture-write');
  const bucket = writeBucket(cfg, storageClass);
  if (!client || !bucket) return null;
  // Prefikset inkluderer klasseleddet, slik at nøkkelen kalleren bygger
  // kan rutes tilbake til samme bøtte ved lesing.
  const prefix =
    cfg.backend === 'b2' ? `${cfg.prefix}${keyMarkerFor(storageClass)}` : cfg.prefix;
  return { client, bucket, backend: cfg.backend, prefix };
}

/**
 * Klient for lageret en GITT nøkkel ligger i.
 *
 * Bruk alltid denne til lesing. Objekter skrevet før B2 ble primær ligger
 * fortsatt i R2, og å slå opp dagens primærvalg ville lett etter dem på
 * feil sted.
 */
export function captureStoreHandleForKey(key: string): CaptureStoreHandle | null {
  const cfg = captureStoreForKey(key);
  const client = getClient(cfg, 'capture-read');
  const bucket = readBucket(cfg, key);
  if (!client || !bucket) return null;
  return { client, bucket, backend: cfg.backend, prefix: cfg.prefix };
}

/**
 * Klient som faktisk kan slette.
 *
 * Egen funksjon fordi lesenøkkelen med vilje IKKE har `deleteFiles`. Ville
 * frigjøringen brukt `captureStoreHandleForKey`, måtte lesenøkkelen fått
 * slettetilgang — og da kunne enhver lekkasje fra preview-visningen slette
 * originalene fra en innspilling.
 */
export function captureDeleteHandleForKey(key: string): CaptureStoreHandle | null {
  const cfg = captureStoreForKey(key);
  const client = getClient(cfg, 'capture-delete');
  const bucket = readBucket(cfg, key);
  if (!client || !bucket) return null;
  return { client, bucket, backend: cfg.backend, prefix: cfg.prefix };
}

const clientCache = new Map<string, S3Client>();

/**
 * Legitimasjonen en operasjon skal bruke.
 *
 * B2 har egne nøkler per rolle: den som signerer en preview-URL trenger
 * ikke kunne skrive, og den som laster opp trenger ikke kunne slette. R2
 * har ikke fått samme oppdeling, så der brukes konfigens nøkkel uansett
 * rolle — å late som noe annet ville vært en falsk trygghet.
 */
function credentialsFor(
  cfg: CaptureStoreConfig,
  role: B2KeyRole,
): { accessKeyId: string; secretAccessKey: string } | null {
  if (cfg.backend === 'b2') {
    const scoped = resolveB2Key(role);
    if (scoped) {
      return {
        accessKeyId: scoped.keyId,
        secretAccessKey: scoped.applicationKey,
      };
    }
  }
  if (!cfg.accessKeyId || !cfg.secretAccessKey) return null;
  return { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey };
}

function getClient(cfg: CaptureStoreConfig, role: B2KeyRole): S3Client | null {
  if (!cfg.enabled || !cfg.endpoint) return null;
  const creds = credentialsFor(cfg, role);
  if (!creds) return null;
  // Nøkkel-id-en er med i cache-nøkkelen, så to roller med ulik nøkkel
  // aldri deler klient — ellers ville den første rollen som koblet opp
  // bestemt legitimasjonen for de andre.
  const cacheKey = `${cfg.backend}|${cfg.endpoint}|${creds.accessKeyId}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;
  const client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: creds,
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
  /// Versjonsleddet ('v3/'). Det er dette som gjør nøkkelen unik per
  /// versjon — uten det traff en ny opplasting samme nøkkel og overskrev
  /// fila i bøtta.
  versionSegment: string;
  filename: string;
}): string {
  const name = sanitizeFilename(params.filename, 'file.bin');
  return (
    `${params.prefix}${params.ownerUserId}/${params.sessionId}/` +
    `${params.assetId}/${params.kind}/${params.versionSegment}${name}`
  );
}

/**
 * Hører nøkkelen til dette assetet?
 *
 * Sjekken finnes for å hindre at en klient oppgir en vilkårlig nøkkel og
 * får den signert. Den må tåle begge nøkkelformene:
 *
 *   capture-b2/_originals/{eier}/{sesjon}/{asset}/…   ← etter bøtte-splitten
 *   capture-b2/{eier}/{sesjon}/{asset}/…              ← før
 *
 * En sjekk som bare kjente den siste ville avvist alt som lastes opp
 * etter splitten — og en som bare kjente den første ville sluppet gjennom
 * alt fra før den.
 */
function keyBelongsToAsset(
  cfg: CaptureStoreConfig,
  key: string,
  ownerUserId: string,
  sessionId: string,
  assetId: string,
): boolean {
  if (!key.startsWith(cfg.prefix)) return false;
  let rest = key.slice(cfg.prefix.length);
  const marker = classForKeySegment(rest);
  if (marker) rest = rest.slice(keyMarkerFor(marker).length);
  return rest.startsWith(`${ownerUserId}/${sessionId}/${assetId}/`);
}

async function fetchOwnedAsset(
  db: Db,
  ownerUserId: string,
  assetId: string,
): Promise<{
  sessionId: string;
  originalFilename: string;
  mime: string;
  projectId: string | null;
} | null> {
  const rows = await db
    .select({
      sessionId: captureAssets.sessionId,
      originalFilename: captureAssets.originalFilename,
      mime: captureAssets.mime,
      // Produksjonen bytene tilhører. Nullbar — en capture-sesjon kan
      // opprettes uten prosjekt, og da faller bokføringen tilbake til
      // brukeren som lastet opp.
      projectId: captureSessions.projectId,
    })
    .from(captureAssets)
    .innerJoin(captureSessions, eq(captureAssets.sessionId, captureSessions.id))
    .where(and(eq(captureAssets.id, assetId), eq(captureSessions.ownerUserId, ownerUserId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Produksjonen et asset tilhører, eller null.
 *
 * Egen funksjon fordi kvotesjekken skjer FØR multipart-opplastingen
 * startes, og da har ruten ikke asset-raden ennå. Eierskapssjekken er
 * den samme — et asset i en annen brukers sesjon svarer null, ikke
 * prosjektet.
 */
export async function getAssetProjectId(
  db: Db,
  ownerUserId: string,
  assetId: string,
): Promise<string | null> {
  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  return asset?.projectId ?? null;
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
  /// Versjonsraden som ble reservert. Klienten sender den tilbake ved
  /// complete, slik at riktig rad markeres ferdig selv om en parallell
  /// opplasting av samme kind rakk å reservere et høyere nummer.
  versionId: string;
  versionNumber: number;
}

export async function startMultipartUpload(
  db: Db,
  pool: Pool,
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
  const client = getClient(cfg, 'capture-write');
  // Masterne (full/raw) og previews havner i hver sin bøtte: previews kan
  // gjenskapes og tåler aggressiv opprydding, masterne kan ikke.
  const storageClass = storageClassForKind(kind);
  const bucket = writeBucket(cfg, storageClass);
  const keyPrefix =
    cfg.backend === 'b2' ? `${cfg.prefix}${keyMarkerFor(storageClass)}` : cfg.prefix;
  if (!client || !bucket) return { ok: false, error: 'not_configured' };

  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };

  // Reserver versjonsnummeret FØR opplastingen starter. Nummeret må inn
  // i nøkkelen, og reservasjonen er det som hindrer at to samtidige
  // opplastinger av samme kind ender på samme objekt — som er nøyaktig
  // overskrivingen versjonering skal fjerne.
  const version = await reserveVersion(pool, {
    assetId,
    kind,
    bucket,
    backend: cfg.backend,
    contentType: mime,
    uploadedBy: ownerUserId,
    buildKey: (versionNumber) =>
      buildObjectKey({
        prefix: keyPrefix,
        ownerUserId,
        sessionId: asset.sessionId,
        assetId,
        kind,
        versionSegment: versionSegment(versionNumber),
        filename: asset.originalFilename,
      }),
  });
  const key = version.objectKey;

  const partSize = computePartSize(sizeBytes, preferredPartSize);
  const partCount = Math.ceil(sizeBytes / partSize);
  let created;
  try {
    created = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: mime,
        Metadata: {
          ownerUserId,
          sessionId: asset.sessionId,
          assetId,
          kind,
          versionNumber: String(version.versionNumber),
        },
      }),
    );
  } catch (err) {
    // Reservasjonen ville ellers blitt stående og brent et versjonsnummer
    // på en opplasting som aldri kom i gang.
    await discardVersion(pool, version.id).catch(() => undefined);
    throw err;
  }
  if (!created.UploadId) {
    await discardVersion(pool, version.id).catch(() => undefined);
    throw new Error('multipart start returned no uploadId');
  }
  return {
    ok: true,
    result: {
      bucket,
      key,
      uploadId: created.UploadId,
      partSize,
      partCount,
      signedUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
      partUrlBatchMax: PART_URL_BATCH_MAX,
      versionId: version.id,
      versionNumber: version.versionNumber,
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
  const client = getClient(cfg, 'capture-write');
  const bucket = readBucket(cfg, key);
  if (!client || !bucket) return { ok: false, error: 'not_configured' };
  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };
  if (!keyBelongsToAsset(cfg, key, ownerUserId, asset.sessionId, assetId)) {
    return { ok: false, error: 'not_found' };
  }
  const parts: SignedPart[] = await Promise.all(
    partNumbers.slice(0, PART_URL_BATCH_MAX).map(async (partNumber) => ({
      partNumber,
      url: await getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket: bucket,
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
  /// Hvilket lager objektet faktisk havnet i. Trengs for at
  /// lagringsregnskapet skal kunne bokføre bytene på riktig backend.
  backend: CaptureStoreBackend;
  sizeBytes: number;
  etag: string | null;
  /// Originalfilnavnet fra kameraet. Brukes som objektnavn ved B2-speiling,
  /// slik at fotografen kjenner igjen filene i sin egen bøtte — nøkkelen vår
  /// er en UUID-sti og sier dem ingenting.
  originalFilename: string;
  /// Innholdstypen fra asset-raden. Ligger ikke i complete-bodyen, og B2
  /// trenger den for å lagre objektet med riktig Content-Type.
  mime: string;
  /// Produksjonen bytene skal bokføres på. Null når sesjonen ikke er
  /// knyttet til et prosjekt — da eier brukeren dem alene.
  projectId: string | null;
  /// Versjonen som ble gjort gjeldende. Null når klienten ikke sendte
  /// noen versjonsid — en eldre iPad, eller en opplasting startet før
  /// versjonering fantes.
  versionId: string | null;
  versionNumber: number | null;
}

export async function completeMultipartUpload(
  db: Db,
  pool: Pool,
  ownerUserId: string,
  assetId: string,
  kind: UploadKind,
  uploadId: string,
  key: string,
  parts: Array<{ partNumber: number; etag: string }>,
  checksumSha256: string,
  sizeBytes: number,
  versionId?: string | null,
): Promise<Result<CompletedUpload>> {
  if (parts.length === 0 || checksumSha256.length !== 64 || sizeBytes <= 0) {
    return { ok: false, error: 'invalid' };
  }
  const cfg = captureStoreForKey(key);
  const client = getClient(cfg, 'capture-write');
  const bucket = readBucket(cfg, key);
  if (!client || !bucket) return { ok: false, error: 'not_configured' };

  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };
  if (!keyBelongsToAsset(cfg, key, ownerUserId, asset.sessionId, assetId)) {
    return { ok: false, error: 'not_found' };
  }

  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sorted.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }),
  );
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const verifiedSize = Number(head.ContentLength ?? sizeBytes);

  // Gjør versjonen gjeldende. promoteVersion avløser de foregående OG
  // setter capture_assets.{kind}_key i samme transaksjon, slik at de
  // rundt 40 lesestiene som signerer fra en bar nøkkel aldri ser en
  // asset-rad som peker på en fil vi ikke vet er ferdig opplastet.
  //
  // versionId kommer fra klienten. Finner vi ikke raden — en eldre
  // klient, eller en opplasting startet før versjonering fantes — faller
  // vi tilbake til å skrive nøkkelen direkte. Uten det ville en iPad som
  // ikke er oppdatert slutte å kunne fullføre opplastinger.
  const promoted = versionId
    ? await promoteVersion(pool, {
        versionId,
        sizeBytes: verifiedSize,
        checksumSha256,
        // Nøkkelen klienten faktisk lastet opp til må være den vi
        // reserverte. Ellers ville bytene havnet ett sted og asset-raden
        // pekt et annet.
        expectedObjectKey: key,
      })
    : null;

  const patch: Partial<InsertCaptureAsset> = {
    checksumSha256,
    sizeBytes: verifiedSize,
    updatedAt: new Date(),
    ...(promoted
      ? {}
      : {
          ...(kind === 'preview' ? { previewKey: key } : {}),
          ...(kind === 'full' ? { fullKey: key } : {}),
          ...(kind === 'raw' ? { rawKey: key } : {}),
        }),
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
      bucket,
      key,
      backend: cfg.backend,
      sizeBytes: verifiedSize,
      etag: head.ETag ?? null,
      originalFilename: asset.originalFilename,
      mime: asset.mime,
      projectId: asset.projectId,
      versionId: promoted?.id ?? null,
      versionNumber: promoted?.versionNumber ?? null,
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
  const client = getClient(cfg, 'capture-write');
  // Nøkkelen kommer fra kalleren, så klassen leses av den — ikke gjettes.
  const bucket = readBucket(cfg, params.key);
  if (!cfg.enabled || !bucket || !client) {
    return null;
  }
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
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
  const client = getClient(cfg, 'capture-read');
  const bucket = readBucket(cfg, key);
  if (!client || !bucket) return null;
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: ttlSeconds },
  );
}

export async function abortMultipartUpload(
  db: Db,
  pool: Pool,
  ownerUserId: string,
  assetId: string,
  uploadId: string,
  key: string,
): Promise<{ ok: true } | { ok: false; error: UploadError }> {
  const cfg = captureStoreForKey(key);
  // Avbrudd rydder en ufullstendig multipart, ikke et ferdig objekt.
  // Skrive-rollen holder — sletterollen er reservert for det som er
  // uopprettelig.
  const client = getClient(cfg, 'capture-write');
  const bucket = readBucket(cfg, key);
  if (!client || !bucket) return { ok: false, error: 'not_configured' };
  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };
  if (!keyBelongsToAsset(cfg, key, ownerUserId, asset.sessionId, assetId)) {
    return { ok: false, error: 'not_found' };
  }
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    }),
  );

  // Frigi versjonsnummeret. Uten dette ville hver avbrutte opplasting
  // brent et nummer, og versjonshistorikken fått hull som ser ut som
  // filer noen har slettet.
  const reserved = await versionForKey(pool, key);
  if (reserved && reserved.status === 'uploading') {
    await discardVersion(pool, reserved.id).catch(() => undefined);
  }

  return { ok: true };
}
