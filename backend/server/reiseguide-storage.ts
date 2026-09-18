/**
 * Lagringshierarki for SenseAid Explore i CreatorHubs private S3-bøtte
 * (infrastructure/aws/creatorhubn-storage/README.md, «Product media»).
 *
 *   products/senseaid-explore/
 *     areas/{areaSlug}/
 *       pois/{poiSlug}/
 *         audio/{kind}-{chapterNo}-{lang}-v{version}.mp3
 *         captions/{kind}-{chapterNo}-{lang}-v{version}.vtt
 *         images/{objectId}-{filename}
 *
 * Prefikset er produktets egen mappe utenfor tenant-lagringen
 * (organizations/…) og har egen IAM-setning (SenseAidExploreMediaAccess).
 * Bøtta er privat, så appen får aldri S3-nøkler direkte: API-et gir
 * /api/guide/media/{key}, som omdirigerer til en kortlevd signert URL.
 */

import { storageSegment } from "./creatorhub-storage-key.js";

export const SENSEAID_STORAGE_PREFIX = "products/senseaid-explore";
export const SENSEAID_MEDIA_ROUTE = "/api/guide/media";

const KEY_RE = /^products\/senseaid-explore\/areas\/[A-Za-z0-9._-]+\/pois\/[A-Za-z0-9._-]+\/(audio|captions|images)\/[A-Za-z0-9._-]+$/;

export interface SenseAidScriptRef {
  areaSlug: string;
  poiSlug: string;
  kind: string;
  chapterNo: number;
  lang: string;
  version: number;
}

function scriptFileStem(ref: SenseAidScriptRef): string {
  return [
    storageSegment(ref.kind, "script"),
    String(Math.max(1, Math.trunc(ref.chapterNo))),
    storageSegment(ref.lang, "und"),
    `v${Math.max(1, Math.trunc(ref.version))}`,
  ].join("-");
}

function poiPrefix(ref: Pick<SenseAidScriptRef, "areaSlug" | "poiSlug">): string {
  return [
    SENSEAID_STORAGE_PREFIX,
    "areas",
    storageSegment(ref.areaSlug, "unknown-area"),
    "pois",
    storageSegment(ref.poiSlug, "unknown-poi"),
  ].join("/");
}

export function senseAidAudioKey(ref: SenseAidScriptRef): string {
  return `${poiPrefix(ref)}/audio/${scriptFileStem(ref)}.mp3`;
}

export function senseAidCaptionsKey(ref: SenseAidScriptRef): string {
  return `${poiPrefix(ref)}/captions/${scriptFileStem(ref)}.vtt`;
}

export function senseAidImageKey(ref: Pick<SenseAidScriptRef, "areaSlug" | "poiSlug">, objectId: string, fileName: string): string {
  return `${poiPrefix(ref)}/images/${storageSegment(objectId, "object")}-${storageSegment(fileName, "image.jpg")}`;
}

/** Sann bare for nøkler som følger hierarkiet over; brukes før presigning. */
export function isSenseAidStorageKey(key: string): boolean {
  return KEY_RE.test(key) && !key.includes("..");
}

/** URL appen bruker for en nøkkel i CreatorHub S3 (omdirigeres til signert URL). */
export function senseAidMediaUrl(key: string, publicApiBase: string): string {
  return `${publicApiBase.replace(/\/+$/, "")}${SENSEAID_MEDIA_ROUTE}/${key}`;
}
