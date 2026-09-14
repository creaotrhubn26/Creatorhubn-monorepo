import { storageSegment } from "./creatorhub-storage-key.js";

function safeExtension(fileName: string, fallback: string): string {
  return fileName.toLowerCase().match(/\.([a-z0-9]{1,10})$/)?.[1] || fallback;
}

interface PhotoRoomStorageScope {
  organizationId?: string | null;
  userId: string;
  projectId?: string | null;
}

function photoRoomPrefix(input: PhotoRoomStorageScope): string[] {
  const user = storageSegment(input.userId, "unknown-user");
  const organization = storageSegment(input.organizationId, `personal-${user}`);
  return [
    "organizations",
    organization,
    "users",
    user,
    "projects",
    storageSegment(input.projectId, "unassigned"),
    "photo-room",
  ];
}

/** Stable prefix used to authorize CreatorHub S3 reads for one user/project. */
export function buildPhotoRoomProjectPrefix(input: PhotoRoomStorageScope): string {
  return `${photoRoomPrefix(input).join("/")}/`;
}

/** Canonical key for Capture uploads that feed Photo Room and client galleries. */
export function buildPhotoRoomCaptureKey(input: PhotoRoomStorageScope & {
  sessionId: string;
  assetId: string;
  kind: "preview" | "full" | "raw" | "cleaned" | "review-audio";
  fileName: string;
}): string {
  const extension = safeExtension(input.fileName, input.kind === "review-audio" ? "m4a" : "bin");
  const objectName = input.kind === "review-audio"
    ? `${storageSegment(input.fileName.replace(/\.[^.]+$/u, ""), "review")}.${extension}`
    : `original.${extension}`;
  return [
    ...photoRoomPrefix(input),
    "capture",
    "sessions",
    storageSegment(input.sessionId, "unknown-session"),
    "assets",
    storageSegment(input.assetId, "unknown-asset"),
    storageSegment(input.kind, "full"),
    objectName,
  ].join("/");
}

export function buildPhotoRoomCaptureAssetPrefix(input: PhotoRoomStorageScope & {
  sessionId: string;
  assetId: string;
}): string {
  return [
    ...photoRoomPrefix(input),
    "capture",
    "sessions",
    storageSegment(input.sessionId, "unknown-session"),
    "assets",
    storageSegment(input.assetId, "unknown-asset"),
    "",
  ].join("/");
}

/** Canonical key for a permanent generative result owned by CreatorHub. */
export function buildPhotoRoomAiResultKey(input: PhotoRoomStorageScope & {
  jobId: string;
  mediaKind: "image" | "video";
  fileName?: string;
}): string {
  return [
    ...photoRoomPrefix(input),
    "ai",
    input.mediaKind === "video" ? "videos" : "images",
    storageSegment(input.jobId, "unknown-job"),
    `result.${safeExtension(input.fileName || "", input.mediaKind === "video" ? "mp4" : "png")}`,
  ].join("/");
}

/** Direct Photo Enhancer input uploaded by Capture before a queued job. */
export function buildPhotoRoomEnhancerSourceKey(input: PhotoRoomStorageScope & {
  objectId: string;
  fileName: string;
}): string {
  return [
    ...photoRoomPrefix(input),
    "enhancer",
    "sources",
    storageSegment(input.objectId, "source"),
    `original.${safeExtension(input.fileName, "bin")}`,
  ].join("/");
}

export function buildPhotoRoomDeliveryKey(input: PhotoRoomStorageScope & {
  galleryId: string;
  objectId: string;
  fileName: string;
}): string {
  return [
    ...photoRoomPrefix(input),
    "galleries",
    storageSegment(input.galleryId, "unknown-gallery"),
    "deliveries",
    `${storageSegment(input.objectId, "object")}-${storageSegment(input.fileName, "image.bin")}`,
  ].join("/");
}

export function isCreatorHubPhotoRoomKey(key: string | null | undefined): boolean {
  return typeof key === "string"
    && key.startsWith("organizations/")
    && key.includes("/photo-room/");
}
