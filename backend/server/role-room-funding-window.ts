/**
 * role-room-funding-window.ts
 *
 * Søknadsvinduer (Del A punkt 114).
 *
 * En ferdig søknad er ikke nødvendigvis mulig å sende. NFI opplyser at «alle
 * søknadsrunder åpnes for søknader på dagen fire uker før søknadsfrist», og at
 * «frist for innsending [er] klokken 12.00 på oppgitt dato». Enkelte ordninger
 * har i stedet løpende saksbehandling.
 *
 * Uten dette oppdager produsenten stengt vindu først når portalen ikke lar
 * dem laste opp — typisk kvelden før fristen.
 *
 * Klokkeslettet er norsk tid. Datoregning gjøres på UTC-komponenter for å
 * unngå at sommertidsskiftet flytter en frist et døgn.
 */

/** Søknadsrunden åpner fire uker før fristen. */
export const WINDOW_OPENS_DAYS_BEFORE = 28;
/** Fristen går ut kl. 12.00 på oppgitt dato. */
export const DEADLINE_HOUR_LOCAL = 12;

export type WindowState = "rolling" | "upcoming" | "open" | "closed";

export interface FundingWindow {
  label: string;
  deadlineDate: string;
  opensDate: string | null;
}

export interface WindowStatus {
  state: WindowState;
  label: string | null;
  /** Dato runden åpner. Null for løpende ordninger. */
  opensAt: string | null;
  /** Frist inkludert klokkeslett. Null for løpende ordninger. */
  deadlineAt: string | null;
  /** Dager til åpning (upcoming) eller til frist (open). Negativt = passert. */
  daysUntil: number | null;
  /** Kort forklaring til visning. */
  message: string;
  /** Kan søknaden sendes akkurat nå? */
  canSubmitNow: boolean;
}

/** Fristens tidspunkt: kl. 12.00 norsk tid på oppgitt dato. */
export function deadlineMoment(deadlineDate: string, offsetHours = 1): Date {
  const [y, m, d] = deadlineDate.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, DEADLINE_HOUR_LOCAL - offsetHours, 0, 0));
}

/** Åpningsdato — eksplisitt hvis satt, ellers fire uker før fristen. */
export function opensMoment(win: FundingWindow): Date {
  if (win.opensDate) {
    const [y, m, d] = win.opensDate.slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  }
  const deadline = deadlineMoment(win.deadlineDate);
  const opens = new Date(deadline.getTime());
  opens.setUTCDate(opens.getUTCDate() - WINDOW_OPENS_DAYS_BEFORE);
  opens.setUTCHours(0, 0, 0, 0);
  return opens;
}

const DAY_MS = 86_400_000;

/**
 * Kalenderdager mellom to tidspunkter.
 *
 * Bevisst kalenderdager og ikke millisekunder delt på et døgn: på selve
 * fristdagen kl. 09.00 er det tre timer igjen, og `Math.ceil` ville meldt
 * «1 dag til frist». Det leses som «jeg har i morgen også», som er feil den
 * dagen det gjelder.
 */
const daysBetween = (from: Date, to: Date) => {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / DAY_MS);
};

/**
 * Finner runden som gjelder nå.
 *
 * Velger den nærmeste runden som ikke er passert. Er alle passert, rapporteres
 * den siste som stengt — «det finnes ingen flere runder» er en annen beskjed
 * enn «vi vet ikke om noen runder», og produsenten trenger å se forskjellen.
 */
export function resolveWindowStatus(
  processingType: string,
  windows: FundingWindow[],
  now: Date = new Date(),
): WindowStatus {
  if (processingType === "rolling") {
    return {
      state: "rolling",
      label: null,
      opensAt: null,
      deadlineAt: null,
      daysUntil: null,
      message: "Løpende saksbehandling — ingen frist å rekke.",
      canSubmitNow: true,
    };
  }

  if (windows.length === 0) {
    return {
      state: "upcoming",
      label: null,
      opensAt: null,
      deadlineAt: null,
      daysUntil: null,
      message: "Ingen søknadsrunder er registrert for ordningen.",
      canSubmitNow: false,
    };
  }

  const sorted = [...windows].sort(
    (a, b) => deadlineMoment(a.deadlineDate).getTime() - deadlineMoment(b.deadlineDate).getTime(),
  );

  for (const win of sorted) {
    const deadline = deadlineMoment(win.deadlineDate);
    if (deadline.getTime() < now.getTime()) continue;

    const opens = opensMoment(win);
    if (now.getTime() < opens.getTime()) {
      const days = daysBetween(now, opens);
      return {
        state: "upcoming",
        label: win.label,
        opensAt: opens.toISOString(),
        deadlineAt: deadline.toISOString(),
        daysUntil: days,
        message: `Åpner om ${days} ${days === 1 ? "dag" : "dager"} (${win.label}).`,
        // Runden er ikke åpen ennå — søknaden kan ikke sendes.
        canSubmitNow: false,
      };
    }

    const days = daysBetween(now, deadline);
    return {
      state: "open",
      label: win.label,
      opensAt: opens.toISOString(),
      deadlineAt: deadline.toISOString(),
      daysUntil: days,
      message:
        days <= 0
          ? `Fristen går ut i dag kl. 12.00 (${win.label}).`
          : `Åpen — ${days} ${days === 1 ? "dag" : "dager"} til frist kl. 12.00 (${win.label}).`,
      canSubmitNow: true,
    };
  }

  const last = sorted[sorted.length - 1];
  return {
    state: "closed",
    label: last.label,
    opensAt: opensMoment(last).toISOString(),
    deadlineAt: deadlineMoment(last.deadlineDate).toISOString(),
    daysUntil: daysBetween(now, deadlineMoment(last.deadlineDate)),
    message: `Siste registrerte runde (${last.label}) er passert. Nye frister kunngjøres halvårsvis.`,
    canSubmitNow: false,
  };
}

// ── Samarbeidspartnere ──────────────────────────────────────────────────────

export const PARTNER_ROLES = [
  "national_fund", "regional_fund", "distributor", "broadcaster",
  "co_producer", "sales_agent", "sponsor", "own_equity", "other",
] as const;

export type PartnerRole = (typeof PARTNER_ROLES)[number];

export const PARTNER_ROLE_LABELS: Record<PartnerRole, string> = {
  national_fund: "Nasjonalt filmfond",
  regional_fund: "Regionalt filmfond",
  distributor: "Distributør",
  broadcaster: "Kringkaster",
  co_producer: "Samprodusent",
  sales_agent: "Salgsagent",
  sponsor: "Sponsor",
  own_equity: "Egenkapital",
  other: "Annet",
};

/**
 * Partnerroller som typisk må på plass for å nå 80 % bekreftet finansiering i
 * en norsk produksjon. Dette er en veiledning, ikke et krav fra NFI — derfor
 * «foreslått», og derfor blokkerer den ingenting.
 */
export const SUGGESTED_PARTNER_ROLES: PartnerRole[] = [
  "regional_fund", "distributor", "broadcaster", "co_producer",
];

export interface PartnerCoverage {
  role: PartnerRole;
  label: string;
  present: boolean;
  confirmed: boolean;
  amount: number;
  names: string[];
}

/**
 * Hvilke samarbeid som er på plass, og hvilke som mangler.
 *
 * Poenget er å gjøre «det mangler 540 000 i bekreftet finansiering» om til
 * «du har ikke distributør ennå» — altså noe man kan handle på.
 */
export function summarisePartners(
  sources: Array<{ name: string; partnerRole?: string | null; amount: number; confirmed: boolean }>,
): { coverage: PartnerCoverage[]; missingSuggested: string[] } {
  const byRole = new Map<string, PartnerCoverage>();

  for (const role of PARTNER_ROLES) {
    byRole.set(role, {
      role, label: PARTNER_ROLE_LABELS[role],
      present: false, confirmed: false, amount: 0, names: [],
    });
  }

  for (const s of sources) {
    const role = (s.partnerRole ?? "other") as PartnerRole;
    const entry = byRole.get(role) ?? byRole.get("other")!;
    entry.present = true;
    entry.amount += s.amount;
    entry.names.push(s.name);
    if (s.confirmed) entry.confirmed = true;
  }

  const coverage = [...byRole.values()].filter((c) => c.present);
  const missingSuggested = SUGGESTED_PARTNER_ROLES.filter(
    (role) => !byRole.get(role)?.present,
  ).map((role) => PARTNER_ROLE_LABELS[role]);

  return { coverage, missingSuggested };
}
