// Upload storage router — bestemmer hvor en assemblet upload skal lagres
// permanent: Cloudflare Stream (for video), et S3-kompatibelt objektlager
// (B2 primært, R2 som fallback), eller filesystem som siste utvei.
//
// Brukes av chunked-upload-routes.ts etter at chunks er assemblet, men
// kan også brukes av andre upload-paths som vil ha samme routing-logikk.
//
// B2 er primærlageret. R2 beholdes som fallback fordi filene som allerede
// ligger der fortsatt må kunne leses: hvilken backend en fil ligger på
// lagres PER FIL (`storageBackend` i metadata), så eksisterende R2-objekter
// leses videre via R2-klienten uten at noe må migreres.
//
// Env-kjede for B2:
//   GENERIC_UPLOADS_B2_BUCKET → B2_ROLE_ROOM_BUCKET_NAME → B2_BUCKET_NAME
// Env-kjede for R2 følger samme mønster som cms-media-service.ts:
//   GENERIC_UPLOADS_R2_BUCKET → CLOUDFLARE_R2_BUCKET → R2_BUCKET
//
// Rekkefølgen kan snus med UPLOAD_STORAGE_PRIMARY=r2 hvis B2 må kobles ut
// uten redeploy av kode.
//
// Stream-konfig leses fra cloudflare-stream-service.ts (samme env vars).

import * as fs from "fs/promises";
import * as fsSync from "fs";
import { PutObjectCommand, S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  buildStreamConfig,
  uploadToStream,
} from "./cloudflare-stream-service.js";
import { resolveB2Key, type B2KeyRole } from "./b2-key-registry.js";
import { bucketForClass, bucketForKey, keyMarkerFor } from "./b2-bucket-registry.js";

/** S3-kompatible objektlagre. Samme kode-path, ulik klient og bucket. */
export const OBJECT_STORE_BACKENDS = ["b2", "r2"] as const;
export type ObjectStoreBackend = (typeof OBJECT_STORE_BACKENDS)[number];

export type UploadStorageBackend =
  | "cloudflare_stream"
  | ObjectStoreBackend
  | "filesystem";

/** Ligger fila i et objektlager vi kan hente den fra med en S3-klient? */
export function isObjectStoreBackend(
  backend: string | null | undefined,
): backend is ObjectStoreBackend {
  return (
    backend === "b2" || backend === "r2"
  );
}

export interface UploadStorageResult {
  backend: UploadStorageBackend;
  // Felles
  fileId: string; // intern referanse vi lagrer
  fileName: string;
  size: number;
  mimeType: string | null;
  // Stream-spesifikt
  streamUid?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  ready?: boolean;
  duration?: number;
  // Objektlager (B2 eller R2) — bruk disse i ny kode.
  objectKey?: string;
  objectBucket?: string;
  // Samme verdier under de gamle navnene. Feltnavnet sier R2, men verdien
  // er nøkkelen i det objektlageret fila faktisk havnet i — beholdt fordi
  // lesepathene og lagret metadata fortsatt bruker disse navnene.
  r2Key?: string;
  r2Bucket?: string;
  // Filesystem fallback
  filesystemPath?: string;
  // Public/signed URL klienter kan bruke direkte (ikke alltid satt)
  downloadUrl?: string;
  // Envelope-encryption-metadata (kun satt hvis encryptAtRest=true)
  encryptedAtRest?: boolean;
  encryptionAlgorithm?: "aes-256-gcm";
  encryptedDek?: string; // base64 — DEK kryptert med per-bruker-KEK
  // Ciphertext-størrelse er forskjellig fra plaintext-størrelse pga
  // iv (12B) + auth-tag (16B) prepended/appended. Lagre begge.
  ciphertextSize?: number;
}

interface ObjectStoreConfig {
  backend: ObjectStoreBackend;
  enabled: boolean;
  endpoint?: string;
  region: string;
  /** B2 krever path-style; R2 bruker virtual-host. */
  forcePathStyle: boolean;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  prefix: string;
  publicUrlBase?: string;
}

const firstNonEmpty = (
  ...values: (string | undefined)[]
): string | undefined => {
  for (const v of values) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
};

// the-role-room-prod ligger i eu-central-003 (samme default som
// b2-archive-helper.ts — feil default her ville gitt stille skrivefeil).
const B2_DEFAULT_REGION = "eu-central-003";

const buildGenericUploadsB2Config = (): ObjectStoreConfig => {
  const region =
    firstNonEmpty(process.env.GENERIC_UPLOADS_B2_REGION, process.env.B2_REGION) ??
    B2_DEFAULT_REGION;
  const endpoint =
    firstNonEmpty(
      process.env.GENERIC_UPLOADS_B2_ENDPOINT,
      process.env.B2_ENDPOINT,
    ) ?? `https://s3.${region}.backblazeb2.com`;
  const bucket = firstNonEmpty(
    process.env.GENERIC_UPLOADS_B2_BUCKET,
    process.env.B2_ROLE_ROOM_BUCKET_NAME,
    process.env.B2_BUCKET_NAME,
  );
  const accessKeyId = firstNonEmpty(
    process.env.GENERIC_UPLOADS_B2_APPLICATION_KEY_ID,
    process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID,
    process.env.B2_APPLICATION_KEY_ID,
  );
  const secretAccessKey = firstNonEmpty(
    process.env.GENERIC_UPLOADS_B2_APPLICATION_KEY,
    process.env.B2_ROLE_ROOM_APPLICATION_KEY,
    process.env.B2_APPLICATION_KEY,
  );
  return {
    backend: "b2",
    enabled: Boolean(endpoint && bucket && accessKeyId && secretAccessKey),
    endpoint,
    region,
    forcePathStyle: true,
    bucket,
    accessKeyId,
    secretAccessKey,
    prefix: process.env.GENERIC_UPLOADS_B2_PREFIX ?? "uploads/",
    publicUrlBase: process.env.GENERIC_UPLOADS_B2_PUBLIC_URL_BASE,
  };
};

const buildGenericUploadsR2Config = (): ObjectStoreConfig => {
  const endpoint = firstNonEmpty(
    process.env.GENERIC_UPLOADS_R2_ENDPOINT,
    process.env.CLOUDFLARE_R2_ENDPOINT,
    process.env.R2_ENDPOINT,
  );
  const bucket = firstNonEmpty(
    process.env.GENERIC_UPLOADS_R2_BUCKET,
    process.env.CLOUDFLARE_R2_BUCKET,
    process.env.R2_BUCKET,
  );
  const accessKeyId = firstNonEmpty(
    process.env.GENERIC_UPLOADS_R2_ACCESS_KEY_ID,
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    process.env.R2_ACCESS_KEY_ID,
  );
  const secretAccessKey = firstNonEmpty(
    process.env.GENERIC_UPLOADS_R2_SECRET_ACCESS_KEY,
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    process.env.R2_SECRET_ACCESS_KEY,
  );
  return {
    backend: "r2",
    enabled: Boolean(endpoint && bucket && accessKeyId && secretAccessKey),
    endpoint,
    region: "auto",
    forcePathStyle: false,
    bucket,
    accessKeyId,
    secretAccessKey,
    prefix: process.env.GENERIC_UPLOADS_R2_PREFIX ?? "uploads/",
    publicUrlBase: process.env.GENERIC_UPLOADS_R2_PUBLIC_URL_BASE,
  };
};

const buildObjectStoreConfig = (backend: ObjectStoreBackend): ObjectStoreConfig =>
  backend === "b2" ? buildGenericUploadsB2Config() : buildGenericUploadsR2Config();

/**
 * Rekkefølgen vi forsøker å skrive i. B2 er primær; R2 er der som fallback
 * slik at en feilende eller ukonfigurert B2 ikke stopper opplastinger.
 * UPLOAD_STORAGE_PRIMARY=r2 snur rekkefølgen uten kodeendring.
 */
export function objectStoreWriteOrder(): ObjectStoreConfig[] {
  const primary: ObjectStoreBackend =
    process.env.UPLOAD_STORAGE_PRIMARY === "r2" ? "r2" : "b2";
  const secondary: ObjectStoreBackend = primary === "b2" ? "r2" : "b2";
  return [buildObjectStoreConfig(primary), buildObjectStoreConfig(secondary)].filter(
    (cfg) => cfg.enabled,
  );
}

const clientCache = new Map<string, S3Client>();

/**
 * Legitimasjonen for en operasjon.
 *
 * B2 har egne nokler per rolle - skrivenokkelen kan ikke slette, og
 * lesenokkelen kan ikke skrive. R2 har ikke fatt samme oppdeling, sa der
 * brukes konfigens nokkel uansett rolle; a late som noe annet ville vaert
 * en falsk trygghet.
 */
const credentialsFor = (
  cfg: ObjectStoreConfig,
  role: B2KeyRole,
): { accessKeyId: string; secretAccessKey: string } | null => {
  if (cfg.backend === "b2") {
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
};

const getObjectStoreClient = (
  cfg: ObjectStoreConfig,
  role: B2KeyRole,
): S3Client | null => {
  if (!cfg.enabled || !cfg.endpoint) return null;
  const creds = credentialsFor(cfg, role);
  if (!creds) return null;
  // Nokkel-id-en er med i cache-nokkelen, slik at to roller med ulik
  // nokkel aldri deler klient.
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
};

/**
 * Klient + bucket for backend'en en GITT FIL ligger på — les alltid fra
 * `metadata.storageBackend`, aldri fra dagens primærvalg. Ellers ville en
 * fil som ble skrevet til R2 i går bli lett etter i B2 i dag.
 */
export function getObjectStoreClientFor(
  backend: string | null | undefined,
  objectKey?: string | null,
): { client: S3Client; bucket: string } | null {
  if (!isObjectStoreBackend(backend)) return null;
  const cfg = buildObjectStoreConfig(backend);
  const client = getObjectStoreClient(cfg, "uploads-read");
  if (!client) return null;
  // Klasseleddet i nøkkelen avgjør bøtta. Nøkler skrevet før splitten
  // mangler leddet og havner i fellesbøtta — derfor må ingenting kopieres.
  const bucket =
    cfg.backend === "b2" && objectKey
      ? bucketForKey(stripPrefix(cfg, objectKey))?.bucket ?? cfg.bucket
      : cfg.bucket;
  if (!bucket) return null;
  return { client, bucket };
}

const stripPrefix = (cfg: ObjectStoreConfig, key: string): string =>
  key.startsWith(cfg.prefix) ? key.slice(cfg.prefix.length) : key;

// Signed-URL TTL: kort (1 time) som default. En lekket lenke har dermed
// et mindre risikovindu enn med 7-dagers TTL.
//
// Klient-flyt forventes å hente fersk URL via /api/chunked-upload/files/:fileId
// hver gang den trenger fila — det endepunktet redirecter (302) til en ny
// signed URL slik at klient-koden ikke trenger å bekymre seg om utløp.
//
// Overstyr via env STORAGE_SIGNED_URL_TTL_SECONDS hvis bruksmønsteret
// krever lengre lenker (f.eks. e-post-baserte klient-galleri-deler som
// skal kunne åpnes flere ganger).
const R2_SIGNED_TTL_DEFAULT_SECONDS = 60 * 60; // 1 time
const R2_SIGNED_TTL_SECONDS = (() => {
  const env = process.env.STORAGE_SIGNED_URL_TTL_SECONDS;
  if (env) {
    const parsed = parseInt(env, 10);
    if (Number.isFinite(parsed) && parsed >= 60 && parsed <= 7 * 24 * 60 * 60) {
      return parsed;
    }
  }
  return R2_SIGNED_TTL_DEFAULT_SECONDS;
})();

export interface AssembledUploadInput {
  fileId: string;
  fileName: string;
  mimeType?: string | null;
  size: number;
  // Filsti på serveren — vi streamer fra denne for R2 og Stream
  sourcePath: string;
  // Metadata vi bruker til tagging (Stream meta, R2 object metadata)
  metadata?: Record<string, unknown>;
  userId: string;
  // Hvis true: krypter med envelope-encryption før upload. Krever
  // STORAGE_MASTER_KEK_HEX env. Stream tillates ikke (Cloudflare må
  // kunne lese for transcoding); video med encryptAtRest blir tvunget
  // til R2 eller filesystem. Standard: false (bakoverkompatibel).
  encryptAtRest?: boolean;
}

export interface RouteToStorageOpts {
  // Hvis true forsøker vi aldri Stream, bare R2/filesystem
  preferFilesystem?: boolean;
}

/**
 * Bestem og utfør lagring av en assemblet upload.
 *
 * Routing-policy:
 *   - video/* → Cloudflare Stream hvis CLOUDFLARE_STREAM_API_TOKEN er satt.
 *   - alt annet → R2 hvis GENERIC_UPLOADS_R2_BUCKET (eller fallback) er satt.
 *   - Hvis ingen av delene: behold på filesystem og returner intern URL.
 *
 * Returnerer alltid en `UploadStorageResult` slik at kalleren har
 * nok info til å lagre i DB og kunne reflektere riktig URL/uid.
 */
export async function routeAssembledUpload(
  input: AssembledUploadInput,
  opts: RouteToStorageOpts = {},
): Promise<UploadStorageResult> {
  const mime = input.mimeType || null;
  const isVideo = !!mime && mime.startsWith("video/");
  const streamCfg = buildStreamConfig();
  const wantsEncryption = input.encryptAtRest === true;

  // Hvis encryptAtRest=true: forhåndskrypter til en temp-fil og bruk
  // den som kilde for R2/filesystem. Stream tillates IKKE — Cloudflare
  // må kunne lese råfila for transcoding.
  let activeSourcePath = input.sourcePath;
  let activeSize = input.size;
  let encryptionMeta: {
    encryptedDek: string;
    ciphertextSize: number;
  } | null = null;
  let encryptTempPath: string | null = null;

  if (wantsEncryption) {
    const {
      isEncryptionAvailable,
      generateDek,
      deriveUserKek,
      encryptDek,
      EncryptStream,
      ciphertextSizeFor,
    } = await import("./file-encryption.js");
    if (!isEncryptionAvailable()) {
      throw new Error("encryption_not_configured: STORAGE_MASTER_KEK_HEX mangler");
    }

    const dek = generateDek();
    const userKek = deriveUserKek(input.userId);
    const encryptedDek = encryptDek(dek, userKek);

    // Stream-kryptering til temp-fil. Vi skriver til en sti ved siden av
    // kildefila slik at vi rydder begge ved feil.
    encryptTempPath = `${input.sourcePath}.enc.tmp`;
    await new Promise<void>((resolve, reject) => {
      const readStream = fsSync.createReadStream(input.sourcePath);
      const writeStream = fsSync.createWriteStream(encryptTempPath!);
      const cipher = new EncryptStream(dek);
      readStream.on("error", reject);
      writeStream.on("error", reject);
      cipher.on("error", reject);
      writeStream.on("close", () => resolve());
      readStream.pipe(cipher).pipe(writeStream);
    });

    activeSourcePath = encryptTempPath;
    activeSize = ciphertextSizeFor(input.size);
    encryptionMeta = {
      encryptedDek,
      ciphertextSize: activeSize,
    };
  }

  // 1) Video → Stream (kun hvis IKKE encrypt-at-rest)
  if (!opts.preferFilesystem && !wantsEncryption && isVideo && streamCfg.enabled) {
    try {
      const bytes = await fs.readFile(input.sourcePath);
      const streamRes = await uploadToStream(bytes, mime!, {
        projectId:
          (input.metadata?.projectId as string | undefined) || input.userId,
        postId: input.fileId,
        filename: input.fileName,
      });
      // Rydd kildefil — den ligger nå hos Cloudflare
      await fs.rm(input.sourcePath, { force: true }).catch(() => undefined);
      return {
        backend: "cloudflare_stream",
        fileId: input.fileId,
        fileName: input.fileName,
        size: input.size,
        mimeType: mime,
        streamUid: streamRes.uid,
        playbackUrl: streamRes.playbackUrl,
        thumbnailUrl: streamRes.thumbnailUrl,
        ready: streamRes.ready,
        duration: streamRes.duration,
        downloadUrl: streamRes.playbackUrl,
      };
    } catch (err) {
      console.warn(
        "[storage-router] Stream upload feilet, faller tilbake til R2:",
        err,
      );
      // Fortsetter til R2-pathen
    }
  }

  // 2) Objektlager — B2 først, deretter R2. Feiler den ene går vi videre
  //    til den neste før vi gir opp og lar fila bli liggende på disk.
  const stores = opts.preferFilesystem ? [] : objectStoreWriteOrder();
  for (const cfg of stores) {
    const client = getObjectStoreClient(cfg, "uploads-write");
    // Generiske opplastinger har sin egen bøtte-klasse: de hører ikke til
    // en produksjon, og skal ikke ryddes av produksjonens livssyklus.
    const bucket =
      cfg.backend === "b2"
        ? bucketForClass("uploads")?.bucket ?? cfg.bucket
        : cfg.bucket;
    const keyPrefix =
      cfg.backend === "b2"
        ? `${cfg.prefix}${keyMarkerFor("uploads")}`
        : cfg.prefix;
    if (!client || !bucket) continue;
    try {
      const safeName = input.fileName
        .replace(/[\\/:*?"<>|\x00-\x1F]/g, "_")
        .slice(0, 200);
      const key = `${keyPrefix}${input.userId}/${input.fileId}/${safeName}`;
      const stream = fsSync.createReadStream(activeSourcePath);

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: stream,
          // Hvis kryptert: ciphertext er opaque blob, ikke originalt MIME
          ContentType: wantsEncryption
            ? "application/octet-stream"
            : mime ?? "application/octet-stream",
          ContentLength: activeSize,
          Metadata: {
            "user-id": input.userId,
            "file-id": input.fileId,
            "original-name": safeName,
            ...(wantsEncryption ? { "encrypted-at-rest": "aes-256-gcm" } : {}),
          },
        }),
      );

      // Bygg URL: public hvis konfigurert, ellers signed.
      // VIKTIG: encrypted-at-rest filer kan IKKE 302-redirectes til
      // objektlageret — klient ville fått ciphertext den ikke kan
      // dekryptere. Vi setter downloadUrl til vårt eget proxy-endepunkt
      // så fil-serving piper gjennom decrypt.
      let url: string;
      if (wantsEncryption) {
        url = `/api/chunked-upload/files/${input.fileId}`;
      } else if (cfg.publicUrlBase) {
        url = `${cfg.publicUrlBase.replace(/\/$/, "")}/${key}`;
      } else {
        url = await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: bucket, Key: key }),
          { expiresIn: R2_SIGNED_TTL_SECONDS },
        );
      }

      // Rydd kildefiler — både original og ev. encrypt-temp
      await fs.rm(input.sourcePath, { force: true }).catch(() => undefined);
      if (encryptTempPath) {
        await fs.rm(encryptTempPath, { force: true }).catch(() => undefined);
      }

      return {
        backend: cfg.backend,
        fileId: input.fileId,
        fileName: input.fileName,
        size: input.size,
        mimeType: mime,
        objectKey: key,
        objectBucket: bucket,
        r2Key: key,
        r2Bucket: bucket,
        downloadUrl: url,
        ...(encryptionMeta && {
          encryptedAtRest: true,
          encryptionAlgorithm: "aes-256-gcm" as const,
          encryptedDek: encryptionMeta.encryptedDek,
          ciphertextSize: encryptionMeta.ciphertextSize,
        }),
      };
    } catch (err) {
      console.warn(
        `[storage-router] ${cfg.backend}-upload feilet, prøver neste backend:`,
        err,
      );
      // Fortsetter til neste objektlager, ev. filesystem-fallback
    }
  }

  // 3) Filesystem fallback — behold der den ligger.
  // Hvis kryptert: vi behold ciphertext-fila (encryptTempPath) som primær,
  // sletter originalen.
  if (wantsEncryption && encryptTempPath) {
    // Flytt encryptTempPath til input.sourcePath og slett originalen
    await fs.rm(input.sourcePath, { force: true }).catch(() => undefined);
    await fs.rename(encryptTempPath, input.sourcePath).catch(() => undefined);
  }

  return {
    backend: "filesystem",
    fileId: input.fileId,
    fileName: input.fileName,
    size: input.size,
    mimeType: mime,
    filesystemPath: input.sourcePath,
    downloadUrl: `/api/chunked-upload/files/${input.fileId}`,
    ...(encryptionMeta && {
      encryptedAtRest: true,
      encryptionAlgorithm: "aes-256-gcm" as const,
      encryptedDek: encryptionMeta.encryptedDek,
      ciphertextSize: encryptionMeta.ciphertextSize,
    }),
  };
}

/** Diagnose: hva er koblet til akkurat nå? */
export function getStorageStatus(): {
  cloudflareStream: { enabled: boolean; customerSubdomain: string | null };
  b2: { enabled: boolean; bucket: string | null };
  r2: { enabled: boolean; bucket: string | null };
  /** Objektlageret nye opplastinger faktisk havner i, eller null. */
  primaryObjectStore: ObjectStoreBackend | null;
  filesystem: { dir: string };
} {
  const streamCfg = buildStreamConfig();
  const b2Cfg = buildGenericUploadsB2Config();
  const r2Cfg = buildGenericUploadsR2Config();
  return {
    cloudflareStream: {
      enabled: streamCfg.enabled,
      customerSubdomain: streamCfg.customerSubdomain ?? null,
    },
    b2: {
      enabled: b2Cfg.enabled,
      bucket: b2Cfg.bucket ?? null,
    },
    r2: {
      enabled: r2Cfg.enabled,
      bucket: r2Cfg.bucket ?? null,
    },
    primaryObjectStore: objectStoreWriteOrder()[0]?.backend ?? null,
    filesystem: {
      dir:
        process.env.CHUNKED_UPLOAD_DIR ||
        require("os").tmpdir() + "/creatorhub-chunked-uploads",
    },
  };
}
