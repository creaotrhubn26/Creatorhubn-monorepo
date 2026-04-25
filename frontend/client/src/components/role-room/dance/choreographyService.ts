/**
 * Frontend client for /api/dance/choreography.
 *
 * Backend-modellen er identisk med ChoreographyTypes (samme felt-navn,
 * samme enum-verdier). Vi mapper kun start_sec ↔ startSec / end_sec ↔
 * endSec — alt annet er 1:1.
 */

import type {
  ApprovalStatus,
  Choreography,
  EnergyLevel,
  Segment,
  SegmentKind,
} from './choreographyTypes';

export interface ChoreographyHeader {
  id: string;
  ownerUserId: string;
  title: string;
  choreographer: string | null;
  totalDurationSec: number;
  segmentCount: number;
  updatedAt: string;
}

interface RawSegment {
  id: string;
  kind: SegmentKind;
  label: string | null;
  startSec: number;
  endSec: number;
  musicCue: string | null;
  formation: string | null;
  camera: string | null;
  lighting: string | null;
  costume: string | null;
  movementNotes: string | null;
  energy: EnergyLevel;
  dancers: string[];
  videoRefUrl: string | null;
  approval: ApprovalStatus;
}

interface RawChoreography {
  id: string;
  title: string;
  choreographer: string | null;
  musicTitle: string | null;
  musicUrl: string | null;
  bpm: number | null;
  musicalKey: string | null;
  totalDurationSec: number;
  segments: RawSegment[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function toClient(raw: RawChoreography): Choreography {
  return {
    id: raw.id,
    title: raw.title,
    choreographer: raw.choreographer ?? undefined,
    musicTitle: raw.musicTitle ?? undefined,
    bpm: raw.bpm ?? undefined,
    musicalKey: raw.musicalKey ?? undefined,
    totalDurationSec: raw.totalDurationSec,
    segments: raw.segments.map((s): Segment => ({
      id: s.id,
      kind: s.kind,
      label: s.label ?? undefined,
      startSec: s.startSec,
      endSec: s.endSec,
      musicCue: s.musicCue ?? undefined,
      formation: s.formation ?? undefined,
      camera: s.camera ?? undefined,
      lighting: s.lighting ?? undefined,
      costume: s.costume ?? undefined,
      movementNotes: s.movementNotes ?? undefined,
      energy: s.energy,
      dancers: s.dancers,
      videoRefUrl: s.videoRefUrl ?? undefined,
      approval: s.approval,
    })),
  };
}

export async function listChoreographies(): Promise<ChoreographyHeader[]> {
  const res = await fetch('/api/dance/choreography', { credentials: 'include' });
  const body = await json<{ success: boolean; data: ChoreographyHeader[] }>(res);
  return body.data;
}

export async function createChoreography(input: {
  title: string;
  choreographer?: string | null;
  musicTitle?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  totalDurationSec?: number;
}): Promise<Choreography> {
  const res = await fetch('/api/dance/choreography', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const body = await json<{ success: boolean; data: RawChoreography }>(res);
  return toClient(body.data);
}

export async function getChoreography(id: string): Promise<Choreography> {
  const res = await fetch(`/api/dance/choreography/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });
  const body = await json<{ success: boolean; data: RawChoreography }>(res);
  return toClient(body.data);
}

export async function updateChoreographyHeader(
  id: string,
  patch: Partial<{
    title: string;
    choreographer: string | null;
    musicTitle: string | null;
    bpm: number | null;
    musicalKey: string | null;
    totalDurationSec: number;
    musicUrl: string | null;
    musicStorageKey: string | null;
  }>,
): Promise<Choreography> {
  const res = await fetch(`/api/dance/choreography/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  const body = await json<{ success: boolean; data: RawChoreography }>(res);
  return toClient(body.data);
}

export async function replaceSegments(
  id: string,
  segments: Segment[],
): Promise<Choreography> {
  const payload = {
    segments: segments.map((s) => ({
      kind: s.kind,
      label: s.label ?? null,
      startSec: s.startSec,
      endSec: s.endSec,
      musicCue: s.musicCue ?? null,
      formation: s.formation ?? null,
      camera: s.camera ?? null,
      lighting: s.lighting ?? null,
      costume: s.costume ?? null,
      movementNotes: s.movementNotes ?? null,
      energy: s.energy,
      dancers: s.dancers,
      videoRefUrl: s.videoRefUrl ?? null,
      approval: s.approval,
    })),
  };
  const res = await fetch(`/api/dance/choreography/${encodeURIComponent(id)}/segments`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const body = await json<{ success: boolean; data: RawChoreography }>(res);
  return toClient(body.data);
}

export async function deleteChoreography(id: string): Promise<void> {
  const res = await fetch(`/api/dance/choreography/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
}
