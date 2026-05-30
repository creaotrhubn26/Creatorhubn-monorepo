/**
 * marketingPreviewVideoService — Bjarne laster opp en proxy-rendret
 * fra timelinen til en spesifikk marketing-plan-post.
 *
 * Pipeline (backend velger automatisk):
 *   - Cloudflare Stream (primær): HLS, adaptive bitrate, posterframe
 *   - R2 (fallback): rå mp4 + signed URL
 *
 * Backend-endepunkter:
 *   GET    /api/role-room/marketing-preview/posts?projectId=...
 *   POST   /api/role-room/marketing-plan-posts/:postId/preview-video
 *   GET    /api/role-room/marketing-plan-posts/:postId/preview-video/status
 *   DELETE /api/role-room/marketing-plan-posts/:postId/preview-video
 *
 * Filer leses via Tauri's convertFileSrc → fetch til Uint8Array.
 * Proxy-renders bør være under 500 MB (multer-cap).
 */

import { convertFileSrc } from "@tauri-apps/api/core";
import { loadSettings } from "../components/SettingsModal";

function getBaseUrl(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}

function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

export interface MarketingPreviewPost {
  id: string;
  dayOffset: number | null;
  hook: string;
  format: string;
  status: string;
  previewStreamUid: string | null;
  previewStreamReady: boolean;
  previewUploadedAt: string | null;
  hasPreview: boolean;
}

export type PreviewUploadResult =
  | {
      ok: true;
      pipeline: "cloudflare-stream";
      postId: string;
      streamUid: string;
      playbackUrl: string;
      thumbnailUrl: string;
      ready: boolean;
      duration?: number;
    }
  | {
      ok: true;
      pipeline: "r2";
      postId: string;
      previewVideoUrl: string;
      bytes: number;
    };

export interface PreviewStatusResult {
  ready: boolean;
  hasStream: boolean;
  playbackUrl?: string | null;
  thumbnailUrl?: string | null;
}

async function readFileAsBlob(absolutePath: string, mime: string): Promise<Blob> {
  const url = convertFileSrc(absolutePath);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kunne ikke lese fil: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Blob([buf], { type: mime });
}

function guessMime(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "mp4": return "video/mp4";
    case "mov": return "video/quicktime";
    case "webm": return "video/webm";
    case "mkv": return "video/x-matroska";
    default: return "video/mp4";
  }
}

export const marketingPreviewVideoService = {
  async listPosts(projectId: string): Promise<MarketingPreviewPost[]> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");
    const u = new URL(`${getBaseUrl()}/api/role-room/marketing-preview/posts`);
    u.searchParams.set("projectId", projectId);
    const res = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`list-posts: HTTP ${res.status}`);
    const data = await res.json() as { posts: MarketingPreviewPost[] };
    return data.posts;
  },

  async uploadFromFile(args: {
    postId: string;
    filePath: string;
    onProgress?: (bytes: number, total: number) => void;
  }): Promise<PreviewUploadResult> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");

    const mime = guessMime(args.filePath);
    const blob = await readFileAsBlob(args.filePath, mime);

    if (blob.size > 500 * 1024 * 1024) {
      throw new Error(
        `Fil er ${(blob.size / 1024 / 1024).toFixed(0)} MB — backend caps på 500 MB. ` +
        `Eksporter en lavere oppløsning eller H.264 i 720p.`,
      );
    }

    const filename = args.filePath.split(/[/\\]/).pop() || "preview.mp4";
    const form = new FormData();
    form.append("video", blob, filename);

    const url = `${getBaseUrl()}/api/role-room/marketing-plan-posts/`
      + `${encodeURIComponent(args.postId)}/preview-video`;

    // fetch støtter ikke progress på upload. For MVP rapporterer vi
    // 0% → 100% ved start/stop. Bytte til XHR hvis vi vil ha ekte progress.
    args.onProgress?.(0, blob.size);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}` },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`preview-upload: HTTP ${res.status} ${detail}`.trim());
    }
    args.onProgress?.(blob.size, blob.size);
    return (await res.json()) as PreviewUploadResult;
  },

  async pollStatus(postId: string): Promise<PreviewStatusResult> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const url = `${getBaseUrl()}/api/role-room/marketing-plan-posts/`
      + `${encodeURIComponent(postId)}/preview-video/status`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`status: HTTP ${res.status}`);
    return (await res.json()) as PreviewStatusResult;
  },

  async deletePreview(postId: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const url = `${getBaseUrl()}/api/role-room/marketing-plan-posts/`
      + `${encodeURIComponent(postId)}/preview-video`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`delete: HTTP ${res.status}`);
  },
};
