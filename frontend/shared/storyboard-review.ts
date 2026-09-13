export type StoryboardReviewStatus =
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'superseded';
export type StoryboardReviewAccessMode = 'view' | 'comment' | 'approve';

export type StoryboardReviewAnnotationTool = 'freehand' | 'arrow' | 'rectangle';
export type StoryboardReviewAnnotationColor = '#fbbf24' | '#f87171' | '#60a5fa' | '#34d399';

export interface StoryboardReviewAnnotationPoint {
  x: number;
  y: number;
}

export interface StoryboardReviewAnnotation {
  id: string;
  tool: StoryboardReviewAnnotationTool;
  color: StoryboardReviewAnnotationColor;
  strokeWidth: number;
  points: StoryboardReviewAnnotationPoint[];
}

export interface StoryboardReviewSnapshotFrame {
  id: string;
  shotNumber?: string;
  description?: string;
  duration?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  scriptLineRange?: [number, number];
  [key: string]: unknown;
}

export interface StoryboardReviewSnapshotScene {
  id: string;
  heading: string;
  sceneNumber?: string | number;
  description?: string;
  storyboardFrames: StoryboardReviewSnapshotFrame[];
  storyboardVersionLog?: unknown[];
  storyboardSettings?: unknown;
  storyboardNotes?: unknown;
}

export interface StoryboardReviewSnapshot {
  schemaVersion: 'storyboard-review-snapshot-v1';
  manuscript: { id: string; title: string; version?: number };
  scenes: StoryboardReviewSnapshotScene[];
  dialogue: Array<{
    id?: string;
    sceneId?: string;
    lineNumber?: number;
    characterName?: string;
    text: string;
  }>;
}

export interface StoryboardReviewRound {
  id: string;
  projectId: string;
  manuscriptId: string;
  version: number;
  label: string;
  summary?: string | null;
  snapshotHash: string;
  scriptFingerprint: string;
  status: StoryboardReviewStatus;
  frameCount: number;
  totalDurationSeconds: number;
  createdBy: string;
  approvedBy?: string | null;
  submittedAt: string;
  approvedAt?: string | null;
  createdAt: string;
  snapshot?: StoryboardReviewSnapshot;
  comments?: StoryboardReviewComment[];
  decisions?: StoryboardReviewDecision[];
  shareLinks?: StoryboardReviewShareLink[];
  carriedCommentCount?: number;
}

export interface StoryboardReviewShareLink {
  id: string;
  reviewRoundId: string;
  accessMode: StoryboardReviewAccessMode;
  requireIdentity: boolean;
  expiresAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  url?: string;
}

export interface StoryboardReviewComment {
  id: string;
  reviewRoundId: string;
  frameId?: string | null;
  parentId?: string | null;
  authorDisplayName: string;
  body: string;
  visibility: 'client' | 'team';
  anchorX?: number | null;
  anchorY?: number | null;
  annotations: StoryboardReviewAnnotation[];
  status: 'open' | 'resolved';
  assignedTo?: string | null;
  dueAt?: string | null;
  resolutionNote?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  resolvedInRoundId?: string | null;
  carriedFromCommentId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface StoryboardReviewDecision {
  id: string;
  reviewRoundId: string;
  decision: 'approved' | 'changes_requested';
  expectedSnapshotHash: string;
  actorDisplayName: string;
  note?: string | null;
  createdAt: string;
}

export interface StoryboardReviewInboxItem {
  id: string;
  eventType:
    | 'storyboard_review_round_created'
    | 'storyboard_review_comment_added'
    | 'storyboard_review_comment_resolved'
    | 'storyboard_review_comment_reopened'
    | 'storyboard_review_approved'
    | 'storyboard_review_changes_requested';
  title: string;
  message?: string | null;
  reviewRoundId: string;
  roundVersion: number;
  frameId?: string | null;
  actorDisplayName?: string | null;
  decision?: 'approved' | 'changes_requested' | null;
  createdAt: string;
  read: boolean;
  readAt?: string | null;
}

export interface StoryboardReviewInbox {
  items: StoryboardReviewInboxItem[];
  unreadCount: number;
}

export interface StoryboardReviewDiff {
  currentHash: string;
  baselineHash: string;
  scriptChanged: boolean;
  addedFrameIds: string[];
  removedFrameIds: string[];
  changedFrameIds: string[];
  movedFrameIds: string[];
  impactedScriptLineRanges: Array<[number, number]>;
  unchangedFrameCount: number;
}

export interface StoryboardSharedReview {
  round: StoryboardReviewRound & { snapshot: StoryboardReviewSnapshot };
  share: {
    accessMode: StoryboardReviewAccessMode;
    requireIdentity: boolean;
    expiresAt?: string | null;
  };
  reviewer?: { id: string; displayName: string; email?: string | null } | null;
}
