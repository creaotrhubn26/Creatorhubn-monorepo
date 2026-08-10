/**
 * admin-storage-status-service.ts
 *
 * Samler lagringsbildet på ett sted, slik at det finnes et sted å se det.
 *
 * Alle delene har eksistert en stund — nøkkelroller, bøtte-klasser,
 * produksjonsregnskap, egress, kostmodell — men bare som data ingen ser.
 * Rolle- og bøtte-diagnosen sto i oppstartsloggen, som er nøyaktig det
 * stedet en halvferdig utrulling blir usynlig etter første omstart.
 *
 * Tre spørsmål flata skal kunne svare på:
 *
 *   1. Er sikkerheten faktisk rullet ut, eller deler alt fortsatt én
 *      nøkkel og én bøtte?
 *   2. Hvem bruker plassen, og hva koster de oss?
 *   3. Nærmer noen seg egress-grensen, der kostnaden plutselig hopper?
 *
 * Modulen regner; den henter ikke selv. Postgres-oppslagene kommer inn
 * som parametre, slik at logikken kan testes uten database — og fordi
 * regnestykkene her er de som faktisk kan bli feil.
 */

import { describeBuckets, type BucketStatus } from "./b2-bucket-registry.js";
import { describeKeyRoles, type B2RoleStatus } from "./b2-key-registry.js";
import {
  backendCostBasis,
  costForBackendUsage,
  marginForUsage,
  type BackendUsage,
  type CostBackend,
} from "./storage-cost-model.js";
import { freeEgressStatus } from "./storage-egress-service.js";

const GIB = 1024 * 1024 * 1024;

export interface RolloutStatus {
  /** Roller totalt, og hvor mange som har egen nøkkel. */
  keyRolesTotal: number;
  keyRolesScoped: number;
  keyRolesSharingFallback: string[];
  bucketClassesTotal: number;
  bucketClassesScoped: number;
  bucketClassesSharingFallback: string[];
  /**
   * Er utrullingen ferdig? Krever BÅDE at alle roller har egen nøkkel og
   * at alle klasser har egen bøtte — halve jobben gir ingen isolasjon.
   */
  complete: boolean;
  /** Null når B2 ikke er konfigurert i det hele tatt. */
  configured: boolean;
}

/**
 * Hvor langt sikkerhetsutrullingen er kommet.
 *
 * Rapporteres som «ikke konfigurert» framfor «ferdig» når B2 ikke er satt
 * opp. En tom liste roller som deler nøkkel er ikke det samme som at alle
 * har sin egen.
 */
export function rolloutStatus(
  roles: B2RoleStatus[] = describeKeyRoles(),
  buckets: BucketStatus[] = describeBuckets(),
): RolloutStatus {
  const configuredRoles = roles.filter((r) => r.configured);
  const configuredBuckets = buckets.filter((b) => b.bucket !== null);
  const roleFallbacks = configuredRoles.filter((r) => r.usingSharedFallback);
  const bucketFallbacks = configuredBuckets.filter((b) => b.usingSharedFallback);
  const configured = configuredRoles.length > 0;

  return {
    keyRolesTotal: roles.length,
    keyRolesScoped: configuredRoles.length - roleFallbacks.length,
    keyRolesSharingFallback: roleFallbacks.map((r) => r.role),
    bucketClassesTotal: buckets.length,
    bucketClassesScoped: configuredBuckets.length - bucketFallbacks.length,
    bucketClassesSharingFallback: bucketFallbacks.map((b) => b.storageClass),
    complete:
      configured && roleFallbacks.length === 0 && bucketFallbacks.length === 0,
    configured,
  };
}

export interface ProductionUsageRow {
  projectId: string;
  projectName: string | null;
  billingUserId: string;
  usedBytes: number;
  b2Bytes: number;
  r2Bytes: number;
  streamBytes: number;
  filesystemBytes: number;
  fileCount: number;
}

export interface ProductionCostRow extends ProductionUsageRow {
  usedGb: number;
  monthlyCostNok: number;
  /** Andel av totalen på tvers av produksjonene i utvalget. */
  shareOfTotal: number;
}

/**
 * Kostnad per produksjon.
 *
 * Backend-fordelingen brukes, ikke totalen: Stream koster rundt seksten
 * ganger mer per GB enn B2, så en produksjon med mye selftape er en helt
 * annen kostnad enn én med like mange GB dailies. En beregning på
 * `usedBytes` alene ville vist dem som like dyre.
 */
export function productionCosts(
  rows: ProductionUsageRow[],
): { productions: ProductionCostRow[]; totalMonthlyCostNok: number } {
  const withCost = rows.map((row) => {
    const usages: BackendUsage[] = [
      { backend: "b2", storedBytes: row.b2Bytes },
      { backend: "r2", storedBytes: row.r2Bytes },
      { backend: "cloudflare_stream", storedBytes: row.streamBytes },
      { backend: "filesystem", storedBytes: row.filesystemBytes },
    ];
    const monthlyCostNok = usages.reduce(
      (sum, u) => sum + costForBackendUsage(u).totalCostNok,
      0,
    );
    return { row, monthlyCostNok };
  });

  const totalMonthlyCostNok = withCost.reduce((s, x) => s + x.monthlyCostNok, 0);
  const totalBytes = rows.reduce((s, r) => s + r.usedBytes, 0);

  return {
    totalMonthlyCostNok,
    productions: withCost.map(({ row, monthlyCostNok }) => ({
      ...row,
      usedGb: row.usedBytes / GIB,
      monthlyCostNok,
      // Deling på null gir NaN, som forplanter seg gjennom hver graf den
      // havner i. Null produksjoner betyr null andel.
      shareOfTotal: totalBytes > 0 ? row.usedBytes / totalBytes : 0,
    })),
  };
}

export interface AccountEgressInput {
  userId: string;
  email: string | null;
  storedBytes: number;
  egressBytes: number;
  backend: CostBackend;
}

export interface AccountEgressRow extends AccountEgressInput {
  freeAllowanceBytes: number;
  overageBytes: number;
  usedFraction: number | null;
  egressCostNok: number;
  /** Over terskelen der noen bør varsles før regningen kommer. */
  approachingLimit: boolean;
}

/**
 * Terskelen der en konto bør varsles.
 *
 * 0.8 og ikke 1.0: poenget er å oppdage det FØR kostnaden slår inn. Ved
 * 1.0 har den allerede gjort det.
 */
export const EGRESS_WARN_FRACTION = 0.8;

/**
 * Egress målt mot gratiskvoten.
 *
 * Kvoten følger lagret mengde — lagrer du mer, får du hente mer gratis.
 * Derfor må `storedBytes` inn: en fast grense ville gitt feil svar for
 * både den lille og den store kunden.
 */
export function accountEgress(rows: AccountEgressInput[]): AccountEgressRow[] {
  return rows.map((row) => {
    const cost = costForBackendUsage({
      backend: row.backend,
      storedBytes: row.storedBytes,
      egressBytes: row.egressBytes,
    });
    // Multiplikatoren leses fra kostmodellen, ikke gjentas her. To steder
    // som definerer gratiskvoten ville før eller siden vært uenige, og
    // den ene ville vært den vi fakturerte på.
    const status = freeEgressStatus(
      row.storedBytes,
      row.egressBytes,
      backendCostBasis()[row.backend].freeEgressMultiplier,
    );
    return {
      ...row,
      freeAllowanceBytes: status.freeAllowanceBytes,
      overageBytes: status.overageBytes,
      usedFraction: status.usedFraction,
      egressCostNok: cost.egressCostNok,
      approachingLimit:
        status.usedFraction !== null &&
        status.usedFraction >= EGRESS_WARN_FRACTION,
    };
  });
}

export interface MarginSummary {
  costNok: number;
  revenueNok: number;
  marginNok: number;
  marginFraction: number | null;
}

/** Marginen på plattformens samlede lagring for en periode. */
export function platformMargin(
  usages: BackendUsage[],
  revenueNok: number,
): MarginSummary {
  const m = marginForUsage(usages, revenueNok);
  return {
    costNok: m.costNok,
    revenueNok: m.revenueNok,
    marginNok: m.marginNok,
    marginFraction: m.marginFraction,
  };
}
