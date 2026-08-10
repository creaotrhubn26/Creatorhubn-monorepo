/**
 * role-room-work-time-rules.ts
 *
 * Arbeidstidssjekk mot norsk regelverk (Del A punkt 74 og 80).
 *
 * Backloggen kaller dette en differensiator — «internasjonale kan ikke AML» —
 * og det stemmer: en amerikansk produksjonsplanlegger kjenner ikke
 * arbeidsmiljølovens hviletidskrav, og slett ikke kapittel 11 om barn.
 *
 * **Dette er beslutningsstøtte, ikke juridisk rådgivning.** To forbehold som
 * er innebygd i modellen framfor bare skrevet i en fotnote:
 *
 *   1. Tariffavtale kan utvide flere av grensene (AML § 10-12). Motoren tar
 *      derfor imot et `agreement`-objekt og sier hvilken grense den brukte.
 *   2. Grensene for barn avhenger av alderen PÅ OPPTAKSDAGEN og av om barnet
 *      er grunnskolepliktig — ikke av alder i dag.
 *
 * Funnene skiller mellom `violation` (bryter loven slik den er oppgitt) og
 * `warning` (nær grensen, eller avhenger av opplysninger vi ikke har). Et
 * varsel som ikke skiller de to blir enten ignorert eller skaper unødig
 * panikk.
 *
 * Paragrafhenvisninger er tatt med i hvert funn, fordi den som skal utfordre
 * eller etterleve et varsel trenger å slå det opp selv.
 */

import { osloHour } from "./role-room-oslo-time.js";

// ── Typer ───────────────────────────────────────────────────────────────────

export interface Shift {
  /** ISO-tidspunkt for innkalling. */
  callTime: string;
  /** ISO-tidspunkt for slutt (faktisk hvis registrert, ellers planlagt). */
  wrapTime: string;
  breakMinutes?: number;
  /** Merkes når dagen er en skoledag for barnet. Påvirker kap. 11-grensene. */
  isSchoolDay?: boolean;
  label?: string;
}

export interface PersonWorkContext {
  name: string;
  /** Alder på opptaksdagen. Undefined = ukjent, som gir advarsel, ikke brudd. */
  ageAtShoot?: number;
  /** AML § 11-2: grunnskolepliktige har egne, strengere grenser. */
  inCompulsorySchooling?: boolean;
  /** AML § 11-1 tredje ledd: påkrevd for barn under 15 i kunstnerisk arbeid. */
  hasLabourAuthorityPermit?: boolean;
}

export interface WorkTimeAgreement {
  /**
   * AML § 10-8 første ledd åpner for at daglig hvile settes ned fra 11 til
   * minst 8 timer ved skriftlig avtale. Gjelder ikke barn.
   */
  reducedDailyRestAgreed?: boolean;
  /** AML § 10-12 / tariff: utvidede overtidsrammer. */
  collectiveAgreement?: boolean;
}

export type FindingSeverity = "violation" | "warning";

export interface WorkTimeFinding {
  severity: FindingSeverity;
  /** Maskinlesbar kode, stabil på tvers av tekstendringer. */
  code: string;
  /** Paragrafen funnet bygger på. */
  reference: string;
  message: string;
  /** Hvilken vakt/dag funnet gjelder, når det er avgrenset til én. */
  shiftLabel?: string;
}

export interface WorkTimeReport {
  person: string;
  ageAtShoot?: number;
  ruleSet: "adult" | "minor_15_18" | "minor_under_15" | "unknown";
  totalHours: number;
  findings: WorkTimeFinding[];
  violations: number;
  warnings: number;
}

// ── Hjelpere ────────────────────────────────────────────────────────────────

const HOUR_MS = 3_600_000;

export function shiftHours(shift: Shift): number {
  const start = new Date(shift.callTime).getTime();
  const end = new Date(shift.wrapTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  // Pauser regnes ikke som arbeidstid.
  return Math.max((end - start) / HOUR_MS - (shift.breakMinutes ?? 0) / 60, 0);
}

/** Hvile mellom to påfølgende vakter, i timer. */
export function restBetween(previous: Shift, next: Shift): number {
  const end = new Date(previous.wrapTime).getTime();
  const start = new Date(next.callTime).getTime();
  if (!Number.isFinite(end) || !Number.isFinite(start)) return Infinity;
  return (start - end) / HOUR_MS;
}

/**
 * Om vakten berører et klokkeslettvindu (f.eks. nattarbeidsforbudet).
 * Vinduet kan krysse midnatt, som 23:00–06:00 gjør.
 *
 * Klokkeslettene leses på norsk veggklokke, ikke serverens. Loven sier «kl.
 * 20.00», og på en UTC-server ville en wrap kl. 21.30 norsk sommertid blitt
 * lest som 19.30 og sluppet utenom forbudet. Et brudd som forsvinner stille
 * er verre enn et falskt varsel — ingen leter etter et funn som aldri kom.
 */
export function touchesClockWindow(shift: Shift, fromHour: number, toHour: number): boolean {
  const start = new Date(shift.callTime);
  const end = new Date(shift.wrapTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  const inWindow = (h: number) =>
    fromHour <= toHour ? h >= fromHour && h < toHour : h >= fromHour || h < toHour;

  // Gå kvarter for kvarter gjennom vakten. Enkelt, og vakter er timer, ikke år.
  for (let t = start.getTime(); t < end.getTime(); t += HOUR_MS / 4) {
    if (inWindow(osloHour(new Date(t)))) return true;
  }
  // Sluttidspunktet selv teller også, hvis vakten slutter inne i vinduet.
  return inWindow(osloHour(end)) && end.getTime() > start.getTime();
}

function determineRuleSet(person: PersonWorkContext): WorkTimeReport["ruleSet"] {
  if (person.ageAtShoot === undefined || person.ageAtShoot === null) return "unknown";
  if (person.ageAtShoot >= 18) return "adult";
  if (person.ageAtShoot < 15 || person.inCompulsorySchooling) return "minor_under_15";
  return "minor_15_18";
}

// ── Regelmotor ──────────────────────────────────────────────────────────────

/**
 * Vurderer én persons vakter. Vaktene sorteres etter starttid, fordi
 * hviletidsreglene handler om rekkefølge og en usortert liste ville gitt
 * negative hvileperioder.
 */
export function evaluateWorkTime(
  person: PersonWorkContext,
  shifts: Shift[],
  agreement: WorkTimeAgreement = {},
): WorkTimeReport {
  const ordered = [...shifts].sort(
    (a, b) => new Date(a.callTime).getTime() - new Date(b.callTime).getTime(),
  );
  const ruleSet = determineRuleSet(person);
  const findings: WorkTimeFinding[] = [];
  const totalHours = ordered.reduce((sum, s) => sum + shiftHours(s), 0);

  if (ruleSet === "unknown") {
    findings.push({
      severity: "warning",
      code: "age_unknown",
      reference: "AML kap. 11",
      message:
        `Fødselsdato mangler for ${person.name}. Er personen under 18 gjelder strengere ` +
        `grenser for arbeidstid, nattarbeid og hvile — sjekken kan ikke bekrefte at de er oppfylt.`,
    });
  }

  for (const shift of ordered) {
    const hours = shiftHours(shift);
    const label = shift.label ?? new Date(shift.callTime).toISOString().slice(0, 10);

    if (ruleSet === "adult" || ruleSet === "unknown") {
      evaluateAdultShift(shift, hours, label, findings);
    } else {
      evaluateMinorShift(person, ruleSet, shift, hours, label, findings);
    }

    // Pausekravet gjelder alle. AML § 10-9 første ledd.
    if (hours + (shift.breakMinutes ?? 0) / 60 > 5.5 && (shift.breakMinutes ?? 0) < 30) {
      findings.push({
        severity: "violation",
        code: "break_missing",
        reference: "AML § 10-9 første ledd",
        message:
          `Vakt på over 5,5 time krever pause. Registrert pause: ${shift.breakMinutes ?? 0} min ` +
          `(minst 30 min kreves når arbeidstiden overstiger 5,5 time).`,
        shiftLabel: label,
      });
    }
  }

  // Hvile mellom vakter.
  for (let i = 1; i < ordered.length; i++) {
    const rest = restBetween(ordered[i - 1], ordered[i]);
    const label = ordered[i].label ?? new Date(ordered[i].callTime).toISOString().slice(0, 10);

    let required: number;
    let reference: string;
    if (ruleSet === "minor_under_15") {
      required = 14;
      reference = "AML § 11-5 andre ledd";
    } else if (ruleSet === "minor_15_18") {
      required = 12;
      reference = "AML § 11-5 første ledd";
    } else {
      // Kan settes ned til 8 timer ved skriftlig avtale — men ikke for barn.
      required = agreement.reducedDailyRestAgreed ? 8 : 11;
      reference = agreement.reducedDailyRestAgreed
        ? "AML § 10-8 første ledd (redusert ved skriftlig avtale)"
        : "AML § 10-8 første ledd";
    }

    if (rest < required) {
      findings.push({
        severity: "violation",
        code: "daily_rest_short",
        reference,
        message:
          `Bare ${rest.toFixed(1)} timer hvile før denne vakten. Kravet er ${required} timer ` +
          `sammenhengende arbeidsfri i løpet av 24 timer.`,
        shiftLabel: label,
      });
    } else if (rest < required + 1) {
      findings.push({
        severity: "warning",
        code: "daily_rest_tight",
        reference,
        message: `${rest.toFixed(1)} timer hvile — like over kravet på ${required}. Forsinket wrap gir brudd.`,
        shiftLabel: label,
      });
    }
  }

  // Ukentlig ramme. AML § 10-6 åttende ledd for voksne, § 11-2 for barn.
  evaluateWeeklyTotals(ruleSet, ordered, findings);

  // Tillatelse fra Arbeidstilsynet for barn under 15.
  if (ruleSet === "minor_under_15" && person.hasLabourAuthorityPermit !== true) {
    findings.push({
      severity: person.hasLabourAuthorityPermit === false ? "violation" : "warning",
      code: "labour_authority_permit_missing",
      reference: "AML § 11-1 tredje ledd",
      message:
        person.hasLabourAuthorityPermit === false
          ? `Barn under 15 i kunstnerisk arbeid krever tillatelse fra Arbeidstilsynet. Ingen tillatelse er registrert.`
          : `Er ${person.name} under 15 kreves tillatelse fra Arbeidstilsynet for kulturelt/kunstnerisk arbeid. Ingen referanse er registrert.`,
    });
  }

  return {
    person: person.name,
    ageAtShoot: person.ageAtShoot,
    ruleSet,
    totalHours: Math.round(totalHours * 100) / 100,
    findings,
    violations: findings.filter((f) => f.severity === "violation").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
  };
}

function evaluateAdultShift(
  shift: Shift,
  hours: number,
  label: string,
  findings: WorkTimeFinding[],
): void {
  // AML § 10-6 åttende ledd: samlet arbeidstid maks 13 timer i løpet av 24 timer.
  if (hours > 13) {
    findings.push({
      severity: "violation",
      code: "daily_max_exceeded",
      reference: "AML § 10-6 åttende ledd",
      message: `${hours.toFixed(1)} timers arbeidsdag. Samlet arbeidstid kan ikke overstige 13 timer i løpet av 24 timer.`,
      shiftLabel: label,
    });
  } else if (hours > 12) {
    findings.push({
      severity: "warning",
      code: "daily_max_near",
      reference: "AML § 10-6 åttende ledd",
      message: `${hours.toFixed(1)} timer — under én time igjen til taket på 13. Forsinket wrap gir brudd.`,
      shiftLabel: label,
    });
  }

  // AML § 10-4 første ledd: alminnelig arbeidstid 9 timer per døgn. Alt over
  // er overtid, som krever særlig og tidsavgrenset behov (§ 10-6 første ledd).
  if (hours > 9) {
    findings.push({
      severity: "warning",
      code: "overtime",
      reference: "AML § 10-4 første ledd, jf. § 10-6 første ledd",
      message:
        `${(hours - 9).toFixed(1)} timer overtid. Overtid krever «særlig og tidsavgrenset behov» ` +
        `og skal ikke være en fast ordning.`,
      shiftLabel: label,
    });
  }
}

function evaluateMinorShift(
  person: PersonWorkContext,
  ruleSet: "minor_under_15" | "minor_15_18",
  shift: Shift,
  hours: number,
  label: string,
  findings: WorkTimeFinding[],
): void {
  if (ruleSet === "minor_under_15") {
    // AML § 11-2 andre ledd: 2 timer på skoledager, 7 timer på skolefrie dager.
    const limit = shift.isSchoolDay ? 2 : 7;
    if (hours > limit) {
      findings.push({
        severity: "violation",
        code: "minor_daily_max_exceeded",
        reference: "AML § 11-2 andre ledd",
        message:
          `${hours.toFixed(1)} timer for ${person.name}. Grunnskolepliktige kan arbeide maks ` +
          `${limit} timer på ${shift.isSchoolDay ? "skoledager" : "skolefrie dager"}.`,
        shiftLabel: label,
      });
    }
    // AML § 11-3: ikke arbeid mellom 20:00 og 06:00.
    if (touchesClockWindow(shift, 20, 6)) {
      findings.push({
        severity: "violation",
        code: "minor_night_work",
        reference: "AML § 11-3 andre ledd",
        message: `Vakten berører tidsrommet 20:00–06:00. Grunnskolepliktige kan ikke arbeide om natten.`,
        shiftLabel: label,
      });
    }
  } else {
    // AML § 11-2 tredje ledd: 8 timer per dag for 15–18 utenfor grunnskolen.
    if (hours > 8) {
      findings.push({
        severity: "violation",
        code: "minor_daily_max_exceeded",
        reference: "AML § 11-2 tredje ledd",
        message: `${hours.toFixed(1)} timer for ${person.name} (under 18). Grensen er 8 timer per dag.`,
        shiftLabel: label,
      });
    }
    // AML § 11-3 første ledd: ikke arbeid mellom 23:00 og 06:00.
    if (touchesClockWindow(shift, 23, 6)) {
      findings.push({
        severity: "violation",
        code: "minor_night_work",
        reference: "AML § 11-3 første ledd",
        message: `Vakten berører tidsrommet 23:00–06:00. Personer under 18 kan ikke arbeide om natten.`,
        shiftLabel: label,
      });
    }
  }
}

/** Grupperer vakter i ISO-uker og sjekker ukerammen. */
function evaluateWeeklyTotals(
  ruleSet: WorkTimeReport["ruleSet"],
  shifts: Shift[],
  findings: WorkTimeFinding[],
): void {
  const byWeek = new Map<string, { hours: number; schoolWeek: boolean }>();
  for (const shift of shifts) {
    const key = isoWeekKey(new Date(shift.callTime));
    const entry = byWeek.get(key) ?? { hours: 0, schoolWeek: false };
    entry.hours += shiftHours(shift);
    if (shift.isSchoolDay) entry.schoolWeek = true;
    byWeek.set(key, entry);
  }

  for (const [week, entry] of byWeek) {
    let limit: number;
    let reference: string;
    if (ruleSet === "minor_under_15") {
      limit = entry.schoolWeek ? 12 : 35;
      reference = "AML § 11-2 andre ledd";
    } else if (ruleSet === "minor_15_18") {
      limit = 40;
      reference = "AML § 11-2 tredje ledd";
    } else {
      // Samlet arbeidstid maks 48 timer per sju dager (§ 10-6 åttende ledd).
      limit = 48;
      reference = "AML § 10-6 åttende ledd";
    }

    if (entry.hours > limit) {
      findings.push({
        severity: "violation",
        code: "weekly_max_exceeded",
        reference,
        message:
          `${entry.hours.toFixed(1)} timer i uke ${week}. Grensen er ${limit} timer` +
          (ruleSet === "minor_under_15" ? ` i ${entry.schoolWeek ? "skoleuker" : "skolefrie uker"}` : "") +
          `.`,
        shiftLabel: `uke ${week}`,
      });
    }
  }
}

/** ISO-8601-ukenummer. Norsk kalender bruker mandag som ukestart. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Torsdag i samme uke avgjør hvilket år uken tilhører.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}

/** Alder på en gitt dato — ikke i dag. Grensene i kap. 11 avhenger av dette. */
export function ageOn(birthDate: string | Date, onDate: string | Date): number {
  const b = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  const d = typeof onDate === "string" ? new Date(onDate) : onDate;
  let age = d.getFullYear() - b.getFullYear();
  const monthDiff = d.getMonth() - b.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && d.getDate() < b.getDate())) age -= 1;
  return age;
}
