#!/usr/bin/env node

import crypto from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const args = new Set(process.argv.slice(2));
const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
const sourceType = sourceArg?.split("=")[1] === "r2" ? "r2" : "b2";
const execute = args.has("--execute");
const verifyOnly = args.has("--verify-only");
const verifyContent = args.has("--verify-content") || execute;
const skipExistingContent = args.has("--skip-existing-content");
const migrateAll = args.has("--all");
const concurrencyArg = process.argv.find((arg) => arg.startsWith("--concurrency="));
const concurrency = Math.min(8, Math.max(1, Number(concurrencyArg?.split("=")[1] || 3)));
const objectBaseTimeoutMs = Math.max(
  60_000,
  Number(process.env.ROLE_ROOM_MIGRATION_OBJECT_TIMEOUT_MS?.trim() || 60_000),
);
const prefixes = process.argv
  .filter((arg) => arg.startsWith("--prefix="))
  .map((arg) => arg.slice("--prefix=".length));

if (!migrateAll && prefixes.length === 0) {
  console.error("Avbrutt: bruk --all eller minst ett --prefix=<prefix>.");
  process.exit(2);
}
if (verifyOnly && execute) {
  console.error("Avbrutt: --verify-only og --execute kan ikke kombineres.");
  process.exit(2);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Mangler miljøvariabel: ${name}`);
  return value;
}

const sourceRegion = sourceType === "r2" ? "auto" : process.env.B2_REGION?.trim() || "eu-central-003";
const sourceBucket = sourceType === "r2"
  ? required("R2_SOURCE_BUCKET_NAME")
  : required("B2_ROLE_ROOM_BUCKET_NAME");
const source = sourceType === "r2"
  ? new S3Client({
      region: "auto",
      endpoint: required("CLOUDFLARE_R2_ENDPOINT"),
      credentials: {
        accessKeyId: required("CLOUDFLARE_R2_ACCESS_KEY_ID"),
        secretAccessKey: required("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
      },
    })
  : new S3Client({
      region: sourceRegion,
      endpoint: `https://s3.${sourceRegion}.backblazeb2.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: required("B2_ROLE_ROOM_APPLICATION_KEY_ID"),
        secretAccessKey: required("B2_ROLE_ROOM_APPLICATION_KEY"),
      },
    });

const targetRegion = process.env.AWS_ROLE_ROOM_REGION?.trim() || "eu-north-1";
const targetBucket = required("AWS_ROLE_ROOM_BUCKET_NAME");
const targetSessionToken = process.env.AWS_ROLE_ROOM_SESSION_TOKEN?.trim();
const target = new S3Client({
  region: targetRegion,
  // B2's response stream may emit sub-8 KiB chunks. The S3 checksum
  // middleware requires buffered chunks for a retry-safe aws-chunked upload.
  requestStreamBufferSize: 64 * 1024,
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: required("AWS_ROLE_ROOM_ACCESS_KEY_ID"),
    secretAccessKey: required("AWS_ROLE_ROOM_SECRET_ACCESS_KEY"),
    ...(targetSessionToken ? { sessionToken: targetSessionToken } : {}),
  },
});

async function listObjects(client, bucket, prefix) {
  const objects = [];
  let continuationToken;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      ContinuationToken: continuationToken,
    }));
    for (const object of page.Contents || []) {
      if (object.Key && typeof object.Size === "number") {
        objects.push({ key: object.Key, size: object.Size });
      }
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

async function inventory(client, bucket) {
  const selected = migrateAll ? await listObjects(client, bucket, "") : [];
  if (!migrateAll) {
    for (const prefix of prefixes) selected.push(...await listObjects(client, bucket, prefix));
  }
  return [...new Map(selected.map((object) => [object.key, object])).values()]
    .sort((a, b) => a.key.localeCompare(b.key));
}

function anonymousKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 12);
}

function opaqueUuid(value) {
  const hex = crypto.createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const compact = hex.join("");
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

function safeExtension(value, fallback = "bin") {
  return value.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] || fallback;
}

function canonicalKey(key) {
  const normalized = key.trim().replace(/^\/+/, "");
  const legacyUserFile = normalized.match(/^users\/([^/]+)\/([0-9a-f-]{36})-[^/]+\.([a-z0-9]{1,8})$/i);
  if (legacyUserFile) {
    return `users/${legacyUserFile[1]}/files/${legacyUserFile[2]}/original.${legacyUserFile[3].toLowerCase()}`;
  }
  if (/^(platform|organizations|agencies|users|talents|projects|workspaces|education|temporary|quarantine|exports|_system)\//.test(normalized)) {
    return normalized;
  }
  // B2 model files overlap names used by the authoritative R2 model bucket.
  // Preserve the B2 variants under a source-specific legacy branch so a
  // same-sized but different artifact can never overwrite the R2 copy.
  if (normalized.startsWith("models/")) return `platform/models/legacy-b2/${normalized.slice(7)}`;
  if (normalized.startsWith("downloads/post-agent/")) {
    return `platform/releases/post-agent/${normalized.slice("downloads/post-agent/".length)}`;
  }
  if (normalized.startsWith("downloads/")) return `platform/releases/${normalized.slice(10)}`;
  if (normalized.startsWith("photo-enhancer-staging/")) {
    return `platform/staging/photo-enhancer/${opaqueUuid(normalized)}/source.${safeExtension(normalized)}`;
  }
  const workspace = normalized.match(/^workspace\/([^/]+)\/storyboards\/([^/]+)\/animation-sources\/([^/]+)$/);
  if (workspace) {
    return `workspaces/${opaqueUuid(`workspace:${workspace[1]}`)}/storyboards/${workspace[2]}/animation-sources/${opaqueUuid(`asset:${normalized}`)}/source.${safeExtension(workspace[3])}`;
  }
  const topLevel = normalized.split("/", 1)[0].replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "unknown";
  return `platform/archives/${topLevel}/${opaqueUuid(`legacy:${normalized}`)}/original.${safeExtension(normalized)}`;
}

function canonicalR2Key(bucket, key) {
  const normalized = key.trim().replace(/^\/+/, "");
  if (!normalized) return `platform/imports/${bucket}/${opaqueUuid(`${bucket}:empty`)}/marker`;
  if (bucket === "ml-models") {
    if (normalized.startsWith("models/")) return `platform/models/${normalized.slice(7)}`;
    if (normalized.startsWith("Sam-3D/")) return `platform/models/sam-3d/${normalized.slice(7)}`;
    if (normalized.startsWith("datasets/")) return `platform/datasets/${normalized.slice(9)}`;
    if (normalized.startsWith("assets/")) return `platform/assets/${normalized.slice(7)}`;
    if (normalized.startsWith("generated-assets/")) return `platform/assets/generated/${normalized.slice(17)}`;
    if (normalized.startsWith("logos/")) return `platform/assets/logos/${normalized.slice(6)}`;
    if (normalized.startsWith("props/")) return `platform/assets/props/${normalized.slice(6)}`;
    if (normalized.startsWith("photo-enhancer/")) return `platform/staging/photo-enhancer/${opaqueUuid(normalized)}/source.${safeExtension(normalized)}`;
    return `platform/models/legacy/${normalized}`;
  }
  if (bucket === "ml-models2") return `platform/models/${normalized}`;
  if (bucket === "casting-videos") {
    const personal = normalized.match(/^(uploads|protools-bounces)\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (personal) {
      const service = personal[1] === "protools-bounces" ? "protools/bounces" : "casting/uploads";
      return `users/${personal[2]}/services/${service}/${personal[3]}/original.${safeExtension(personal[4])}`;
    }
    if (normalized.startsWith("photo-enhancer/")) return `platform/staging/photo-enhancer/${opaqueUuid(normalized)}/source.${safeExtension(normalized)}`;
    return `platform/services/casting/${normalized}`;
  }
  if (bucket === "theroleroom" || bucket === "role-room-storyboards") {
    if (normalized.endsWith("/")) return `platform/assets/storyboards/_system/${opaqueUuid(`${bucket}:${normalized}`)}/marker`;
    return `platform/assets/storyboards/${normalized.replace(/^storyboard_?assets\//, "")}`;
  }
  return `platform/imports/${bucket}/${opaqueUuid(`${bucket}:${normalized}`)}/original.${safeExtension(normalized)}`;
}

async function hashBody(body, signal) {
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  const abort = () => body.destroy?.(signal.reason || new Error("Objektoperasjonen fikk tidsavbrudd"));
  signal?.addEventListener("abort", abort, { once: true });
  try {
    for await (const chunk of body) {
      signal?.throwIfAborted();
      hash.update(chunk);
      bytes += chunk.byteLength;
    }
  } finally {
    signal?.removeEventListener("abort", abort);
  }
  return { hash: hash.digest("hex"), bytes };
}

async function targetHead(key, signal) {
  try {
    return await target.send(
      new HeadObjectCommand({ Bucket: targetBucket, Key: key }),
      { abortSignal: signal },
    );
  } catch (error) {
    if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

async function compareContent(sourceKey, targetKey, expectedSize, signal) {
  const [sourceObject, targetObject] = await Promise.all([
    source.send(
      new GetObjectCommand({ Bucket: sourceBucket, Key: sourceKey }),
      { abortSignal: signal },
    ),
    target.send(
      new GetObjectCommand({ Bucket: targetBucket, Key: targetKey }),
      { abortSignal: signal },
    ),
  ]);
  if (!sourceObject.Body || !targetObject.Body) throw new Error("Objektet mangler body");
  if (sourceObject.ContentLength !== expectedSize || targetObject.ContentLength !== expectedSize) {
    throw new Error("Uventet Content-Length under checksum-verifikasjon");
  }
  const [sourceDigest, targetDigest] = await Promise.all([
    hashBody(sourceObject.Body, signal),
    hashBody(targetObject.Body, signal),
  ]);
  if (sourceDigest.bytes !== expectedSize || targetDigest.bytes !== expectedSize) {
    throw new Error("Uventet byteantall under checksum-verifikasjon");
  }
  if (sourceDigest.hash !== targetDigest.hash) {
    throw new Error("SHA-256 avviker mellom kilde og mål");
  }
}

async function copyAndVerify(object, abortController) {
  const { signal } = abortController;
  const existing = await targetHead(object.targetKey, signal);
  if (existing && existing.ContentLength === object.size) {
    try {
      if (verifyContent && !skipExistingContent) {
        await compareContent(object.sourceKey, object.targetKey, object.size, signal);
      }
      return { status: "verified", bytes: object.size };
    } catch (error) {
      if (verifyOnly || !execute) throw error;
      // A same-sized partial/corrupt object is replaced below.
    }
  }
  if (verifyOnly) throw new Error(existing ? "Størrelse avviker" : "Mangler i mål-bøtten");
  if (!execute) return { status: "planned", bytes: object.size };

  const sourceObject = await source.send(
    new GetObjectCommand({
      Bucket: sourceBucket,
      Key: object.sourceKey,
    }),
    { abortSignal: signal },
  );
  if (!sourceObject.Body) throw new Error("Kildeobjektet mangler body");
  if (sourceObject.ContentLength !== object.size) {
    throw new Error("Kildeobjektets Content-Length avviker fra inventory");
  }

  const sourceHash = crypto.createHash("sha256");
  let streamedSourceBytes = 0;
  const hashingStream = new Transform({
    transform(chunk, _encoding, callback) {
      sourceHash.update(chunk);
      streamedSourceBytes += chunk.byteLength;
      callback(null, chunk);
    },
  });
  const upload = new Upload({
    client: target,
    abortController,
    queueSize: 1,
    partSize: 32 * 1024 * 1024,
    leavePartsOnError: false,
    params: {
      Bucket: targetBucket,
      Key: object.targetKey,
      Body: hashingStream,
      ContentLength: object.size,
      ContentType: sourceObject.ContentType,
      CacheControl: sourceObject.CacheControl,
      ContentDisposition: sourceObject.ContentDisposition,
      ContentEncoding: sourceObject.ContentEncoding,
      ContentLanguage: sourceObject.ContentLanguage,
      Metadata: sourceObject.Metadata,
      ServerSideEncryption: "AES256",
    },
  });
  await Promise.all([
    pipeline(sourceObject.Body, hashingStream, { signal }),
    upload.done(),
  ]);
  if (streamedSourceBytes !== object.size) {
    throw new Error("Byteantall avviker under streaming til mål");
  }

  const copied = await targetHead(object.targetKey, signal);
  if (!copied || copied.ContentLength !== object.size) {
    throw new Error("Størrelse avviker etter kopiering");
  }
  const targetObject = await target.send(
    new GetObjectCommand({
      Bucket: targetBucket,
      Key: object.targetKey,
    }),
    { abortSignal: signal },
  );
  if (!targetObject.Body || targetObject.ContentLength !== object.size) {
    throw new Error("Målobjektet mangler body eller har feil størrelse");
  }
  const targetDigest = await hashBody(targetObject.Body, signal);
  if (targetDigest.bytes !== object.size || sourceHash.digest("hex") !== targetDigest.hash) {
    throw new Error("SHA-256 avviker etter kopiering");
  }
  return { status: "copied", bytes: object.size };
}

async function copyAndVerifyWithRetries(object) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const abortController = new AbortController();
    // A new copy reads the source once and S3 once more for SHA verification.
    // Budget for a conservative 5 MiB/s without making tiny hung requests wait
    // as long as multi-gigabyte model artifacts.
    const objectTimeoutMs = objectBaseTimeoutMs
      + Math.ceil((object.size * 2) / (5 * 1024 * 1024)) * 1_000;
    const timeout = setTimeout(() => {
      abortController.abort(new Error(`Objektoperasjonen overskred ${objectTimeoutMs} ms`));
    }, objectTimeoutMs);
    try {
      return await copyAndVerify(object, abortController);
    } catch (error) {
      lastError = error;
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function mapConcurrent(items, limit, worker) {
  let next = 0;
  const results = new Array(items.length);
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        results[index] = { status: "failed", bytes: items[index].size, error };
        console.error(
          `Feil underveis objekt=${anonymousKey(items[index].sourceKey)} size=${items[index].size}: ${error?.message || error}`,
        );
      }
      // Long-running one-off jobs process multi-GB streams. Explicit GC is a
      // no-op unless Node starts with --expose-gc, and prevents released SDK
      // stream buffers from accumulating between objects on bounded workers.
      if (typeof globalThis.gc === "function") globalThis.gc();
      const done = results.filter(Boolean).length;
      if (done % 25 === 0 || done === items.length) {
        console.log(`Fremdrift: ${done}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, run));
  return results;
}

const rawSourceInventory = await inventory(source, sourceBucket);
const sourceInventory = rawSourceInventory.map((object) => ({
  sourceKey: object.key,
  targetKey: sourceType === "r2" ? canonicalR2Key(sourceBucket, object.key) : canonicalKey(object.key),
  size: object.size,
}));
const targetKeys = new Map();
for (const object of sourceInventory) {
  const previous = targetKeys.get(object.targetKey);
  if (previous && previous !== object.sourceKey) {
    throw new Error(`Kanonisk key-kollisjon: ${anonymousKey(previous)} og ${anonymousKey(object.sourceKey)}`);
  }
  targetKeys.set(object.targetKey, object.sourceKey);
}
const sourceBytes = sourceInventory.reduce((sum, object) => sum + object.size, 0);
const hierarchy = sourceInventory.reduce((acc, object) => {
  const prefix = object.targetKey.split("/", 1)[0];
  const current = acc[prefix] || { objects: 0, bytes: 0 };
  current.objects += 1;
  current.bytes += object.size;
  acc[prefix] = current;
  return acc;
}, {});
console.log(JSON.stringify({
  mode: verifyOnly ? "verify-only" : execute ? "execute" : "dry-run",
  sourceType,
  sourceBucket,
  targetBucket,
  objectCount: sourceInventory.length,
  totalBytes: sourceBytes,
  contentVerification: verifyContent ? "sha256" : "size-only",
  existingContentVerification: skipExistingContent ? "size-only-resume" : verifyContent ? "sha256" : "size-only",
  concurrency,
  hierarchy,
}, null, 2));

const results = await mapConcurrent(sourceInventory, concurrency, copyAndVerifyWithRetries);
const summary = results.reduce((acc, result) => {
  acc[result.status] = (acc[result.status] || 0) + 1;
  acc[`${result.status}Bytes`] = (acc[`${result.status}Bytes`] || 0) + result.bytes;
  return acc;
}, {});
const failures = results
  .map((result, index) => ({ result, object: sourceInventory[index] }))
  .filter(({ result }) => result.status === "failed");

console.log(JSON.stringify({ summary, failureCount: failures.length }, null, 2));
for (const { result, object } of failures.slice(0, 20)) {
  console.error(`Feil objekt=${anonymousKey(object.sourceKey)} size=${object.size}: ${result.error?.message || result.error}`);
}
if (failures.length > 0) process.exit(1);
