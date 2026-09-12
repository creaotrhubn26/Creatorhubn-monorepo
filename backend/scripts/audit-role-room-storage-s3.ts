#!/usr/bin/env tsx

import crypto from "node:crypto";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import {
  canonicalizeRoleRoomR2StorageKey,
  canonicalizeRoleRoomStorageKey,
} from "../server/role-room-storage-key.js";

type InventoryObject = { key: string; size: number };
type ExpectedObject = InventoryObject & { sources: string[] };

const args = new Set(process.argv.slice(2));
const allowMissing = args.has("--allow-missing");
const r2BucketsArg = process.argv.find((arg) => arg.startsWith("--r2-buckets="));
const r2Buckets = (r2BucketsArg?.slice("--r2-buckets=".length)
  || "casting-videos,ml-models,ml-models2,role-room-storyboards,theroleroom")
  .split(",")
  .map((bucket) => bucket.trim())
  .filter(Boolean);

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Mangler miljøvariabel: ${name}`);
  return value;
}

function anonymousKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 12);
}

async function listObjects(client: S3Client, bucket: string): Promise<InventoryObject[]> {
  const objects: InventoryObject[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
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

const r2 = new S3Client({
  region: "auto",
  endpoint: required("CLOUDFLARE_R2_ENDPOINT"),
  credentials: {
    accessKeyId: required("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey: required("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
  },
});
const b2Region = process.env.B2_REGION?.trim() || "eu-central-003";
const b2 = new S3Client({
  region: b2Region,
  endpoint: `https://s3.${b2Region}.backblazeb2.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: required("B2_ROLE_ROOM_APPLICATION_KEY_ID"),
    secretAccessKey: required("B2_ROLE_ROOM_APPLICATION_KEY"),
  },
});
const target = new S3Client({
  region: required("AWS_ROLE_ROOM_REGION"),
  credentials: {
    accessKeyId: required("AWS_ROLE_ROOM_ACCESS_KEY_ID"),
    secretAccessKey: required("AWS_ROLE_ROOM_SECRET_ACCESS_KEY"),
  },
});
const targetBucket = required("AWS_ROLE_ROOM_BUCKET_NAME");
const b2Bucket = required("B2_ROLE_ROOM_BUCKET_NAME");

const expected = new Map<string, ExpectedObject>();
const conflicts: Array<{ keyHash: string; sizes: number[]; sources: string[] }> = [];
let sourceObjects = 0;
let sourceBytes = 0;

function addExpected(key: string, size: number, sourceName: string): void {
  sourceObjects += 1;
  sourceBytes += size;
  const previous = expected.get(key);
  if (!previous) {
    expected.set(key, { key, size, sources: [sourceName] });
    return;
  }
  previous.sources.push(sourceName);
  if (previous.size !== size) {
    conflicts.push({
      keyHash: anonymousKey(key),
      sizes: [previous.size, size],
      sources: previous.sources,
    });
  }
}

for (const bucket of r2Buckets) {
  for (const object of await listObjects(r2, bucket)) {
    addExpected(
      canonicalizeRoleRoomR2StorageKey(bucket, object.key),
      object.size,
      `r2:${bucket}`,
    );
  }
}
for (const object of await listObjects(b2, b2Bucket)) {
  addExpected(canonicalizeRoleRoomStorageKey(object.key), object.size, `b2:${b2Bucket}`);
}

const targetObjects = (await listObjects(target, targetBucket))
  .filter((object) => !object.key.startsWith("_system/"));
const targetByKey = new Map(targetObjects.map((object) => [object.key, object]));
const missing = [...expected.values()].filter((object) => !targetByKey.has(object.key));
const sizeMismatches = [...expected.values()].filter((object) => {
  const targetObject = targetByKey.get(object.key);
  return targetObject && targetObject.size !== object.size;
});
const unexpected = targetObjects.filter((object) => !expected.has(object.key));
const collisions = [...expected.values()].filter((object) => object.sources.length > 1);
const targetDataBytes = targetObjects.reduce((sum, object) => sum + object.size, 0);
const missingBytes = missing.reduce((sum, object) => sum + object.size, 0);
const unexpectedBytes = unexpected.reduce((sum, object) => sum + object.size, 0);

console.log(JSON.stringify({
  sourceObjects,
  sourceBytes,
  expectedUniqueObjects: expected.size,
  crossSourceCollisions: collisions.length,
  conflictingCollisions: conflicts.length,
  targetDataObjects: targetObjects.length,
  targetDataBytes,
  missingObjects: missing.length,
  missingBytes,
  sizeMismatches: sizeMismatches.length,
  unexpectedObjects: unexpected.length,
  unexpectedBytes,
  samples: {
    missing: missing.slice(0, 20).map((object) => ({
      keyHash: anonymousKey(object.key),
      size: object.size,
      sources: object.sources,
    })),
    sizeMismatches: sizeMismatches.slice(0, 20).map((object) => ({
      keyHash: anonymousKey(object.key),
      sourceSize: object.size,
      targetSize: targetByKey.get(object.key)?.size,
      sources: object.sources,
    })),
    unexpected: unexpected.slice(0, 20).map((object) => ({
      key: object.key,
      size: object.size,
    })),
    conflicts: conflicts.slice(0, 20),
  },
}, null, 2));

if (
  conflicts.length > 0
  || sizeMismatches.length > 0
  || unexpected.length > 0
  || (!allowMissing && missing.length > 0)
) {
  process.exit(1);
}
