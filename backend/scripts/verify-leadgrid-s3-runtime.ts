import { randomUUID } from "node:crypto";
import {
  createLeadgridObjectStorage,
  leadgridStorageKeys,
  readLeadgridS3Config,
} from "../server/leadgrid-s3-storage-service.js";

if (process.env.LEADGRID_S3_E2E !== "1") {
  throw new Error("Sett LEADGRID_S3_E2E=1 for å kjøre mot den faktiske bucketen");
}

const config = readLeadgridS3Config();
if (!config) {
  throw new Error("AWS_LEADGRID_* er ikke komplett konfigurert");
}
const storage = createLeadgridObjectStorage({
  ...config,
  // Separat testvariabel: produksjonskontrakten forblir de fire
  // AWS_LEADGRID_*-verdiene og kan ikke falle tilbake til global AWS-konfig.
  sessionToken: process.env.LEADGRID_S3_E2E_SESSION_TOKEN?.trim() || undefined,
});

const organizationId = randomUUID();
const leadId = randomUUID();
const assetId = randomUUID();
const key = leadgridStorageKeys.leadAttachment({
  organizationId,
  projectId: `e2e-${randomUUID()}`,
  leadId,
  assetId,
});
const payload = Buffer.from(`leadgrid-s3-e2e:${randomUUID()}`, "utf8");
let uploaded = false;
let temporaryVideoKey: string | null = null;
let finalizedVideoKey: string | null = null;

try {
  const stored = await storage.putObject({
    key,
    body: payload,
    contentType: "text/plain; charset=utf-8",
    purpose: "runtime_e2e",
  });
  uploaded = true;
  if (stored.sizeBytes !== payload.byteLength || stored.key !== key) {
    throw new Error("S3 PUT returnerte uventet metadata");
  }

  const downloadUrl = await storage.createDownloadUrl(key, 60);
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error(`Signert GET feilet med HTTP ${response.status}`);
  const downloaded = Buffer.from(await response.arrayBuffer());
  if (!downloaded.equals(payload)) {
    throw new Error("Signert GET returnerte andre bytes enn PUT");
  }

  await storage.deleteObject(key);
  uploaded = false;
  const deletedResponse = await fetch(downloadUrl);
  if (deletedResponse.status !== 404) {
    throw new Error(`Slettet objekt svarte HTTP ${deletedResponse.status}, forventet 404`);
  }

  const courseId = randomUUID();
  const chapterId = randomUUID();
  const videoAssetId = randomUUID();
  temporaryVideoKey = leadgridStorageKeys.temporaryAcademyVideo({
    organizationId,
    chapterId,
    uploadId: randomUUID(),
  });
  finalizedVideoKey = leadgridStorageKeys.academyVideo({
    organizationId,
    courseId,
    chapterId,
    assetId: videoAssetId,
  });
  const videoPayload = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from("ftypisom", "ascii"),
    Buffer.from("leadgrid-academy-video-e2e", "utf8"),
  ]);
  const uploadUrl = await storage.createUploadUrl({
    key: temporaryVideoKey,
    contentType: "video/mp4",
    ttlSeconds: 60,
  });
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": "video/mp4" },
    body: videoPayload,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Signert PUT feilet med HTTP ${uploadResponse.status}`);
  }
  const finalized = await storage.finalizeTemporaryObject({
    temporaryKey: temporaryVideoKey,
    finalKey: finalizedVideoKey,
    allowedContentTypes: ["video/mp4"],
    maxBytes: 1024,
    purpose: "academy_video",
    validatePrefix: (prefix) => prefix.subarray(4, 8).toString("ascii") === "ftyp",
  });
  temporaryVideoKey = null;
  const finalizedBytes = await storage.getObjectBuffer(finalized.key, 1024);
  if (!finalizedBytes.equals(videoPayload) || finalized.checksumSha256.length !== 64) {
    throw new Error("Academy-finalisering beholdt ikke bytes og SHA-256");
  }
  await storage.deleteObject(finalized.key);
  finalizedVideoKey = null;

  console.log(
    "Leadgrid S3 runtime E2E: server-PUT/GET/DELETE og direkte PUT/finalisering/SHA-256 bestått",
  );
} finally {
  if (uploaded) await storage.deleteObject(key).catch(() => undefined);
  if (temporaryVideoKey) {
    await storage.deleteObject(temporaryVideoKey).catch(() => undefined);
  }
  if (finalizedVideoKey) {
    await storage.deleteObject(finalizedVideoKey).catch(() => undefined);
  }
}
