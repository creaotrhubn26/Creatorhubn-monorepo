/**
 * Social cuts types — matcher backend role_room_social_cuts.
 */

export type CutStatus =
  | "extracted" | "reviewed" | "approved" | "published" | "rejected";

export type CutAspect = "9:16" | "1:1" | "4:5" | "16:9";

export interface SocialCut {
  id: string;
  projectId: string;
  sourceVideoPath: string;
  startSec: number;
  endSec: number;
  outputPath: string | null;
  aspectRatio: CutAspect;
  captionsBurnt: boolean;
  thumbnailPath: string | null;
  standoutScore: number | null;
  transcriptSnippet: string | null;
  headline: string | null;
  status: CutStatus;
  agentKind: string | null;
  renderCount: number;
  renderedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StandoutMoment {
  startSec: number;
  endSec: number;
  durationSec: number;
  score: number;
  text: string;
  reason: string;
}
