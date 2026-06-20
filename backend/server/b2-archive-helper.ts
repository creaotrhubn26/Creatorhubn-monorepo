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

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// NB: the-role-room-prod-bøtta ligger i eu-central-003 (verifisert via B2
// b2_authorize_account 2026-06-08). Defaulten var feil (us-west-001) → all
// role-room-B2-lesing/-skriving feilet stille i prod. B2_REGION er nå satt på
// Render, men defaulten her må også være riktig så koden er korrekt uten env.
const B2_REGION = process.env.B2_REGION || "eu-central-003";
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
 * Hent et objekt fra Role Room B2-bucketen (server-side). Brukes til å servere
 * publiserte guider via vår egen /g/:id — så lenken er permanent uten at
 * bucketen må være offentlig. Returnerer null hvis ikke konfigurert/ikke funnet.
 */
export async function getFromRoleRoomB2(
  key: string,
): Promise<{ body: Buffer; contentType?: string } | null> {
  const config = getRoleRoomB2Client();
  if (!config) return null;
  try {
    const out = await config.client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    const bytes = await (out.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined)
      ?.transformToByteArray?.();
    if (!bytes) return null;
    return { body: Buffer.from(bytes), contentType: out.ContentType };
  } catch {
    return null;
  }
}

/**
 * Lag en tidsbegrenset (presigned) GET-URL for et objekt i Role Room-bøtta.
 * Brukes til gated nedlasting av Post Agent-appen: backend sjekker entitlement,
 * og redirecter så til denne URL-en — bøtta forblir privat, men brukeren får
 * laste direkte fra B2 (ingen båndbredde gjennom Node).
 *
 * `downloadFilename` setter Content-Disposition slik at fila lagres med riktig
 * navn uansett key-struktur. Returnerer null hvis B2 ikke er konfigurert.
 */
export async function presignRoleRoomB2Download(
  key: string,
  downloadFilename?: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  const config = getRoleRoomB2Client();
  if (!config) return null;
  try {
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ...(downloadFilename
        ? { ResponseContentDisposition: `attachment; filename="${downloadFilename}"` }
        : {}),
    });
    return await getSignedUrl(config.client, command, { expiresIn: expiresInSeconds });
  } catch (err) {
    console.warn("[b2-archive] presign failed", { key, err: (err as Error).message });
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
 * F.eks. `business-plans/role_room/snapshots/2026-06-05T15-23-snapshot.json`
 * eller `business-plans/leadgrid/snapshots/...` etter mig 0335 (multi-produkt).
 *
 * @param productKey 'role_room' (default for bakoverkompatibilitet) eller 'leadgrid'.
 */
export function businessPlanSnapshotKey(productKey: "role_room" | "leadgrid" = "role_room"): string {
  const now = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "T");
  const stamp = now.slice(0, 19); // YYYY-MM-DDTHH-MM-SS
  return `business-plans/${productKey}/snapshots/${stamp}-snapshot.json`;
}
