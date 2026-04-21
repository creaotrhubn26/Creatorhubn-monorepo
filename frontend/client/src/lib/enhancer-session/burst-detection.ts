/**
 * Burst detection for culling.
 *
 * Groups images likely to be consecutive shots from the same camera so
 * the cull UI can surface them as "burst of N" and the photographer can
 * rate/reject the whole cluster with one key.
 *
 * Two signals combined:
 *   1. Filename-sequence adjacency — IMG_0042.CR3 → IMG_0043.CR3 with
 *      the same stem and sequential number. Robust across cameras that
 *      zero-pad (IMG_0042) and cameras that don't (DSC_42).
 *   2. lastModified proximity — same-camera shutter bursts land within a
 *      small time window. Default 3 seconds captures typical 3-10 fps
 *      bursts without accidentally merging separate shots that happened
 *      to land near each other (e.g. 30 s between frames is not a burst).
 *
 * Both conditions must hold to extend a burst. A burst needs ≥2 images.
 *
 * Pure function, deterministic, no side effects. Input is read-only.
 */

export interface BurstCandidateInput {
  id: string;
  fileName: string;
  lastModified: number;
}

export interface BurstAssignment {
  imageId: string;
  burstId: string | null;
}

export interface DetectBurstsOptions {
  /** Max seconds between adjacent frames to count as a burst. Default 3. */
  maxGapSeconds?: number;
  /** Minimum burst size. Default 2. Anything smaller has burstId = null. */
  minBurstSize?: number;
}

const DEFAULT_MAX_GAP_SECONDS = 3;
const DEFAULT_MIN_BURST_SIZE = 2;

export function detectBursts(
  images: ReadonlyArray<BurstCandidateInput>,
  options: DetectBurstsOptions = {},
): BurstAssignment[] {
  const maxGap = options.maxGapSeconds ?? DEFAULT_MAX_GAP_SECONDS;
  const minSize = options.minBurstSize ?? DEFAULT_MIN_BURST_SIZE;

  if (images.length === 0) return [];

  // Work on a sorted copy keyed by lastModified so rearranged upload
  // order doesn't break burst continuity. The input id list is used to
  // restore original ordering in the returned array.
  const ordered = images.map((image, index) => ({ ...image, originalIndex: index }))
    .sort((a, b) => a.lastModified - b.lastModified || a.fileName.localeCompare(b.fileName));

  const assignments = new Map<string, string | null>();
  for (const image of images) assignments.set(image.id, null);

  let clusterStart = 0;
  for (let i = 1; i <= ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = i < ordered.length ? ordered[i] : null;

    const continues =
      current &&
      currentIsBurstNeighbour(previous, current, maxGap);

    if (!continues) {
      const clusterEnd = i;
      const clusterSize = clusterEnd - clusterStart;
      if (clusterSize >= minSize) {
        const burstId = `burst_${ordered[clusterStart].id}`;
        for (let k = clusterStart; k < clusterEnd; k += 1) {
          assignments.set(ordered[k].id, burstId);
        }
      }
      clusterStart = i;
    }
  }

  return images.map((image) => ({ imageId: image.id, burstId: assignments.get(image.id) ?? null }));
}

function currentIsBurstNeighbour(
  a: BurstCandidateInput,
  b: BurstCandidateInput,
  maxGapSeconds: number,
): boolean {
  const gapSeconds = Math.abs(b.lastModified - a.lastModified) / 1000;
  if (gapSeconds > maxGapSeconds) return false;

  const seqA = parseFilenameSequence(a.fileName);
  const seqB = parseFilenameSequence(b.fileName);
  if (!seqA || !seqB) {
    // Fall back to time-only when we can't parse a sequence. Honours the
    // intent for cameras that use cryptic names (e.g. DJI drones using
    // DJI_0123.JPG → DJI_0124.JPG still parses, but .braw with hashes
    // may not).
    return true;
  }
  if (seqA.stem !== seqB.stem) return false;
  const diff = seqB.seq - seqA.seq;
  return diff >= 1 && diff <= 3;
}

const FILENAME_SEQ_RE = /^(.*?)(\d+)(\.[^.]+)?$/;

export function parseFilenameSequence(name: string): { stem: string; seq: number } | null {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? name;
  const match = FILENAME_SEQ_RE.exec(base);
  if (!match) return null;
  const stem = match[1];
  const seqRaw = match[2];
  const seq = Number.parseInt(seqRaw, 10);
  if (!Number.isFinite(seq)) return null;
  return { stem, seq };
}
