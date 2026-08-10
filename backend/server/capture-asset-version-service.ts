/**
 * capture-asset-version-service.ts
 *
 * Versjonshistorikk for kameramedier.
 *
 * Kjerneregelen: en objektnøkkel skrives én gang og aldri igjen. Før
 * dette var nøkkelen deterministisk, så en ny opplasting av samme asset
 * og kind traff samme nøkkel og overskrev fila i bøtta. Godkjenninger,
 * kommentarer og checksummer pekte etterpå på bytes som ikke lenger var
 * de samme.
 *
 * Lesestiene er urørt. `capture_assets.preview_key/full_key/raw_key`
 * peker fortsatt på gjeldende versjon, så de rundt 40 stedene som
 * signerer en URL fra en bar nøkkel trenger ikke vite at versjoner
 * finnes. Denne modulen er historikken ved siden av.
 */

import type { Pool, PoolClient } from "pg";
import type { UploadKind, CaptureStoreBackend } from "./capture-upload-service.js";

export type VersionStatus = "uploading" | "ready" | "released";

export interface AssetVersion {
  id: string;
  assetId: string;
  kind: UploadKind;
  versionNumber: number;
  objectKey: string;
  bucket: string;
  backend: CaptureStoreBackend;
  sizeBytes: number | null;
  checksumSha256: string | null;
  contentType: string | null;
  status: VersionStatus;
  uploadedBy: string | null;
  createdAt: string;
  readyAt: string | null;
  supersededAt: string | null;
  releasedAt: string | null;
}

function mapRow(row: Record<string, unknown>): AssetVersion {
  const iso = (v: unknown): string | null =>
    v instanceof Date ? v.toISOString() : v == null ? null : String(v);
  return {
    id: String(row.id),
    assetId: String(row.asset_id),
    kind: row.kind as UploadKind,
    versionNumber: Number(row.version_number),
    objectKey: String(row.object_key),
    bucket: String(row.bucket),
    backend: row.backend as CaptureStoreBackend,
    sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
    checksumSha256: row.checksum_sha256 == null ? null : String(row.checksum_sha256),
    contentType: row.content_type == null ? null : String(row.content_type),
    status: row.status as VersionStatus,
    uploadedBy: row.uploaded_by == null ? null : String(row.uploaded_by),
    createdAt: iso(row.created_at) ?? "",
    readyAt: iso(row.ready_at),
    supersededAt: iso(row.superseded_at),
    releasedAt: iso(row.released_at),
  };
}

/**
 * Bygg versjonsleddet i en objektnøkkel.
 *
 * Ligger her, ikke i nøkkelbyggeren, fordi det er dette leddet som gjør
 * nøkkelen unik per versjon. Endres formatet, endres det ett sted.
 */
export function versionSegment(versionNumber: number): string {
  return `v${versionNumber}/`;
}

export interface ReserveInput {
  assetId: string;
  kind: UploadKind;
  bucket: string;
  backend: CaptureStoreBackend;
  contentType?: string | null;
  uploadedBy?: string | null;
  /**
   * Bygger nøkkelen når versjonsnummeret er kjent. Nummeret må inn i
   * nøkkelen — uten det ville to versjoner delt objekt, og hele poenget
   * med tabellen falt bort.
   */
  buildKey: (versionNumber: number) => string;
}

/** Hvor mange ganger vi prøver på nytt når to opplastinger kolliderer. */
const RESERVE_MAX_ATTEMPTS = 5;

/**
 * Reserver neste versjonsnummer og opprett raden.
 *
 * Skjer ved START av opplastingen, ikke ved slutten: nummeret trengs for
 * å bygge nøkkelen, og det må være reservert før en samtidig opplasting
 * kan få det samme.
 *
 * To samtidige opplastinger av samme asset og kind vil begge lese samme
 * MAX(version_number). Unik-indeksen fanger den ene, og den prøver på
 * nytt med neste ledige nummer. Uten den ville begge skrevet til samme
 * objektnøkkel — nøyaktig overskrivingen dette skal fjerne.
 */
export async function reserveVersion(
  pool: Pool,
  input: ReserveInput,
): Promise<AssetVersion> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < RESERVE_MAX_ATTEMPTS; attempt += 1) {
    const next = await pool.query<{ next: string }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next
         FROM capture_asset_versions
        WHERE asset_id = $1 AND kind = $2`,
      [input.assetId, input.kind],
    );
    const versionNumber = Number(next.rows[0]?.next ?? 1);

    try {
      const r = await pool.query(
        `INSERT INTO capture_asset_versions
           (asset_id, kind, version_number, object_key, bucket, backend,
            content_type, uploaded_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploading')
         RETURNING *`,
        [
          input.assetId,
          input.kind,
          versionNumber,
          input.buildKey(versionNumber),
          input.bucket,
          input.backend,
          input.contentType ?? null,
          input.uploadedBy ?? null,
        ],
      );
      return mapRow(r.rows[0]);
    } catch (err) {
      // 23505 = unique_violation. Noen andre tok nummeret mellom
      // oppslaget og innsettingen. Alt annet er en ekte feil.
      if ((err as { code?: string })?.code !== "23505") throw err;
      lastError = err;
    }
  }

  throw new Error(
    `Kunne ikke reservere versjonsnummer for ${input.assetId}/${input.kind} ` +
      `etter ${RESERVE_MAX_ATTEMPTS} forsøk: ${String(lastError)}`,
  );
}

export interface PromoteInput {
  versionId: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  /**
   * Nøkkelen klienten sier den lastet opp til.
   *
   * Sjekkes mot den reserverte nøkkelen. Uten den sjekken kunne en klient
   * laste opp til én nøkkel og be oss promotere en annen versjon: bytene
   * havnet ett sted, og asset-raden pekte et annet. Avvik er enten en
   * klientfeil eller et forsøk — begge skal stoppes, ikke gjettes på.
   */
  expectedObjectKey?: string | null;
}

/**
 * Marker en versjon ferdig og gjør den til gjeldende.
 *
 * Tre ting i én transaksjon, fordi mellomtilstandene er farlige:
 *
 *   1. Versjonen blir 'ready'.
 *   2. Alle tidligere ready-versjoner av samme kind blir avløst.
 *   3. capture_assets.{kind}_key peker på den nye nøkkelen.
 *
 * Skjedde 3 uten 1, ville asset-raden pekt på en fil vi ikke vet er
 * ferdig opplastet. Skjedde 1 uten 3, ville en fullført opplasting vært
 * usynlig for alle lesestiene.
 *
 * Returnerer null hvis versjonen ikke finnes eller allerede er frigjort.
 */
export async function promoteVersion(
  pool: Pool,
  input: PromoteInput,
): Promise<AssetVersion | null> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    const found = await client.query(
      `SELECT * FROM capture_asset_versions
        WHERE id = $1 AND status <> 'released'
        FOR UPDATE`,
      [input.versionId],
    );
    if (found.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    const row = found.rows[0];
    const assetId = String(row.asset_id);
    const kind = String(row.kind) as UploadKind;

    if (
      input.expectedObjectKey != null &&
      input.expectedObjectKey !== String(row.object_key)
    ) {
      await client.query("ROLLBACK");
      return null;
    }

    // Avløs de foregående. Bare 'ready' — en 'uploading'-rad er en
    // parallell opplasting som ennå ikke har vunnet, og å avløse den
    // ville satt superseded_at på noe som aldri ble gjeldende.
    await client.query(
      `UPDATE capture_asset_versions
          SET superseded_at = now()
        WHERE asset_id = $1 AND kind = $2 AND id <> $3
          AND status = 'ready' AND superseded_at IS NULL`,
      [assetId, kind, input.versionId],
    );

    const updated = await client.query(
      `UPDATE capture_asset_versions
          SET status = 'ready',
              ready_at = now(),
              size_bytes = $2,
              checksum_sha256 = COALESCE($3, checksum_sha256),
              superseded_at = NULL
        WHERE id = $1
        RETURNING *`,
      [input.versionId, Math.max(0, Math.trunc(input.sizeBytes)), input.checksumSha256 ?? null],
    );

    // Kolonnenavnet kommer fra en fast liste, aldri fra input — kind er
    // allerede begrenset av CHECK-en i skjemaet, men en streng som går
    // rett inn i SQL fortjener ikke tilliten uansett.
    const keyColumn = { preview: "preview_key", full: "full_key", raw: "raw_key" }[kind];
    if (keyColumn) {
      await client.query(
        `UPDATE capture_assets
            SET ${keyColumn} = $2, updated_at = now()
          WHERE id = $1`,
        [assetId, String(row.object_key)],
      );
    }

    await client.query("COMMIT");
    return mapRow(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Fjern reservasjonen når en opplasting avbrytes. */
export async function discardVersion(pool: Pool, versionId: string): Promise<boolean> {
  // Bare 'uploading' slettes. En 'ready'-versjon er en fil noen kan ha
  // godkjent; den frigjøres, den forsvinner ikke.
  const r = await pool.query(
    `DELETE FROM capture_asset_versions
      WHERE id = $1 AND status = 'uploading'`,
    [versionId],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Alle versjoner av et asset, nyeste først. */
export async function listVersions(
  pool: Pool,
  assetId: string,
  kind?: UploadKind,
): Promise<AssetVersion[]> {
  const r = await pool.query(
    `SELECT * FROM capture_asset_versions
      WHERE asset_id = $1 AND ($2::text IS NULL OR kind = $2)
      ORDER BY kind, version_number DESC`,
    [assetId, kind ?? null],
  );
  return r.rows.map(mapRow);
}

/** Gjeldende versjon av en kind, eller null. */
export async function currentVersion(
  pool: Pool,
  assetId: string,
  kind: UploadKind,
): Promise<AssetVersion | null> {
  const r = await pool.query(
    `SELECT * FROM capture_asset_versions
      WHERE asset_id = $1 AND kind = $2 AND status = 'ready'
        AND superseded_at IS NULL
      ORDER BY version_number DESC
      LIMIT 1`,
    [assetId, kind],
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

/** Slå opp en versjon fra objektnøkkelen. */
export async function versionForKey(
  pool: Pool,
  objectKey: string,
): Promise<AssetVersion | null> {
  const r = await pool.query(
    `SELECT * FROM capture_asset_versions WHERE object_key = $1 LIMIT 1`,
    [objectKey],
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

/**
 * Versjoner som er trygge å frigjøre: avløste, men fortsatt i bøtta.
 *
 * Gjeldende versjon er aldri med. Den er hva asset-raden peker på, og å
 * frigjøre den ville etterlatt en signert URL mot et objekt som ikke
 * finnes.
 */
export async function supersededVersions(
  pool: Pool,
  opts: { olderThanDays: number; limit?: number },
): Promise<AssetVersion[]> {
  const r = await pool.query(
    `SELECT * FROM capture_asset_versions
      WHERE status = 'ready'
        AND superseded_at IS NOT NULL
        AND superseded_at < now() - ($1 || ' days')::interval
      ORDER BY superseded_at
      LIMIT $2`,
    [String(Math.max(0, Math.trunc(opts.olderThanDays))), opts.limit ?? 100],
  );
  return r.rows.map(mapRow);
}

/** Marker en versjon frigjort etter at objektet faktisk er slettet. */
export async function markVersionReleased(
  pool: Pool,
  versionId: string,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE capture_asset_versions
        SET status = 'released', released_at = now()
      WHERE id = $1 AND status <> 'released'`,
    [versionId],
  );
  return (r.rowCount ?? 0) > 0;
}
