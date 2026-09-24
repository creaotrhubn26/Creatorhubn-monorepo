/**
 * Delt øyeblikksbilde av Fastlegeregisteret.
 *
 * Problemet dette løser er målt, ikke antatt: NHNs produksjonsendepunkt
 * bruker 13–15 sekunder på å generere 23,5 MB og har selv en gateway-timeout
 * på 15. Et kaldt kall gir 504 omtrent like ofte som 200. Hver
 * Discovery-kjøring som henter registeret på nytt stiller seg i det
 * kappløpet, og taper av og til.
 *
 * Registeret endrer seg i døgn. Så vi henter det én gang, deler det, og lar
 * kjøringene lese fra en rad i stedet for fra en tidsbegrenset HTTP-strøm.
 *
 * To nivåer, med vilje:
 *
 *   fersk   (< TTL)  serveres rett fra basen, null nettverk
 *   utløpt  (> TTL)  forsøkes hentet på nytt — men hvis NHN ikke svarer,
 *                    serveres det gamle videre
 *
 * Det andre nivået er poenget. En uke gammel legekontoradresse er fortsatt
 * riktig adresse. En feilet kjøring er ingenting.
 */
import type { Pool, PoolClient } from "pg";

/** Hvor lenge et øyeblikksbilde regnes som ferskt. */
export const SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1_000;

/**
 * Hvor gammelt et øyeblikksbilde kan bli før vi heller feiler enn å lyve.
 *
 * Sju døgn er valgt fordi det er lengre enn enhver rimelig NHN-nedetid, og
 * kortere enn tiden det tar før et legekontor har rukket å flytte.
 */
export const SNAPSHOT_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1_000;

export type FlrEnvironmentName = "test" | "production";

export interface FlrSnapshot {
  payload: unknown;
  contractCount: number;
  sourceUri: string;
  fetchedAt: Date;
  expiresAt: Date;
}

export interface FlrSnapshotStore {
  read(environment: FlrEnvironmentName): Promise<FlrSnapshot | null>;
  write(environment: FlrEnvironmentName, snapshot: Omit<FlrSnapshot, "expiresAt"> & { expiresAt: Date }): Promise<void>;
  /**
   * Kjører `arbeid` med en lås som er delt på tvers av prosesser.
   *
   * Uten den ville to kjøringer som starter samtidig begge hentet 23,5 MB og
   * begge stilt seg i kappløpet. Med den henter én, og den andre leser
   * resultatet.
   */
  withFetchLock<T>(environment: FlrEnvironmentName, arbeid: () => Promise<T>): Promise<T>;
}

/** Stabil nøkkel for advisory-låsen. Vilkårlig tall, men det må være det samme overalt. */
const LOCK_NAMESPACE = 0x1f7c_0001;

function lockKey(environment: FlrEnvironmentName): number {
  return environment === "production" ? LOCK_NAMESPACE : LOCK_NAMESPACE + 1;
}

export function createFlrSnapshotStore(pool: Pool): FlrSnapshotStore {
  return {
    async read(environment) {
      const rader = await pool.query<{
        payload: unknown;
        contract_count: number;
        source_uri: string;
        fetched_at: Date;
        expires_at: Date;
      }>(
        `SELECT payload, contract_count, source_uri, fetched_at, expires_at
           FROM leadgrid_flr_snapshot WHERE environment = $1`,
        [environment],
      );
      const rad = rader.rows[0];
      if (!rad) return null;
      return {
        payload: rad.payload,
        contractCount: rad.contract_count,
        sourceUri: rad.source_uri,
        fetchedAt: rad.fetched_at,
        expiresAt: rad.expires_at,
      };
    },

    async write(environment, snapshot) {
      await pool.query(
        `INSERT INTO leadgrid_flr_snapshot (
           environment, payload, contract_count, source_uri, fetched_at, expires_at
         ) VALUES ($1, $2::jsonb, $3, $4, $5, $6)
         ON CONFLICT (environment) DO UPDATE SET
           payload = EXCLUDED.payload,
           contract_count = EXCLUDED.contract_count,
           source_uri = EXCLUDED.source_uri,
           fetched_at = EXCLUDED.fetched_at,
           expires_at = EXCLUDED.expires_at`,
        [
          environment,
          JSON.stringify(snapshot.payload),
          snapshot.contractCount,
          snapshot.sourceUri,
          snapshot.fetchedAt,
          snapshot.expiresAt,
        ],
      );
    },

    async withFetchLock(environment, arbeid) {
      let klient: PoolClient;
      try {
        klient = await pool.connect();
      } catch {
        // Får vi ikke tilkobling, er låsen det minste problemet. Kjør uten.
        return arbeid();
      }
      try {
        await klient.query("SELECT pg_advisory_lock($1)", [lockKey(environment)]);
        return await arbeid();
      } finally {
        await klient
          .query("SELECT pg_advisory_unlock($1)", [lockKey(environment)])
          .catch(() => undefined);
        klient.release();
      }
    },
  };
}

export type SnapshotFreshness = "fersk" | "utløpt" | "for_gammel";

/** Hvor brukbart et øyeblikksbilde er akkurat nå. */
export function freshness(snapshot: FlrSnapshot, now: Date): SnapshotFreshness {
  if (snapshot.expiresAt > now) return "fersk";
  const alder = now.valueOf() - snapshot.fetchedAt.valueOf();
  return alder <= SNAPSHOT_MAX_STALE_MS ? "utløpt" : "for_gammel";
}

/** Alder i hele timer, til logging og til notisen kunden ser. */
export function ageHours(snapshot: FlrSnapshot, now: Date): number {
  return Math.floor((now.valueOf() - snapshot.fetchedAt.valueOf()) / 3_600_000);
}
