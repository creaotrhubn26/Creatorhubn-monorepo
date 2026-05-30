/**
 * Cloudflare Stream — direct-upload + signed playback for klient-preview.
 *
 * Vi bruker Stream som primær video-pipeline for klient-preview fordi
 * den gir oss tre ting gratis som R2 ikke gjør:
 *   - Auto-transcoding til HLS (adaptive bitrate, alle skjermer)
 *   - Auto-generert posterframe (thumbnail klienten ser før play)
 *   - CDN-streaming med signed tokens (utløp = magic-link-sesjonen)
 *
 * Bjarne laster opp én h264/mov-fil. Stream returnerer en uid + URL
 * vi lagrer på posten. Klient-portalen sender HLS-manifest-URL.
 *
 * Auth: API token på `CLOUDFLARE_STREAM_API_TOKEN` med Stream:Edit-rett.
 * Account: `CLOUDFLARE_ACCOUNT_ID` (samme som R2 — ofte allerede satt).
 *
 * Hvis ingen av disse er satt, isStreamEnabled() returnerer false og
 * upload-routen faller tilbake på R2-pipelinen.
 */

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export interface CloudflareStreamConfig {
  enabled: boolean;
  accountId?: string;
  apiToken?: string;
  /** Brukes for å bygge playback-URLer: `customer-<subdomain>.cloudflarestream.com`. */
  customerSubdomain?: string;
}

export function buildStreamConfig(): CloudflareStreamConfig {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
    || process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim()
    || undefined;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim() || undefined;
  const customerSubdomain = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim()
    || undefined;
  return {
    enabled: Boolean(accountId && apiToken),
    accountId, apiToken, customerSubdomain,
  };
}

export function isStreamEnabled(): boolean {
  return buildStreamConfig().enabled;
}

export interface StreamUploadResult {
  uid: string;
  /** HLS manifest URL — det frontenden spiller av. */
  playbackUrl: string;
  /** Posterframe — vist før play. */
  thumbnailUrl: string;
  /** True når Stream er ferdig transcoded. På upload er den nesten alltid false. */
  ready: boolean;
  duration?: number;
}

/**
 * Last opp en video-buffer direkte til Cloudflare Stream via deres
 * direct-upload-endpoint (POST som multipart). For proxy-størrelse
 * (<500 MB) er dette enklere enn tus.
 */
export async function uploadToStream(
  bytes: Buffer,
  mime: string,
  meta: { projectId: string; postId: string; filename: string },
): Promise<StreamUploadResult> {
  const cfg = buildStreamConfig();
  if (!cfg.enabled) {
    throw new Error('cloudflare_stream_not_configured');
  }

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], { type: mime }), meta.filename);
  // Meta tagger vi på Stream-side — gir oss kobling tilbake hvis
  // raden i Postgres skulle forsvinne av en eller annen grunn.
  form.append('meta', JSON.stringify({
    projectId: meta.projectId,
    postId: meta.postId,
    source: 'role-room-marketing-preview',
  }));

  const res = await fetch(
    `${CF_API_BASE}/accounts/${cfg.accountId}/stream`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiToken}` },
      body: form,
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`stream_upload_failed: ${res.status} ${text}`);
  }
  const data = await res.json() as {
    success: boolean;
    result?: {
      uid: string;
      readyToStream: boolean;
      duration?: number;
      playback?: { hls?: string; dash?: string };
      thumbnail?: string;
    };
    errors?: unknown;
  };
  if (!data.success || !data.result) {
    throw new Error(`stream_upload_rejected: ${JSON.stringify(data.errors)}`);
  }
  const uid = data.result.uid;
  return {
    uid,
    playbackUrl: data.result.playback?.hls
      ?? buildPlaybackUrl(uid, cfg.customerSubdomain),
    thumbnailUrl: data.result.thumbnail
      ?? buildThumbnailUrl(uid, cfg.customerSubdomain),
    ready: data.result.readyToStream === true,
    duration: data.result.duration,
  };
}

/**
 * Poll Stream for ready-state. Brukes når frontend trenger å vite om
 * videoen kan spilles (etter upload tar transcoding noen sekunder).
 */
export async function getStreamVideoStatus(uid: string): Promise<{
  ready: boolean;
  playbackUrl: string;
  thumbnailUrl: string;
  duration?: number;
} | null> {
  const cfg = buildStreamConfig();
  if (!cfg.enabled) return null;
  const res = await fetch(
    `${CF_API_BASE}/accounts/${cfg.accountId}/stream/${uid}`,
    { headers: { Authorization: `Bearer ${cfg.apiToken}` } },
  );
  if (!res.ok) return null;
  const data = await res.json() as {
    success: boolean;
    result?: {
      readyToStream: boolean;
      duration?: number;
      playback?: { hls?: string };
      thumbnail?: string;
    };
  };
  if (!data.success || !data.result) return null;
  return {
    ready: data.result.readyToStream === true,
    playbackUrl: data.result.playback?.hls ?? buildPlaybackUrl(uid, cfg.customerSubdomain),
    thumbnailUrl: data.result.thumbnail ?? buildThumbnailUrl(uid, cfg.customerSubdomain),
    duration: data.result.duration,
  };
}

export async function deleteStreamVideo(uid: string): Promise<void> {
  const cfg = buildStreamConfig();
  if (!cfg.enabled) return;
  await fetch(
    `${CF_API_BASE}/accounts/${cfg.accountId}/stream/${uid}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cfg.apiToken}` },
    },
  ).catch(() => { /* orphan-tolerant — DB-raden er det viktige */ });
}

/**
 * Lag en signert playback-URL (kort TTL) for klient-portal-sesjoner.
 * Stream støtter signed URLs ved å POST-e til /stream/<uid>/token.
 * For MVP returnerer vi unsigned URL — bytt til signed når public
 * portal-link skal kunne deles uten å lekke video til verden.
 */
export async function signStreamPlaybackUrl(
  uid: string, _ttlSeconds: number,
): Promise<string | null> {
  const cfg = buildStreamConfig();
  if (!cfg.enabled) return null;
  // TODO: bytt til /stream/<uid>/token når Stream-videoer markeres som
  // requireSignedURLs=true. For nå er videoene satt opp som unsigned
  // (samme tilgangsmodell som magic-link).
  return buildPlaybackUrl(uid, cfg.customerSubdomain);
}

function buildPlaybackUrl(uid: string, customerSubdomain: string | undefined): string {
  if (customerSubdomain) {
    return `https://customer-${customerSubdomain}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
  }
  // Generisk videodelivery.net-iframe fungerer uten subdomain
  return `https://videodelivery.net/${uid}/manifest/video.m3u8`;
}

function buildThumbnailUrl(uid: string, customerSubdomain: string | undefined): string {
  if (customerSubdomain) {
    return `https://customer-${customerSubdomain}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`;
  }
  return `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;
}
