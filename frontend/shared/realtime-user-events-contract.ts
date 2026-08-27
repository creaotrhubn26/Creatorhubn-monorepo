/** Wire contract shared by the backend and browser clients. */
export const USER_EVENTS_PROTOCOL_VERSION = 1 as const;

export type UserEvent =
  | { kind: "milestones.updated"; projectId: string; timestamp: string }
  | { kind: "board.updated"; projectId: string; timestamp: string }
  | { kind: "chat.message"; channelId: string; projectId: string; timestamp: string }
  | { kind: "chat.typing"; channelId: string; name: string; timestamp: string }
  | { kind: "chat.mention"; channelId: string; projectId: string; fromName: string; timestamp: string }
  | {
      kind: "asset.hearted";
      assetId: string;
      sessionId: string;
      clientName: string | null;
      hearted: boolean;
      timestamp: string;
    }
  | {
      kind: "asset.commented";
      assetId: string;
      sessionId: string;
      clientName: string | null;
      preview: string;
      timestamp: string;
    }
  | {
      kind: "quote.signed";
      quoteId: string;
      clientName: string | null;
      signerKind: "client" | "photographer";
      timestamp: string;
    }
  | {
      kind: "contract.signed";
      contractId: string;
      clientName: string | null;
      signerKind: "client" | "photographer";
      timestamp: string;
    }
  | {
      kind: "shot.captured";
      projectId: string;
      shotId: string;
      capturedAssetId: string | null;
      timestamp: string;
    }
  | {
      kind: "shot.completion-toggled";
      projectId: string;
      shotId: string;
      isCompleted: boolean;
      timestamp: string;
    }
  | {
      kind: "presence.joined";
      sessionId: string;
      actorUserId: string;
      displayName: string | null;
      timestamp: string;
    }
  | {
      kind: "presence.left";
      sessionId: string;
      actorUserId: string;
      timestamp: string;
    }
  | {
      kind: "asset.labels-changed";
      assetId: string;
      sessionId: string;
      actorUserId: string;
      rating: number | null;
      colorLabel: string | null;
      flaggedForClient: boolean | null;
      rejected: boolean | null;
      timestamp: string;
    }
  | { kind: "shot.list-updated"; projectId: string; timestamp: string }
  | {
      kind: "moodboard.presence";
      projectId: string;
      actorUserId: string;
      actorName: string | null;
      joined: boolean;
      timestamp: string;
    }
  | {
      kind: "video.comment-added";
      galleryId: string;
      chapterId: string | null;
      timecodeSec: number;
      commentId: string;
      clientLabel: string | null;
      category: string | null;
      priority: string | null;
      timestamp: string;
    }
  | {
      kind: "gallery.selection-submitted";
      galleryId: string;
      clientEmail: string | null;
      clientName: string | null;
      selectedCount: number;
      submissionNote: string | null;
      timestamp: string;
    }
  | {
      kind: "video-room.updated";
      projectId: string;
      reason: "version" | "comment" | "approval" | "chapters";
      timestamp: string;
    }
  | {
      kind: "sound-room.updated";
      projectId: string;
      reason: "version" | "comment" | "approval";
      timestamp: string;
    }
  | {
      kind: "mockup.review-updated";
      projectId: string;
      versionId: string | null;
      reason: "review" | "version" | "comment" | "resolution" | "decision" | "presence";
      timestamp: string;
    }
  | {
      kind: "capture.activity-recorded";
      projectId: string | null;
      sessionId: string;
      activity: {
        id: string;
        assetId: string | null;
        eventType: string;
        metadata: Record<string, unknown>;
        createdAt: string;
      };
      timestamp: string;
    }
  | {
      kind: "capture.asset-updated";
      projectId: string | null;
      sessionId: string;
      assetId: string;
      reason: "labels";
      timestamp: string;
    }
  | {
      kind: "capture.handoff-triggered";
      projectId: string | null;
      sessionId: string;
      handoffId: string;
      submittedCount: number;
      requestedCount: number;
      timestamp: string;
    }
  | {
      kind: "capture.client-review";
      projectId: string | null;
      sessionId: string;
      review: Record<string, unknown>;
      timestamp: string;
    };

export type UserEventsFrame =
  | {
      version: typeof USER_EVENTS_PROTOCOL_VERSION;
      type: "connection_established";
      serverTime: string;
    }
  | {
      version: typeof USER_EVENTS_PROTOCOL_VERSION;
      type: "user_event";
      event: UserEvent;
      serverTime: string;
    };

export interface UserEventsTicketResponse {
  ticket: string;
  expiresAt: string;
  websocketPath: string;
  protocolVersion: typeof USER_EVENTS_PROTOCOL_VERSION;
}

export function isSupportedUserEventsVersion(value: unknown): boolean {
  return value === undefined || value === USER_EVENTS_PROTOCOL_VERSION;
}
