/**
 * B-roll Library types — strukturen som matcher backend role_room_
 * broll_clips + vision-AI-output fra analyze_broll_clip.py.
 */

export type AnalysisStatus = "pending" | "analyzing" | "ready" | "failed";

/** Strukturert vision-analyse-output fra Claude. Matcher prompt-shape
 * i analyze_broll_clip.py. */
export interface BrollVisionAnalysis {
  summary?: string;
  objects?: string[];
  people?: boolean;
  peopleCount?: number;
  scene?: "interior" | "exterior" | "mixed";
  location?: string;
  timeOfDay?: "morning" | "midday" | "afternoon" | "evening" | "night" | "unknown";
  lighting?: string;
  mood?: string[];
  motion?: string;
  shotType?: "extreme-wide" | "wide" | "medium" | "close-up" | "extreme-close-up";
  colorPalette?: string[];
  audioContext?: string[];
  suggestedFor?: string[];
  tags?: string[];
}

export interface BrollClip {
  id: string;
  projectId: string;
  filePath: string;
  previewVideoPath: string | null;
  previewThumbnailPath: string | null;
  visionAnalysis: BrollVisionAnalysis;
  tags: string[];
  userDescription: string | null;
  durationSec: number;
  width: number | null;
  height: number | null;
  fps: number | null;
  suggestionCount: number;
  approvalCount: number;
  rejectionCount: number;
  usageCount: number;
  lastUsedAt: string | null;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrollSuggestion {
  id: string;
  filePath: string;
  previewThumbnailPath: string | null;
  visionAnalysis: BrollVisionAnalysis;
  tags: string[];
  durationSec: number;
  /** Final score etter learning-boost (0-1). */
  score: number;
  /** Tag-overlap-score uten boost. */
  baseScore: number;
  /** Universal-learning boost (0.5 = nøytral, >0.5 = bedre enn snitt). */
  learningBoost: number;
  /** Antall tags som overlapper med context. */
  tagOverlap: number;
}
