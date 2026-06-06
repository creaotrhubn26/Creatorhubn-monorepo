/**
 * b2-archive-helper.ts
 *
 * Fire-and-forget upload til The Role Room sin B2-bucket (`the-role-room-prod`)
 * fra backend-routes. Brukes av newsletter-, funding-, deck-, og business-plan-
 * flowene for automatisk arkivering når dokumenter genereres/sendes.
 *
 * Designprinsipper:
 *   - Aldri kast feil til kaller — arkivering må ALDRI hindre den faktiske
 *     forretnings-handlingen (e-post-send, status-endring). Logges + tellesilent.
 *   - Lat S3-klient-konstruksjon (per call) så env-vars som settes etter boot
 *     fortsatt funker uten redeploy.
 *   - Følger mappestruktur godkjent 2026-06-05 (se project_b2_bucket_config.md).
 *
 * Hierarki i bucket:
 *   newsletters/issues/YYYY-MM/{issueId}.{html|json|meta.json}
 *   funding-apps/{scheme}/{appId}-{slug}-{status}.{pdf|html|json}
 *   decks/{deckId}-{slug}/{slides/*.html|meta.json|full.pdf}
 *   business-plans/snapshots/{isoDate}-snapshot.json
 *   casting-call-posters/{projectId}/{roleId}-{variant}.png
 *   marketing-reports/{type}/{date}.json
 *   ad-hoc/{filename}   (manuelle uploads fra B2-arkiv-fanen)
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const B2_REGION = process.env.B2_REGION || "us-west-001";
const B2_ENDPOINT = `https://s3.${B2_REGION}.backblazeb2.com`;

function getRoleRoomB2Client(): { client: S3Client; bucket: string } | null {
  const keyId = process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID;
  const appKey = process.env.B2_ROLE_ROOM_APPLICATION_KEY;
  const bucket = process.env.B2_ROLE_ROOM_BUCKET_NAME;
  if (!keyId || !appKey || !bucket) return null;

  const client = new S3Client({
    region: B2_REGION,
    endpoint: B2_ENDPOINT,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
    forcePathStyle: true,
  });
  return { client, bucket };
}

/**
 * Sanitize en streng til trygg bruk i B2-key (path-segment).
 * B2 tillater nesten alt, men vi normaliserer for å unngå rare URL-er.
 */
export function slugifyForKey(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[æå]/g, "a")
    .replace(/[ø]/g, "o")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Upload byte-buffer til Role Room B2-bucketen. Returnerer info om hva
 * som ble lastet opp, eller null hvis bucket ikke er konfigurert (logges
 * stille — produksjon uten B2-env kjører som vanlig).
 *
 * Designet for fire-and-forget bruk:
 *   void archiveToRoleRoomB2(...).catch(err => console.warn(...))
 */
export async function archiveToRoleRoomB2(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
): Promise<{ bucket: string; key: string; size: number } | null> {
  const config = getRoleRoomB2Client();
  if (!config) {
    console.warn(
      "[b2-archive] Skipping upload — B2_ROLE_ROOM_* env-vars ikke satt. " +
        `Ville skrevet til key=${key}`,
    );
    return null;
  }

  const buf = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);

  try {
    await config.client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buf,
        ContentType: contentType,
      }),
    );
    return { bucket: config.bucket, key, size: buf.length };
  } catch (err) {
    console.warn("[b2-archive] upload failed", {
      key,
      err: (err as Error).message,
    });
    return null;
  }
}

/**
 * Bygg key for newsletter-issue-arkivering.
 * F.eks. `newsletters/issues/2026-06/{issueId}.html`
 */
export function newsletterIssueKey(issueId: string, suffix: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `newsletters/issues/${yyyy}-${mm}/${issueId}.${suffix}`;
}

/**
 * Bygg key for funding-app-arkivering.
 * F.eks. `funding-apps/innovasjon-norge/{appId}-{slug}-{status}.html`
 */
export function fundingAppKey(
  scheme: string,
  appId: string,
  slug: string,
  status: string,
  suffix: string,
): string {
  const safeScheme = slugifyForKey(scheme) || "ukjent-scheme";
  const safeSlug = slugifyForKey(slug);
  const safeStatus = slugifyForKey(status) || "draft";
  return `funding-apps/${safeScheme}/${appId}-${safeSlug}-${safeStatus}.${suffix}`;
}

/**
 * Bygg key for deck-arkivering.
 * F.eks. `decks/{deckId}-{slug}/full.pdf`
 */
export function deckKey(deckId: string, slug: string, suffix: string): string {
  const safeSlug = slugifyForKey(slug);
  return `decks/${deckId}-${safeSlug}/${suffix}`;
}

/**
 * Bygg key for business-plan-snapshot.
 * F.eks. `business-plans/snapshots/2026-06-05T15-23-snapshot.json`
 */
export function businessPlanSnapshotKey(): string {
  const now = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "T");
  const stamp = now.slice(0, 19); // YYYY-MM-DDTHH-MM-SS
  return `business-plans/snapshots/${stamp}-snapshot.json`;
}
