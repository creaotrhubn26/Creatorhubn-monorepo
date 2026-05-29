/**
 * feedPlanThumbnailService — pusher en lokal PNG-thumbnail tilbake til
 * en spesifikk feed-plan-post som customImageUrl. Bruker Tauri FS for
 * å lese filen som bytes, konverterer til base64 data: URL.
 *
 * Backend cap: 2 MB. PNG-er over dette må enten ned-skaleres eller
 * sendes som JPEG-q82 (allerede dekt av PIL i de fleste tilfeller).
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

function bytesToBase64(bytes: Uint8Array): string {
  // Chunk for å unngå stack-overflow på store filer
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function readFileViaTauriProtocol(absolutePath: string): Promise<Uint8Array> {
  // convertFileSrc gir tauri://-URL som vi kan fetche som blob
  const url = convertFileSrc(absolutePath);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kunne ikke lese fil: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export interface UploadThumbnailParams {
  projectId: string;
  platform: string;
  postId: string;
  /** Absolutt filsti til PNG på disk. */
  filePath: string;
  /** Visnings-navn (for "valgt design"-tooltip). */
  fileName?: string;
  /** Hvilken layout-template generatoren valgte. */
  sourceLayout?: string;
  /** Hvilket sekund-merke fra source-video framet kom fra. */
  sourceFrameSec?: number;
}

export interface UploadThumbnailResult {
  ok: boolean;
  postId: string;
  customImageName: string | null;
}

export const feedPlanThumbnailService = {
  async upload(p: UploadThumbnailParams): Promise<UploadThumbnailResult> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");

    const bytes = await readFileViaTauriProtocol(p.filePath);
    const base64 = bytesToBase64(bytes);
    const dataUrl = `data:image/png;base64,${base64}`;

    const sizeMB = bytes.byteLength / (1024 * 1024);
    if (sizeMB > 1.9) {
      throw new Error(
        `Thumbnail er ${sizeMB.toFixed(1)} MB — backend caps på 2 MB. ` +
        `Reduser oppløsning eller bytt til JPEG-q82.`,
      );
    }

    const url = `${getBaseUrl()}/api/role-room/feed-plan/`
      + `${encodeURIComponent(p.projectId)}/`
      + `${encodeURIComponent(p.platform)}/`
      + `post/${encodeURIComponent(p.postId)}/thumbnail`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageDataUrl: dataUrl,
        fileName: p.fileName ?? null,
        sourceLayout: p.sourceLayout ?? null,
        sourceFrameSec: p.sourceFrameSec ?? null,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`thumbnail-upload: HTTP ${res.status} ${detail}`.trim());
    }
    return (await res.json()) as UploadThumbnailResult;
  },
};
