import { loadSettings } from "../components/SettingsModal";

export interface FeedMockupLink {
  id: string;
  workspaceProjectId: string;
  platform: "instagram" | "tiktok" | "linkedin";
  feedPostId: string;
  feedPostTitle: string | null;
  feedPostCaption: string | null;
  mockupProjectId: string;
  mockupName: string;
  mockupRevision: number;
  lastAppliedRevision: number | null;
  lastAppliedAt: string | null;
  stale: boolean;
  variantId: string;
  variantLabel: string;
  qualityStatus?: "ready" | "limited" | "failed";
  skillRuns?: Array<{
    id: string;
    version: string;
    status: "ready" | "limited" | "failed";
  }>;
  mediaType: "image" | "carousel" | "reel";
  variantActive: boolean;
  outputPosition: number;
  syncStatus: "building" | "not_sent" | "synced" | "stale" | "error";
  readyOutputCount: number;
  expectedOutputCount: number;
}

function getBaseUrl(): string {
  const settings = loadSettings();
  const base = settings.RR_POST_AGENT_BASE_URL || "https://www.creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}

function authHeaders(): Record<string, string> {
  const bearer = loadSettings().RR_BEARER_TOKEN?.trim();
  if (!bearer) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");
  return { Authorization: `Bearer ${bearer}` };
}

export class FeedMockupApplyError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FeedMockupApplyError";
  }
}

export const feedMockupLinksService = {
  async list(mockupProjectId: string): Promise<FeedMockupLink[]> {
    const params = new URLSearchParams({ mockupProjectId });
    const response = await fetch(`${getBaseUrl()}/api/role-room/feed-mockup-links?${params}`, {
      headers: authHeaders(),
    });
    const payload = await response.json().catch(() => null) as {
      links?: FeedMockupLink[];
      error?: string;
    } | null;
    if (!response.ok) throw new Error(payload?.error || `Koblingsoppslag feilet (HTTP ${response.status})`,
      );
    return Array.isArray(payload?.links) ? payload.links : [];
  },

  async applyOutput(input: {
    linkId: string;
    mediaDataUrl: string;
    fileName: string;
    mockupRevision: number;
    confirmApprovedAssetChange?: boolean;
  }): Promise<{
    changed: boolean;
    approvalState: string;
    variantComplete?: boolean;
  }> {
    const response = await fetch(
      `${getBaseUrl()}/api/role-room/feed-mockup-links/${encodeURIComponent(input.linkId)}/apply-output`,
      {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaDataUrl: input.mediaDataUrl,
          fileName: input.fileName,
          mockupRevision: input.mockupRevision,
          confirmApprovedAssetChange: input.confirmApprovedAssetChange === true,
        }),
      },
    );
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      changed?: boolean;
      approvalState?: string;
      variantComplete?: boolean;
      error?: string;
      currentRevision?: number;
    } | null;
    if (!response.ok || !payload?.ok) {
      const code = payload?.error || "apply_feil";
      const message =
        code === "approval_confirmation_required"
          ? "Posten er allerede godkjent eller planlagt og må godkjennes på nytt hvis designet endres."
          : code === "published_post_locked"
            ? "Publiserte poster kan ikke få designet erstattet."
            : code === "mockup_versjon_utdatert"
              ? `Mockupen ble oppdatert i skyen (versjon ${payload?.currentRevision ?? "nyere"}). Oppdater koblingene og prøv igjen.`
            : `Kunne ikke sende designet (${code}).`;
      throw new FeedMockupApplyError(code, response.status, message);
    }
    return {
      changed: payload.changed === true,
      approvalState: payload.approvalState || "draft",
      variantComplete: payload.variantComplete,
    };
  },
};
