/**
 * role-room-work-time-service.ts
 *
 * Kobler vaktene i basen til AML-regelmotoren (Del A punkt 74 og 80).
 *
 * Regelmotoren er bevisst ren og uten databasekjennskap, slik at reglene kan
 * testes uten oppsett. Denne modulen henter data og oversetter.
 */

import type { Pool } from "pg";
import {
  ageOn,
  evaluateWorkTime,
  type Shift,
  type WorkTimeAgreement,
  type WorkTimeReport,
} from "./role-room-work-time-rules.js";

export interface ProjectWorkTimeReport {
  projectId: string;
  people: WorkTimeReport[];
  totalViolations: number;
  totalWarnings: number;
  /** Personer med minst ett brudd — lista produsenten må gjøre noe med. */
  peopleWithViolations: string[];
  disclaimer: string;
}

const DISCLAIMER =
  "Beslutningsstøtte, ikke juridisk rådgivning. Tariffavtale kan utvide flere av grensene " +
  "(AML § 10-12), og sjekken kjenner ikke innholdet i deres avtaler. Funn med henvisning " +
  "til AML kap. 11 gjelder personer under 18 og bør alltid kvalitetssikres manuelt.";

/**
 * Kjører sjekken for alle som har vakter på prosjektet.
 *
 * Faktisk sluttidspunkt vinner over planlagt der det er registrert — det er
 * forskjellen mellom «vi planla en lovlig dag» og «vi hadde en lovlig dag»,
 * og det er den siste tilsynet spør om.
 */
export async function evaluateProjectWorkTime(
  pool: Pool,
  projectId: string,
  agreement: WorkTimeAgreement = {},
): Promise<ProjectWorkTimeReport> {
  const rows = await pool.query(
    `SELECT s.person_type, s.person_id, s.call_time, s.wrap_time, s.actual_wrap_time,
            s.break_minutes, s.notes,
            COALESCE(s.person_name, cand.name, crew.name) AS person_name,
            cand.birth_date              AS candidate_birth_date,
            crew.birth_date              AS crew_birth_date,
            cand.in_compulsory_schooling AS in_compulsory_schooling,
            cand.labour_authority_permit_ref AS permit_ref,
            d.date                       AS production_date
       FROM role_room_work_shifts s
       LEFT JOIN casting_candidates cand
              ON s.person_type = 'candidate' AND cand.id = s.person_id
       LEFT JOIN casting_crew crew
              ON s.person_type = 'crew' AND crew.id = s.person_id
       LEFT JOIN casting_production_days d ON d.id = s.production_day_id
      WHERE s.project_id = $1
      ORDER BY s.person_type, s.person_id, s.call_time`,
    [projectId],
  );

  // Grupper per person. Hviletidsreglene handler om én persons vakter i
  // rekkefølge, ikke om dagen som helhet.
  const byPerson = new Map<
    string,
    { context: Parameters<typeof evaluateWorkTime>[0]; shifts: Shift[] }
  >();

  for (const row of rows.rows as Array<Record<string, unknown>>) {
    const key = `${row.person_type}:${row.person_id}`;
    const callTime = toIso(row.call_time);
    // Faktisk slutt vinner der den finnes.
    const wrapTime = toIso(row.actual_wrap_time ?? row.wrap_time);
    const birthDate = (row.candidate_birth_date ?? row.crew_birth_date) as Date | string | null;

    if (!byPerson.has(key)) {
      byPerson.set(key, {
        context: {
          name: String(row.person_name ?? key),
          // Alderen regnes på opptaksdagen — en 14-åring som fyller 15 midt i
          // innspillingen bytter regelsett underveis.
          ageAtShoot: birthDate ? ageOn(birthDate as string, callTime) : undefined,
          inCompulsorySchooling:
            row.in_compulsory_schooling === null || row.in_compulsory_schooling === undefined
              ? undefined
              : Boolean(row.in_compulsory_schooling),
          hasLabourAuthorityPermit: row.permit_ref ? true : undefined,
        },
        shifts: [],
      });
    }

    byPerson.get(key)!.shifts.push({
      callTime,
      wrapTime,
      breakMinutes: Number(row.break_minutes ?? 0),
      isSchoolDay: isSchoolDay(row.production_date ?? row.call_time),
      label: toIso(row.call_time).slice(0, 10),
    });
  }

  const people = [...byPerson.values()].map((entry) =>
    evaluateWorkTime(entry.context, entry.shifts, agreement),
  );

  return {
    projectId,
    people,
    totalViolations: people.reduce((sum, p) => sum + p.violations, 0),
    totalWarnings: people.reduce((sum, p) => sum + p.warnings, 0),
    peopleWithViolations: people.filter((p) => p.violations > 0).map((p) => p.person),
    disclaimer: DISCLAIMER,
  };
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

/**
 * Grov skoledag-heuristikk: mandag–fredag utenom fellesferien i juli.
 *
 * Bevisst grov, og bevisst konservativ — den slår ut som skoledag oftere enn
 * den strengt tatt burde, fordi et falskt varsel koster en oppklaring mens en
 * oversett skoledag koster et lovbrudd. Faktiske skoleruter varierer per
 * kommune, og bør overstyres per produksjonsdag når produksjonen vet bedre.
 */
export function isSchoolDay(value: unknown): boolean {
  const d = value instanceof Date ? value : new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return false;
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  // Juli er fellesferie i norsk grunnskole.
  if (d.getMonth() === 6) return false;
  return true;
}
