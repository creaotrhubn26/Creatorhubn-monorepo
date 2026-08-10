/**
 * role-room-work-shift-service.ts
 *
 * Skriver vaktene AML-sjekken leser (Del A punkt 74 og 80).
 *
 * `role_room_work_shifts` ble opprettet i migrering 0456, men ingenting fylte
 * den. Konsekvensen er verre enn en manglende funksjon: `rr_work_time_check`
 * svarte «0 brudd» på ethvert prosjekt, fordi det ikke fantes en eneste vakt å
 * regne på. Et etterlevelsesverktøy som er grønt av mangel på data er
 * farligere enn et som ikke finnes — det andre leter man opp, det første
 * stoler man på.
 *
 * Inngangen er opptaksdagen, ikke personen. Slik fungerer en call sheet: én
 * innkalling og ett forventet wrap for dagen, med individuelle avvik som
 * unntak. Å be produsenten skrive inn tider per person ville betydd at ingen
 * gjorde det, og da er vi tilbake til tom tabell.
 */

import type { Pool, PoolClient } from "pg";
import { resolveSceneCast } from "./role-room-scene-cast-service.js";
import { osloInstantFrom } from "./role-room-oslo-time.js";

export interface GenerateShiftsInput {
  projectId: string;
  productionDayId: string;
  /**
   * Klokkeslett, «07:00». Utelates det brukes opptaksdagens egen callTime.
   *
   * Produksjonsdagen har allerede innkalling og wrap — produsenten har fylt
   * dem inn i dagsplanen. Å spørre om dem på nytt her ville gjort AML-sjekken
   * til enda et skjema, og skjemaer som gjentar noe man allerede har svart på
   * blir ikke fylt ut.
   */
  callTime?: string;
  /** Klokkeslett, «19:00». Passerer det midnatt regnes det som neste dag. */
  wrapTime?: string;
  breakMinutes?: number;
  /**
   * Erstatt vaktene som allerede finnes på dagen. Uten dette legges bare
   * personer som mangler vakt til, slik at individuelle justeringer overlever
   * en ny generering.
   */
  replace?: boolean;
}

export interface GenerateShiftsResult {
  productionDayId: string;
  date: string;
  created: number;
  kept: number;
  removed: number;
  /** Personer dagen omfatter, men som ikke lot seg identifisere med navn. */
  skipped: string[];
  /** Tidene som faktisk ble brukt — dagens egne med mindre de ble overstyrt. */
  callTime: string;
  wrapTime: string;
  breakMinutes: number;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Overstyring vinner, ellers dagens egen tid. Ugyldig format regnes som fraværende. */
export function pickTime(override: unknown, fromDay: unknown): string | null {
  for (const value of [override, fromDay]) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, 5);
    if (TIME_PATTERN.test(trimmed)) return trimmed;
  }
  return null;
}

interface PersonRef {
  personType: "candidate" | "crew";
  personId: string;
  personName: string | null;
}

/**
 * Setter sammen dato og klokkeslett til et tidspunkt.
 *
 * Klokkeslettet er norsk tid — «innkalling 07:00» betyr 07:00 i Norge,
 * uansett hvilken sone serveren kjører i. Se role-room-oslo-time.ts.
 *
 * Wrap før call betyr at dagen krysser midnatt — vanlig på nattopptak — og
 * skyves da ett døgn fram. Uten det ville en natt fra 18:00 til 02:00 blitt
 * lagret som en negativ vakt, og CHECK-constrainten i 0456 ville avvist den.
 */
export function combineDateAndTime(date: string, time: string, dayOffset = 0): string {
  return osloInstantFrom(date, time, dayOffset).toISOString();
}

/** True når wrap-klokkeslettet ligger før call — altså at dagen krysser midnatt. */
export function crossesMidnight(callTime: string, wrapTime: string): boolean {
  const toMinutes = (t: string) => {
    const [hh, mm] = t.slice(0, 5).split(":").map(Number);
    return hh * 60 + mm;
  };
  return toMinutes(wrapTime) <= toMinutes(callTime);
}

/**
 * Hvem er på jobb denne dagen.
 *
 * Crew leses fra dagens `crew_ids`. Cast utledes fra scenene som er lagt til
 * dagen, via scene → karakter → rolle → tildelt kandidat. En kandidat som
 * spiller i flere av dagens scener skal ha én vakt, ikke fem — derfor
 * dedupliseres det på person.
 */
export async function resolvePeopleOnDay(
  pool: Pool,
  projectId: string,
  day: { sceneIds: string[]; crewIds: string[] },
): Promise<{ people: PersonRef[]; skipped: string[] }> {
  const byKey = new Map<string, PersonRef>();
  const skipped: string[] = [];

  if (day.crewIds.length > 0) {
    const crew = await pool.query(
      `SELECT id, name FROM casting_crew WHERE project_id = $1 AND id = ANY($2::varchar[])`,
      [projectId, day.crewIds],
    );
    for (const row of crew.rows as Array<Record<string, unknown>>) {
      byKey.set(`crew:${row.id}`, {
        personType: "crew",
        personId: String(row.id),
        personName: (row.name as string) ?? null,
      });
    }
    // Crew-id-er på dagen som ikke finnes i tabellen — som regel slettede
    // rader. Rapporteres framfor å forsvinne stille.
    const found = new Set((crew.rows as Array<Record<string, unknown>>).map((r) => String(r.id)));
    for (const id of day.crewIds) if (!found.has(id)) skipped.push(`crew:${id}`);
  }

  if (day.sceneIds.length > 0) {
    const sceneSet = new Set(day.sceneIds);
    const { scenes } = await resolveSceneCast(pool, projectId);
    for (const scene of scenes) {
      if (!sceneSet.has(scene.sceneId)) continue;
      for (const entry of scene.cast) {
        if (!entry.candidateId) continue;
        byKey.set(`candidate:${entry.candidateId}`, {
          personType: "candidate",
          personId: entry.candidateId,
          personName: entry.candidateName ?? null,
        });
      }
    }
  }

  return { people: [...byKey.values()], skipped };
}

/**
 * Genererer vakter for alle på en opptaksdag.
 *
 * Kjøres i transaksjon fordi delvis genererte vakter er verre enn ingen: et
 * halvt dekket døgn gir en AML-rapport som ser fullstendig ut uten å være det.
 */
export async function generateShiftsForDay(
  pool: Pool,
  input: GenerateShiftsInput,
): Promise<GenerateShiftsResult> {
  const dayRes = await pool.query(
    `SELECT id, project_id, date::text AS date, scene_ids, crew_ids,
            data->>'callTime'     AS day_call_time,
            data->>'wrapTime'     AS day_wrap_time,
            data->>'breakMinutes' AS day_break_minutes
       FROM casting_production_days WHERE id = $1 AND project_id = $2 LIMIT 1`,
    [input.productionDayId, input.projectId],
  );
  if (dayRes.rowCount === 0) {
    const err = new Error("Fant ikke opptaksdagen.");
    (err as { code?: string }).code = "day_not_found";
    throw err;
  }
  const day = dayRes.rows[0] as Record<string, unknown>;
  const date = String(day.date);

  // Dagens egne tider vinner når kalleren ikke overstyrer dem.
  const callTime = pickTime(input.callTime, day.day_call_time);
  const wrapTime = pickTime(input.wrapTime, day.day_wrap_time);
  if (!callTime || !wrapTime) {
    const err = new Error("Opptaksdagen mangler innkalling eller wrap.");
    (err as { code?: string }).code = "day_times_missing";
    throw err;
  }

  const sceneIds = asStringArray(day.scene_ids);
  const crewIds = asStringArray(day.crew_ids);
  const { people, skipped } = await resolvePeopleOnDay(pool, input.projectId, { sceneIds, crewIds });

  const callAt = combineDateAndTime(date, callTime);
  const wrapAt = combineDateAndTime(date, wrapTime, crossesMidnight(callTime, wrapTime) ? 1 : 0);
  const breakMinutes = Math.max(
    0,
    Math.trunc(input.breakMinutes ?? Number(day.day_break_minutes ?? 0) ?? 0),
  );

  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    let removed = 0;
    if (input.replace) {
      const del = await client.query(
        `DELETE FROM role_room_work_shifts WHERE production_day_id = $1`,
        [input.productionDayId],
      );
      removed = del.rowCount ?? 0;
    }

    const existing = await client.query<{ person_type: string; person_id: string }>(
      `SELECT person_type, person_id FROM role_room_work_shifts WHERE production_day_id = $1`,
      [input.productionDayId],
    );
    const have = new Set(existing.rows.map((r) => `${r.person_type}:${r.person_id}`));

    let created = 0;
    let kept = 0;
    for (const person of people) {
      if (have.has(`${person.personType}:${person.personId}`)) {
        // Individuelle justeringer overlever en ny generering.
        kept += 1;
        continue;
      }
      await client.query(
        `INSERT INTO role_room_work_shifts
           (project_id, production_day_id, person_type, person_id, person_name,
            call_time, wrap_time, break_minutes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          input.projectId, input.productionDayId, person.personType, person.personId,
          person.personName, callAt, wrapAt, breakMinutes,
        ],
      );
      created += 1;
    }

    await client.query("COMMIT");
    return {
      productionDayId: input.productionDayId, date, created, kept, removed, skipped,
      callTime, wrapTime, breakMinutes,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export interface WorkShiftRow {
  id: string;
  productionDayId: string | null;
  date: string | null;
  personType: string;
  personId: string;
  personName: string | null;
  callTime: string;
  wrapTime: string;
  actualWrapTime: string | null;
  breakMinutes: number;
  notes: string | null;
}

export async function listShifts(pool: Pool, projectId: string): Promise<WorkShiftRow[]> {
  const r = await pool.query(
    `SELECT s.id, s.production_day_id, d.date::text AS date, s.person_type, s.person_id,
            COALESCE(s.person_name, cand.name, crew.name) AS person_name,
            s.call_time, s.wrap_time, s.actual_wrap_time, s.break_minutes, s.notes
       FROM role_room_work_shifts s
       LEFT JOIN casting_production_days d ON d.id = s.production_day_id
       LEFT JOIN casting_candidates cand ON s.person_type = 'candidate' AND cand.id = s.person_id
       LEFT JOIN casting_crew crew ON s.person_type = 'crew' AND crew.id = s.person_id
      WHERE s.project_id = $1
      ORDER BY s.call_time, person_name`,
    [projectId],
  );
  return (r.rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    productionDayId: (row.production_day_id as string) ?? null,
    date: (row.date as string) ?? null,
    personType: String(row.person_type),
    personId: String(row.person_id),
    personName: (row.person_name as string) ?? null,
    callTime: toIso(row.call_time),
    wrapTime: toIso(row.wrap_time),
    actualWrapTime: row.actual_wrap_time ? toIso(row.actual_wrap_time) : null,
    breakMinutes: Number(row.break_minutes ?? 0),
    notes: (row.notes as string) ?? null,
  }));
}

export interface UpdateShiftInput {
  callTime?: string;
  wrapTime?: string;
  actualWrapTime?: string | null;
  breakMinutes?: number;
  notes?: string | null;
}

/**
 * Oppdaterer én vakt.
 *
 * Bare felter som faktisk er oppgitt skrives. En PATCH som setter alt ville
 * nullet ut faktisk wrap-tid hver gang noen justerte pausen — og faktisk
 * wrap er det feltet hele overtidsvarselet hviler på.
 */
export async function updateShift(
  pool: Pool,
  shiftId: string,
  input: UpdateShiftInput,
): Promise<WorkShiftRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (input.callTime !== undefined) push("call_time", input.callTime);
  if (input.wrapTime !== undefined) push("wrap_time", input.wrapTime);
  if (input.actualWrapTime !== undefined) push("actual_wrap_time", input.actualWrapTime);
  if (input.breakMinutes !== undefined) push("break_minutes", Math.max(0, Math.trunc(input.breakMinutes)));
  if (input.notes !== undefined) push("notes", input.notes);
  if (sets.length === 0) return null;

  params.push(shiftId);
  const r = await pool.query(
    `UPDATE role_room_work_shifts SET ${sets.join(", ")}, updated_at = now()
      WHERE id = $${params.length} RETURNING project_id`,
    params,
  );
  if (r.rowCount === 0) return null;

  const all = await listShifts(pool, String((r.rows[0] as Record<string, unknown>).project_id));
  return all.find((s) => s.id === shiftId) ?? null;
}

export async function deleteShift(pool: Pool, shiftId: string): Promise<boolean> {
  const r = await pool.query(`DELETE FROM role_room_work_shifts WHERE id = $1`, [shiftId]);
  return (r.rowCount ?? 0) > 0;
}

/** Prosjektet en vakt hører til — for tilgangssjekk på id-oppslag. */
export async function getShiftProject(pool: Pool, shiftId: string): Promise<string | null> {
  const r = await pool.query<{ project_id: string }>(
    `SELECT project_id FROM role_room_work_shifts WHERE id = $1 LIMIT 1`,
    [shiftId],
  );
  return r.rowCount === 0 ? null : r.rows[0].project_id;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

/** `scene_ids`/`crew_ids` er JSONB — kan komme som array eller som streng. */
export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}
