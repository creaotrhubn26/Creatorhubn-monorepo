/**
 * upcomingJobsService — fetcher kommende feed-plan-jobs fra Role Room.
 * Project-type-agnostisk: returnerer jobs på tvers av alle prosjekter
 * brukeren har tilgang til, uansett kind (bryllup, corporate, music,
 * content-producer-leveranser, etc.).
 */

import { loadSettings } from "../components/SettingsModal";

export interface UpcomingJob {
  postId: string;
  platform: string;
  scheduledFor: string | null;
  title: string;
  caption: string;
  callToAction: string;
  hashtags: string[];
  mediaType: string | null;
  imageStyle: string | null;
  approvalState: string | null;
  customImageUrl: string | null;
  projectId: string;
  projectName: string;
  projectKind: string | null;
  brandSnapshot: {
    companyName?: string | null;
    accentColor?: string | null;
    backgroundColor?: string | null;
    textColor?: string | null;
    logoUrl?: string | null;
    toneOfVoice?: string | null;
    industry?: string | null;
  } | null;
  daysUntilDeadline: number | null;
  hoursUntilDeadline: number | null;
}

export interface UpcomingJobsResponse {
  jobs: UpcomingJob[];
  projects: number;
  scannedDays: number;
  totalJobs: number;
  overdueCount: number;
}

function getBaseUrl(): string {
  const s = loadSettings();
  // Bytt /api/post-agent til root for Role Room-endepunkter
  const base = s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}

function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

export const upcomingJobsService = {
  async getUpcoming(opts?: {
    days?: number;
    maxPerProject?: number;
    includeOverdue?: boolean;
  }): Promise<UpcomingJobsResponse> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");

    const u = new URLSearchParams();
    if (opts?.days != null) u.set("days", String(opts.days));
    if (opts?.maxPerProject != null) u.set("maxPerProject", String(opts.maxPerProject));
    if (opts?.includeOverdue != null) u.set("includeOverdue", String(opts.includeOverdue));

    const url = `${getBaseUrl()}/api/role-room/feed-plan/upcoming-jobs?${u.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`upcoming-jobs: HTTP ${res.status} ${detail}`.trim());
    }
    return (await res.json()) as UpcomingJobsResponse;
  },
};
