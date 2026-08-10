/**
 * storage-egress-service.ts
 *
 * Måler hvor mye som hentes ut, ikke bare hvor mye som ligger lagret.
 *
 * Hvorfor det trengs: B2 gir gratis egress opp til 3x lagret mengde per
 * måned. En produksjon som laster ned dailies daglig passerer den
 * grensen lenge før en som bare arkiverer, og fra da av koster kunden
 * mer enn lagringstallet tilsier. Uten måling ser de to like ut i
 * regnskapet.
 *
 * OM PRESISJON — les dette før tallet brukes til noe:
 *
 * Nedlastingene går rett fra objektlageret til klienten via en signert
 * URL. Vi ser aldri bytene passere. Det vi kan registrere er at vi
 * utstedte en URL for et objekt av kjent størrelse. Det er et ESTIMAT:
 * det overestimerer når en signert URL aldri blir brukt, og
 * underestimerer når den brukes flere ganger innenfor TTL-en.
 *
 * Leverandørens fakturarapport er fasit for totalen. Dette er det vi kan
 * se selv — fordelt per konto og per produksjon, noe fakturaen aldri
 * viser.
 */

import type { Pool } from "pg";
import type { StorageLedgerBackend } from "./production-storage-service.js";

export interface EgressEvent {
  userId: string;
  /** Produksjonen, når nedlastingen hører til en. */
  projectId?: string | null;
  backend: StorageLedgerBackend;
  estimatedBytes: number;
  /** Hvor i appen nedlastingen ble utløst. */
  source: string;
  relatedResourceId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Registrer en antatt nedlasting.
 *
 * Kalles fire-and-forget fra signerings-punktene. Egress-måling skal
 * aldri kunne hindre noen i å få fila si — en manglende rad koster oss
 * presisjon i et estimat, en feilet nedlasting koster kunden en
 * opptaksdag.
 */
export function recordEgress(pool: Pool, event: EgressEvent): void {
  if (!event.userId || !Number.isFinite(event.estimatedBytes)) return;
  // Null-bytes er ikke en nedlasting. Å skrive den ville fylt tabellen
  // med rader som ikke sier noe.
  if (event.estimatedBytes <= 0) return;

  void pool
    .query(
      `INSERT INTO storage_egress_events
         (user_id, project_id, backend, estimated_bytes, source,
          related_resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        event.userId,
        event.projectId ?? null,
        event.backend,
        Math.trunc(event.estimatedBytes),
        event.source,
        event.relatedResourceId ?? null,
        JSON.stringify(event.metadata ?? {}),
      ],
    )
    .catch((err) => {
      console.error("[egress] kunne ikke registrere nedlasting:", err);
    });
}

export interface EgressSummary {
  totalBytes: number;
  byBackend: Record<string, number>;
  eventCount: number;
}

/**
 * Egress for en konto i en periode.
 *
 * `sinceDays` er antall døgn bakover, ikke kalendermåned. En kalender-
 * måned ville gitt et tall som faller til null den første i måneden og
 * derfor er ubrukelig til å oppdage en kunde som er i ferd med å
 * passere gratiskvoten.
 */
export async function egressForUser(
  pool: Pool,
  userId: string,
  sinceDays = 30,
): Promise<EgressSummary> {
  const r = await pool.query<{ backend: string; total: string; n: string }>(
    `SELECT backend,
            COALESCE(SUM(estimated_bytes), 0) AS total,
            COUNT(*) AS n
       FROM storage_egress_events
      WHERE user_id = $1
        AND created_at >= now() - ($2 || ' days')::interval
      GROUP BY backend`,
    [userId, String(Math.max(1, Math.trunc(sinceDays)))],
  );
  return summarise(r.rows);
}

/** Egress for én produksjon i en periode. */
export async function egressForProduction(
  pool: Pool,
  projectId: string,
  sinceDays = 30,
): Promise<EgressSummary> {
  const r = await pool.query<{ backend: string; total: string; n: string }>(
    `SELECT backend,
            COALESCE(SUM(estimated_bytes), 0) AS total,
            COUNT(*) AS n
       FROM storage_egress_events
      WHERE project_id = $1
        AND created_at >= now() - ($2 || ' days')::interval
      GROUP BY backend`,
    [projectId, String(Math.max(1, Math.trunc(sinceDays)))],
  );
  return summarise(r.rows);
}

function summarise(
  rows: Array<{ backend: string; total: string; n: string }>,
): EgressSummary {
  const byBackend: Record<string, number> = {};
  let totalBytes = 0;
  let eventCount = 0;
  for (const row of rows) {
    const bytes = Number(row.total);
    byBackend[row.backend] = bytes;
    totalBytes += bytes;
    eventCount += Number(row.n);
  }
  return { totalBytes, byBackend, eventCount };
}

export interface FreeEgressStatus {
  storedBytes: number;
  egressBytes: number;
  freeAllowanceBytes: number;
  overageBytes: number;
  /** Andel av gratiskvoten brukt. null når ingenting er lagret. */
  usedFraction: number | null;
}

/**
 * Hvor nær gratiskvoten en konto ligger.
 *
 * Gratiskvoten følger lagret mengde — lagrer du mer, får du hente mer
 * gratis. Det er derfor `storedBytes` må inn: en fast grense ville gitt
 * feil svar for både den lille og den store kunden.
 */
export function freeEgressStatus(
  storedBytes: number,
  egressBytes: number,
  multiplier: number,
): FreeEgressStatus {
  const stored = Math.max(0, storedBytes);
  const egress = Math.max(0, egressBytes);
  const freeAllowanceBytes = Number.isFinite(multiplier)
    ? stored * Math.max(0, multiplier)
    : Infinity;
  const overageBytes = Number.isFinite(freeAllowanceBytes)
    ? Math.max(0, egress - freeAllowanceBytes)
    : 0;
  return {
    storedBytes: stored,
    egressBytes: egress,
    freeAllowanceBytes,
    overageBytes,
    // Uten lagring finnes ingen kvote å bruke av. 0 ville sett ut som
    // «god plass igjen», når svaret egentlig er at alt koster.
    usedFraction:
      freeAllowanceBytes > 0 && Number.isFinite(freeAllowanceBytes)
        ? egress / freeAllowanceBytes
        : null,
  };
}
