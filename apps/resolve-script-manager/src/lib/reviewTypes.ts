/**
 * Review-portal types — matcher backend role_room_review_sessions +
 * role_room_review_comments.
 */

export type ReviewStatus = "draft" | "active" | "completed" | "expired";
export type CommentSentiment = "positive" | "neutral" | "negative";

export interface ReviewVisibilitySettings {
  showCuts: boolean;
  showBroll: boolean;
  showMusic: boolean;
  showLowerThirds: boolean;
  showCaptions: boolean;
  allowReject: boolean;
  allowApprove: boolean;
  allowComments: boolean;
}

export interface ReviewSession {
  id: string;
  projectId: string;
  token: string;
  agentKind: string | null;
  sessionTitle: string | null;
  clientName: string | null;
  clientEmail: string | null;
  visibilitySettings: ReviewVisibilitySettings;
  status: ReviewStatus;
  expiresAt: string;
  lastViewedAt: string | null;
  viewCount: number;
  commentCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewComment {
  id: string;
  sessionId: string;
  cutId: string | null;
  timestampSec: number | null;
  clientName: string;
  commentText: string;
  sentiment: CommentSentiment | null;
  addressed: boolean;
  addressedAt: string | null;
  createdAt: string;
}

export const DEFAULT_VISIBILITY: ReviewVisibilitySettings = {
  showCuts: true,
  showBroll: false,
  showMusic: false,
  showLowerThirds: false,
  showCaptions: true,
  allowReject: true,
  allowApprove: true,
  allowComments: true,
};
