/**
 * Music Library types — matcher backend role_room_music_tracks +
 * librosa-output fra analyze_music_track.py.
 */

import type { AnalysisStatus } from "./brollTypes";

export interface MusicSegment {
  type: "intro" | "verse" | "chorus" | "break" | "bridge"
        | "final-chorus" | "outro";
  start: number;
  end: number;
  energy: number;
}

export interface MusicAudioAnalysis {
  bpm?: number;
  bpmConfidence?: number;
  key?: string;
  mode?: "major" | "minor";
  keyConfidence?: number;
  durationSec?: number;
  energyCurve?: number[]; // 40 buckets, 0-1
  energyAverage?: number;
  energyPeak?: number;
  spectralCentroidAvg?: number;
  rmsAvg?: number;
  segments?: MusicSegment[];
  beatCount?: number;
  moodTags?: string[];
  suggestedFor?: string[];
  tags?: string[];
  method?: string;
}

export interface MusicTrack {
  id: string;
  projectId: string;
  filePath: string;
  previewAudioPath: string | null;
  waveformImagePath: string | null;
  audioAnalysis: MusicAudioAnalysis;
  tags: string[];
  userDescription: string | null;
  durationSec: number;
  suggestionCount: number;
  approvalCount: number;
  rejectionCount: number;
  usageCount: number;
  lastUsedAt: string | null;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  licenseType: string | null;
  licenseInfo: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MusicSuggestion {
  id: string;
  filePath: string;
  previewAudioPath: string | null;
  waveformImagePath: string | null;
  audioAnalysis: MusicAudioAnalysis;
  tags: string[];
  durationSec: number;
  score: number;
  baseScore: number;
  learningBoost: number;
  bpmBoost: number;
  tagOverlap: number;
}
