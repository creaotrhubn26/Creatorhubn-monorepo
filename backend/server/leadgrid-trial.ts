/**
 * Prøvetid som måler bruk, ikke kalenderdager.
 *
 * Klokka starter ved første fullførte Discovery-kjøring. Registrerer noen seg
 * torsdag og blir dratt inn i noe annet, er helga borte før de har åpnet
 * produktet — og sju dager blir fire. Målt i vår egen base: fire
 * Discovery-kjøringer totalt, null godkjente kandidater. Selv den som bygde
 * produktet kom ikke gjennom kjeden på en uke.
 *
 * Yttergrensen på 30 dager fra registrering gjelder uansett, så en konto som
 * aldri kommer i gang ikke ligger åpen i årevis.
 *
 * Når prøvetiden er ute blir organisasjonen SKRIVEBESKYTTET, ikke stengt.
 * De ser leadene sine og kan ikke legge til nye. Sletting er fiendtlig, og
 * full utestenging fjerner det eneste som får noen til å betale: at de ser
 * hva de mister.
 */
import type { Pool, PoolClient } from "pg";

/** Pool eller klient — statusen leses både frittstående og inne i en transaksjon. */
type Queryable = Pick<Pool | PoolClient, "query">;

export const TRIAL_DAYS = 7;
export const TRIAL_HARD_LIMIT_DAYS = 30;

export type TrialState =
  /** Klokka har ikke startet — de har ikke kjørt Discovery ennå. */
  | "not_started"
  | "active"
  | "expired"
  /** Betalende. Prøvetiden gjelder ikke lenger. */
  | "paid";

export interface TrialStatus {
  state: TrialState;
  /** Hele dager igjen. 0 betyr «i dag er siste». Null når klokka ikke går. */
  days_left: number | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  /** Yttergrensen, uansett om Discovery er kjørt. */
  hard_expires_at: string | null;
  /** Sant når organisasjonen ikke lenger kan opprette noe. */
  read_only: boolean;
  /** Én setning, ment for brukeren. */
  message: string;
}

interface OrgRad {
  plan: string | null;
  stripe_subscription_id: string | null;
  trial_started_at: Date | null;
  trial_ends_at: Date | null;
  trial_hard_expires_at: Date | null;
}

/** Betalende org-er har ikke prøvetid å gå tom for. */
function erBetalende(rad: OrgRad): boolean {
  if (rad.stripe_subscription_id) return true;
  const plan = (rad.plan ?? "").trim().toLowerCase();
  return plan !== "" && plan !== "trial" && plan !== "free" && plan !== "solo_free";
}

export function evaluateTrial(rad: OrgRad, now = new Date()): TrialStatus {
  const base = {
    trial_started_at: rad.trial_started_at?.toISOString() ?? null,
    trial_ends_at: rad.trial_ends_at?.toISOString() ?? null,
    hard_expires_at: rad.trial_hard_expires_at?.toISOString() ?? null,
  };

  if (erBetalende(rad)) {
    return {
      ...base,
      state: "paid",
      days_left: null,
      read_only: false,
      message: "Abonnementet er aktivt.",
    };
  }

  // Yttergrensen slår først: den gjelder også når klokka aldri startet.
  if (rad.trial_hard_expires_at && rad.trial_hard_expires_at <= now) {
    return {
      ...base,
      state: "expired",
      days_left: 0,
      read_only: true,
      message:
        "Prøveperioden er over. Du ser leadene dine, men kan ikke legge til nye " +
        "før du velger en avtale.",
    };
  }

  if (!rad.trial_ends_at) {
    const dagerTilHard = rad.trial_hard_expires_at
      ? dagerMellom(now, rad.trial_hard_expires_at)
      : null;
    return {
      ...base,
      state: "not_started",
      days_left: dagerTilHard,
      read_only: false,
      message:
        "Prøveperioden på sju dager starter når du kjører ditt første søk. " +
        "Til da koster ingenting tid.",
    };
  }

  if (rad.trial_ends_at <= now) {
    return {
      ...base,
      state: "expired",
      days_left: 0,
      read_only: true,
      message:
        "Prøveperioden er over. Du ser leadene dine, men kan ikke legge til nye " +
        "før du velger en avtale.",
    };
  }

  const igjen = dagerMellom(now, rad.trial_ends_at);
  return {
    ...base,
    state: "active",
    days_left: igjen,
    read_only: false,
    message:
      igjen <= 1
        ? "Siste dag av prøveperioden. Velg en avtale for å beholde tilgangen."
        : `${igjen} dager igjen av prøveperioden.`,
  };
}

/** Hele dager, alltid rundet opp: en halv dag igjen er fortsatt «1 dag». */
function dagerMellom(fra: Date, til: Date): number {
  return Math.max(0, Math.ceil((til.getTime() - fra.getTime()) / 86_400_000));
}

export async function trialStatus(
  pool: Queryable,
  organizationId: string,
  now = new Date(),
): Promise<TrialStatus | null> {
  const rad = await pool.query<OrgRad>(
    `SELECT plan, stripe_subscription_id, trial_started_at, trial_ends_at,
            trial_hard_expires_at
       FROM organizations WHERE id = $1::uuid`,
    [organizationId],
  );
  if (!rad.rows[0]) return null;
  return evaluateTrial(rad.rows[0], now);
}

/**
 * Starter klokka. Kalles når en Discovery-kjøring fullfører.
 *
 * Idempotent: `trial_started_at IS NULL` i WHERE-en gjør at kjøring nummer to
 * ikke forlenger prøvetiden. Uten det ville hver kjøring nullstilt klokka, og
 * prøvetiden vart evig for den som søkte ofte.
 */
export async function startTrialOnFirstDiscovery(
  pool: Pool,
  organizationId: string,
  now = new Date(),
): Promise<boolean> {
  const slutt = new Date(now.getTime() + TRIAL_DAYS * 86_400_000);
  const ut = await pool.query(
    `UPDATE organizations
        SET trial_started_at = $2,
            trial_ends_at = $3,
            updated_at = NOW()
      WHERE id = $1::uuid
        AND trial_started_at IS NULL
        AND stripe_subscription_id IS NULL`,
    [organizationId, now, slutt],
  );
  return (ut.rowCount ?? 0) > 0;
}

/** Setter yttergrensen ved registrering. */
export async function setTrialHardLimit(
  pool: Pool,
  organizationId: string,
  now = new Date(),
): Promise<void> {
  const grense = new Date(now.getTime() + TRIAL_HARD_LIMIT_DAYS * 86_400_000);
  await pool.query(
    `UPDATE organizations
        SET trial_hard_expires_at = COALESCE(trial_hard_expires_at, $2)
      WHERE id = $1::uuid`,
    [organizationId, grense],
  );
}
