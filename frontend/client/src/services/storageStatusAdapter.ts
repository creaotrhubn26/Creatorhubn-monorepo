/**
 * storageStatusAdapter.ts
 *
 * Oversetter admin-lagringsflatens API-svar til det panelet faktisk
 * tegner.
 *
 * Ligger utenfor komponenten fordi det er her tallene kan bli feil, og
 * fordi et panel er tungvint å teste. Ingen React her — bare funksjoner
 * som tar et svar og gir en visning.
 *
 * Serveren svarer med bytes og kroner; flata skal vise mennesker noe de
 * kan handle på. Oversettelsen er ikke bare formatering: den avgjør også
 * hva som er en advarsel og hva som bare er et tall.
 */

export type RolloutSeverity = "ok" | "partial" | "not_configured";

export interface RolloutView {
  severity: RolloutSeverity;
  headline: string;
  detail: string;
  /** Hva som gjenstår, klart til å listes opp. */
  outstanding: string[];
}

export interface RolloutResponse {
  configured: boolean;
  complete: boolean;
  keyRolesTotal: number;
  keyRolesScoped: number;
  keyRolesSharingFallback: string[];
  bucketClassesTotal: number;
  bucketClassesScoped: number;
  bucketClassesSharingFallback: string[];
}

/**
 * Utrullingsstatus som én setning noen kan handle på.
 *
 * «Delvis» er med vilje en advarsel og ikke en nøytral tilstand: en
 * halvferdig utrulling ser ut som at alt virker, og det er nettopp derfor
 * ingen oppdager den.
 */
export function rolloutView(r: RolloutResponse): RolloutView {
  if (!r.configured) {
    return {
      severity: "not_configured",
      headline: "B2 er ikke konfigurert",
      detail:
        "Ingen nøkler er satt opp, så lagringen går til R2 eller lokal disk.",
      outstanding: [],
    };
  }

  const outstanding: string[] = [];
  if (r.keyRolesSharingFallback.length > 0) {
    outstanding.push(
      `${r.keyRolesSharingFallback.length} roller deler fellesnøkkelen: ` +
        r.keyRolesSharingFallback.join(", "),
    );
  }
  if (r.bucketClassesSharingFallback.length > 0) {
    outstanding.push(
      `${r.bucketClassesSharingFallback.length} klasser deler fellesbøtta: ` +
        r.bucketClassesSharingFallback.join(", "),
    );
  }

  if (r.complete) {
    return {
      severity: "ok",
      headline: "Utrullingen er fullført",
      detail:
        `Alle ${r.keyRolesTotal} roller har egen nøkkel, og alle ` +
        `${r.bucketClassesTotal} klasser har egen bøtte.`,
      outstanding: [],
    };
  }

  return {
    severity: "partial",
    headline: "Utrullingen er ikke fullført",
    detail:
      `${r.keyRolesScoped} av ${r.keyRolesTotal} roller og ` +
      `${r.bucketClassesScoped} av ${r.bucketClassesTotal} klasser er skilt ut. ` +
      "Resten har fortsatt tilgang til alt.",
    outstanding,
  };
}

const GIB = 1024 * 1024 * 1024;
const TIB = GIB * 1024;

/** Bytes som noe et menneske leser uten å telle nuller. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 GB";
  if (bytes >= TIB) return `${(bytes / TIB).toFixed(1)} TB`;
  if (bytes >= 10 * GIB) return `${Math.round(bytes / GIB)} GB`;
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;
}

/**
 * Kroner, avrundet.
 *
 * Øre er støy i en oversikt over månedskostnad — men et beløp under en
 * krone skal ikke vises som «0 kr», for da ser en reell kostnad ut som
 * ingen kostnad.
 */
export function formatNok(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  if (amount > 0 && amount < 1) return "<1 kr";
  if (amount < 0 && amount > -1) return ">-1 kr";
  return `${Math.round(amount).toLocaleString("nb-NO")} kr`;
}

export function formatPercent(fraction: number | null): string {
  // null betyr udefinert, ikke null prosent. «0 %» ville sett ut som et
  // svar; «—» sier at spørsmålet ikke gir mening ennå.
  if (fraction === null || !Number.isFinite(fraction)) return "—";
  return `${Math.round(fraction * 100)} %`;
}

export interface ProductionRow {
  projectId: string;
  projectName: string | null;
  usedBytes: number;
  monthlyCostNok: number;
  shareOfTotal: number;
  fileCount: number;
  streamBytes: number;
}

export interface ProductionRowView {
  id: string;
  name: string;
  size: string;
  cost: string;
  share: string;
  files: number;
  /**
   * Produksjoner der Stream utgjør mye av kostnaden. Stream prises per
   * minutt, ikke per GB, så en slik produksjon er dyr på en måte
   * størrelsen ikke røper.
   */
  streamHeavy: boolean;
}

/** Andel Stream-bytes der kostnadsbildet skifter karakter. */
export const STREAM_HEAVY_FRACTION = 0.5;

export function productionRows(rows: ProductionRow[]): ProductionRowView[] {
  return rows.map((row) => ({
    id: row.projectId,
    // Et slettet prosjekt har fortsatt bytes i regnskapet. Å vise id-en
    // er stygt, men det er bedre enn en tom rad ingen kan følge opp.
    name: row.projectName ?? `(uten navn · ${row.projectId})`,
    size: formatBytes(row.usedBytes),
    cost: formatNok(row.monthlyCostNok),
    share: formatPercent(row.shareOfTotal),
    files: row.fileCount,
    streamHeavy:
      row.usedBytes > 0 && row.streamBytes / row.usedBytes >= STREAM_HEAVY_FRACTION,
  }));
}

export interface EgressRow {
  userId: string;
  email: string | null;
  storedBytes: number;
  egressBytes: number;
  freeAllowanceBytes: number;
  overageBytes: number;
  usedFraction: number | null;
  egressCostNok: number;
  approachingLimit: boolean;
}

export interface EgressRowView {
  id: string;
  who: string;
  stored: string;
  egress: string;
  allowance: string;
  used: string;
  overage: string;
  cost: string;
  severity: "ok" | "warn" | "over";
}

export function egressRows(rows: EgressRow[]): EgressRowView[] {
  return rows.map((row) => ({
    id: row.userId,
    who: row.email ?? row.userId,
    stored: formatBytes(row.storedBytes),
    egress: formatBytes(row.egressBytes),
    // Uendelig kvote er R2, der egress er gratis. «∞» er ærligere enn et
    // tall, som ville sett ut som en grense det går an å nå.
    allowance: Number.isFinite(row.freeAllowanceBytes)
      ? formatBytes(row.freeAllowanceBytes)
      : "∞",
    used: formatPercent(row.usedFraction),
    overage: row.overageBytes > 0 ? formatBytes(row.overageBytes) : "—",
    cost: formatNok(row.egressCostNok),
    severity: row.overageBytes > 0 ? "over" : row.approachingLimit ? "warn" : "ok",
  }));
}

export interface KeyRoleRow {
  role: string;
  purpose: string;
  requiredCapabilities: string[];
  envVars: { id: string; secret: string };
  configured: boolean;
  usingSharedFallback: boolean;
  keyIdSuffix: string | null;
}

export interface KeyRoleRowView {
  role: string;
  purpose: string;
  capabilities: string;
  status: "scoped" | "shared" | "missing";
  statusLabel: string;
  /** Hva som må settes, når noe mangler. */
  action: string | null;
  keyHint: string;
}

export function keyRoleRows(rows: KeyRoleRow[]): KeyRoleRowView[] {
  return rows.map((row) => {
    const status = !row.configured
      ? ("missing" as const)
      : row.usingSharedFallback
        ? ("shared" as const)
        : ("scoped" as const);
    return {
      role: row.role,
      purpose: row.purpose,
      capabilities: row.requiredCapabilities.join(", "),
      status,
      statusLabel: {
        scoped: "Egen nøkkel",
        shared: "Deler fellesnøkkel",
        missing: "Ikke konfigurert",
      }[status],
      action:
        status === "scoped"
          ? null
          : `Sett ${row.envVars.id} og ${row.envVars.secret}`,
      // Aldri hele nøkkel-id-en. En nøkkel-id på skjermen er halve
      // lekkasjen, og et skjermbilde havner fort i en chat.
      keyHint: row.keyIdSuffix ? `…${row.keyIdSuffix}` : "—",
    };
  });
}
