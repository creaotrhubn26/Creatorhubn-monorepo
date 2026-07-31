/**
 * production-storage-service.ts
 *
 * Lagring som eies av produksjonen, ikke av den som trykket opplast.
 *
 * To nivåer som ble blandet fram til nå:
 *
 *   Produksjonen  eier bytene. Hver fil bokføres på prosjektet, uansett
 *                 hvem i crewet som lastet den opp. Det er dette som gjør
 *                 at dailies ikke sprenger DIT-ens personlige kvote, og
 *                 at lagringen følger produksjonen når crewet skifter.
 *
 *   Kontoen       betaler. Planens inkluderte kvote er én pott på
 *                 kontonivå som alle kontoens produksjoner trekker fra.
 *                 Potten ligger derfor ikke per produksjon — ellers ville
 *                 hver nye produksjon gitt gratis kvote på nytt, og
 *                 ubegrenset lagring vært et prosjekt unna.
 *
 * Kvotesjekken spør alltid kontoen. Bokføringen skjer alltid på
 * produksjonen. Det er hele skillet.
 */

import type { Pool } from "pg";
import { getStorageStatus, type StorageStatus } from "./storage-quota-service.js";

/** Backends bokføringen kjenner igjen. Må matche SQL-funksjonen. */
export type StorageLedgerBackend =
  | "b2"
  | "r2"
  | "cloudflare_stream"
  | "filesystem";

export interface ProductionStorageRow {
  projectId: string;
  billingUserId: string;
  usedBytes: number;
  b2Bytes: number;
  r2Bytes: number;
  streamBytes: number;
  filesystemBytes: number;
  fileCount: number;
  quotaOverrideBytes: number | null;
}

/**
 * Hvem som betaler for en produksjon.
 *
 * Leses fra ledgeren når produksjonen allerede har en rad — den kan ha
 * blitt flyttet til produksjonsselskapet etter at en enkeltperson
 * opprettet prosjektet. Først da faller vi tilbake til oppretteren.
 * Motsatt rekkefølge ville stille overstyrt en bevisst flytting hver
 * gang noen lastet opp en fil.
 */
export async function resolveBillingUser(
  pool: Pool,
  projectId: string,
): Promise<string | null> {
  const existing = await pool.query<{ billing_user_id: string }>(
    `SELECT billing_user_id FROM role_room_production_storage WHERE project_id = $1`,
    [projectId],
  );
  if (existing.rows[0]?.billing_user_id) return existing.rows[0].billing_user_id;

  const project = await pool.query<{ created_by: string | null }>(
    `SELECT created_by FROM casting_projects WHERE id = $1`,
    [projectId],
  );
  return project.rows[0]?.created_by ?? null;
}

/** Alt kontoen har lagret, summert over produksjonene den betaler for. */
export async function accountProductionBytes(
  pool: Pool,
  billingUserId: string,
): Promise<number> {
  const r = await pool.query<{ total: string | null }>(
    `SELECT COALESCE(SUM(used_bytes), 0) AS total
       FROM role_room_production_storage
      WHERE billing_user_id = $1`,
    [billingUserId],
  );
  return Number(r.rows[0]?.total ?? 0);
}

export interface ProductionQuotaDecision {
  ok: boolean;
  /** Satt når ok = false. */
  reason?: "production_cap_reached" | "plan_limit_reached_no_overage";
  message?: string;
  billingUserId: string;
  /** Kontoens plan og forbruk. Null når kontoen ikke lot seg slå opp. */
  account: StorageStatus | null;
  productionUsedBytes: number;
  productionCapBytes: number | null;
}

/**
 * Kan denne produksjonen ta imot `additionalBytes` til?
 *
 * To grenser, i denne rekkefølgen:
 *
 *   1. Produksjonens eget tak, hvis satt. Finnes for å hindre at én
 *      produksjon med 40 TB dailies spiser hele kontoens pott fra de
 *      andre. Et tak er absolutt — overage på planen redder det ikke,
 *      for det er nettopp det taket er der for å stoppe.
 *   2. Kontoens plan. Her gjelder overage: er planen metered, slipper
 *      opplastingen gjennom og differansen faktureres.
 */
export async function canProductionStore(
  pool: Pool,
  projectId: string,
  additionalBytes: number,
): Promise<ProductionQuotaDecision> {
  const row = await getProductionStorage(pool, projectId);
  const billingUserId =
    row?.billingUserId ?? (await resolveBillingUser(pool, projectId)) ?? "";
  const productionUsedBytes = row?.usedBytes ?? 0;
  const productionCapBytes = row?.quotaOverrideBytes ?? null;

  if (
    productionCapBytes !== null &&
    productionUsedBytes + additionalBytes > productionCapBytes
  ) {
    return {
      ok: false,
      reason: "production_cap_reached",
      message:
        `Produksjonen har nådd sitt eget lagringstak på ` +
        `${formatGb(productionCapBytes)}. Hev taket for produksjonen, ` +
        `eller frigjør plass.`,
      billingUserId,
      account: null,
      productionUsedBytes,
      productionCapBytes,
    };
  }

  // Uten en fakturerbar konto finnes det ingen plan å måle mot. Vi
  // slipper gjennom framfor å blokkere en innspilling på en manglende
  // kobling — bokføringen skjer uansett, så bytene er ikke tapt.
  if (!billingUserId) {
    return {
      ok: true,
      billingUserId,
      account: null,
      productionUsedBytes,
      productionCapBytes,
    };
  }

  const account = await getStorageStatus(pool, billingUserId);
  const projected = account.usedBytes + additionalBytes;
  if (projected <= account.user.storageLimitBytes || account.user.allowsOverage) {
    return {
      ok: true,
      billingUserId,
      account,
      productionUsedBytes,
      productionCapBytes,
    };
  }

  return {
    ok: false,
    reason: "plan_limit_reached_no_overage",
    message:
      `Lagringen på kontoen er full. Planen (${account.user.tier}) ` +
      `inkluderer ${formatGb(account.user.storageLimitBytes)}, og ` +
      `${formatGb(account.usedBytes)} er brukt. Oppgrader planen, eller ` +
      `frigjør plass.`,
    billingUserId,
    account,
    productionUsedBytes,
    productionCapBytes,
  };
}

export interface RecordProductionUsageInput {
  projectId: string;
  /** Den i crewet som lastet opp. Ikke nødvendigvis den som betaler. */
  actorUserId: string | null;
  deltaBytes: number;
  backend: StorageLedgerBackend;
  reason: string;
  relatedResourceId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Bokfør bytes på produksjonen.
 *
 * Returnerer produksjonens nye totalsum, eller null hvis prosjektet ikke
 * lot seg knytte til en fakturerbar konto — da finnes det ingen rad å
 * skrive, og kalleren bør falle tilbake til brukerbokføringen.
 */
export async function recordProductionUsage(
  pool: Pool,
  input: RecordProductionUsageInput,
): Promise<number | null> {
  const billingUserId = await resolveBillingUser(pool, input.projectId);
  if (!billingUserId) return null;

  const r = await pool.query<{ apply_production_storage_delta: string }>(
    `SELECT apply_production_storage_delta($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       AS apply_production_storage_delta`,
    [
      input.projectId,
      billingUserId,
      input.actorUserId,
      Math.trunc(input.deltaBytes),
      input.backend,
      input.reason,
      input.relatedResourceId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return Number(r.rows[0]?.apply_production_storage_delta ?? 0);
}

/**
 * Bokfør bytes både på produksjonen og på kontoen som betaler.
 *
 * Begge må skrives, og de teller ikke det samme to ganger — de svarer på
 * hvert sitt spørsmål:
 *
 *   Produksjonsledgeren  «hvor mye ligger på Nordlys, og hvem la det inn»
 *   Kontoledgeren        «hvor mye av planens pott er brukt»
 *
 * Kvotesjekken og Stripe-pushen leser kontoledgeren. Skrev vi bare til
 * produksjonen, ville potten aldri krympet og planens grense aldri slått
 * inn. Skrev vi bare til kontoen, mistet vi hvilken produksjon bytene
 * tilhører — og dermed muligheten til å fakturere per produksjon.
 *
 * Kontoen som belastes er den som BETALER, ikke den som lastet opp.
 */
export async function recordStorageForProduction(
  pool: Pool,
  input: RecordProductionUsageInput,
  recordAccountUsage: (
    billingUserId: string,
    bytes: number,
    backend: StorageLedgerBackend,
  ) => Promise<unknown>,
): Promise<{ billingUserId: string | null; productionUsedBytes: number | null }> {
  const billingUserId = await resolveBillingUser(pool, input.projectId);
  if (!billingUserId) {
    return { billingUserId: null, productionUsedBytes: null };
  }

  const productionUsedBytes = await recordProductionUsage(pool, input);
  await recordAccountUsage(billingUserId, input.deltaBytes, input.backend);
  return { billingUserId, productionUsedBytes };
}

export async function getProductionStorage(
  pool: Pool,
  projectId: string,
): Promise<ProductionStorageRow | null> {
  const r = await pool.query(
    `SELECT project_id, billing_user_id, used_bytes, b2_bytes, r2_bytes,
            stream_bytes, filesystem_bytes, file_count, quota_override_bytes
       FROM role_room_production_storage
      WHERE project_id = $1`,
    [projectId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    projectId: row.project_id,
    billingUserId: row.billing_user_id,
    usedBytes: Number(row.used_bytes),
    b2Bytes: Number(row.b2_bytes),
    r2Bytes: Number(row.r2_bytes),
    streamBytes: Number(row.stream_bytes),
    filesystemBytes: Number(row.filesystem_bytes),
    fileCount: Number(row.file_count),
    quotaOverrideBytes:
      row.quota_override_bytes === null ? null : Number(row.quota_override_bytes),
  };
}

/** Alle produksjonene en konto betaler for, størst forbruk først. */
export async function listProductionsForAccount(
  pool: Pool,
  billingUserId: string,
): Promise<Array<ProductionStorageRow & { projectName: string | null }>> {
  const r = await pool.query(
    `SELECT s.project_id, s.billing_user_id, s.used_bytes, s.b2_bytes,
            s.r2_bytes, s.stream_bytes, s.filesystem_bytes, s.file_count,
            s.quota_override_bytes, p.name AS project_name
       FROM role_room_production_storage s
       LEFT JOIN casting_projects p ON p.id = s.project_id
      WHERE s.billing_user_id = $1
      ORDER BY s.used_bytes DESC`,
    [billingUserId],
  );
  return r.rows.map((row) => ({
    projectId: row.project_id,
    billingUserId: row.billing_user_id,
    usedBytes: Number(row.used_bytes),
    b2Bytes: Number(row.b2_bytes),
    r2Bytes: Number(row.r2_bytes),
    streamBytes: Number(row.stream_bytes),
    filesystemBytes: Number(row.filesystem_bytes),
    fileCount: Number(row.file_count),
    quotaOverrideBytes:
      row.quota_override_bytes === null ? null : Number(row.quota_override_bytes),
    projectName: row.project_name ?? null,
  }));
}

/**
 * Flytt fakturaansvaret for en produksjon til en annen konto.
 *
 * Dette er den eneste veien inn til billing_user_id. SQL-funksjonen rører
 * den aldri, nettopp fordi hvem som betaler er en beslutning noen tar
 * bevisst — ikke noe en filopplasting skal kunne endre.
 */
export async function reassignBillingUser(
  pool: Pool,
  projectId: string,
  newBillingUserId: string,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE role_room_production_storage
        SET billing_user_id = $2, updated_at = now()
      WHERE project_id = $1`,
    [projectId, newBillingUserId],
  );
  return (r.rowCount ?? 0) > 0;
}

/** Sett eller fjern produksjonens eget tak. null fjerner det. */
export async function setProductionCap(
  pool: Pool,
  projectId: string,
  capBytes: number | null,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE role_room_production_storage
        SET quota_override_bytes = $2, updated_at = now()
      WHERE project_id = $1`,
    [projectId, capBytes],
  );
  return (r.rowCount ?? 0) > 0;
}

const GIB = 1024 * 1024 * 1024;

export function formatGb(bytes: number): string {
  const gb = bytes / GIB;
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
  if (gb >= 10) return `${Math.round(gb)} GB`;
  return `${gb.toFixed(1)} GB`;
}
