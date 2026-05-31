/**
 * Multi-cam sync types — matcher backend role_room_multicam_groups +
 * sync_multicam_audio.py output.
 */

export type SyncStatus = "pending" | "syncing" | "ready" | "failed";

export interface MulticamClip {
  /** Klient-lokal ID (random) — ikke samme som DB-id. */
  id: string;
  filePath: string;
  fileName: string;
  isReference: boolean;
  /** Auto-detektert offset i sek fra reference. 0 hvis reference. */
  detectedOffsetSec: number;
  /** Bjarne's manuell finetune (+/- noen sek). */
  manualOffsetSec: number;
  /** 0-1 fra cross-correlation. 1 = reference. */
  confidence: number;
  durationSec: number;
  /** 200-bucket peak-amplitude for waveform-visualisering. */
  waveformData: number[];
}

export interface MulticamGroup {
  id: string;
  projectId: string;
  groupName: string;
  clips: MulticamClip[];
  agentKind: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  syncMethod: string | null;
  lastSyncedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Effektiv offset = detected + manual */
export function effectiveOffset(clip: MulticamClip): number {
  return clip.detectedOffsetSec + clip.manualOffsetSec;
}

export function newClient(): string {
  return `mc-${Math.random().toString(36).slice(2, 11)}`;
}
