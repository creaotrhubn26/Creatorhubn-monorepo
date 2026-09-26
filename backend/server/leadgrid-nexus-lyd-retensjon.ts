/**
 * leadgrid-nexus-lyd-retensjon.ts
 *
 * Sletter rå lyd og video fra Nexus når fristen er ute.
 *
 * docs/leadgrid-gdpr-lydopptak.md §5:
 *
 *   «Rå lyd slettes automatisk etter 90 dager (konfigurerbart per org, aldri
 *    lenger enn 12 mnd). Sletterutine: cron-jobb + logg av hva som ble
 *    slettet når (etterprøvbarhet).»
 *
 * To ting kreves, og bare det ene er sletting. Uten loggen kan vi ikke
 * dokumentere etterlevelse, og da er sletting like ubevisbar som ingen
 * sletting.
 *
 * Transkripsjonen består. Den er tekst, ligger i notatet, og er det eneste
 * som står igjen av møtet — som er hele meningen med at lyden forsvinner.
 */
import type { Pool } from "pg";
import { getLeadgridObjectStorage } from "./leadgrid-s3-storage-service.js";

/** Standard når org-en ikke har valgt selv. */
export const STANDARD_FRIST_DAGER = 90;
/** Taket dokumentet setter. En org kan ikke velge seg bort fra sletting. */
export const MAKS_FRIST_DAGER = 365;

export function gyldigFrist(valgt: number | null | undefined): number {
  if (valgt == null || !Number.isFinite(valgt)) return STANDARD_FRIST_DAGER;
  return Math.min(MAKS_FRIST_DAGER, Math.max(1, Math.floor(valgt)));
}

export interface RetensjonResultat {
  slettet: number;
  bytes: number;
  feilet: number;
}

/**
 * Sletter alt som har passert fristen sin.
 *
 * Rekkefølgen er med vilje: bytes først, så raden, så loggen. Feiler
 * lagringssletting, står raden igjen og prøves på nytt neste kjøring —
 * en rad uten bytes er et lite problem, bytes uten rad er et GDPR-brudd
 * vi ikke lenger vet om.
 */
export async function slettUtloptNexusLyd(
  pool: Pool,
  now: Date = new Date(),
): Promise<RetensjonResultat> {
  const ut: RetensjonResultat = { slettet: 0, bytes: 0, feilet: 0 };
  const forfalt = await pool.query<{
    id: string; notat_id: string | null; organization_id: string;
    slag: string; size_bytes: string | null; created_at: Date | null;
    storage_object_id: string | null; storage_key: string | null;
  }>(
    `SELECT id, notat_id::text, organization_id, slag, size_bytes::text,
            created_at, storage_object_id::text, storage_key
       FROM leadgrid_canvas_dokumenter
      WHERE slettes_etter IS NOT NULL
        AND slettes_etter <= $1::timestamptz
      ORDER BY slettes_etter ASC
      LIMIT 500`,
    [now.toISOString()],
  );

  const storage = getLeadgridObjectStorage();
  for (const rad of forfalt.rows) {
    try {
      if (storage && rad.storage_key) {
        await storage.deleteObject(rad.storage_key);
      }
      await pool.query(
        `DELETE FROM leadgrid_canvas_dokumenter WHERE id = $1`, [rad.id]);
      await pool.query(
        `INSERT INTO leadgrid_nexus_sletting_logg
           (dok_id, notat_id, organization_id, slag, storrelse_bytes,
            opprettet_at, grunn)
         VALUES ($1, $2::uuid, $3, $4, $5, $6, $7)`,
        [rad.id, rad.notat_id, rad.organization_id, rad.slag,
         rad.size_bytes ? Number(rad.size_bytes) : null,
         rad.created_at, "slettefrist"],
      );
      ut.slettet += 1;
      ut.bytes += Number(rad.size_bytes) || 0;
    } catch (error) {
      // Én rad som feiler skal ikke stoppe resten. Den prøves igjen neste
      // kjøring, og fristen har ikke løpt fra oss ennå.
      ut.feilet += 1;
      console.warn("[nexus-retensjon] kunne ikke slette", rad.id,
                   (error as Error).message);
    }
  }
  return ut;
}
