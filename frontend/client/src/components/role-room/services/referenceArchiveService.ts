/**
 * Reference archive client — wraps the /api/reference-archive endpoints.
 *
 * Storage of the actual image bytes is the caller's responsibility; this
 * module only deals with (a) previewing Claude Vision tags from a base64
 * payload, and (b) storing/searching/mutating already-hosted frames.
 */

import { apiFetch } from '@/lib/queryClient';

export type ReferenceFrameShotType =
  | 'wide'
  | 'medium'
  | 'close-up'
  | 'extreme-close-up'
  | 'over-the-shoulder'
  | 'two-shot'
  | 'insert'
  | 'aerial'
  | 'unknown';

export interface ReferenceFrameClaudeTags {
  shotType: ReferenceFrameShotType;
  cameraAngle: string;
  lensRange: string;
  lightingMood: string;
  colorPalette: string[];
  composition: string;
  timeOfDay: string;
  suggestedCinematographerStyle: string;
  keywords: string[];
}

export interface ReferenceFrame {
  id: string;
  ownerUserId: string;
  uploadedByUserId: string;
  sourceUrl: string;
  thumbnailUrl: string | null;
  filmTitle: string | null;
  cinematographer: string | null;
  year: number | null;
  notes: string | null;
  claudeTags: ReferenceFrameClaudeTags;
  userTags: string[];
  usedOnProjectIds: string[];
  createdAt: string;
  updatedAt: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function analyzeFramePreview(input: {
  imageBase64: string;
  mime: string;
  hintFilmTitle?: string;
  hintCinematographer?: string;
}): Promise<ReferenceFrameClaudeTags> {
  const res = await apiFetch('/api/reference-archive/analyze', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const body = await json<{ success: boolean; data: { claudeTags: ReferenceFrameClaudeTags } }>(res);
  return body.data.claudeTags;
}

export async function createReferenceFrame(input: {
  /** Pre-hosted URL. Either this or (imageBase64 + mime) is required. */
  sourceUrl?: string;
  /** Base64-encoded image — backend uploads to R2 and derives sourceUrl. */
  imageBase64?: string;
  mime?: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';
  thumbnailUrl?: string | null;
  filmTitle?: string | null;
  cinematographer?: string | null;
  year?: number | null;
  notes?: string | null;
  claudeTags: ReferenceFrameClaudeTags;
  userTags?: string[];
  usedOnProjectIds?: string[];
}): Promise<ReferenceFrame> {
  const res = await apiFetch('/api/reference-archive/frames', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const body = await json<{ success: boolean; data: ReferenceFrame }>(res);
  return body.data;
}

export interface SearchArgs {
  q?: string;
  shotType?: ReferenceFrameShotType;
  cinematographer?: string;
  timeOfDay?: string;
  limit?: number;
  offset?: number;
}

export async function searchReferenceFrames(args: SearchArgs = {}): Promise<ReferenceFrame[]> {
  const params = new URLSearchParams();
  if (args.q) params.set('q', args.q);
  if (args.shotType) params.set('shotType', args.shotType);
  if (args.cinematographer) params.set('cinematographer', args.cinematographer);
  if (args.timeOfDay) params.set('timeOfDay', args.timeOfDay);
  if (args.limit) params.set('limit', String(args.limit));
  if (args.offset) params.set('offset', String(args.offset));
  const res = await apiFetch(`/api/reference-archive/frames?${params.toString()}`);
  const body = await json<{ success: boolean; data: ReferenceFrame[] }>(res);
  return body.data;
}

export async function updateReferenceFrame(
  id: string,
  patch: Partial<{
    sourceUrl: string;
    thumbnailUrl: string | null;
    filmTitle: string | null;
    cinematographer: string | null;
    year: number | null;
    notes: string | null;
    userTags: string[];
    usedOnProjectIds: string[];
  }>,
): Promise<ReferenceFrame> {
  const res = await apiFetch(`/api/reference-archive/frames/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  const body = await json<{ success: boolean; data: ReferenceFrame }>(res);
  return body.data;
}

export interface SuggestedFrame {
  frame: ReferenceFrame;
  similarity: number;
}

export async function suggestFramesForScene(input: {
  scene: {
    sceneNumber?: string | number;
    heading?: string;
    locationName?: string;
    intExt?: string;
    timeOfDay?: string;
    description?: string;
    characters?: string[];
    mood?: string;
    beats?: string[];
  };
  limit?: number;
}): Promise<SuggestedFrame[]> {
  const res = await apiFetch('/api/reference-archive/suggest', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const body = await json<{ success: boolean; data: SuggestedFrame[] }>(res);
  return body.data;
}

export async function deleteReferenceFrame(id: string): Promise<void> {
  const res = await apiFetch(`/api/reference-archive/frames/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
}

/**
 * Reads a File as base64 (without the data URL prefix). Used by the upload
 * dialog to feed /analyze before persisting the frame.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('FileReader did not return a string'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}
